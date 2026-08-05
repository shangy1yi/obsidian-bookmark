import { displayUrl, normalizeText } from '../../shared/text.js'
import { isExternallyCheckableUrl } from '../../shared/sensitive-url.js'
import type {
  AvailabilityResult,
  BookmarkRecord,
  NavigationAttempt,
  NavigationEvidence,
  NavigationNetworkEvidence,
  ProbeKind,
  ProbeResult
} from '../../shared/types.js'
import type { AvailabilityProbeResult } from '../../shared/messages.js'

export const FETCH_TIMEOUT_MS = 20000

const RETRYABLE_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_ABORTED',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_TIMED_OUT'
])

const STRONG_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_TIMED_OUT',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_ADDRESS_UNREACHABLE',
  'net::ERR_DNS_MALFORMED_RESPONSE',
  'net::ERR_DNS_SERVER_FAILED',
  'net::ERR_DNS_TIMED_OUT',
  'net::ERR_SSL_PROTOCOL_ERROR',
  'net::ERR_CERT_AUTHORITY_INVALID',
  'net::ERR_CERT_COMMON_NAME_INVALID',
  'net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH'
])

const CLIENT_BLOCKING_NAVIGATION_ERRORS = new Set([
  'net::ERR_BLOCKED_BY_CLIENT',
  'runtime-message-failed',
  'tab-update-failed',
  'tab-removed'
])

const AMBIGUOUS_NAVIGATION_ERRORS = new Set([
  'net::ERR_ABORTED'
])

const UNVERIFIED_AVAILABILITY_ERROR_CODES = new Set([
  'permission-missing',
  'private-network-endpoint',
  'sensitive-redirect',
  'sensitive-url',
  'ungranted-redirect',
  'unsupported-address-space',
  'unsupported-dns-boundary',
  'unverified-network-endpoint'
])

const TIMEOUT_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_TIMED_OUT',
  'net::ERR_CONNECTION_TIMED_OUT'
])

const RESTRICTED_STATUS_CODES = new Set([401, 403, 407, 429, 451])
const MISSING_STATUS_CODES = new Set([404, 410])
const TEMPORARY_STATUS_CODES = new Set([408, 500, 502, 503, 504, 522, 523, 524])

export function buildNavigationSuccess(
  bookmark: BookmarkRecord,
  navigationResult: NavigationAttempt,
  label: string
): AvailabilityResult {
  const finalUrl = navigationResult.finalUrl || bookmark.url
  const redirected = isRedirectedNavigation(bookmark.url, finalUrl)

  return {
    ...bookmark,
    status: redirected ? 'redirected' : 'available',
    badgeText: redirected ? '后台跳转成功' : '后台导航成功',
    finalUrl,
    detail: redirected
      ? `${label}，最终打开 ${displayUrl(finalUrl)}`
      : `${label}，后台标签页完成页面导航。`
  }
}

