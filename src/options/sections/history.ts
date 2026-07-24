import { STORAGE_KEYS } from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import {
  availabilityState,
  managerState,
  normalizeHistoryRunScope
} from '../shared-options/state.js'
import {
  compareByPathTitle,
  formatDateTime
} from '../shared-options/utils.js'
import { HISTORY_LOG_LIMIT } from '../shared-options/constants.js'
import { publishAvailabilityHistory } from '../components/availability-history-store.js'

function normalizeHistoryResultArray(entries) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.flatMap((flatMapValue, flatMapIndex, flatMapArray) => { const mappedResult = ((entry) => {
      const bookmarkId = String(entry?.id || '').trim()
      if (!bookmarkId) {
        return null
      }

      return {
        id: bookmarkId,
        title: String(entry?.title || '未命名书签').trim() || '未命名书签',
        url: String(entry?.url || '').trim(),
        path: String(entry?.path || '').trim(),
        status: String(entry?.status || '').trim() === 'failed' ? 'failed' : 'review',
        streak: Math.max(1, Number(entry?.streak) || 1)
      }
    })(flatMapValue); return mappedResult ? [mappedResult] : [] })
}

function normalizeDetectionHistoryRun(run) {
  if (!run || typeof run !== 'object') {
    return null
  }

  const normalizedResults = normalizeHistoryResultArray(run.results)
  const normalizedNewResults = normalizeHistoryResultArray(run.newResults)
  const normalizedRecoveredResults = normalizeHistoryResultArray(run.recoveredResults)
  const reviewCount = normalizedResults.filter((entry) => entry.status === 'review').length
  const failedCount = normalizedResults.filter((entry) => entry.status === 'failed').length

  return {
    runId: String(run.runId || `run-${Number(run.completedAt) || Date.now()}`).trim(),
    completedAt: Number(run.completedAt) || 0,
    scope: normalizeHistoryRunScope(run.scope),
    results: normalizedResults.map((entry) => ({
      ...entry,
      streak: Math.max(1, Number(entry.streak) || 1)
    })),
    newResults: normalizedNewResults,
    recoveredResults: normalizedRecoveredResults,
    summary: {
      totalAbnormal:
        Number(run?.summary?.totalAbnormal) ||
        normalizedResults.length,
      newCount:
        Number(run?.summary?.newCount) ||
        normalizedNewResults.length,
      persistentCount:
        Number(run?.summary?.persistentCount) ||
        Math.max(normalizedResults.length - normalizedNewResults.length, 0),
      recoveredCount:
        Number(run?.summary?.recoveredCount) ||
        normalizedRecoveredResults.length,
      reviewCount:
        Number(run?.summary?.reviewCount) ||
        reviewCount,
      failedCount:
        Number(run?.summary?.failedCount) ||
        failedCount
    }
  }
}

function normalizeHistoryEntrySource(entries) {
  if (entries instanceof Map) {
    return [...entries.values()]
  }

  return Array.isArray(entries) ? entries : []
}

function normalizeHistoryBookmarkIdSet(bookmarkIds) {
  const source = bookmarkIds instanceof Set
    ? [...bookmarkIds]
    : Array.isArray(bookmarkIds)
      ? bookmarkIds
      : []

  return new Set(source.flatMap((bookmarkId) => {
    const normalizedId = String(bookmarkId || '').trim()
    return normalizedId ? [normalizedId] : []
  }))
}

function normalizeHealthyBookmarkEvidence(evidence) {
  const normalizedEvidence = new Map()
  const sourceEntries = evidence instanceof Map
    ? [...evidence.entries()]
    : evidence instanceof Set
      ? [...evidence].map((bookmarkId) => [bookmarkId, ''])
      : Array.isArray(evidence)
        ? evidence.map((entry) => {
            if (entry && typeof entry === 'object') {
              return [entry.id, entry.url]
            }
            return [entry, '']
          })
        : []

  for (const [bookmarkId, url] of sourceEntries) {
    const normalizedId = String(bookmarkId || '').trim()
    if (normalizedId) {
      normalizedEvidence.set(normalizedId, String(url || '').trim())
    }
  }

  return normalizedEvidence
}

export function isSameHistoryEntryIdentity(left, right) {
  const leftId = String(left?.id || '').trim()
  const rightId = String(right?.id || '').trim()
  const leftUrl = String(left?.url || '').trim()
  const rightUrl = String(right?.url || '').trim()
  return Boolean(leftId && leftId === rightId && leftUrl && leftUrl === rightUrl)
}

export function hasMatchingPreviousHistoryEntry(result) {
  const bookmarkId = String(result?.id || '').trim()
  return isSameHistoryEntryIdentity(
    managerState.previousHistoryMap.get(bookmarkId),
    result
  )
}

