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
  'async function runAiNamingSuggestions()',
  'async function runAiNamingSuggestionChunks('
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
  'async function commitAiNamingResult(',
  'function buildAiNamingResultFromModelItem('
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
assert.match(
  retryRunner,
  /requestAiNamingBatch\(\[preparedItem\], \{\s*signal: controller\.signal\s*\}\)/,
  'single-item isolation retries must inherit the active run AbortSignal'
)
assert.match(
  retryRunner,
  /recordAiGenerationFailure\(failureCircuit, retryError\)[\s\S]*?throw createAiNamingRunFailure/,
  'a second terminal generation failure should escape the retry loop'
)
assert.match(
  topLevelRun,
  /catch \(error\)[\s\S]*?lastRunOutcome = 'failed'[\s\S]*?normalizeAiNamingRunFailure\(error\)/,
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
  topLevelRun,
  /runTotalBookmarks = aiNamingState\.bookmarks\.length/,
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

console.log('Options AI analysis controller boundary tests passed.')

function getSection(startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0 && end > start, `Missing source section: ${startMarker}`)
  return source.slice(start, end)
}
