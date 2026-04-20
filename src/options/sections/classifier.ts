// @ts-nocheck
import { displayUrl, normalizeText } from '../../shared/text.js'

export const FETCH_TIMEOUT_MS = 20000

const RETRYABLE_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_ABORTED',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_TIMED_OUT'
])

const HARD_NAVIGATION_ERRORS = new Set([
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_ADDRESS_UNREACHABLE',
  'net::ERR_DNS_MALFORMED_RESPONSE',
  'net::ERR_DNS_SERVER_FAILED',
  'net::ERR_DNS_TIMED_OUT'
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

const TIMEOUT_NAVIGATION_ERRORS = new Set([
  'timeout',
  'net::ERR_TIMED_OUT',
  'net::ERR_CONNECTION_TIMED_OUT'
])

const RESTRICTED_STATUS_CODES = new Set([401, 403, 407, 429, 451])
const MISSING_STATUS_CODES = new Set([404, 410])
const TEMPORARY_STATUS_CODES = new Set([408, 500, 502, 503, 504, 522, 523, 524])

export function buildNavigationSuccess(bookmark, navigationResult, label) {
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

export function buildFailureClassification(bookmark, attempts, probe, probeEnabled) {
  const baseResult = {
    ...bookmark,
    finalUrl: attempts.at(-1)?.finalUrl || bookmark.url
  }
  const navigationEvidence = summarizeNavigationEvidence(attempts)
  const navigationSummary = attempts
    .map((attempt, index) => {
      return `${index === 0 ? '首轮' : '重试'}：${attempt.detail}`
    })
    .join('；')

  if (!probeEnabled || !probe) {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: `${navigationSummary}。未完成第二层网络探测，暂归为低置信异常，不建议直接删除。`
    }
  }

  if (probe.kind === 'ok') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: `${navigationSummary}。但网络探测(${probe.method})返回可访问，站点可能仍可用，暂归为低置信异常，建议人工确认。`
    }
  }

  if (probe.kind === 'restricted') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '受限/低置信',
      detail: `${navigationSummary}。网络探测(${probe.method})返回 ${probe.label}，站点可能需要登录、地区许可或反爬验证，暂归为低置信异常。`
    }
  }

  if (probe.kind === 'temporary') {
    return {
      ...baseResult,
      status: 'review',
      badgeText: '临时异常',
      detail: `${navigationSummary}。网络探测(${probe.method})返回 ${probe.label}，更像临时服务异常，不建议直接删除。`
    }
  }

  if (probe.kind === 'missing') {
    return {
      ...baseResult,
      status: 'failed',
      badgeText: '高置信异常',
      detail: `${navigationSummary}。网络探测(${probe.method})返回 ${probe.label}，较大概率是失效链接。`
    }
  }

  if (probe.kind === 'network') {
    if (shouldClassifyAsHighConfidence(navigationEvidence, probe.kind)) {
      return {
        ...baseResult,
        status: 'failed',
        badgeText: '高置信异常',
        detail: `${navigationSummary}。网络探测也失败：${probe.detail}，多层结果都指向连接层故障，已按高置信异常归类。`
      }
    }

    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: `${navigationSummary}。网络探测也失败：${probe.detail}，证据仍不足以直接删除，暂归为低置信异常。`
    }
  }

  if (probe.kind === 'unknown') {
    if (shouldClassifyAsHighConfidence(navigationEvidence, probe.kind)) {
      return {
        ...baseResult,
        status: 'failed',
        badgeText: '高置信异常',
        detail: `${navigationSummary}。${probe.detail}，且后台导航连续给出强失败信号，已按高置信异常归类。`
      }
    }

    return {
      ...baseResult,
      status: 'review',
      badgeText: '低置信异常',
      detail: `${navigationSummary}。${probe.detail} 证据仍不足以直接删除，暂归为低置信异常。`
    }
  }

  return {
    ...baseResult,
    status: 'review',
    badgeText: '低置信异常',
    detail: `${navigationSummary}。${probe.detail} 暂归为低置信异常，建议人工确认。`
  }
}

export function shouldRetryNavigation(result) {
  if (!result || result.status === 'available') {
    return false
  }

  return RETRYABLE_NAVIGATION_ERRORS.has(result.errorCode)
}

export function summarizeNavigationEvidence(attempts) {
  const errorCodes = attempts
    .map((attempt) => String(attempt?.errorCode || '').trim())
    .filter(Boolean)

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

export function shouldClassifyAsHighConfidence(navigationEvidence, probeKind) {
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

export function shouldFallbackToGet(statusCode) {
  return [401, 403, 405, 429, 451, 500, 501, 502, 503, 504].includes(statusCode)
}

export function classifyProbeResponse(response, method) {
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

export function classifyProbeError(error) {
  if (error?.name === 'AbortError') {
    return {
      kind: 'unknown',
      method: 'GET',
      label: '探测超时',
      detail: `网络探测超时，超过 ${Math.round(FETCH_TIMEOUT_MS / 1000)} 秒仍未返回。`
    }
  }

  if (error instanceof TypeError) {
    return {
      kind: 'network',
      method: 'GET',
      label: '网络探测失败',
      detail: '网络探测未能建立连接。'
    }
  }

  return {
    kind: 'unknown',
    method: 'GET',
    label: '探测失败',
    detail: error instanceof Error ? error.message : '网络探测失败。'
  }
}

export function isRedirectedNavigation(originalUrl, finalUrl) {
  return normalizeNavigationUrl(originalUrl) !== normalizeNavigationUrl(finalUrl)
}

export function normalizeNavigationUrl(url) {
  try {
    const parsedUrl = new URL(String(url || ''))
    parsedUrl.hash = ''
    parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = normalizeNavigationPathname(parsedUrl.pathname)
    const search = normalizeNavigationSearch(parsedUrl.search)
    return `${parsedUrl.hostname}${pathname}${search}`
  } catch (error) {
    return normalizeText(String(url || ''))
  }
}

function normalizeNavigationPathname(pathname) {
  const normalizedPath = String(pathname || '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')

  return normalizedPath || '/'
}

function normalizeNavigationSearch(search) {
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

  return `?${normalizedPairs.map(([key, value]) => `${key}=${value}`).join('&')}`
}
