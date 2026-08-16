import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./options-controller.ts', import.meta.url), 'utf8')
const progressSource = readFileSync(new URL('../ui/base/Progress.tsx', import.meta.url), 'utf8')
const progressPanelSource = readFileSync(
  new URL('./components/AiAnalysisProgressPanel.tsx', import.meta.url),
  'utf8'
)

const chunkRunner = getSection(
  'async function runAiNamingSuggestionChunks(',
  'async function prepareAiNamingChunk('
)
const retryRunner = getSection(
  'async function retryAiNamingBookmarks(',
  'function createAiNamingRunFailure('
)
const topLevelRun = getSection(
  'async function runAiNamingSuggestions({',
  'async function runAiNamingSuggestionChunks('
)
const beginRun = getSection(
  'function beginAiAnalysisRunSession(',
  'function hasActiveAiAnalysisRunSession('
)
const prepareRunner = getSection(
  'async function prepareAiNamingChunk(',
  'async function notifyAiNamingRunFinished('
)
const renderSection = getSection(
  'function renderAiNamingSection()',
  'function renderBookmarkTagDataCard()'
)
const completionMarker = getSection(
  'function markAiNamingBookmarkCompleted(',
  'function syncAiNamingCatalog('
)
const resetRunState = getSection(
  'function resetAiNamingRunState()',
  'function markAiNamingBookmarkCompleted('
)
const commitResult = getSection(
  'async function commitAiNamingResults(',
  'async function persistAiNamingTagRecords('
)
const permissionRun = getSection(
  'async function ensureAiNamingPermissionsForRun(',
  'async function ensureAiNamingProviderPermission('
)
const batchRequest = getSection(
  'async function requestAiNamingBatch(',
  'function getResolvedAiProviderEndpoint('
)
const checkpointPersistence = getSection(
  'async function persistAiAnalysisCheckpoint(',
  'function scheduleAiAnalysisCheckpointSave('
)
const responseReader = getSection(
  'async function fetchTextWithRequestTimeout(',
  'function throwIfAborted('
)
const preparedItem = getSection(
  'async function buildAiNamingPreparedItem(',
  'async function saveContentSnapshotsForAiPreparedItems('
)
const mutationGuard = getSection(
  'async function requireCurrentAiNamingBookmark(',
  'function validateAiNamingSettings('
)
const providerSettingsAction = getSection(
  'export function handleAiProviderSettingsAction(',
  'export function handleContentSnapshotSettingsChange('
)

