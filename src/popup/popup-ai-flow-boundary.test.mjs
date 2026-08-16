import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const controllerSource = readFileSync(new URL('./popup-controller.ts', import.meta.url), 'utf8')
const classifierSource = readFileSync(new URL('./smart-classifier.ts', import.meta.url), 'utf8')

function getSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0, `${startMarker} must exist`)
  assert.ok(end > start, `${endMarker} must follow ${startMarker}`)
  return source.slice(start, end)
}

const cleanup = getSection(
  controllerSource,
  'function cleanupPopupController()',
  'function resetPopupSessionStateForNextOpen()'
)
const resetSmart = getSection(
  controllerSource,
  'function resetSmartClassification()',
  'async function classifyCurrentPage('
)
const classifySmart = getSection(
  controllerSource,
  'async function classifyCurrentPage(',
  'function advanceSmartProgressStage('
)
const runNaturalSearch = getSection(
  controllerSource,
  'async function runNaturalSearch(',
  'async function resolveCachedNaturalSearchPlan('
)
const resolveNaturalSearch = getSection(
  controllerSource,
  'async function resolveNaturalSearchPlan(',
  'async function searchNaturalQuery('
)
const buildPageContext = getSection(
  classifierSource,
  'export async function buildCurrentPageContext(',
  'async function fetchRemoteCurrentPageContext('
)
const fetchRemoteContext = getSection(
  classifierSource,
  'async function fetchRemoteCurrentPageContext(',
  'export async function requestSmartClassification('
)
const requestClassification = getSection(
  classifierSource,
  'export async function requestSmartClassification(',
  'function reportSmartProgress('
)
const fetchPageText = getSection(
  classifierSource,
  'async function fetchSmartTextWithTimeout(',
  'function throwIfSmartAborted('
)

assert.match(
  controllerSource,
  /let smartClassificationAbortController: AbortController \| null = null/,
  'popup smart classification must own an AbortController for the active run'
)
assert.match(cleanup, /abortSmartClassificationRequest\(\)/, 'closing the popup must abort its smart request')
assert.match(resetSmart, /abortSmartClassificationRequest\(\)/, 'exiting smart classification must abort its request')
assert.match(
  classifySmart,
  /const controller = new AbortController\(\)[\s\S]*smartClassificationAbortController = controller/,
  'each smart classification run must create and retain its own AbortController'
)
assert.ok(
  (classifySmart.match(/signal: controller\.signal/g) || []).length >= 2,
  'the active signal must reach both page extraction and the model request'
)
assert.match(
  classifySmart,
  /finally \{[\s\S]*smartClassificationAbortController === controller[\s\S]*smartClassificationAbortController = null/,
  'the active smart controller must be released only by its own run'
)
assert.match(
  classifySmart,
  /catch \(error\) \{[\s\S]*state\.smartRunId !== runId \|\| controller\.signal\.aborted/,
  'closing or resetting the popup must not publish an error from the cancelled smart run'
)

assert.match(
  buildPageContext,
  /signal\?: AbortSignal \| null/,
  'page-context extraction must accept external cancellation'
)
assert.match(
  buildPageContext,
  /Math\.min\(settings\.timeoutMs, POPUP_SMART_DEFAULT_TIMEOUT_MS\)/,
  'page extraction must retain a shorter timeout than the model request'
)
assert.ok(
  (buildPageContext.match(/signal/g) || []).length >= 5,
  'page-context cancellation must be checked and forwarded across async boundaries'
)
assert.match(
  buildPageContext,
  /if \(!response\.ok\)[\s\S]*网页返回 HTTP/,
  'direct page extraction must fall back on unsuccessful HTTP responses'
)
assert.match(fetchRemoteContext, /signal\?: AbortSignal \| null/, 'remote parsing must accept cancellation')
assert.match(fetchRemoteContext, /signal[\s\S]*timeoutMs/, 'remote parsing must pass cancellation into fetch')
assert.match(
  fetchPageText,
  /const response = await fetch[\s\S]*if \(!response\.ok\)[\s\S]*const text = await response\.text\(\)[\s\S]*finally/,
  'the page fetch must reject unsuccessful bodies and keep successful body reading inside the timeout'
)
assert.match(requestClassification, /signal\?: AbortSignal \| null/, 'model classification must accept cancellation')
assert.match(
  requestClassification,
  /requestStructuredAiOutput[\s\S]*signal,[\s\S]*timeoutMs: settings\.timeoutMs/,
  'model classification must forward cancellation while retaining the full AI timeout'
)

assert.match(
  runNaturalSearch,
  /controller\.signal\.aborted/,
  'natural search should recognize cancellation from its own controller'
)
assert.doesNotMatch(
  runNaturalSearch,
  /isAbortError\(error\)/,
  'runtime timeout errors must not be swallowed as user cancellation'
)
assert.doesNotMatch(
  resolveNaturalSearch,
  /isAbortError\(error\)/,
  'natural-search timeout failures must reach the visible error state'
)

console.log('Popup AI timeout and cancellation boundary tests passed.')