interface AvailabilityHistoryRunFinalizationInput {
  checkedHealthyBookmarks?: unknown[] | Set<unknown> | Map<unknown, unknown>
  checkedHealthyBookmarkIds?: unknown[] | Set<unknown>
  completedAt?: number
  currentEntries?: unknown[] | Map<unknown, unknown>
  previousEntries?: unknown[] | Map<unknown, unknown>
  scope?: unknown
}

export function finalizeAvailabilityHistoryRun({
  checkedHealthyBookmarks = [],
  checkedHealthyBookmarkIds = [],
  completedAt = Date.now(),
  currentEntries = [],
  previousEntries = [],
  scope = null
}: AvailabilityHistoryRunFinalizationInput = {}) {
  const previousHistoryMap = new Map(
    normalizeHistoryResultArray(normalizeHistoryEntrySource(previousEntries))
      .map((entry) => [entry.id, entry])
  )
  const currentEntriesMap = new Map()
  const checkedHealthyIds = normalizeHistoryBookmarkIdSet(checkedHealthyBookmarkIds)
  const checkedHealthyEvidence = normalizeHealthyBookmarkEvidence(checkedHealthyBookmarks)
  const normalizedCompletedAt = Number.isFinite(Number(completedAt))
    ? Number(completedAt)
    : Date.now()

  for (const result of normalizeHistoryResultArray(normalizeHistoryEntrySource(currentEntries))) {
    currentEntriesMap.set(result.id, result)
  }

  const nextEntries = [...currentEntriesMap.values()].sort((left, right) => {
    return compareByPathTitle(left, right)
  })
  const newResults = nextEntries.filter((entry) => {
    return !isSameHistoryEntryIdentity(previousHistoryMap.get(entry.id), entry)
  })
  const recoveredResults = [...previousHistoryMap.values()]
    .filter((entry) => {
      const healthyUrl = checkedHealthyEvidence.get(entry.id)
      const hasMatchingHealthyEvidence =
        healthyUrl === entry.url ||
        (checkedHealthyIds.has(entry.id) && !checkedHealthyEvidence.has(entry.id))
      return hasMatchingHealthyEvidence && !currentEntriesMap.has(entry.id)
    })
    .sort((left, right) => compareByPathTitle(left, right))
  const reviewCount = nextEntries.filter((entry) => entry.status === 'review').length
  const failedCount = nextEntries.filter((entry) => entry.status === 'failed').length

  return {
    runId: `run-${normalizedCompletedAt}`,
    completedAt: normalizedCompletedAt,
    scope: normalizeHistoryRunScope(scope),
    results: nextEntries,
    newResults,
    recoveredResults,
    summary: {
      totalAbnormal: nextEntries.length,
      newCount: newResults.length,
      persistentCount: nextEntries.length - newResults.length,
      recoveredCount: recoveredResults.length,
      reviewCount,
      failedCount
    }
  }
}

function normalizeDetectionHistoryRuns(rawHistory) {
  if (Array.isArray(rawHistory.runs)) {
    return rawHistory.runs.flatMap(run => { const mappedResult = normalizeDetectionHistoryRun(run); return mappedResult ? [mappedResult] : [] })
      .sort((left, right) => right.completedAt - left.completedAt)
  }

  if (Array.isArray(rawHistory.results)) {
    const legacyResults = normalizeHistoryResultArray(rawHistory.results)
    const completedAt = Number(rawHistory.lastRunAt) || 0
    const reviewCount = legacyResults.filter((entry) => entry.status === 'review').length
    const failedCount = legacyResults.filter((entry) => entry.status === 'failed').length

    return [
      normalizeDetectionHistoryRun({
        runId: completedAt ? `legacy-${completedAt}` : 'legacy-run',
        completedAt,
        results: legacyResults.map((entry) => ({
          ...entry,
          streak: 1
        })),
        newResults: legacyResults,
        recoveredResults: [],
        summary: {
          totalAbnormal: legacyResults.length,
          newCount: legacyResults.length,
          persistentCount: 0,
          recoveredCount: 0,
          reviewCount,
          failedCount
        }
      })
    ].filter(Boolean)
  }

  return []
}

function serializeDetectionHistory(runs) {
  return {
    version: 2,
    runs: runs.slice(0, HISTORY_LOG_LIMIT).map((run) => ({
      runId: run.runId,
      completedAt: run.completedAt,
      scope: run.scope,
      results: run.results.map((result) => ({
        id: result.id,
        title: result.title,
        url: result.url,
        path: result.path,
        status: result.status,
        streak: result.streak
      })),
      newResults: run.newResults.map((result) => ({
        id: result.id,
        title: result.title,
        url: result.url,
        path: result.path,
        status: result.status,
        streak: result.streak
      })),
      recoveredResults: run.recoveredResults.map((result) => ({
        id: result.id,
        title: result.title,
        url: result.url,
        path: result.path,
        status: result.status,
        streak: result.streak
      })),
      summary: run.summary
    }))
  }
}

