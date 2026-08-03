import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('./service-worker.ts', import.meta.url),
  'utf8'
)

function readFunction(name, nextName) {
  const start = source.indexOf(`function ${name}`)
  const next = source.indexOf(`function ${nextName}`, start + 1)
  assert.ok(start >= 0, `${name} must exist`)
  assert.ok(next > start, `${nextName} must follow ${name}`)
  return source.slice(start, next)
}

const retryPolicy = readFunction(
  'isRetryableAutoAnalyzeError',
  'markAutoAnalyzeQueueEntryFailed'
)
assert.match(
  retryPolicy,
  /error instanceof AiRuntimeError[\s\S]*error\.kind === 'configuration' \|\| error\.kind === 'permission'[\s\S]*return false/,
  'configuration and permission errors must be terminal'
)
assert.match(
  retryPolicy,
  /\[401, 403, 404\]\.includes\(status\)[\s\S]*return false/,
  'authentication and missing-endpoint provider errors must be terminal'
)
assert.match(
  retryPolicy,
  /\[400, 415, 422\]\.includes\(status\) && !error\.retryable[\s\S]*return false/,
  'explicitly non-retryable request and media errors must be terminal'
)
assert.match(
  retryPolicy,
  /error\.kind === 'network'[\s\S]*return error\.retryable[\s\S]*error\.kind === 'abort'[\s\S]*\/超时\/\.test\(error\.message\)/,
  'only retryable network errors and timeouts should be treated as transient'
)

const queueFailure = readFunction(
  'markAutoAnalyzeQueueEntryFailed',
  'removeAutoAnalyzeQueueEntry'
)
assert.match(
  queueFailure,
  /const willRetry = retryable && attempts < AUTO_ANALYZE_QUEUE_MAX_ATTEMPTS/,
  'queue retries must require an explicitly transient failure'
)
assert.match(
  queueFailure,
  /return willRetry[\s\S]*nextRunAt:[\s\S]*: \[\]/,
  'terminal failures must be removed instead of being scheduled again'
)

