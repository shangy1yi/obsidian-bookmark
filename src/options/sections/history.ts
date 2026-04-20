// @ts-nocheck
import { STORAGE_KEYS } from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { displayUrl } from '../../shared/text.js'
import {
  availabilityState,
  managerState,
  normalizeHistoryRunScope
} from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import {
  compareByPathTitle,
  formatDateTime
} from '../shared-options/utils.js'
import { HISTORY_LOG_LIMIT } from '../shared-options/constants.js'

function normalizeHistoryResultArray(entries) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .map((entry) => {
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
    })
    .filter(Boolean)
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

function normalizeDetectionHistoryRuns(rawHistory) {
  if (Array.isArray(rawHistory.runs)) {
    return rawHistory.runs
      .map((run) => normalizeDetectionHistoryRun(run))
      .filter(Boolean)
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

export function getHistoricalAbnormalStreak(bookmarkId, callbacks) {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return 0
  }

  const currentScopeKey = callbacks.getCurrentAvailabilityScopeMeta().key
  let streak = 0

  for (const run of managerState.historyRuns) {
    if (String(run?.scope?.key || 'all') !== currentScopeKey) {
      continue
    }

    const entry = (run.results || []).find((result) => String(result.id) === normalizedId)
    if (!entry) {
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

export async function finalizeDetectionHistory(callbacks) {
  const scopeMeta = callbacks.getCurrentAvailabilityScopeMeta()
  const previousHistoryMap = new Map(managerState.previousHistoryMap)
  const currentEntriesMap = new Map()
  const completedAt = Date.now()

  for (const result of managerState.currentHistoryEntries) {
    const bookmarkId = String(result?.id || '').trim()
    if (!bookmarkId) {
      continue
    }

    currentEntriesMap.set(bookmarkId, {
      id: bookmarkId,
      title: String(result.title || '未命名书签'),
      url: String(result.url || ''),
      path: String(result.path || ''),
      status: result.status === 'failed' ? 'failed' : 'review',
      streak: Math.max(1, Number(result.streak) || 1)
    })
  }

  const nextEntries = [...currentEntriesMap.values()].sort((left, right) => {
    return compareByPathTitle(left, right)
  })

  managerState.historyNewCount = nextEntries.filter((entry) => {
    return !previousHistoryMap.has(entry.id)
  }).length
  managerState.historyPersistentCount = nextEntries.length - managerState.historyNewCount

  managerState.historyRecoveredResults = [...previousHistoryMap.values()]
    .filter((entry) => !currentEntriesMap.has(entry.id))
    .sort((left, right) => compareByPathTitle(left, right))

  managerState.historyLastRunAt = completedAt
  const reviewCount = nextEntries.filter((entry) => entry.status === 'review').length
  const failedCount = nextEntries.filter((entry) => entry.status === 'failed').length
  const latestRun = {
    runId: `run-${completedAt}`,
    completedAt,
    scope: scopeMeta,
    results: nextEntries.map((entry) => ({
      ...entry
    })),
    newResults: nextEntries
      .filter((entry) => !previousHistoryMap.has(entry.id))
      .map((entry) => ({
        ...entry
      })),
    recoveredResults: managerState.historyRecoveredResults.map((entry) => ({
      ...entry
    })),
    summary: {
      totalAbnormal: nextEntries.length,
      newCount: managerState.historyNewCount,
      persistentCount: managerState.historyPersistentCount,
      recoveredCount: managerState.historyRecoveredResults.length,
      reviewCount,
      failedCount
    }
  }

  managerState.historyRuns = [latestRun, ...managerState.historyRuns]
    .slice(0, HISTORY_LOG_LIMIT)
  syncHistoryComparisonScope(callbacks)
  await saveDetectionHistory()
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

function buildRecoveredResultCard(result) {
  return `
    <article class="detect-result-card compact">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <span class="options-chip success">已恢复</span>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(result.title || '未命名书签')}</strong>
        <div class="detect-result-url">${escapeHtml(displayUrl(result.url))}</div>
        ${result.streak ? `<div class="detect-result-detail">恢复前曾连续异常 ${escapeHtml(String(result.streak))} 次</div>` : ''}
        <p class="detect-result-path" title="${escapeAttr(result.path || '未归档路径')}">${escapeHtml(result.path || '未归档路径')}</p>
      </div>
    </article>
  `
}

function buildHistoryRunCard(run, index, maxAbnormalCount = 1) {
  const newResults = Array.isArray(run.newResults) ? run.newResults : []
  const recoveredResults = Array.isArray(run.recoveredResults) ? run.recoveredResults : []
  const newResultIds = new Set(newResults.map((result) => String(result?.id || '')))
  const persistentResults = (Array.isArray(run.results) ? run.results : []).filter((result) => {
    return !newResultIds.has(String(result?.id || ''))
  })
  const topStreak = (run.results || []).length === 0
    ? 0
    : Math.max(...run.results.map((result) => Number(result.streak) || 1), 1)
  const runLabel = index === 0 ? '最近一次' : `第 ${index + 1} 次记录`
  const abnormalCount = Number(run.summary?.totalAbnormal) || 0
  const width = abnormalCount <= 0 ? 0 : Math.max(8, Math.round((abnormalCount / maxAbnormalCount) * 100))

  return `
    <article class="detect-result-card history-run-card">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <span class="options-chip muted">${escapeHtml(runLabel)}</span>
          <span class="options-chip muted">${escapeHtml(run.scope?.label || '全部书签')}</span>
          <span class="options-chip warning">新增 ${escapeHtml(String(Number(run.summary?.newCount) || 0))}</span>
          <span class="options-chip muted">持续 ${escapeHtml(String(Number(run.summary?.persistentCount) || 0))}</span>
          <span class="options-chip success">恢复 ${escapeHtml(String(Number(run.summary?.recoveredCount) || 0))}</span>
        </div>
        <span class="option-value">${escapeHtml(formatDateTime(run.completedAt))}</span>
      </div>
      <div class="detect-result-copy">
        <div class="history-run-trend">
          <div class="history-trend-meta">
            <strong>异常 ${escapeHtml(String(abnormalCount))} 条</strong>
            <span>低置信 ${escapeHtml(String(Number(run.summary?.reviewCount) || 0))} · 高置信 ${escapeHtml(String(Number(run.summary?.failedCount) || 0))}</span>
          </div>
          <div class="history-trend-bar-track" aria-hidden="true">
            <span class="history-trend-bar" style="width:${width}%"></span>
          </div>
          <div class="history-trend-copy">
            新增 ${escapeHtml(String(Number(run.summary?.newCount) || 0))} · 持续 ${escapeHtml(String(Number(run.summary?.persistentCount) || 0))} · 恢复 ${escapeHtml(String(Number(run.summary?.recoveredCount) || 0))}
          </div>
        </div>
        <div class="history-run-summary">
          ${topStreak > 0
            ? `当前记录中最高连续异常为 ${escapeHtml(String(topStreak))} 次，检测范围为 ${escapeHtml(run.scope?.label || '全部书签')}。`
            : `本次检测没有发现异常，检测范围为 ${escapeHtml(run.scope?.label || '全部书签')}。`}
        </div>
        <div class="history-run-section">
          <strong>本次新增异常</strong>
          ${newResults.length
            ? `<ul class="history-run-list">${newResults.slice(0, 6).map((result) => `<li>${escapeHtml(result.title || '未命名书签')} · ${escapeHtml(displayUrl(result.url))} · 连续异常 ${escapeHtml(String(result.streak || 1))} 次</li>`).join('')}</ul>${newResults.length > 6 ? `<p class="history-run-more">还有 ${escapeHtml(String(newResults.length - 6))} 条新增异常未展开。</p>` : ''}`
            : '<p class="history-run-empty">本次没有新增异常。</p>'}
        </div>
        <div class="history-run-section">
          <strong>本次持续异常</strong>
          ${persistentResults.length
            ? `<ul class="history-run-list">${persistentResults.slice(0, 6).map((result) => `<li>${escapeHtml(result.title || '未命名书签')} · ${escapeHtml(displayUrl(result.url))} · 连续异常 ${escapeHtml(String(result.streak || 1))} 次</li>`).join('')}</ul>${persistentResults.length > 6 ? `<p class="history-run-more">还有 ${escapeHtml(String(persistentResults.length - 6))} 条持续异常未展开。</p>` : ''}`
            : '<p class="history-run-empty">本次没有持续异常。</p>'}
        </div>
        <div class="history-run-section">
          <strong>本次已恢复</strong>
          ${recoveredResults.length
            ? `<ul class="history-run-list">${recoveredResults.slice(0, 4).map((result) => `<li>${escapeHtml(result.title || '未命名书签')} · ${escapeHtml(displayUrl(result.url))}</li>`).join('')}</ul>${recoveredResults.length > 4 ? `<p class="history-run-more">还有 ${escapeHtml(String(recoveredResults.length - 4))} 条已恢复结果未展开。</p>` : ''}`
            : '<p class="history-run-empty">本次没有已恢复结果。</p>'}
        </div>
      </div>
    </article>
  `
}

function renderHistoryLogList(callbacks) {
  if (!dom.availabilityHistoryLogList) {
    return
  }

  const scopeRuns = getHistoryRunsForScope(callbacks)
  dom.availabilityHistoryLogList.classList.toggle(
    'hidden',
    managerState.historyLogsCollapsed && scopeRuns.length > 0
  )

  if (managerState.historyLogsCollapsed && scopeRuns.length > 0) {
    return
  }

  if (!scopeRuns.length) {
    dom.availabilityHistoryLogList.innerHTML = managerState.historyRuns.length
      ? '<div class="detect-empty">当前范围还没有检测日志，切换范围或完成一次检测后会在这里展示。</div>'
      : '<div class="detect-empty">完成检测后，这里会保留最近多次检测日志。</div>'
    return
  }

  const maxAbnormalCount = Math.max(
    ...scopeRuns.map((run) => Math.max(Number(run.summary?.totalAbnormal) || 0, 1)),
    1
  )

  dom.availabilityHistoryLogList.innerHTML = scopeRuns
    .map((run, index) => buildHistoryRunCard(run, index, maxAbnormalCount))
    .join('')
}

export function renderAvailabilityHistory(callbacks) {
  if (!dom.availabilityHistorySubtitle) {
    return
  }

  const scopeMeta = callbacks.getCurrentAvailabilityScopeMeta()
  const scopeRuns = getHistoryRunsForScope(callbacks)
  const latestRun = scopeRuns[0] || null
  dom.availabilityHistoryNew.textContent = String(managerState.historyNewCount)
  dom.availabilityHistoryPersistent.textContent = String(managerState.historyPersistentCount)
  dom.availabilityHistoryRecovered.textContent = String(managerState.historyRecoveredResults.length)
  dom.availabilityHistoryTimestamp.textContent = managerState.historyLastRunAt
    ? formatDateTime(managerState.historyLastRunAt)
    : '尚无历史'
  dom.availabilityClearHistory.disabled =
    availabilityState.deleting ||
    availabilityState.running ||
    availabilityState.retestingSelection ||
    managerState.historyRuns.length === 0
  dom.availabilityHistoryLogCount.textContent = `${scopeRuns.length} 次记录`
  if (dom.availabilityToggleHistoryLogs) {
    dom.availabilityToggleHistoryLogs.disabled = scopeRuns.length === 0
    dom.availabilityToggleHistoryLogs.textContent = managerState.historyLogsCollapsed ? '展开日志' : '收起日志'
  }
  dom.availabilityHistorySubtitle.textContent = scopeRuns.length
    ? `当前显示范围：${scopeMeta.label}。已保留该范围最近 ${scopeRuns.length} 次检测日志，最近一次完成于 ${formatDateTime(latestRun?.completedAt || 0)}。`
    : managerState.historyRuns.length
      ? `当前显示范围：${scopeMeta.label}。该范围还没有检测历史；全部范围共保留 ${managerState.historyRuns.length} 次日志。`
      : '完成一次检测后，这里会生成一条检测日志，保留最近多次结果用于趋势和连续异常对比。'

  renderHistoryLogList(callbacks)

  if (!managerState.historyRecoveredResults.length) {
    dom.availabilityHistoryRecoveredList.innerHTML = managerState.historyLastRunAt
      ? '<div class="detect-empty">最近一次完整检测未发现已恢复书签。</div>'
      : managerState.historyRuns.length
        ? '<div class="detect-empty">当前范围还没有已恢复记录。</div>'
        : '<div class="detect-empty">完成检测后，这里会展示相较于上一次已恢复的书签。</div>'
    return
  }

  dom.availabilityHistoryRecoveredList.innerHTML = managerState.historyRecoveredResults
    .map((result) => buildRecoveredResultCard(result))
    .join('')
}

export async function clearDetectionHistoryLogs(callbacks) {
  if (
    availabilityState.deleting ||
    availabilityState.running ||
    availabilityState.retestingSelection ||
    managerState.historyRuns.length === 0
  ) {
    return
  }

  if (!window.confirm(`确认清空最近 ${managerState.historyRuns.length} 次检测历史日志？`)) {
    return
  }

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
  await saveDetectionHistory([])
  availabilityState.lastError = '已清空历史日志。'
  callbacks.renderAvailabilitySection()
}

export function toggleHistoryLogsCollapsed(callbacks) {
  if (!getHistoryRunsForScope(callbacks).length) {
    return
  }

  managerState.historyLogsCollapsed = !managerState.historyLogsCollapsed
  renderAvailabilityHistory(callbacks)
}
