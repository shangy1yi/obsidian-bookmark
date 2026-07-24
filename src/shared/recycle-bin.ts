import { RECYCLE_BIN_LIMIT, STORAGE_KEYS } from './constants.js'
import { getBookmarkById, removeBookmark } from './bookmarks-api.js'
import {
  getLocalStorage,
  setLocalStorage,
  withLocalStorageTransaction,
  type LocalStorageTransaction
} from './storage.js'

export interface RecycleEntry {
  recycleId: string
  deletedAt: number
  bookmarkId?: string
  title?: string
  url?: string
  parentId?: string
  index?: number
  path?: string
  [key: string]: unknown
}

export const RECYCLE_DELETE_ROLLBACK_FAILED_CODE = 'recycle-delete-rollback-failed'
export const RECYCLE_RESTORE_ROLLBACK_FAILED_CODE = 'recycle-restore-rollback-failed'
export const RECYCLE_RESTORE_SOURCE_EXISTS_CODE = 'recycle-restore-source-exists'

class RecycleLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'RecycleLifecycleError'
  }
}

export async function appendRecycleEntry(entry: RecycleEntry): Promise<void> {
  return appendRecycleEntries([entry])
}

export async function appendRecycleEntries(entries: RecycleEntry[]): Promise<void> {
  return withLocalStorageTransaction((transaction) =>
    appendRecycleEntriesWithoutLock(entries, transaction)
  )
}

export async function removeRecycleEntry(recycleId: string): Promise<void> {
  return removeRecycleEntries([recycleId])
}

export async function removeRecycleEntries(recycleIds: string[]): Promise<void> {
  return withLocalStorageTransaction((transaction) =>
    removeRecycleEntriesWithoutLock(recycleIds, transaction)
  )
}

export async function loadRecycleBinEntries(): Promise<RecycleEntry[]> {
  const stored = await getLocalStorage<Record<string, unknown>>([STORAGE_KEYS.recycleBin])
  return normalizeRecycleEntries(stored[STORAGE_KEYS.recycleBin])
}

export async function deleteBookmarkToRecycle(
  bookmarkId: string,
  entry: RecycleEntry,
  {
    expectedUrl = ''
  }: {
    expectedUrl?: string
  } = {}
): Promise<boolean> {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const recycleId = String(entry?.recycleId || '').trim()
  if (!normalizedBookmarkId || !recycleId) {
    throw new Error('缺少可删除的书签或回收站记录。')
  }

  return withLocalStorageTransaction(async (transaction) => {
    const previousEntries = await loadRecycleBinEntries()
    let recycleEntryAppended = false
    try {
      await appendRecycleEntriesWithoutLock([{ ...entry, recycleId }], transaction)
      recycleEntryAppended = true
      const normalizedExpectedUrl = String(expectedUrl || '').trim()
      if (normalizedExpectedUrl) {
        const latestBookmark = await getBookmarkById(normalizedBookmarkId)
        if (String(latestBookmark?.url || '') !== normalizedExpectedUrl) {
          await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
          recycleEntryAppended = false
          return false
        }
      }
      await removeBookmark(normalizedBookmarkId)
      return true
    } catch (error) {
      if (recycleEntryAppended) {
        try {
          await replaceRecycleEntriesWithoutLock(previousEntries, transaction)
        } catch (cleanupError) {
          throw new RecycleLifecycleError(
            `${formatRecycleBinError(error)} 回收站记录自动回滚失败：` +
            `${formatRecycleBinError(cleanupError)}`,
            RECYCLE_DELETE_ROLLBACK_FAILED_CODE
          )
        }
      }
      throw error
    }
  })
}