export function buildFailureClassification(
  bookmark: BookmarkRecord,
  attempts: NavigationAttempt[],
  probe: ProbeResult | null,
  probeEnabled: boolean
): AvailabilityResult {
  const successfulNavigation = attempts
    .slice()
    .reverse()
    .find(shouldAcceptNavigationSuccess)
  if (successfulNavigation) {
    return buildNavigationSuccess(
      bookmark,
      successfulNavigation,
      attempts.length > 1 ? '重试后台导航成功' : '首轮后台导航成功'
    )
  }

  const baseResult = {
    ...bookmark,
    finalUrl: attempts.at(-1)?.finalUrl || bookmark.url
  }
  const navigationEvidence = summarizeNavigationEvidence(attempts)
  const navigationSummary = formatNavigationAttemptSummary(attempts)
  const requestProbe = classifyNavigationNetworkEvidenceFromAttempts(attempts)
  const effectiveProbe = chooseEffectiveProbe(probe, requestProbe)
  const effectiveProbeEnabled = probeEnabled || Boolean(effectiveProbe)
  const unverifiedAttempt = attempts.find((attempt) => {
    return isUnverifiedAvailabilityErrorCode(attempt.errorCode)
  })
  const unverifiedProbe = isUnverifiedAvailabilityErrorCode(probe?.errorCode)

  if (
    probe?.kind === 'ok' &&
    !probe.errorCode &&
    hasOnlyClientBlockingNavigationErrors(attempts)
  ) {
    const finalUrl = probe.finalUrl || bookmark.url
    const redirected = Boolean(probe.redirected) ||
      isRedirectedNavigation(bookmark.url, finalUrl)
    return {
      ...baseResult,
      finalUrl,
      status: redirected ? 'redirected' : 'available',
      badgeText: redirected ? '网络校验跳转' : '网络校验可访问',
      detail: joinEvidenceDetail(
        navigationSummary,
        probe.detail,
        '后台标签页受本地扩展或浏览器规则拦截；独立网络校验已确认目标可达'
      )
    }
  }

  if (unverifiedAttempt || unverifiedProbe) {
    const errorCode = String(unverifiedAttempt?.errorCode || probe?.errorCode)
    return {
      ...baseResult,
      finalUrl: unverifiedAttempt?.finalUrl || probe?.finalUrl || baseResult.finalUrl,
      status: 'review',
      badgeText: getUnverifiedAvailabilityBadge(errorCode),
      errorCode,
      detail: joinEvidenceDetail(
        navigationSummary,
        formatNavigationNetworkEvidence(unverifiedAttempt?.networkEvidence),
        probe?.detail,
        getUnverifiedAvailabilityDetail(errorCode)
      )
    }
  }

  if (!effectiveProbeEnabled || !effectiveProbe) {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        '未获得目标网站授权或未取得网络校验证据，暂归为低置信异常，不建议直接删除'
      )
    }
  }

  if (effectiveProbe.kind === 'ok') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回可访问，站点可能仍可用；暂归为低置信异常，建议人工确认`
      )
    }
  }

  if (effectiveProbe.kind === 'restricted') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '受限/低置信',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回 ${effectiveProbe.label}，站点可能需要登录、地区许可或反爬验证；暂归为低置信异常`
      )
    }
  }

  if (effectiveProbe.kind === 'temporary') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '临时异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测(${effectiveProbe.method})返回 ${effectiveProbe.label}，更像临时服务异常，不建议直接删除`
      )
    }
  }

  if (effectiveProbe.kind === 'missing') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '资源不存在·待确认',
      detail: joinEvidenceDetail(
        navigationSummary,
        `匿名网络探测(${effectiveProbe.method})返回 ${effectiveProbe.label}；私有资源和登录后内容也可能用 404/410 隐藏访问状态，需由你确认后再移入异常`
      )
    }
  }

  if (effectiveProbe.kind === 'network') {
    if (
      effectiveProbe.method !== '主请求' &&
      shouldClassifyAsHighConfidence(navigationEvidence, effectiveProbe.kind)
    ) {
      return {
        ...baseResult,
        status: 'failed',
        badgeText: '高置信异常',
        detail: joinEvidenceDetail(
          navigationSummary,
          `网络探测也失败：${stripEvidencePunctuation(effectiveProbe.detail)}，多层结果都指向连接层故障，已按高置信异常归类`
        )
      }
    }

    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `网络探测也失败：${stripEvidencePunctuation(effectiveProbe.detail)}，证据仍不足以直接删除，暂归为低置信异常`
      )
    }
  }

  if (effectiveProbe.kind === 'unknown') {
    if (
      effectiveProbe.method !== '主请求' &&
      shouldClassifyAsHighConfidence(navigationEvidence, effectiveProbe.kind)
    ) {
      return {
        ...baseResult,
        status: 'failed',
        badgeText: '高置信异常',
        detail: joinEvidenceDetail(
          navigationSummary,
          `${stripEvidencePunctuation(effectiveProbe.detail)}，且后台导航连续给出强失败信号，已按高置信异常归类`
        )
      }
    }

    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: joinEvidenceDetail(
        navigationSummary,
        `${stripEvidencePunctuation(effectiveProbe.detail)}；证据仍不足以直接删除，暂归为低置信异常`
      )
    }
  }

  return {
    ...baseResult,
    status: 'review',
    badgeText: '低置信异常',
    detail: joinEvidenceDetail(
      navigationSummary,
      `${stripEvidencePunctuation(effectiveProbe.detail)}；暂归为低置信异常，建议人工确认`
    )
  }
}

