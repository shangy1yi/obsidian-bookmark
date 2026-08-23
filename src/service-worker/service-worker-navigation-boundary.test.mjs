import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('./service-worker.ts', import.meta.url),
  'utf8'
)
const manifestSource = await readFile(
  new URL('../manifest.json', import.meta.url),
  'utf8'
)

assert.match(
  source,
  /const reservation = reserveNavigationCheck\(checkId\)[\s\S]*await containsHostPermission/,
  'navigation capacity should be reserved before the first asynchronous permission check'
)
assert.match(
  source,
  /pendingCheckReservations\.has\(checkId\)[\s\S]*AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT/,
  'reservations should reject duplicate IDs and share the frontend concurrency ceiling'
)
assert.match(
  source,
  /reservation\.cancelled = true[\s\S]*reservation\.tabId === null/,
  'cancellation should mark checks that are still creating a tab'
)
assert.match(
  source,
  /senderUrl\.origin === expectedUrl\.origin[\s\S]*senderUrl\.pathname === expectedUrl\.pathname/,
  'availability messages should be restricted to the extension options page'
)
assert.match(
  source,
  /message\?\.type === 'backup:restore'[\s\S]*isTrustedAvailabilityMessageSender\(sender\)[\s\S]*parseBackupRestoreMessage\(message\)[\s\S]*performJournaledBackupRestore/,
  'backup restore messages must be restricted to and parsed for the options page'
)
assert.match(
  source,
  /executeJournaledCuratorBackupRestore\([\s\S]*withMutationLock: withAvailabilityRestoreMutationLock[\s\S]*beforeApply:[\s\S]*createAutoBackupBeforeDangerousOperation/,
  'journaled restore must acquire the availability mutation lock before its one-time automatic backup and mutations'
)
assert.match(
  source,
  /alarm\.name === BACKUP_RESTORE_RECOVERY_ALARM[\s\S]*runBackupRestoreRecovery\(\)[\s\S]*const backupRestoreRecoveryReady = runBackupRestoreRecovery\(\)/,
  'the worker must recover interrupted restores both at startup and from a persisted alarm'
)
assert.match(
  source,
  /beforeRedirect\(details\)[\s\S]*finalizeSensitiveNavigationTarget\(state, details\.redirectUrl\)/,
  'network redirects should be checked before their target is recorded'
)
assert.match(
  source,
  /onCommitted\.addListener[\s\S]*finalizeSensitiveNavigationTarget\(state, details\.url\)/,
  'committed navigations should stop sensitive redirect targets'
)
for (const eventName of ['onCompleted', 'onDOMContentLoaded', 'onErrorOccurred']) {
  const eventStart = source.indexOf(`chrome.webNavigation.${eventName}.addListener`)
  const nextEventStart = source.indexOf('chrome.webNavigation.', eventStart + 1)
  const eventSource = source.slice(
    eventStart,
    nextEventStart === -1 ? source.length : nextEventStart
  )
  assert.ok(eventStart >= 0, `${eventName} listener must exist`)
  assert.match(
    eventSource,
    /if \(isAboutBlank\(details\.url\)\) \{\s*return\s*\}/,
    `${eventName} must always ignore delayed about:blank events`
  )
}
assert.match(
  source,
  /errorCode: 'sensitive-redirect'/,
  'sensitive redirects should return a stable explicit error code'
)
assert.match(
  source,
  /await installNavigationOriginFirewall\(createdTabId, allowedUrlRegex\)[\s\S]*startNavigationWithNetworkObserver/,
  'the per-tab origin firewall must be installed before navigation starts'
)
assert.match(
  source,
  /isRegexSupported\(\{[\s\S]*regex,[\s\S]*isCaseSensitive: true[\s\S]*requireCapturing: false/,
  'the exact URL rule must be validated against Chrome regex limits before creating a tab'
)
assert.match(
  source,
  /parsedUrl\.hash = ''[\s\S]*return `\^\$\{escapeRegex\(parsedUrl\.href\)\}\(\?:#\.\*\)\?\$`/,
  'the exact navigation rule must preserve hash and SPA routes without widening the network URL'
)
assert.ok(
  source.indexOf('await isNavigationUrlRegexSupported(allowedUrlRegex)') <
    source.indexOf("url: 'about:blank'"),
  'unsupported exact URL rules must fail before a hidden tab is created'
)
assert.match(
  source,
  /errorCode: 'unsupported-navigation-url'/,
  'unsupported exact URL rules should return a stable explicit error code'
)
assert.match(
  source,
  /RuleActionType\.ALLOW[\s\S]*regexFilter: allowedUrlRegex[\s\S]*isUrlFilterCaseSensitive: true[\s\S]*RuleActionType\.BLOCK[\s\S]*regexFilter: '\^https\?:/,
  'session rules should allow only the exact requested network URL and block every other HTTP main-frame target'
)
assert.match(
  source,
  /finalizeUnauthorizedNavigationTarget\(state, details\.redirectUrl\)/,
  'redirect targets should be rejected when they leave the authorized origin'
)
assert.match(
  source,
  /errorCode: 'ungranted-redirect'/,
  'ungranted redirect targets should return a stable explicit error code'
)
assert.match(
  source,
  /const evidence = getOrCreateNetworkEvidence\(state, details\)[\s\S]*evidence\.redirects\.push[\s\S]*finalizeUnauthorizedNavigationTarget\(state, details\.redirectUrl\)/,
  'redirect evidence must be recorded before an unauthorized next hop is finalized'
)
assert.match(
  source,
  /clearStaleNavigationOriginFirewalls[\s\S]*closeStaleNavigationTab\(tabId\)[\s\S]*removeRuleIds: removableRuleIds/,
  'stale firewall rules must only be removed after their tabs are closed or already gone'
)
assert.match(
  source,
  /staleRules\.forEach[\s\S]*activeNavigationRuleIds\.add\(Number\(rule\.id\)\)[\s\S]*releaseNavigationRuleIds\(removableRuleIds\)/,
  'retained stale rule IDs must stay reserved until their rules are actually removed'
)
assert.match(
  source,
  /reservation\.tabId === tabId[\s\S]*reservation\.cancelled = true/,
  'tab removal during firewall installation must cancel the pending reservation'
)
assert.match(
  source,
  /performAvailabilityProbeRedirectChain[\s\S]*runWithAvailabilityProbeDeadline\([\s\S]*containsHostPermission\(originPattern\)[\s\S]*fetchAvailabilityProbeHop/,
  'network probes must authorize every redirect hop before resolving or requesting it'
)
assert.match(
  source,
  /fetchAvailabilityProbeHop[\s\S]*assertAvailabilityProbeDnsAddressIsPublic\(\s*url[\s\S]*onBeforeRedirect\.addListener[\s\S]*onResponseStarted\.addListener[\s\S]*credentials: 'omit'[\s\S]*redirect: 'manual'/,
  'network probes must preflight DNS, observe the connected endpoint, and omit ambient credentials'
)
assert.match(
  source,
  /probeHeaderName = 'X-Request-ID'[\s\S]*details\.requestId !== requestId[\s\S]*onBeforeSendHeaders\.addListener\([\s\S]*'requestHeaders', 'extraHeaders'/,
  'network endpoint evidence must be correlated through a probe-only request header and request ID'
)
assert.match(
  source,
  /if \(!response\.status && !redirectUrl\)[\s\S]*waitForRedirectEvidence\([\s\S]*redirectEvidence[\s\S]*controller\.signal/,
  'opaque manual redirect responses must wait for the keyed webRequest event'
)
assert.match(
  source,
  /const receivedAt = Date\.now\(\)[\s\S]*const effectiveDeadlineAtMs = Number\.isSafeInteger\(requestedDeadline\)[\s\S]*performAvailabilityProbeRedirectChain\(\{[\s\S]*deadlineAtMs: effectiveDeadlineAtMs/,
  'the service worker must establish the end-to-end deadline when the message is received'
)
assert.match(
  source,
  /serializeAvailabilityProbeHop\([\s\S]*currentUrl,[\s\S]*deadlineAtMs,[\s\S]*fetchAvailabilityProbeHop\([\s\S]*deadlineAtMs/,
  'per-URL serialization and every redirect hop must share one absolute deadline'
)
assert.match(
  source,
  /serializeAvailabilityProbeHop[\s\S]*throwIfAvailabilityProbeUnavailable\(signal, deadlineAtMs\)[\s\S]*runWithAvailabilityProbeDeadline\(taskPromise, signal, deadlineAtMs\)/,
  'queued probes must expire before issuing a late network request'
)
assert.match(
  source,
  /captureRemoteAddress[\s\S]*details\.ip[\s\S]*isVerifiedHttpsLoopbackProxyResponse\(\{[\s\S]*resolvedAddress: resolvedDnsAddress[\s\S]*statusCode: observedResponseStatus[\s\S]*!viaVerifiedLoopbackProxy[\s\S]*'private-network-endpoint'/,
  'a loopback proxy must only be accepted after public DNS and a correlated HTTPS response status are observed'
)
assert.match(
  source,
  /dnsApi\.resolve\(hostname\)[\s\S]*resultCode[\s\S]*isPublicNetworkAddress\(address\)[\s\S]*'private-network-endpoint'[\s\S]*return address/,
  'each hop must resolve through Chrome and reject a non-public address before fetch'
)
assert.match(
  source,
  /beforeRequest\(details\)[\s\S]*state\.lastAttemptedUrl = details\.url[\s\S]*getOrCreateNetworkEvidence\(state, details\)[\s\S]*finalizeUnauthorizedNavigationTarget\(state, details\.url\)/,
  'a client-side navigation target must be recorded and rejected before the navigation error can win the event race'
)
assert.match(
  source,
  /errorOccurred\(details\)[\s\S]*state\.lastAttemptedUrl = details\.url[\s\S]*getOrCreateNetworkEvidence\(state, details\)[\s\S]*finalizeUnauthorizedNavigationTarget\(state, details\.url\)/,
  'webRequest errors must preserve and classify the attempted target URL'
)
assert.match(
  source,
  /const failedUrl = getLatestAttemptedNavigationUrl\(state, details\.url\)[\s\S]*finalizeUnauthorizedNavigationTarget\(state, failedUrl\)/,
  'webNavigation errors must prefer the latest observed attempted target'
)
assert.match(
  source,
  /response\.body\?\.cancel\(\)[\s\S]*runWithAvailabilityProbeDeadline\([\s\S]*throwIfAvailabilityProbeUnavailable\(runSignal, deadlineAtMs\)/,
  'response body cleanup must remain inside the shared probe deadline'
)
assert.match(
  source,
  /waitForRedirectEvidence\([\s\S]*if \(controller\.signal\.aborted\)[\s\S]*'网络探测超时。'/,
  'a timeout while waiting for redirect evidence must not be downgraded to an opaque response'
)
assert.match(
  source,
  /if \(!remoteAddress && !controller\.signal\.aborted\)[\s\S]*waitForRedirectEvidence\([\s\S]*endpointEvidence[\s\S]*if \(!remoteAddress\)/,
  'a successful fetch must briefly await its keyed endpoint-IP event before failing closed'
)
assert.ok(
  JSON.parse(manifestSource).permissions.includes('declarativeNetRequest'),
  'the per-tab origin firewall requires declarativeNetRequest permission'
)
assert.ok(
  !JSON.parse(manifestSource).permissions.includes('dns'),
  'stable Chrome extensions must omit the dev-channel-only dns permission'
)

console.log('Service worker navigation boundary contract tests passed.')