export async function restoreBookmarkFromRecycleEntry(
  recycleId: string,
  createRestoredBookmark: () => Promise<chrome.bookmarks.BookmarkTreeNode>
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (!normalizedRecycleId) {
    throw new Error('缺少待恢复的回收站记录。')
  }

  return withLocalStorageTransaction(async (transaction) => {
    const currentEntries = await loadRecycleBinEntries()
    const currentEntry = currentEntries.find((entry) => {
      return String(entry.recycleId) === normalizedRecycleId
    })
    if (!currentEntry) {
      throw new Error('回收站记录已不存在，已取消重复恢复。')
    }

    const sourceBookmarkId = String(currentEntry.bookmarkId || '').trim()
    const sourceUrl = String(currentEntry.url || '').trim()
    if (sourceBookmarkId && sourceUrl) {
      const sourceBookmark = await getBookmarkById(sourceBookmarkId)
      if (sourceBookmark && String(sourceBookmark.url || '').trim() === sourceUrl) {
        await removeRecycleEntriesWithoutLock([normalizedRecycleId], transaction)
        throw new RecycleLifecycleError(
          '原书签仍然存在，已清理未完成删除留下的回收站记录；未创建副本。',
          RECYCLE_RESTORE_SOURCE_EXISTS_CODE
        )
      }
    }

    let createdBookmark: chrome.bookmarks.BookmarkTreeNode | null = null
    try {
      createdBookmark = await createRestoredBookmark()
      if (!createdBookmark?.id) {
        throw new Error('Chrome 未返回已恢复书签的标识。')
      }
      await removeRecycleEntriesWithoutLock([normalizedRecycleId], transaction)
      return createdBookmark
    } catch (error) {
      if (!createdBookmark?.id) {
        throw error
      }

      try {
        await removeBookmark(String(createdBookmark.id))
      } catch (rollbackError) {
        throw new RecycleLifecycleError(
          `${formatRecycleBinError(error)} ` +
          `刚恢复的书签自动回滚失败：${formatRecycleBinError(rollbackError)}`,
          RECYCLE_RESTORE_ROLLBACK_FAILED_CODE
        )
      }
      throw new Error(`${formatRecycleBinError(error)} 已撤销刚恢复的书签。`)
    }
  })
}

export function mergeRecycleEntries(
  incomingEntries: RecycleEntry[],
  existingEntries: RecycleEntry[] = []
): RecycleEntry[] {
  const merged = new Map<string, RecycleEntry>()
  const incomingIds = new Set(
    incomingEntries.map((entry) => String(entry?.recycleId || '').trim())
  )

  for (const entry of [...existingEntries, ...incomingEntries]) {
    const recycleId = String(entry?.recycleId || '').trim()
    if (!recycleId) {
      continue
    }
    merged.set(recycleId, {
      ...entry,
      recycleId
    })
  }

  return [...merged.values()]
    .sort((left, right) => {
      const leftIncoming = incomingIds.has(String(left.recycleId))
      const rightIncoming = incomingIds.has(String(right.recycleId))
      if (leftIncoming !== rightIncoming) {
        return leftIncoming ? -1 : 1
      }
      return (Number(right.deletedAt) || 0) - (Number(left.deletedAt) || 0)
    })
    .slice(0, RECYCLE_BIN_LIMIT)
}

function normalizeRecycleEntries(rawEntries: unknown): RecycleEntry[] {
  return Array.isArray(rawEntries)
    ? mergeRecycleEntries(rawEntries as RecycleEntry[])
    : []
}

function updateRecycleBinEntries(
  updater: (entries: RecycleEntry[]) => RecycleEntry[],
  transaction: LocalStorageTransaction
): Promise<void> {
  return loadRecycleBinEntries().then((currentEntries) => {
    const nextEntries = mergeRecycleEntries(updater(currentEntries))
    return setLocalStorage({
      [STORAGE_KEYS.recycleBin]: nextEntries
    }, { transaction })
  })
}

function appendRecycleEntriesWithoutLock(
  entries: RecycleEntry[],
  transaction: LocalStorageTransaction
): Promise<void> {
  return updateRecycleBinEntries(
    (currentEntries) => mergeRecycleEntries(entries, currentEntries),
    transaction
  )
}

function removeRecycleEntriesWithoutLock(
  recycleIds: string[],
  transaction: LocalStorageTransaction
): Promise<void> {
  const targetSet = new Set(
    recycleIds.flatMap((id) => {
      const normalizedId = String(id || '').trim()
      return normalizedId ? [normalizedId] : []
    })
  )
  return updateRecycleBinEntries(
    (currentEntries) => removeRecycleEntriesById(currentEntries, targetSet),
    transaction
  )
}

function replaceRecycleEntriesWithoutLock(
  entries: RecycleEntry[],
  transaction: LocalStorageTransaction
): Promise<void> {
  return setLocalStorage({
    [STORAGE_KEYS.recycleBin]: mergeRecycleEntries(entries)
  }, { transaction })
}

function removeRecycleEntriesById(
  entries: RecycleEntry[],
  targetSet: Set<string>
): RecycleEntry[] {
  return entries.filter((entry) => {
    return !targetSet.has(String(entry?.recycleId || ''))
  })
}

function formatRecycleBinError(error: unknown): string {
  return error instanceof Error ? error.message : '回收站操作失败。'
}