function formatNavigationAttemptSummary(attempts: NavigationAttempt[]): string {
  return attempts
    .map((attempt, index) => {
      const label = index === 0 ? '首轮' : '重试'
      const detail = stripEvidencePunctuation(attempt.detail || '后台导航未返回明确结果')
      return `${label}：${detail}`
    })
    .join('；')
}

function joinEvidenceDetail(...fragments: string[]): string {
  const normalized = fragments.flatMap(fragment => { const mappedResult = stripEvidencePunctuation(fragment); return mappedResult ? [mappedResult] : [] })

  return normalized.length ? `${normalized.join('。')}。` : ''
}

function stripEvidencePunctuation(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[。！？.!?]+$/g, '')
}

function chooseEffectiveProbe(
  probe: ProbeResult | null,
  requestProbe: ProbeResult | null
): ProbeResult | null {
  if (!probe) {
    return requestProbe
  }

  if (!requestProbe) {
    return probe
  }

  if (['missing', 'restricted', 'temporary'].includes(requestProbe.kind)) {
    return requestProbe
  }

  if (probe.kind === 'unknown' || probe.kind === 'network') {
    return requestProbe.kind === 'unknown' || requestProbe.kind === 'network'
      ? probe
      : requestProbe
  }

  return probe
}

export function shouldRetryNavigation(result: NavigationAttempt | null | undefined): boolean {
  if (!result || result.status === 'available') {
    return false
  }

  return RETRYABLE_NAVIGATION_ERRORS.has(result.errorCode)
}

export function shouldAcceptNavigationSuccess(result: NavigationAttempt | null | undefined): boolean {
  if (!result || result.status !== 'available' || result.errorCode) {
    return false
  }

  const evidence = result.networkEvidence
  const statusCode = Number(evidence?.statusCode) || 0
  if (evidence && isUnverifiedRedirectEvidence(evidence)) {
    return false
  }

  if (evidence?.errorCode || statusCode >= 400) {
    return false
  }

  if (statusCode > 0) {
    return statusCode < 400
  }

  return isHttpNavigationUrl(result.finalUrl)
}

export function getSafeSameOriginRedirectUrl(
  sourceUrl: unknown,
  attempt: NavigationAttempt | null | undefined
): string {
  if (!attempt || attempt.errorCode !== 'ungranted-redirect') {
    return ''
  }

  try {
    const source = new URL(String(sourceUrl || '').trim())
    const target = new URL(String(attempt.finalUrl || '').trim())
    if (
      !/^https?:$/i.test(target.protocol) ||
      source.origin !== target.origin ||
      normalizeNavigationUrl(source.href) === normalizeNavigationUrl(target.href) ||
      !isExternallyCheckableUrl(target.href)
    ) {
      return ''
    }
    return target.href
  } catch {
    return ''
  }
}

function summarizeNavigationEvidence(attempts: NavigationAttempt[]): NavigationEvidence {
  const errorCodes = attempts.flatMap(attempt => { const mappedResult = String(attempt?.errorCode || '').trim(); return mappedResult ? [mappedResult] : [] })

  const strongFailures = errorCodes.filter((errorCode) => {
    return STRONG_NAVIGATION_ERRORS.has(errorCode)
  }).length

  return {
    errorCodes,
    strongFailures,
    repeatedStrongFailure:
      errorCodes.length >= 2 &&
      new Set(errorCodes).size === 1 &&
      STRONG_NAVIGATION_ERRORS.has(errorCodes[0]),
    onlyTimeoutErrors:
      errorCodes.length > 0 &&
      errorCodes.every((errorCode) => TIMEOUT_NAVIGATION_ERRORS.has(errorCode)),
    hasClientBlockingError: errorCodes.some((errorCode) => {
      return CLIENT_BLOCKING_NAVIGATION_ERRORS.has(errorCode)
    }),
    onlyAmbiguousErrors:
      errorCodes.length > 0 &&
      errorCodes.every((errorCode) => AMBIGUOUS_NAVIGATION_ERRORS.has(errorCode))
  }
}

