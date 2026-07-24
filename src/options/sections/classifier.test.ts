import assert from 'node:assert/strict'
import type {
  BookmarkRecord,
  NavigationAttempt,
  NavigationNetworkEvidence
} from '../../shared/types.js'
import {
  buildFailureClassification,
  buildNavigationSuccess,
  classifyAvailabilityProbeResult,
  classifyProbeError,
  classifyProbeResponseAndDiscardBody,
  getSafeSameOriginRedirectUrl,
  isRedirectedNavigation,
  isUnverifiedAvailabilityErrorCode,
  requireRepeatedFailureEvidence,
  shouldAcceptNavigationSuccess,
  shouldFallbackToGet
} from './classifier.js'

const bookmark: BookmarkRecord = {
  id: 'bookmark-1',
  title: 'Example',
  url: 'http://example.com/path?a=1&b=2',
  displayUrl: 'example.com/path',
  normalizedTitle: 'example',
  normalizedUrl: 'http://example.com/path?a=1&b=2',
  duplicateKey: 'example',
  domain: 'example.com',
  path: 'Bookmarks',
  ancestorIds: ['1'],
  parentId: '1',
  index: 0,
  dateAdded: 0
}

const successfulProbeWithoutNavigation = buildFailureClassification(
  bookmark,
  [],
  classifyAvailabilityProbeResult({
    ok: true,
    status: 200,
    finalUrl: bookmark.url,
    redirected: false,
    detail: '网络探测(HEAD)返回 HTTP 200。',
    errorCode: ''
  }, 'HEAD'),
  true
)
assert.equal(
  successfulProbeWithoutNavigation.status,
  'review',
  'a header probe without real navigation evidence must not replace page opening'
)

const blockedProbeRedirect = classifyAvailabilityProbeResult({
  ok: false,
  status: 302,
  finalUrl: 'https://ungranted.example/final',
  redirected: true,
  detail: '重定向目标尚未授权，未向该地址发出请求。',
  errorCode: 'ungranted-redirect'
}, 'HEAD')
assert.equal(
  buildFailureClassification(bookmark, [], blockedProbeRedirect, true).badgeText,
  '待授权重定向'
)

const protectedProbeRedirect = classifyAvailabilityProbeResult({
  ok: false,
  status: 302,
  finalUrl: 'https://accounts.example/login',
  redirected: true,
  detail: '重定向目标属于受保护地址，已停止网络探测。',
  errorCode: 'sensitive-redirect'
}, 'HEAD')
const protectedResult = buildFailureClassification(
  bookmark,
  [],
  protectedProbeRedirect,
  true
)
assert.equal(protectedResult.badgeText, '受保护链接')
assert.equal(protectedResult.errorCode, 'sensitive-redirect')
assert.equal(isUnverifiedAvailabilityErrorCode(protectedResult.errorCode), true)

const firstAnonymousMissing = requireRepeatedFailureEvidence({
  ...bookmark,
  status: 'failed',
  badgeText: '高置信异常',
  finalUrl: bookmark.url,
  detail: '网络探测(HEAD)返回 HTTP 404。'
}, false)
assert.equal(firstAnonymousMissing.status, 'review')
assert.equal(firstAnonymousMissing.badgeText, '首次异常·待复核')
assert.equal(
  requireRepeatedFailureEvidence({
    ...firstAnonymousMissing,
    status: 'failed'
  }, true).status,
  'failed'
)

const anonymousMissingProbe = classifyAvailabilityProbeResult({
  ok: false,
  status: 404,
  finalUrl: bookmark.url,
  redirected: false,
  detail: '网络探测(GET)返回 HTTP 404。',
  errorCode: ''
}, 'GET')
const anonymousMissingResult = buildFailureClassification(
  bookmark,
  [],
  anonymousMissingProbe,
  true
)
assert.equal(
  anonymousMissingResult.status,
  'review',
  'anonymous 404 evidence must not enter the automatic high-confidence deletion set'
)
assert.equal(
  requireRepeatedFailureEvidence(anonymousMissingResult, true).status,
  'review',
  'repeating the same anonymous 404 does not create independent failure evidence'
)
assert.match(
  anonymousMissingResult.detail,
  /私有资源和登录后内容/,
  'anonymous missing responses must explain why explicit user confirmation is required'
)