assert.match(
  topLevelRun,
  /const failureCircuit = createAiFailureCircuit\(2\)/,
  'AI analysis should stop after two consecutive terminal generation failures'
)
assert.match(
  chunkRunner,
  /recordAiGenerationFailure\(failureCircuit, error\)[\s\S]*?failureDecision\.shouldStop[\s\S]*?throw createAiNamingRunFailure/,
  'a failed batch should open the circuit before the next chunk can run'
)
assert.ok(
  chunkRunner.indexOf('await mergeAiNamingBatchResults') <
    chunkRunner.indexOf('recordAiGenerationSuccess(failureCircuit)'),
  'generation success must not reset the failure circuit until local persistence succeeds'
)
assert.match(
  chunkRunner,
  /if \(isAiNamingPersistenceFailure\(error\)\) \{[\s\S]*?throw error[\s\S]*?recordAiGenerationFailure/,
  'a local persistence failure must stop before any paid retry is scheduled'
)
assert.match(
  retryRunner,
  /requestAiNamingBatch\(\[preparedItem\], \{[\s\S]*?deadlineAtMs: requestDeadlineAtMs,[\s\S]*?signal: controller\.signal,[\s\S]*?settings/,
  'single-item isolation retries must inherit the active run AbortSignal, deadline, and settings snapshot'
)
assert.match(
  retryRunner,
  /recordAiGenerationFailure\(failureCircuit, retryError\)[\s\S]*?throw createAiNamingRunFailure/,
  'a second terminal generation failure should escape the retry loop'
)
assert.ok(
  retryRunner.indexOf('await commitAiNamingResult') <
    retryRunner.indexOf('recordAiGenerationSuccess(failureCircuit)'),
  'isolated retries count as successful only after their result is durable'
)
assert.match(
  retryRunner,
  /if \(isAiNamingPersistenceFailure\(retryError\)\) \{[\s\S]*?throw retryError[\s\S]*?buildAiNamingRetriedFailureResult/,
  'isolated retries must immediately surface a persistence failure without another model call'
)
assert.match(
  topLevelRun,
  /catch \(error\)[\s\S]*?lastRunOutcome = stopped \? 'stopped' : 'failed'[\s\S]*?normalizeAiNamingRunFailure\(error\)/,
  'automatic circuit failures should publish a failed outcome and the concrete API error'
)
assert.doesNotMatch(
  retryRunner,
  /generateAiNamingResultForBookmark\(candidate\.bookmark, settings\)/,
  'the retry path must not use the old request helper that dropped the AbortSignal'
)
assert.doesNotMatch(
  prepareRunner,
  /aiNamingState\.checkedBookmarks/,
  'preparing bookmark content must not advance completed-result progress'
)
assert.match(
  completionMarker,
  /completedBookmarkIds\.has\(normalizedBookmarkId\)[\s\S]*?completedBookmarkIds\.add\(normalizedBookmarkId\)[\s\S]*?checkedBookmarks = aiNamingState\.completedBookmarkIds\.size/,
  'completed-result progress must be idempotent for each bookmark'
)
assert.match(
  resetRunState,
  /completedBookmarkIds = new Set\(\)/,
  'each AI run should reset its completed-result identity set'
)
assert.match(
  beginRun,
  /runTotalBookmarks = aiNamingState\.eligibleBookmarks/,
  'each AI run should freeze its progress denominator'
)
assert.match(
  commitResult,
  /markAiNamingBookmarkCompleted\(bookmark\.id\)/,
  'a committed AI result should advance completed-result progress'
)
assert.match(
  chunkRunner,
  /buildAiNamingFailedResult\(preparedItems\[0\]\.bookmark, error\)[\s\S]*?markAiNamingBookmarkCompleted\(preparedItems\[0\]\.bookmark\.id\)/,
  'an immediate circuit break should count only its representative failed result'
)
assert.ok(
  (retryRunner.match(/markAiNamingBookmarkCompleted\(candidate\.bookmark\.id\)/g) || []).length >= 2,
  'terminal preparation and generation retry failures should both advance completed-result progress'
)
assert.doesNotMatch(
  renderSection,
  /Math\.round/,
  'AI progress must preserve the exact completed/total ratio'
)
assert.match(
  renderSection,
  /progressMax: Math\.max\(progressMax, 1\),\s*progressValue/,
  'AI progress should publish raw completed and total counts'
)
assert.doesNotMatch(
  progressSource,
  /translateX\(/,
  'Base UI already sizes the progress indicator; a second transform would square the visible ratio'
)
assert.doesNotMatch(
  progressSource,
  /transition-(?:\[)?width/,
  'completed progress should update immediately instead of animating layout width'
)
assert.match(
  progressPanelSource,
  /progressMax=\{state\.progressMax\}[\s\S]*?progressDivisions=\{state\.progressMax\}/,
  'small AI runs should expose exact equal divisions on the progress track'
)
assert.ok(
  permissionRun.indexOf('requestPermissions({') < permissionRun.indexOf('containsPermissions({'),
  'interactive AI permission requests must not await a contains check before requesting'
)
assert.match(
  chunkRunner,
  /const chunkSize = start === 0 \? 1 : settings\.batchSize/,
  'the first structured generation request should probe one bookmark before larger batches'
)
assert.match(
  batchRequest,
  /const settings = options\.settings \|\|[\s\S]*?deadlineAtMs: options\.deadlineAtMs/,
  'AI requests must consume the immutable run settings and shared absolute deadline'
)
assert.ok(
  commitResult.indexOf('await persistAiNamingTagRecords') <
    commitResult.indexOf('upsertAiNamingResult(result)'),
  'a successful result must be persisted before it is published as complete'
)
assert.match(
  commitResult,
  /status: 'failed'[\s\S]*?reason: `AI 已返回分析结果，但本地标签数据保存失败[\s\S]*?throw createAiNamingPersistenceFailure\(error\)/,
  'a failed local commit must retain failed rows and terminate the run with the concrete storage error'
)
assert.match(
  checkpointPersistence,
  /\[STORAGE_KEYS\.aiAnalysisCheckpoint\]: checkpoint/,
  'completed partial AI results should be checkpointed outside page memory'
)
assert.match(
  responseReader,
  /const text = await readResponseTextWithLimit\(response,[\s\S]*?finally \{[\s\S]*?clearTimeout\(timeoutId\)/,
  'request timeout cleanup must happen after the complete response body is read'
)
assert.match(
  responseReader,
  /content-length[\s\S]*?getReader\(\)[\s\S]*?bytesRead > normalizedMaxBytes/,
  'auxiliary AI and page responses must enforce declared and streamed body limits'
)
assert.match(
  preparedItem,
  /Math\.min\([\s\S]*AI_NAMING_CONTENT_FETCH_TIMEOUT_MS[\s\S]*getAiMetadataForBookmark\(bookmark, contentTimeoutMs/,
  'page preparation must keep a bounded content-fetch timeout independent from the model budget'
)
assert.match(
  batchRequest,
  /timeoutMs: settings\.timeoutMs/,
  'structured model generation must retain the full configured AI request budget'
)
assert.match(
  mutationGuard,
  /getBookmarkById\(bookmarkId\)[\s\S]*?latestBookmark\.url[\s\S]*?latestBookmark\.title[\s\S]*?latestBookmark\.parentId/,
  'applying an AI result must revalidate URL, title, and parent immediately before mutation'
)
assert.match(
  providerSettingsAction,
  /updateAiNamingSettingsField\(\s*previousSettings,\s*detail\.field,\s*nextValue\s*\)/,
  'provider field edits must use the tested draft update boundary'
)
assert.match(
  providerSettingsAction,
  /resetAiNamingConnectivityState\(\)[\s\S]*?renderAiProviderConfiguration\(\)/,
  'typing in provider fields should refresh only provider configuration instead of rebuilding AI results'
)
assert.ok(
  topLevelRun.indexOf('await requestAiNamingConnectivityTest(settings') <
    topLevelRun.indexOf('initializeAiAnalysisRunState(bookmarks.length'),
  'the provider canary must fail before replacing the previous analysis results'
)
assert.match(
  topLevelRun,
  /requestAiNamingConnectivityTest\(settings, \{[\s\S]*?signal: controller\.signal/,
  'the provider canary must stop with the active analysis session'
)

console.log('Options AI analysis controller boundary tests passed.')

function getSection(startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0 && end > start, `Missing source section: ${startMarker}`)
  return source.slice(start, end)
}