function hasOnlyClientBlockingNavigationErrors(
  attempts: NavigationAttempt[]
): boolean {
  return attempts.length > 0 && attempts.every((attempt) => {
    return CLIENT_BLOCKING_NAVIGATION_ERRORS.has(
      String(attempt.errorCode || '').trim()
    )
  })
}

function shouldClassifyAsHighConfidence(
  navigationEvidence: NavigationEvidence | null | undefined,
  probeKind: ProbeKind | string
): boolean {
  if (
    !navigationEvidence ||
    navigationEvidence.hasClientBlockingError ||
    navigationEvidence.onlyAmbiguousErrors ||
    navigationEvidence.onlyTimeoutErrors
  ) {
    return false
  }

  if (probeKind === 'network') {
    return navigationEvidence.repeatedStrongFailure || navigationEvidence.strongFailures >= 2
  }

  if (probeKind === 'unknown') {
    return navigationEvidence.repeatedStrongFailure && navigationEvidence.strongFailures >= 2
  }

  return false
}

export function shouldFallbackToGet(statusCode: number): boolean {
  return [401, 403, 404, 405, 410, 451, 500, 501, 502, 503, 504].includes(statusCode)
}

export function classifyProbeResponse(
  response: Pick<Response, 'ok' | 'status' | 'redirected' | 'url'>,
  method: string
): ProbeResult {
  const statusCode = response.status || 0
  const label = `HTTP ${statusCode}`

  if (response.ok) {
    return {
      kind: 'ok',
      method,
      label: response.redirected ? '探测可达并发生跳转' : '探测可达',
      detail: response.redirected
        ? `网络探测(${method})可达，且最终跳转到 ${displayUrl(response.url)}。`
        : `网络探测(${method})可达。`
    }
  }

  if (MISSING_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'missing',
      method,
      label,
      detail: `网络探测(${method})返回 ${label}。`
    }
  }

  if (RESTRICTED_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'restricted',
      method,
      label,
      detail: `网络探测(${method})返回 ${label}。`
    }
  }

  if (TEMPORARY_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'temporary',
      method,
      label,
      detail: `网络探测(${method})返回 ${label}。`
    }
  }

  return {
    kind: 'unknown',
    method,
    label,
    detail: `网络探测(${method})返回 ${label}。`
  }
}

export function classifyAvailabilityProbeResult(
  result: AvailabilityProbeResult,
  method: string
): ProbeResult {
  if (result.errorCode) {
    return {
      kind: 'unknown',
      method,
      label: result.status ? `HTTP ${result.status}` : '探测受限',
      detail: result.detail,
      finalUrl: result.finalUrl,
      redirected: result.redirected,
      errorCode: result.errorCode
    }
  }

  return {
    ...classifyProbeResponse({
      ok: result.ok,
      redirected: result.redirected,
      status: result.status,
      url: result.finalUrl
    }, method),
    finalUrl: result.finalUrl,
    redirected: result.redirected
  }
}

export function isUnverifiedAvailabilityErrorCode(value: unknown): boolean {
  return UNVERIFIED_AVAILABILITY_ERROR_CODES.has(String(value || '').trim())
}

export function requireRepeatedFailureEvidence(
  result: AvailabilityResult,
  hasMatchingPreviousEvidence: boolean
): AvailabilityResult {
  if (result.status !== 'failed' || hasMatchingPreviousEvidence) {
    return result
  }

  return {
    ...result,
    status: 'review',
    badgeText: '首次异常·待复核',
    detail: joinEvidenceDetail(
      result.detail,
      '匿名探测可能受登录墙或访问策略影响；首次异常只列入复核，连续检测仍异常后才升级为失效'
    )
  }
}

function getUnverifiedAvailabilityBadge(errorCode: string): string {
  if (errorCode === 'ungranted-redirect') {
    return '待授权重定向'
  }
  if (errorCode === 'sensitive-redirect' || errorCode === 'sensitive-url') {
    return '受保护链接'
  }
  if (errorCode === 'permission-missing') {
    return '站点未授权'
  }
  if (errorCode === 'private-network-endpoint') {
    return '网络边界受限'
  }
  return '探测能力受限'
}