assert.equal(
  isRedirectedNavigation('http://example.com/path', 'https://example.com/path'),
  true,
  'protocol upgrades must remain visible as redirects'
)
assert.equal(
  isRedirectedNavigation('http://example.com/path', 'http://example.com:80/path'),
  false,
  'an explicit default port should equal the protocol default'
)
assert.equal(
  isRedirectedNavigation('https://example.com:8443/path', 'https://example.com:9443/path'),
  true,
  'effective port changes must remain visible as redirects'
)
assert.equal(
  isRedirectedNavigation('https://www.example.com/path', 'https://example.com/path'),
  true,
  'hostname canonicalization must remain visible as a redirect'
)
assert.equal(
  isRedirectedNavigation(
    'https://example.com/path?b=2&a=1',
    'https://example.com/path?a=1&b=2'
  ),
  false,
  'query parameter ordering alone should not create a redirect'
)
assert.equal(
  isRedirectedNavigation(
    'https://example.com/path?a=b%26c%3Dd',
    'https://example.com/path?a=b&c=d'
  ),
  true,
  'distinct encoded query values must not collapse to the same URL identity'
)

const crossOriginEvidence: NavigationNetworkEvidence = {
  requestSent: true,
  requestedUrl: bookmark.url,
  finalUrl: 'https://canonical.example/path?a=1&b=2',
  statusCode: 301,
  finalResponseObserved: false,
  redirects: [{
    url: bookmark.url,
    redirectUrl: 'https://canonical.example/path?a=1&b=2',
    statusCode: 301
  }],
  timing: {}
}
const completedCrossOriginAttempt: NavigationAttempt = {
  status: 'available',
  finalUrl: 'https://canonical.example/path?a=1&b=2',
  detail: '后台标签页已完成 DOM 就绪检测。',
  errorCode: '',
  networkEvidence: crossOriginEvidence
}

const completedDirectAttempt: NavigationAttempt = {
  status: 'available',
  finalUrl: bookmark.url,
  detail: '后台标签页已完成 DOM 就绪检测。',
  errorCode: '',
  networkEvidence: {
    requestSent: true,
    requestedUrl: bookmark.url,
    finalUrl: bookmark.url,
    statusCode: 200,
    finalResponseObserved: true,
    redirects: [],
    timing: {}
  }
}
assert.equal(
  shouldAcceptNavigationSuccess(completedDirectAttempt),
  true,
  'a completed real navigation with a successful main response must be accepted'
)
assert.equal(
  buildNavigationSuccess(bookmark, completedDirectAttempt, '首轮后台导航成功').status,
  'available'
)

const completedDomOnlyAttempt: NavigationAttempt = {
  status: 'available',
  finalUrl: bookmark.url,
  detail: '后台标签页已完成 DOM 就绪检测。',
  errorCode: ''
}
assert.equal(
  shouldAcceptNavigationSuccess(completedDomOnlyAttempt),
  true,
  'a trusted target-page DOM completion must remain valid when webRequest status evidence is unavailable'
)
assert.equal(
  shouldAcceptNavigationSuccess({
    ...completedDomOnlyAttempt,
    networkEvidence: {
      requestSent: true,
      requestedUrl: bookmark.url,
      finalUrl: bookmark.url,
      statusCode: 0,
      redirects: [],
      timing: {}
    }
  }),
  true,
  'a target-page DOM completion must survive a webRequest race that leaves statusCode at zero'
)