const queueProcessor = readFunction(
  'processNextAutoAnalyzeQueueEntry',
  'getAutoAnalyzeTreeContext'
)
assert.match(
  queueProcessor,
  /const retryable = isRetryableAutoAnalyzeError\(error\)[\s\S]*markAutoAnalyzeQueueEntryFailed\([\s\S]*\{ retryable \}/,
  'the queue processor must classify an error before deciding whether to retry'
)
assert.match(
  queueProcessor,
  /failureDisposition\.willRetry[\s\S]*已安排稍后重试[\s\S]*不可重试的错误/,
  'status details must distinguish scheduled retries from terminal failures'
)
assert.match(
  queueProcessor,
  /maxAttempts: failureDisposition\.willRetry[\s\S]*AUTO_ANALYZE_QUEUE_MAX_ATTEMPTS[\s\S]*failureDisposition\.attempts/,
  'terminal failures must not advertise a retry that was not scheduled'
)
assert.ok(
  queueProcessor.indexOf('scheduleAutoAnalyzeQueueAlarm(AUTO_ANALYZE_QUEUE_WATCHDOG_MS)') <
    queueProcessor.indexOf('runAutoAnalysisForBookmark(entry, treeContext)'),
  'a persistent watchdog alarm must be armed before long page and AI requests begin'
)
const queueLoop = readFunction(
  'processAutoAnalyzeQueue',
  'processNextAutoAnalyzeQueueEntry'
)
assert.match(
  queueLoop,
  /if \(autoAnalyzeQueueProcessing\) \{[\s\S]*scheduleAutoAnalyzeQueueAlarm\(AUTO_ANALYZE_QUEUE_WATCHDOG_MS\)[\s\S]*return/,
  'a watchdog firing during a live run must rearm itself'
)
assert.match(
  source,
  /chrome\.runtime\.onInstalled\.addListener\([\s\S]*resumeAutoAnalyzeQueue\(\)[\s\S]*chrome\.runtime\.onStartup\.addListener\([\s\S]*resumeAutoAnalyzeQueue\(\)/,
  'installation and browser startup must recover a persisted non-empty queue'
)

const enqueue = readFunction(
  'enqueueAutoAnalyzeBookmark',
  'persistAutoBookmarkTagAnalysis'
)
assert.match(
  enqueue,
  /Promise<AutoAnalyzeEnqueueResult>/,
  'enqueue must return an explicit admission result'
)
assert.match(
  enqueue,
  /entries\.length >= AUTO_ANALYZE_QUEUE_LIMIT[\s\S]*accepted: false[\s\S]*reason: 'queue-full'[\s\S]*return entries/,
  'a full queue must preserve existing work and reject the new entry'
)
assert.doesNotMatch(
  enqueue,
  /\.slice\(0,\s*AUTO_ANALYZE_QUEUE_LIMIT\)/,
  'enqueue must never truncate old queue entries'
)

const normalizeQueue = readFunction(
  'normalizeAutoAnalyzeQueue',
  'pruneAutoAnalyzeQueue'
)
const pruneQueue = readFunction(
  'pruneAutoAnalyzeQueue',
  'loadAutoAnalyzeSettings'
)
assert.doesNotMatch(
  normalizeQueue + pruneQueue,
  /\.slice\(0,\s*AUTO_ANALYZE_QUEUE_LIMIT\)/,
  'loading or pruning a queue must not silently discard overflow entries'
)
const queueUpdate = readFunction(
  'updateAutoAnalyzeQueue',
  'loadAutoAnalyzeQueue'
)
assert.match(
  queueUpdate,
  /let entries = pruneAutoAnalyzeQueue\(await loadAutoAnalyzeQueue\(\), now\)[\s\S]*?update\.updater\(entries\)/,
  'expired jobs must be pruned before queue-capacity admission is evaluated'
)

const inboxCapture = readFunction(
  'captureCurrentTabToInbox',
  'getActiveTab'
)
assert.match(
  inboxCapture,
  /const enqueueResult = await enqueueAutoAnalyzeBookmark[\s\S]*enqueueResult\.accepted === false[\s\S]*status: 'failed'[\s\S]*maxAttempts: 0[\s\S]*return[\s\S]*scheduleAutoAnalyzeQueueProcessing/,
  'Inbox capture must publish a failed status and stop when admission is rejected'
)

const createdHandler = readFunction(
  'handleBookmarkCreatedForAutoAnalysis',
  'processAutoAnalyzeQueue'
)
assert.match(
  createdHandler,
  /const enqueueResult = await enqueueAutoAnalyzeBookmark[\s\S]*enqueueResult\.accepted === false[\s\S]*status: 'failed'[\s\S]*maxAttempts: 0[\s\S]*return[\s\S]*status: 'queued'/,
  'bookmark creation must not publish queued after queue admission is rejected'
)

const runAnalysis = readFunction(
  'runAutoAnalysisForBookmark',
  'scheduleAutoAnalyzeQueueProcessing'
)
const latestRead = runAnalysis.indexOf('let latestBookmark = await getBookmarkById(bookmarkId)')
const conflictCheck = runAnalysis.indexOf('getAutoBookmarkMutationConflict(bookmark, latestBookmark)')
const baseTagPersist = runAnalysis.indexOf(
  'await persistAutoBookmarkTagAnalysis({',
  runAnalysis.indexOf('const preMutationFolderPath')
)
const folderCreate = runAnalysis.indexOf('await ensureBookmarkFolderPath(recommendation.path)')
const postFolderRead = runAnalysis.indexOf(
  'await getBookmarkById(bookmarkId)',
  folderCreate
)
const bookmarkMove = runAnalysis.indexOf('await moveBookmarkNode(bookmarkId, folderId)')
const preRenameRead = runAnalysis.indexOf(
  'await getBookmarkById(bookmarkId)',
  bookmarkMove
)
const bookmarkRename = runAnalysis.indexOf("await updateBookmarkNode(bookmarkId, { title: suggestedTitle })")
assert.ok(
  latestRead >= 0 &&
    latestRead < conflictCheck &&
    conflictCheck < baseTagPersist &&
    baseTagPersist < folderCreate &&
    folderCreate < postFolderRead &&
    postFolderRead < bookmarkMove &&
    bookmarkMove < preRenameRead &&
    preRenameRead < bookmarkRename,
  'analysis must persist and revalidate URL/title/parent before folder creation, move, and rename'
)
assert.match(
  runAnalysis,
  /return withAvailabilityAutoAnalysisMutationLock\(async \(\) => \{/,
  'post-AI bookmark writes must share the global availability mutation lock'
)
const targetFolderValidation = runAnalysis.indexOf(
  'const freshTreeContext = await buildAutoAnalyzeTreeContext()'
)
assert.ok(
  targetFolderValidation > conflictCheck &&
    targetFolderValidation < baseTagPersist &&
    runAnalysis.indexOf('currentTargetFolder', targetFolderValidation) <
      runAnalysis.indexOf('ensureBookmarkFolderPath', targetFolderValidation),
  'an existing AI target folder must be refreshed and validated inside the lock before mutations'
)
assert.match(
  runAnalysis,
  /targetFolderChanged[\s\S]*recommendation: null[\s\S]*return/,
  'a changed or deleted target folder must fall back to review without retaining a stale target'
)

const conflictBranchStart = runAnalysis.indexOf('if (mutationConflict)')
const recommendationBranchStart = runAnalysis.indexOf('if (!recommendation)', conflictBranchStart)
const conflictBranch = runAnalysis.slice(conflictBranchStart, recommendationBranchStart)
assert.match(
  conflictBranch,
  /await completeAutoAnalysisWithMutationConflict\([\s\S]*return/,
  'a changed bookmark must use the non-mutating conflict completion path'
)
assert.doesNotMatch(
  conflictBranch,
  /ensureBookmarkFolderPath|moveBookmarkNode|updateBookmarkNode/,
  'the conflict branch must not create folders, move, or rename'
)
const conflictCompletion = readFunction(
  'completeAutoAnalysisWithMutationConflict',
  'scheduleAutoAnalyzeQueueProcessing'
)
assert.match(
  conflictCompletion,
  /await persistAutoBookmarkTagAnalysis\([\s\S]*status: 'needs-review'[\s\S]*未自动移动或改名/,
  'a changed bookmark must retain analysis data and require review without mutation'
)

assert.match(
  runAnalysis,
  /getNonInboxAutoMutationBlockReason\(aiResult, recommendation, pageContext\)[\s\S]*shouldAutoMoveRecommendation = inboxItem[\s\S]*: canMutateNonInboxBookmark[\s\S]*shouldAutoRename = Boolean\(inboxItem\) \|\| canMutateNonInboxBookmark/,
  'non-Inbox move and rename must share the local mutation safety gate'
)
const mutationGate = readFunction(
  'getNonInboxAutoMutationBlockReason',
  'findBestExistingFolder'
)
assert.match(
  mutationGate,
  /aiResult\.confidence < AUTO_CLASSIFY_MUTATION_MIN_CONFIDENCE[\s\S]*recommendation\.confidence < AUTO_CLASSIFY_MUTATION_MIN_CONFIDENCE/,
  'both overall and folder confidence must meet the local threshold'
)
assert.match(
  mutationGate,
  /\['ok', 'remote', 'combined'\]\.includes\(extractionStatus\)[\s\S]*contentLength >= AUTO_CLASSIFY_MUTATION_MIN_CONTENT_LENGTH/,
  'automatic mutation requires a reliable extraction status and useful content'
)

const finalCommit = runAnalysis.slice(runAnalysis.indexOf('const preMutationFolderPath'))
assert.match(
  finalCommit,
  /await persistAutoBookmarkTagAnalysis\([\s\S]*ensureBookmarkFolderPath/,
  'base tag persistence must finish before any folder or bookmark mutation'
)
const metadataRefresh = finalCommit.slice(
  finalCommit.indexOf('let tagMetadataRefreshError'),
  finalCommit.indexOf('if (inboxItem)')
)
assert.match(
  metadataRefresh,
  /await persistAutoBookmarkTagAnalysis\([\s\S]*\.catch\([\s\S]*tagMetadataRefreshError/,
  'post-mutation metadata refresh failures must not retry already-applied mutations'
)
assert.match(
  finalCommit,
  /const liveFinalFolderPath = await getBookmarkFolderPath\([\s\S]*const finalFolderPath = liveFinalFolderPath/,
  'completed metadata and status must use the bookmark actual current parent path'
)
assert.doesNotMatch(
  finalCommit.slice(
    finalCommit.indexOf('const liveFinalFolderPath'),
    finalCommit.indexOf('let tagMetadataRefreshError')
  ),
  /recommendation\.path|recommendation\.title/,
  'the final path must not reuse the pre-AI recommendation snapshot'
)
assert.match(
  finalCommit,
  /const completionWarning[\s\S]*lastError: completionWarning[\s\S]*detail: \[[\s\S]*completionWarning/,
  'non-fatal mutation and metadata warnings must remain visible to the user'
)

assert.match(
  source,
  /throw new AiRuntimeError\(\s*'permission',\s*'缺少 AI 服务地址访问权限/,
  'missing provider permission must be represented as a deterministic AI runtime error'
)
assert.match(
  source,
  /chrome\.bookmarks\.onCreated\.addListener\([\s\S]*?invalidateAutoAnalyzeTreeContext\(\)[\s\S]*?chrome\.bookmarks\.onRemoved\.addListener\([\s\S]*?invalidateAutoAnalyzeTreeContext\(\)[\s\S]*?chrome\.bookmarks\.onChanged\.addListener\([\s\S]*?invalidateAutoAnalyzeTreeContext\(\)[\s\S]*?chrome\.bookmarks\.onMoved\.addListener\([\s\S]*?invalidateAutoAnalyzeTreeContext\(\)/,
  'every bookmark tree mutation must invalidate the queued analysis tree snapshot'
)

const fetchText = readFunction(
  'fetchAutoTextWithTimeout',
  'readAutoResponseTextWithLimit'
)
const readText = readFunction(
  'readAutoResponseTextWithLimit',
  'isAutoAbortError'
)
assert.match(
  fetchText,
  /const text = await readAutoResponseTextWithLimit\([\s\S]*finally \{[\s\S]*clearTimeout\(timeoutId\)/,
  'the auto-analysis request timeout must cover the full response body'
)
assert.match(
  readText,
  /content-length[\s\S]*getReader\(\)[\s\S]*bytesRead > normalizedMaxBytes/,
  'direct and Jina page responses must enforce declared and streamed body limits'
)
assert.doesNotMatch(
  runAnalysis,
  /fetchWithAutoTimeout/,
  'auto-analysis must not use the old headers-only timeout helper'
)

console.log('Service worker auto-analysis boundary contract tests passed.')