function getUnverifiedAvailabilityDetail(errorCode: string): string {
  if (errorCode === 'ungranted-redirect') {
    return '已在发出下一跳请求前阻断；最终地址尚未验证，可授权后重新测试'
  }
  if (errorCode === 'sensitive-redirect' || errorCode === 'sensitive-url') {
    return '目标属于受保护地址，未继续发出请求；此结果不计入异常历史'
  }
  if (errorCode === 'permission-missing') {
    return '站点权限已缺失，未发出请求；此结果不计入异常历史'
  }
  if (errorCode === 'private-network-endpoint') {
    return '安全探测观察到本机或私网连接端点；本地代理也可能产生这一信号，不能据此判断网站失效，此结果不计入异常历史'
  }
  return '浏览器缺少安全探测边界，未发出请求；此结果不计入异常历史'
}

export async function classifyProbeResponseAndDiscardBody(
  response: Response,
  method: string
): Promise<ProbeResult> {
  const result = classifyProbeResponse(response, method)
  await discardProbeResponseBody(response)
  return result
}

export async function discardProbeResponseBody(
  response: Pick<Response, 'body'>
): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // A locked or already-consumed stream does not change the response evidence.
  }
}

function classifyNavigationNetworkEvidence(
  evidence: NavigationNetworkEvidence | null | undefined
): ProbeResult | null {
  if (!evidence) {
    return null
  }

  const method = '主请求'
  const statusCode = Number(evidence.statusCode) || 0
  const failedBeforeCompletion = Boolean(
    evidence.errorCode && !Number.isFinite(evidence.timing?.completedMs)
  )
  if (isUnverifiedRedirectEvidence(evidence)) {
    return {
      kind: 'unknown',
      method,
      label: '最终响应未确认',
      detail: formatNavigationNetworkEvidence(evidence) || '主请求发生跳转，但未确认最终页面响应。'
    }
  }

  if (failedBeforeCompletion) {
    return {
      kind: 'network',
      method,
      label: '主请求失败',
      detail: formatNavigationNetworkEvidence(evidence) || `主请求失败：${evidence.errorCode}。`
    }
  }

  if (statusCode > 0) {
    return classifyHttpStatusProbe(statusCode, method, formatNavigationNetworkEvidence(evidence))
  }

  if (evidence.errorCode) {
    return {
      kind: 'network',
      method,
      label: '主请求失败',
      detail: formatNavigationNetworkEvidence(evidence) || `主请求失败：${evidence.errorCode}。`
    }
  }

  if (evidence.requestSent) {
    return {
      kind: 'unknown',
      method,
      label: '主请求未完成',
      detail: formatNavigationNetworkEvidence(evidence) || '主请求已发出，但未收到可分类响应。'
    }
  }

  return null
}

function isUnverifiedRedirectEvidence(evidence: NavigationNetworkEvidence): boolean {
  const statusCode = Number(evidence.statusCode) || 0
  return statusCode >= 300 && statusCode < 400 && evidence.finalResponseObserved === false
}

function classifyNavigationNetworkEvidenceFromAttempts(
  attempts: NavigationAttempt[]
): ProbeResult | null {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const probe = classifyNavigationNetworkEvidence(attempts[index]?.networkEvidence)
    if (probe) {
      return probe
    }
  }

  return null
}

function classifyHttpStatusProbe(statusCode: number, method: string, detail: string): ProbeResult {
  const label = `HTTP ${statusCode}`

  if (statusCode >= 200 && statusCode < 400) {
    return {
      kind: 'ok',
      method,
      label,
      detail
    }
  }

  if (MISSING_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'missing',
      method,
      label,
      detail
    }
  }

  if (RESTRICTED_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'restricted',
      method,
      label,
      detail
    }
  }

  if (TEMPORARY_STATUS_CODES.has(statusCode)) {
    return {
      kind: 'temporary',
      method,
      label,
      detail
    }
  }

  return {
    kind: 'unknown',
    method,
    label,
    detail
  }
}