async function saveDetectionHistory(runs = managerState.historyRuns) {
  await setLocalStorage({
    [STORAGE_KEYS.detectionHistory]: serializeDetectionHistory(runs)
  })
}

export function hydrateDetectionHistory(rawHistory, callbacks) {
  managerState.historyRuns = []
  managerState.previousHistoryMap = new Map()
  managerState.historyRecoveredResults = []
  managerState.historyNewCount = 0
  managerState.historyPersistentCount = 0

  if (!rawHistory || typeof rawHistory !== 'object') {
    managerState.historyLastRunAt = 0
    return
  }

  const normalizedRuns = normalizeDetectionHistoryRuns(rawHistory)
  managerState.historyRuns = normalizedRuns.slice(0, HISTORY_LOG_LIMIT)
  syncHistoryComparisonScope(callbacks)
}

function getLatestHistoryRunForScope(callbacks, scopeKey = callbacks.getCurrentAvailabilityScopeMeta().key) {
  return managerState.historyRuns.find((run) => {
    return String(run?.scope?.key || 'all') === String(scopeKey || 'all')
  }) || null
}

export function getHistoryRunsForScope(callbacks, scopeKey = callbacks.getCurrentAvailabilityScopeMeta().key) {
  return managerState.historyRuns.filter((run) => {
    return String(run?.scope?.key || 'all') === String(scopeKey || 'all')
  })
}

export function getHistoricalAbnormalStreak(bookmarkId, bookmarkUrl, callbacks) {
  const normalizedId = String(bookmarkId || '').trim()
  const normalizedUrl = String(bookmarkUrl || '').trim()
  if (!normalizedId || !normalizedUrl) {
    return 0
  }

  const currentScopeKey = callbacks.getCurrentAvailabilityScopeMeta().key
  let streak = 0

  for (const run of managerState.historyRuns) {
    if (String(run?.scope?.key || 'all') !== currentScopeKey) {
      continue
    }

    const resultById = new Map((run.results || []).map((result) => [String(result.id), result]))
    const entry = resultById.get(normalizedId)
    if (!isSameHistoryEntryIdentity(entry, {
      id: normalizedId,
      url: normalizedUrl
    })) {
      break
    }

    streak += 1
  }

  return streak
}

export function syncHistoryComparisonScope(callbacks) {
  managerState.previousHistoryMap = new Map()

  const latestScopeRun = getLatestHistoryRunForScope(callbacks)
  managerState.historyLastRunAt = latestScopeRun?.completedAt || 0
  managerState.historyRecoveredResults = latestScopeRun?.recoveredResults?.slice() || []
  managerState.historyNewCount = Number(latestScopeRun?.summary?.newCount) || 0
  managerState.historyPersistentCount = Number(latestScopeRun?.summary?.persistentCount) || 0

  for (const entry of latestScopeRun?.results || []) {
    managerState.previousHistoryMap.set(entry.id, {
      id: entry.id,
      title: entry.title,
      url: entry.url,
      path: entry.path,
      status: entry.status,
      streak: Number(entry.streak) || 1
    })
  }
}

export async function finalizeDetectionHistory(
  callbacks,
  {
    checkedHealthyBookmarks = [],
    checkedHealthyBookmarkIds = []
  }: Pick<
    AvailabilityHistoryRunFinalizationInput,
    'checkedHealthyBookmarks' | 'checkedHealthyBookmarkIds'
  > = {}
) {
  const scopeMeta = callbacks.getCurrentAvailabilityScopeMeta()
  const completedAt = Date.now()
  const latestRun = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarks,
    checkedHealthyBookmarkIds,
    completedAt,
    currentEntries: managerState.currentHistoryEntries,
    previousEntries: managerState.previousHistoryMap,
    scope: scopeMeta
  })
  const nextHistoryRuns = [latestRun, ...managerState.historyRuns]
    .slice(0, HISTORY_LOG_LIMIT)

  await saveDetectionHistory(nextHistoryRuns)
  managerState.historyRuns = nextHistoryRuns
  syncHistoryComparisonScope(callbacks)
}

export function syncHistoryEntryStatus(bookmarkId, status) {
  managerState.currentHistoryEntries = managerState.currentHistoryEntries.map((entry) => {
    if (String(entry.id) !== String(bookmarkId)) {
      return entry
    }

    return {
      ...entry,
      status
    }
  })
}