const privateProxyProbe = classifyAvailabilityProbeResult({
  ok: false,
  status: 0,
  finalUrl: bookmark.url,
  redirected: false,
  detail: '实际网络连接落到本机、内网或非公网端点，已中止探测。',
  errorCode: 'private-network-endpoint'
}, 'HEAD')
const navigationWithPrivateProxyProbe = buildFailureClassification(
  bookmark,
  [completedDomOnlyAttempt],
  privateProxyProbe,
  true
)
assert.equal(
  navigationWithPrivateProxyProbe.status,
  'available',
  'a supplementary private-proxy signal must not override a completed real page navigation'
)
const privateProxyOnlyResult = buildFailureClassification(
  bookmark,
  [],
  privateProxyProbe,
  true
)
assert.equal(
  privateProxyOnlyResult.status,
  'review',
  'a private endpoint signal without successful page navigation must remain inconclusive'
)
assert.equal(
  privateProxyOnlyResult.badgeText,
  '网络边界受限',
  'a private proxy must be described as an inconclusive network boundary rather than unsupported browser behavior'
)

const mihoyoBookmark: BookmarkRecord = {
  ...bookmark,
  id: 'bookmark-mihoyo',
  title: '账号概览',
  url: 'https://user.mihoyo.com/passport/index.html?legacy_env=production#/home/account-overview',
  normalizedUrl: 'https://user.mihoyo.com/passport/index.html?legacy_env=production#/home/account-overview',
  domain: 'user.mihoyo.com'
}
const clientBlockedAttempt: NavigationAttempt = {
  status: 'failed',
  finalUrl: mihoyoBookmark.url,
  detail: '后台导航失败：net::ERR_BLOCKED_BY_CLIENT',
  errorCode: 'net::ERR_BLOCKED_BY_CLIENT'
}
const verifiedProxyProbe = classifyAvailabilityProbeResult({
  ok: true,
  status: 200,
  finalUrl: mihoyoBookmark.url,
  redirected: false,
  detail: '网络探测(HEAD)返回 HTTP 200。已通过 HTTPS 响应确认本机代理传输。',
  errorCode: ''
}, 'HEAD')
const verifiedProxyResult = buildFailureClassification(
  mihoyoBookmark,
  [clientBlockedAttempt],
  verifiedProxyProbe,
  true
)
assert.equal(
  verifiedProxyResult.status,
  'available',
  'a clean independent HTTPS probe must override a local client blocker'
)
assert.equal(
  verifiedProxyResult.badgeText,
  '网络校验可访问',
  'the recovered result must explain that independent network evidence succeeded'
)
assert.equal(
  buildFailureClassification(
    mihoyoBookmark,
    [
      clientBlockedAttempt,
      {
        ...clientBlockedAttempt,
        detail: '后台导航超时。',
        errorCode: 'timeout'
      }
    ],
    verifiedProxyProbe,
    true
  ).status,
  'review',
  'a clean probe must not override mixed client-blocking and transport-failure evidence'
)

assert.equal(
  shouldAcceptNavigationSuccess({
    ...completedDomOnlyAttempt,
    errorCode: 'net::ERR_ABORTED'
  }),
  false,
  'a browser navigation error must not be accepted merely because a DOM event was observed'
)
assert.equal(
  shouldAcceptNavigationSuccess({
    ...completedDomOnlyAttempt,
    networkEvidence: {
      requestSent: true,
      requestedUrl: bookmark.url,
      finalUrl: bookmark.url,
      statusCode: 404,
      finalResponseObserved: true,
      redirects: [],
      timing: {}
    }
  }),
  false,
  'an explicit failing main-frame status must override generic DOM completion'
)

assert.equal(
  shouldAcceptNavigationSuccess(completedCrossOriginAttempt),
  false,
  'a cross-origin redirect without final response evidence must remain unverified'
)