function formatNavigationNetworkEvidence(
  evidence: NavigationNetworkEvidence | null | undefined
): string {
  if (!evidence) {
    return ''
  }

  const fragments = []
  if (evidence.statusCode) {
    fragments.push(`主请求返回 HTTP ${evidence.statusCode}`)
  } else if (evidence.errorCode) {
    fragments.push(`主请求失败：${evidence.errorCode}`)
  } else if (evidence.requestSent) {
    fragments.push('主请求已发出但未收到响应')
  } else {
    fragments.push('主请求未发出')
  }

  if (evidence.redirects?.length) {
    fragments.push(`重定向 ${evidence.redirects.length} 次`)
  }

  if (isUnverifiedRedirectEvidence(evidence)) {
    fragments.push('未确认最终页面响应')
  }

  const responseLatencyMs = evidence.timing?.responseLatencyMs
  const totalMs = evidence.timing?.totalMs
  if (Number.isFinite(responseLatencyMs)) {
    fragments.push(`响应头 ${Math.round(Number(responseLatencyMs))}ms`)
  }

  if (Number.isFinite(totalMs)) {
    fragments.push(`总耗时 ${Math.round(Number(totalMs))}ms`)
  }

  return `${fragments.join('，')}。`
}

export function classifyProbeError(error: unknown): ProbeResult {
  const errorName =
    error && typeof error === 'object'
      ? String((error as { name?: unknown }).name || '')
      : ''
  const rawErrorCode =
    error && typeof error === 'object'
      ? String((error as { code?: unknown }).code || '').trim()
      : ''
  const errorCode = /^[a-z][a-z0-9._:-]*$/i.test(rawErrorCode)
    ? rawErrorCode
    : undefined

  if (errorName === 'AbortError') {
    return {
      kind: 'unknown',
      method: 'GET',
      label: '探测超时',
      detail: `网络探测超时，超过 ${Math.round(FETCH_TIMEOUT_MS / 1000)} 秒仍未返回。`,
      errorCode
    }
  }

  if (error instanceof TypeError) {
    return {
      kind: 'network',
      method: 'GET',
      label: '网络探测失败',
      detail: '网络探测未能建立连接。',
      errorCode
    }
  }

  return {
    kind: 'unknown',
    method: 'GET',
    label: '探测失败',
    detail: error instanceof Error ? error.message : '网络探测失败。',
    errorCode
  }
}

export function isRedirectedNavigation(originalUrl: unknown, finalUrl: unknown): boolean {
  return normalizeNavigationUrl(originalUrl) !== normalizeNavigationUrl(finalUrl)
}

function normalizeNavigationUrl(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || ''))
    parsedUrl.hash = ''
    const protocol = parsedUrl.protocol.toLowerCase()
    const hostname = parsedUrl.hostname.toLowerCase()
    const port = getEffectiveNavigationPort(protocol, parsedUrl.port)
    const pathname = normalizeNavigationPathname(parsedUrl.pathname)
    const search = normalizeNavigationSearch(parsedUrl.search)
    return `${protocol}//${hostname}:${port}${pathname}${search}`
  } catch (error) {
    return normalizeText(String(url || ''))
  }
}

function isHttpNavigationUrl(url: unknown): boolean {
  try {
    return /^https?:$/i.test(new URL(String(url || '')).protocol)
  } catch {
    return false
  }
}

function getEffectiveNavigationPort(protocol: string, explicitPort: string): string {
  if (explicitPort) {
    return explicitPort
  }

  if (protocol === 'http:') {
    return '80'
  }

  if (protocol === 'https:') {
    return '443'
  }

  return ''
}

function normalizeNavigationPathname(pathname: unknown): string {
  const normalizedPath = String(pathname || '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')

  return normalizedPath || '/'
}

function normalizeNavigationSearch(search: string): string {
  if (!search) {
    return ''
  }

  const params = new URLSearchParams(search)
  const normalizedPairs = [...params.entries()]
    .map(([key, value]) => [key, value])
    .sort((left, right) => {
      return left[0].localeCompare(right[0], 'en') || left[1].localeCompare(right[1], 'en')
    })

  if (!normalizedPairs.length) {
    return ''
  }

  const normalizedParams = new URLSearchParams()
  normalizedPairs.forEach(([key, value]) => {
    normalizedParams.append(key, value)
  })
  return `?${normalizedParams.toString()}`
}
