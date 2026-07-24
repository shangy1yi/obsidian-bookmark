import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('./options-controller.ts', import.meta.url),
  'utf8'
)
const redirectsSource = await readFile(
  new URL('./sections/redirects.ts', import.meta.url),
  'utf8'
)
const recycleSource = await readFile(
  new URL('./sections/recycle.ts', import.meta.url),
  'utf8'
)
const permissionsSource = await readFile(
  new URL('./shared-options/permissions.ts', import.meta.url),
  'utf8'
)
const serviceWorkerSource = await readFile(
  new URL('../service-worker/service-worker.ts', import.meta.url),
  'utf8'
)

const probePermissionAction = getFunctionSource(
  'async function ensureProbePermissionForRun',
  'function normalizeOriginPermissionList'
)
assert.match(
  probePermissionAction,
  /if \(interactive\)[\s\S]*await requestPermissions\(\{[\s\S]*origins: requestOrigins/,
  'interactive permission requests must call Chrome request directly from the user-triggered path'
)
assert.match(
  permissionsSource,
  /export function requestPermissions[\s\S]*chrome\.permissions\.request\(/,
  'the request wrapper must not consume user activation with a preliminary contains call'
)

const fullRunAction = getFunctionSource('async function handleAvailabilityAction', 'async function handleAvailabilityScopeChange')
assert.ok(
  fullRunAction.indexOf("beginAvailabilityRunSession('full')") <
    fullRunAction.indexOf('await ensureProbePermissionForRun'),
  'the full run must claim ownership before its first permission await'
)
assert.match(
  fullRunAction,
  /availabilityState\.settingsSaving/,
  'a full run must not start while runner settings are still being persisted'
)
assert.ok(
  fullRunAction.indexOf('await acquireGlobalAvailabilityRunLock(sessionId)') <
    fullRunAction.indexOf('await runAvailabilityDetection'),
  'a full run must own the cross-document lock before network work starts'
)

const retestAction = getFunctionSource(
  'async function retestSelectedAvailabilityResults',
  'function applyRetestedAvailabilityResult'
)
assert.ok(
  retestAction.indexOf("beginAvailabilityRunSession('retest')") <
    retestAction.indexOf('await ensureProbePermissionForRun'),
  'retest must claim ownership before its first permission await'
)
assert.match(
  retestAction,
  /shouldContinue:\s*\(\)\s*=>\s*waitForAvailabilityRun\(sessionId\)/,
  'retest must share the cancellable run gate'
)
assert.match(
  retestAction,
  /label:\s*'死链\/重定向重新测试'/,
  'retest network access must be recorded in the privacy audit'
)
assert.ok(
  retestAction.indexOf('await acquireGlobalAvailabilityRunLock(sessionId)') <
    retestAction.indexOf("transition(sessionId, 'running')"),
  'retest must own the cross-document lock before entering its running phase'
)
assert.match(
  source,
  /function finishAvailabilityRunSession[\s\S]*availabilityGlobalRunLocks\.release\(sessionId\)/,
  'finishing any run must release its cross-document lock'
)
const finishRunSession = getFunctionSource(
  'async function finishAvailabilityRunSession',
  'async function acquireGlobalAvailabilityRunLock'
)
assert.ok(
  finishRunSession.indexOf('await cancelActiveNavigationChecks()') <
    finishRunSession.indexOf('availabilityGlobalRunLocks.release(sessionId)'),
  'active probes must be cancelled before the cross-document run lock is released'
)
const globalRunLockAction = getFunctionSource(
  'async function acquireGlobalAvailabilityRunLock',
  'async function claimAvailabilityMutationLock'
)
assert.match(
  globalRunLockAction,
  /await refreshAvailabilityPersistentStateUnderLock\(\)/,
  'a document must refresh persistent availability state after acquiring the global run lock'
)
assert.match(
  source,
  /claimAvailabilityMutationLock[\s\S]*STORAGE_KEYS\.detectionHistory[\s\S]*STORAGE_KEYS\.redirectCache/,
  'non-run availability mutations must share the global lock and refresh persisted state'
)

const settingsDraftAction = getFunctionSource(
  'function syncAvailabilitySettingsDraft',
  'async function saveAvailabilitySettingsFromDraft'
)
assert.doesNotMatch(
  settingsDraftAction,
  /availabilityState\.settings\s*=/,
  'editing an unsaved draft must not mutate effective settings'
)

const fullRun = getFunctionSource(
  'async function runAvailabilityDetection',
  'async function inspectBookmarkAvailability'
)
const inspectBookmark = getFunctionSource(
  'async function inspectBookmarkAvailability',
  'async function notifyAvailabilityRunFinished'
)
assert.match(
  inspectBookmark,
  /runNavigationAttempt[\s\S]*shouldAcceptNavigationSuccess[\s\S]*buildNavigationSuccess/,
  'availability checks must use a real background navigation as their primary evidence'
)
assert.ok(
  inspectBookmark.indexOf('runNavigationAttempt') <
    inspectBookmark.indexOf('probeBookmarkUrl'),
  'header probes must supplement failed navigation rather than replace real page opening'
)
assert.match(
  inspectBookmark,
  /buildFailureClassification\(bookmark, attempts, probe, probeEnabled\)/,
  'failed navigation attempts must remain part of the final evidence'
)
assert.match(
  inspectBookmark,
  /AUTHORIZED_SAME_ORIGIN_REDIRECT_HOP_LIMIT[\s\S]*getAuthorizedSameOriginRedirectUrl[\s\S]*visitedNavigationUrls\.has[\s\S]*runRecordedNavigationAttempt/,
  'same-origin redirects must use a bounded, loop-safe, exact follow-up navigation'
)
assert.ok(
  inspectBookmark.indexOf('getAuthorizedSameOriginRedirectUrl') <
    inspectBookmark.indexOf('shouldRetryNavigation(navigation)') &&
    inspectBookmark.indexOf('getAuthorizedSameOriginRedirectUrl') <
      inspectBookmark.indexOf('probeBookmarkUrl'),
  'authorized same-origin redirects must be followed before generic retry and header probing'
)
const authorizedSameOriginRedirect = getFunctionSource(
  'async function getAuthorizedSameOriginRedirectUrl',
  'function normalizeAvailabilityNavigationUrl'
)
assert.match(
  authorizedSameOriginRedirect,
  /getSafeSameOriginRedirectUrl\(sourceUrl, attempt\)[\s\S]*containsPermissions\(\{ origins: \[originPattern\] \}\)/,
  'a redirect follow-up must pass both the safe same-origin check and the current host permission check'
)
const runNavigationAttempt = getFunctionSource(
  'async function runNavigationAttempt',
  'function createNavigationCheckId'
)
assert.match(
  runNavigationAttempt,
  /isRuntimeMessagePortUnavailable\(error\)[\s\S]*已停止检测，未把这些书签记为异常/,
  'a broken primary message channel must abort instead of classifying every bookmark as abnormal'
)
assert.match(
  fullRun,
  /checkedHealthyBookmarks:\s*availabilityState\.checkedHealthyBookmarkUrls/,
  'history finalization must receive URL-bound healthy bookmark evidence'
)
assert.match(
  fullRun,
  /checkedHealthyBookmarkIds:\s*availabilityState\.checkedHealthyBookmarkIds/,
  'history finalization must receive explicit healthy bookmark evidence'
)
assert.match(
  fullRun,
  /if\s*\(!stopped && !catalogChangedDuringRun\)[\s\S]*persistRedirectCacheSnapshot/,
  'stopped runs must not replace the complete redirect cache'
)
assert.ok(
  fullRun.indexOf("transition(sessionId, 'finalizing')") <
    fullRun.indexOf('await finalizeDetectionHistory'),
  'a completed run must become non-cancellable before persistence starts'
)
assert.match(
  fullRun,
  /getCurrentAvailabilityScopeMeta:\s*\(\)\s*=>\s*redirectCacheScope/,
  'history persistence must use the scope snapshot captured at run start'
)

const stopAction = getFunctionSource(
  'function requestAvailabilityStop',
  'function createAvailabilityScheduler'
)
assert.match(
  stopAction,
  /activeSession\.phase === 'finalizing'/,
  'stop must not interrupt completed-result persistence'
)

const bookmarkRefreshAction = getFunctionSource(
  'export function handleOptionsBookmarkTreeChanged',
  'async function hydratePersistentState'
)
assert.match(
  bookmarkRefreshAction,
  /hasActiveAvailabilityRunSession\(\)[\s\S]*availabilityCatalogRefreshPending = true/,
  'bookmark catalog changes must be deferred while a run owns its snapshot'
)

assert.match(
  retestAction,
  /mergeRetestedRedirectCache\(retestedResults/,
  'every retest must merge only its explicit redirect evidence into the prior complete cache'
)
assert.doesNotMatch(
  retestAction,
  /persistRedirectCacheSnapshot/,
  'a partial retest must never replace the complete redirect cache snapshot'
)

const settingsSaveAction = getFunctionSource(
  'async function saveAvailabilitySettingsFromDraft',
  'async function resetAvailabilitySettings'
)
assert.match(
  settingsSaveAction,
  /availabilityState\.settingsSaving = true[\s\S]*availabilitySettingsDraftRevision === savedDraftRevision/,
  'settings persistence must lock edits and preserve newer draft revisions'
)

assert.match(
  redirectsSource,
  /finally\s*\{[\s\S]*availabilityState\.deleting = false[\s\S]*callbacks\.renderAvailabilitySection\(\)/,
  'redirect mutations must always unlock and render after reconciliation failures'
)
assert.match(
  recycleSource,
  /finally\s*\{[\s\S]*availabilityState\.deleting = false[\s\S]*callbacks\.renderAvailabilitySection\(\)/,
  'recycle mutations must always unlock and render after reconciliation failures'
)
assert.match(
  recycleSource,
  /candidate\.expectedUrl !== String\(latestBookmark\.url\)/,
  'destructive deletion must reject stale evidence after a bookmark URL changes'
)
assert.match(
  recycleSource,
  /runRecycleEntriesSequentially\(uniqueCandidates[\s\S]*await getBookmarkById\(bookmarkId\)[\s\S]*expectedUrl: candidate\.expectedUrl/,
  'each batch deletion must re-read and revalidate the bookmark immediately before mutation'
)
assert.match(
  redirectsSource,
  /targetResults\.reduce[\s\S]*await getBookmarkById\(String\(result\.id\)\)[\s\S]*await updateBookmark/,
  'each redirect update must re-read the bookmark immediately before mutation'
)

assert.match(
  serviceWorkerSource,
  /fetchAvailabilityProbeHop[\s\S]*credentials:\s*'omit'[\s\S]*redirect:\s*'manual'[\s\S]*response\.body\?\.cancel/,
  'probes must omit credentials, observe redirects manually, and discard response bodies'
)
assert.match(
  serviceWorkerSource,
  /const beforeRedirect[\s\S]*redirectUrl = String\(details\.redirectUrl/,
  'redirect targets must be captured from the network event'
)
assert.match(
  serviceWorkerSource,
  /onBeforeRedirect\.addListener\(beforeRedirect, filter\)/,
  'the redirect capture listener must be attached around the probe fetch'
)
assert.match(
  serviceWorkerSource,
  /runWithAvailabilityProbeDeadline\([\s\S]*containsHostPermission\(originPattern\)[\s\S]*fetchAvailabilityProbeHop[\s\S]*currentUrl = normalizeNavigationUrl\(captured\.redirectUrl\)/,
  'captured redirect targets must return to the authorization gate before the next loop request'
)
const probeBookmarkAction = getFunctionSource(
  'async function probeBookmarkUrl',
  'async function runAvailabilityProbe'
)
assert.match(
  probeBookmarkAction,
  /const deadlineAtMs = Date\.now\(\) \+ timeoutMs[\s\S]*runProbeWithinDeadline\('HEAD'\)[\s\S]*runProbeWithinDeadline\('GET'\)/,
  'HEAD, GET fallback, and redirect hops must share one per-bookmark timeout budget'
)
assert.match(
  probeBookmarkAction,
  /const allowGetFallback = isGetFallbackSafeForUrl\(url\)[\s\S]*!allowGetFallback[\s\S]*return classifyAvailabilityProbeResult\(headResponse, 'HEAD'\)/,
  'URLs with query parameters must never fall back from HEAD to a potentially state-changing GET'
)
assert.match(
  probeBookmarkAction,
  /const classifiedError = classifyProbeError\(error\)[\s\S]*isUnverifiedAvailabilityErrorCode\(classifiedError\.errorCode\)[\s\S]*return classifiedError/,
  'unverified HEAD transport failures must stop before a GET fallback'
)

const backupRestoreAction = getFunctionSource(
  'async function handleFullBackupRestore',
  'async function getCurrentBookmarksForTagData'
)
assert.ok(
  backupRestoreAction.indexOf('getOrCreateBackupRestoreOperationId') <
    backupRestoreAction.indexOf('requestBackupRestore'),
  'the options page must assign an idempotent operation ID before handing restore to the worker'
)
assert.doesNotMatch(
  backupRestoreAction,
  /restoreCuratorBackup|createAutoBackupBeforeDangerousOperation/,
  'the options page must not own the restore transaction or its pre-restore backup'
)
assert.match(
  backupRestoreAction,
  /const result = await requestBackupRestore[\s\S]*releaseRefreshLock = await claimAvailabilityMutationLock\(\)/,
  'safe full restore may reacquire the availability lock only to refresh committed UI state'
)
assert.match(
  backupRestoreAction,
  /const result = await requestBackupRestore\(operationId[\s\S]*clearBackupRestoreOperationIdentity\(operationId\)/,
  'a committed restore must release its idempotency key so a later explicit restore can run again'
)
assert.match(
  backupRestoreAction,
  /BACKUP_RESTORE_ROLLED_BACK_CODE[\s\S]*clearBackupRestoreOperationIdentity\(operationId\)/,
  'an explicitly rolled-back restore must release its terminal idempotency key'
)
assert.match(
  source,
  /function clearBackupRestoreOperationIdentity[\s\S]*operationKey = ''[\s\S]*operationId = ''/,
  'only the matching terminal restore operation may clear the cached identity'
)

assert.match(
  source,
  /removeAvailabilityResultById\(bookmarkId,\s*\{\s*removeHistoryEntry:\s*false\s*\}\)/,
  'hiding a result must preserve its history evidence'
)
assert.match(
  source,
  /!latestBookmark \|\| String\(latestBookmark\.url \|\| ''\) !== String\(result\.url \|\| ''\)/,
  'catalog reconciliation must discard evidence when the bookmark URL changed'
)

console.log('Options availability controller boundary tests passed.')

function getFunctionSource(startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker)
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length)
  assert.notEqual(startIndex, -1, `missing source marker: ${startMarker}`)
  assert.notEqual(endIndex, -1, `missing source marker: ${endMarker}`)
  return source.slice(startIndex, endIndex)
}