const bybitLocaleRedirect: NavigationAttempt = {
  status: 'failed',
  finalUrl: 'https://www.bybit.com/en/trade/usdt/BTCUSDT',
  detail: '后台导航被目标网站重定向到未授权地址。',
  errorCode: 'ungranted-redirect',
  networkEvidence: {
    requestSent: true,
    requestedUrl: 'https://www.bybit.com/trade/usdt/BTCUSDT',
    finalUrl: 'https://www.bybit.com/en/trade/usdt/BTCUSDT',
    statusCode: 200,
    finalResponseObserved: true,
    redirects: [],
    timing: {}
  }
}
assert.equal(
  getSafeSameOriginRedirectUrl(
    'https://www.bybit.com/trade/usdt/BTCUSDT',
    bybitLocaleRedirect
  ),
  bybitLocaleRedirect.finalUrl,
  'an already-authorized same-origin locale route should be eligible for one exact follow-up navigation'
)
assert.equal(
  getSafeSameOriginRedirectUrl(
    'https://www.bybit.com/trade/usdt/BTCUSDT',
    {
      ...bybitLocaleRedirect,
      finalUrl: 'https://bybit.com/en/trade/usdt/BTCUSDT'
    }
  ),
  '',
  'a different origin must not be treated as an authorized same-origin redirect'
)
assert.equal(
  getSafeSameOriginRedirectUrl(
    'https://www.bybit.com/trade/usdt/BTCUSDT',
    {
      ...bybitLocaleRedirect,
      finalUrl: 'https://www.bybit.com/logout'
    }
  ),
  '',
  'a same-origin capability action must remain protected'
)
assert.equal(
  getSafeSameOriginRedirectUrl(
    bybitLocaleRedirect.finalUrl,
    bybitLocaleRedirect
  ),
  '',
  'a redirect target equal to the active URL must not create a navigation loop'
)
assert.equal(
  buildFailureClassification(
    bookmark,
    [{
      ...completedCrossOriginAttempt,
      status: 'failed',
      errorCode: 'ungranted-redirect'
    }],
    null,
    true
  ).badgeText,
  '待授权重定向',
  'a blocked next hop should be presented as an unverified redirect rather than a generic failure'
)
assert.equal(
  buildFailureClassification(
    bookmark,
    [{
      status: 'failed',
      finalUrl: 'https://client-redirect.example/path',
      detail: '页面脚本尝试跳转到未授权地址。',
      errorCode: 'ungranted-redirect'
    }],
    null,
    true
  ).badgeText,
  '待授权重定向',
  'client-side redirects without HTTP redirect evidence must still remain unverified redirects'
)
assert.equal(
  shouldAcceptNavigationSuccess({
    ...completedCrossOriginAttempt,
    finalUrl: bookmark.url,
    networkEvidence: {
      ...crossOriginEvidence,
      finalUrl: bookmark.url,
      redirects: []
    }
  }),
  false,
  'unverified response evidence without an explicit redirect target must remain conservative'
)

assert.equal(shouldFallbackToGet(404), true, 'HEAD 404 must be verified with GET')
assert.equal(shouldFallbackToGet(410), true, 'HEAD 410 must be verified with GET')
assert.equal(shouldFallbackToGet(405), true, 'HEAD-not-supported responses must still fall back')
assert.equal(shouldFallbackToGet(429), false, 'HEAD 429 must preserve throttle evidence without an immediate GET')
assert.equal(shouldFallbackToGet(204), false, 'successful HEAD responses should not issue GET')
let bodyCancelCount = 0
await classifyProbeResponseAndDiscardBody({
  body: {
    async cancel() {
      bodyCancelCount += 1
    }
  },
  ok: true,
  redirected: false,
  status: 200,
  url: bookmark.url
} as unknown as Response, 'GET')
assert.equal(bodyCancelCount, 1, 'fallback GET response bodies must be cancelled after reading headers')
assert.equal(
  classifyProbeError(new DOMException('timed out', 'AbortError')).kind,
  'unknown',
  'transport timeouts must remain inconclusive rather than becoming missing links'
)
const unsupportedAddressSpaceResult = classifyProbeError(
  Object.assign(new Error('Public address-space targeting is unavailable.'), {
    code: 'unsupported-address-space'
  })
)
assert.equal(
  unsupportedAddressSpaceResult.errorCode,
  'unsupported-address-space',
  'structured probe error codes must survive transport classification'
)
assert.equal(
  isUnverifiedAvailabilityErrorCode(unsupportedAddressSpaceResult.errorCode),
  true,
  'an unsupported native address-space boundary must remain unverified'
)
assert.equal(
  classifyProbeError(new DOMException('timed out', 'AbortError')).errorCode,
  undefined,
  'numeric DOMException codes must not be mistaken for semantic probe error codes'
)

console.log('Availability classifier tests passed.')
