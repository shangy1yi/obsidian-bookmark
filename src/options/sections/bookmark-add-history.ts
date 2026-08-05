import {
  BOOKMARK_ADD_HISTORY_LIMIT,
  STORAGE_KEYS
} from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { formatDateTime } from '../shared-options/utils.js'
import { publishBookmarkAddHistory } from '../components/bookmark-add-history-store.js'
import type {
  BookmarkAddHistoryHeaderState,
  BookmarkAddHistorySummaryState
} from '../components/BookmarkAddHistoryTypes.js'

export interface BookmarkAddHistoryEntry {
  id: string
  createdAt: number
  bookmarkId: string
  title: string
  url: string
  originalFolderPath: string
  targetFolderPath: string
  targetFolderId: string
  recommendationKind: 'existing' | 'new'
  moved: boolean
  confidence: number
  reason: string
  summary: string
  suggestedTitle: string
}

function normalizeConfidence(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, 1)) : 0
}

function normalizeRecommendationKind(value: unknown): 'existing' | 'new' {
  return String(value || '').trim() === 'new' ? 'new' : 'existing'
}

function normalizeHistoryEntry(entry: any): BookmarkAddHistoryEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const bookmarkId = String(entry.bookmarkId || '').trim()
  const url = String(entry.url || '').trim()
  const createdAt = Number(entry.createdAt) || 0
  if (!bookmarkId || !url || !createdAt) {
    return null
  }

  const targetFolderPath = String(entry.targetFolderPath || entry.folderPath || '').trim()
  return {
    id: String(entry.id || `bookmark-add-${createdAt}-${bookmarkId}`).trim(),
    createdAt,
    bookmarkId,
    title: String(entry.title || '未命名书签').trim() || '未命名书签',
    url,
    originalFolderPath: String(entry.originalFolderPath || '').trim(),
    targetFolderPath,
    targetFolderId: String(entry.targetFolderId || '').trim(),
    recommendationKind: normalizeRecommendationKind(entry.recommendationKind),
    moved: Boolean(entry.moved),
    confidence: normalizeConfidence(entry.confidence),
    reason: String(entry.reason || '').trim(),
    summary: String(entry.summary || '').trim(),
    suggestedTitle: String(entry.suggestedTitle || '').trim()
  }
}

function normalizeBookmarkAddHistory(rawHistory: unknown): BookmarkAddHistoryEntry[] {
  const source = rawHistory && typeof rawHistory === 'object'
    ? rawHistory as { entries?: unknown }
    : {}
  const entries = Array.isArray(source.entries)
    ? source.entries
    : Array.isArray(rawHistory)
      ? rawHistory
      : []

  return entries.flatMap(entry => { const mappedResult = normalizeHistoryEntry(entry); return mappedResult ? [mappedResult] : [] })
    .sort((left, right) => right!.createdAt - left!.createdAt)
    .slice(0, BOOKMARK_ADD_HISTORY_LIMIT) as BookmarkAddHistoryEntry[]
}

export function serializeBookmarkAddHistory(
  entries: BookmarkAddHistoryEntry[] = managerState.bookmarkAddHistory
) {
  return {
    version: 1,
    entries: normalizeBookmarkAddHistory(entries).map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      bookmarkId: entry.bookmarkId,
      title: entry.title,
      url: entry.url,
      originalFolderPath: entry.originalFolderPath,
      targetFolderPath: entry.targetFolderPath,
      targetFolderId: entry.targetFolderId,
      recommendationKind: entry.recommendationKind,
      moved: entry.moved,
      confidence: entry.confidence,
      reason: entry.reason,
      summary: entry.summary,
      suggestedTitle: entry.suggestedTitle
    }))
  }
}

export function hydrateBookmarkAddHistory(rawHistory: unknown): void {
  managerState.bookmarkAddHistory = normalizeBookmarkAddHistory(rawHistory)
}

async function saveBookmarkAddHistory(entries = managerState.bookmarkAddHistory): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.bookmarkAddHistory]: serializeBookmarkAddHistory(entries)
  })
}

function getBookmarkAddHistorySummary() {
  const entries = managerState.bookmarkAddHistory
  return {
    total: entries.length,
    moved: entries.filter((entry) => entry.moved).length,
    existing: entries.filter((entry) => entry.recommendationKind === 'existing').length,
    newFolder: entries.filter((entry) => entry.recommendationKind === 'new').length
  }
}

export function renderBookmarkAddHistory(): void {
  const entries = managerState.bookmarkAddHistory
  const summary = getBookmarkAddHistorySummary()
  const latestEntry = entries[0] || null
  const timestamp = latestEntry
    ? formatDateTime(latestEntry.createdAt)
    : '尚无历史'
  const headerState: BookmarkAddHistoryHeaderState = {
    clearDisabled: summary.total === 0,
    subtitle: summary.total
      ? `最近 ${summary.total} 条记录 · ${formatDateTime(latestEntry!.createdAt)}`
      : '自动分析完成后，这里记录新增书签的位置。',
    timestamp
  }
  const summaryState: BookmarkAddHistorySummaryState = {
    existing: summary.existing,
    moved: summary.moved,
    newFolder: summary.newFolder,
    total: summary.total
  }

  publishBookmarkAddHistory({
    entries,
    header: headerState,
    summary: summaryState
  })
}

export async function clearBookmarkAddHistory(callbacks: {
  renderAvailabilitySection: () => void
  confirm?: (options: {
    title: string
    copy: string
    confirmLabel: string
    label: string
    tone: string
  }) => Promise<boolean>
}): Promise<void> {
  if (!managerState.bookmarkAddHistory.length) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `清空 ${managerState.bookmarkAddHistory.length} 条添加书签历史？`,
        copy: '只会清空 AI 整理记录，不会删除已经保存的书签。',
        confirmLabel: '清空整理记录',
        label: '清空历史',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  managerState.bookmarkAddHistory = []
  await saveBookmarkAddHistory([])
  availabilityState.lastError = '已清空添加书签历史。'
  callbacks.renderAvailabilitySection()
}