export function upsertAvailabilityHistoryEntry(result) {
  const bookmarkId = String(result?.id || '').trim()
  if (!bookmarkId) {
    return
  }

  const nextEntry = {
    id: bookmarkId,
    title: String(result.title || '未命名书签'),
    url: String(result.url || ''),
    path: String(result.path || ''),
    status: String(result.status || 'review'),
    streak: Number(result.abnormalStreak) || 1
  }
  const existingIndex = managerState.currentHistoryEntries.findIndex((entry) => {
    return String(entry.id) === bookmarkId
  })

  if (existingIndex === -1) {
    managerState.currentHistoryEntries.push(nextEntry)
    return
  }

  managerState.currentHistoryEntries[existingIndex] = nextEntry
}

function getAvailabilityHistoryLogState(callbacks) {
  const scopeRuns = getHistoryRunsForScope(callbacks)

  if (!scopeRuns.length) {
    return {
      collapsed: false,
      emptyCopy: managerState.historyRuns.length
        ? '当前范围暂无检测日志。'
        : '完成检测后会保留日志。',
      maxAbnormalCount: 1,
      runs: []
    }
  }

  const maxAbnormalCount = Math.max(
    ...scopeRuns.map((run) => Math.max(Number(run.summary?.totalAbnormal) || 0, 1)),
    1
  )

  return {
    collapsed: managerState.historyLogsCollapsed,
    emptyCopy: '',
    maxAbnormalCount,
    runs: scopeRuns
  }
}

export function renderAvailabilityHistory(callbacks) {
  const scopeMeta = callbacks.getCurrentAvailabilityScopeMeta()
  const scopeRuns = getHistoryRunsForScope(callbacks)
  const latestRun = scopeRuns[0] || null

  publishAvailabilityHistory({
    controls: {
      clearDisabled:
        availabilityState.deleting ||
        availabilityState.running ||
        availabilityState.retestingSelection ||
        managerState.historyRuns.length === 0,
      logCount: scopeRuns.length,
      logToggleDisabled: scopeRuns.length === 0,
      logToggleLabel: managerState.historyLogsCollapsed ? '展开日志' : '收起日志',
      metrics: {
        newCount: managerState.historyNewCount,
        persistentCount: managerState.historyPersistentCount,
        recoveredCount: managerState.historyRecoveredResults.length
      },
      subtitle: getAvailabilityHistorySubtitle(scopeMeta, scopeRuns, latestRun),
      timestamp: managerState.historyLastRunAt ? formatDateTime(managerState.historyLastRunAt) : '尚无历史'
    },
    log: getAvailabilityHistoryLogState(callbacks),
    recovered: {
      results: managerState.historyRecoveredResults,
      emptyCopy: managerState.historyLastRunAt
        ? '最近一次未发现已恢复。'
        : managerState.historyRuns.length
          ? '当前范围暂无已恢复记录。'
          : '完成检测后显示已恢复书签。'
    },
  })
}

function getAvailabilityHistorySubtitle(scopeMeta, scopeRuns, latestRun): string {
  if (scopeRuns.length) {
    return `${scopeMeta.label} · ${scopeRuns.length} 次记录 · ${formatDateTime(latestRun?.completedAt || 0)}`
  }
  if (managerState.historyRuns.length) {
    return `${scopeMeta.label} 暂无历史；全部范围 ${managerState.historyRuns.length} 次。`
  }
  return '完成检测后保留日志和趋势。'
}

export async function clearDetectionHistoryLogs(callbacks) {
  if (
    availabilityState.deleting ||
    availabilityState.runSessionActive ||
    managerState.historyRuns.length === 0
  ) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `清空 ${managerState.historyRuns.length} 次检测历史日志？`,
        copy: '检测历史、趋势对比和连续异常计数会被清除。当前检测结果不会被删除。',
        confirmLabel: '清空历史日志',
        label: '清空历史',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  const releaseMutationLock = await callbacks.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }

  try {
    await saveDetectionHistory([])
    managerState.historyRuns = []
    managerState.previousHistoryMap = new Map()
    managerState.historyLastRunAt = 0
    managerState.historyRecoveredResults = []
    managerState.historyNewCount = 0
    managerState.historyPersistentCount = 0
    managerState.historyLogsCollapsed = false
    availabilityState.reviewResults = availabilityState.reviewResults.map((result) => ({
      ...result,
      historyStatus: '',
      abnormalStreak: 0
    }))
    availabilityState.failedResults = availabilityState.failedResults.map((result) => ({
      ...result,
      historyStatus: '',
      abnormalStreak: 0
    }))
    availabilityState.lastError = '已清空历史日志。'
    callbacks.renderAvailabilitySection()
  } finally {
    releaseMutationLock()
  }
}

export function toggleHistoryLogsCollapsed(callbacks) {
  if (!getHistoryRunsForScope(callbacks).length) {
    return
  }

  managerState.historyLogsCollapsed = !managerState.historyLogsCollapsed
  renderAvailabilityHistory(callbacks)
}
