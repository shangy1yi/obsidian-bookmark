import {
  BOOKMARKS_BAR_ID,
  RECYCLE_BIN_LIMIT
} from '../../shared/constants.js'
import {
  createBookmark,
  getBookmarkById,
  getBookmarkTree
} from '../../shared/bookmarks-api.js'
import { buildBookmarkCatalogSnapshot } from '../../shared/bookmark-catalog.js'
import {
  deleteBookmarkToRecycle,
  loadRecycleBinEntries,
  mergeRecycleEntries,
  RECYCLE_RESTORE_ROLLBACK_FAILED_CODE,
  RECYCLE_RESTORE_SOURCE_EXISTS_CODE,
  removeRecycleEntries,
  restoreBookmarkFromRecycleEntry,
  type RecycleEntry
} from '../../shared/recycle-bin.js'
import { createAutoBackupBeforeDangerousOperation, type DangerousOperationKind } from '../../shared/backup.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { isInteractionLocked, syncSelectionSet } from '../shared-options/utils.js'
import { publishRecycleBin } from '../components/recycle-bin-store.js'
import { publishRecycleControls } from '../components/recycle-controls-store.js'

export function normalizeRecycleBin(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return []
  }

  return rawEntries.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((entry) => {
      return {
        recycleId: String(entry?.recycleId || '').trim(),
        bookmarkId: String(entry?.bookmarkId || '').trim(),
        title: String(entry?.title || '未命名书签').trim() || '未命名书签',
        url: String(entry?.url || '').trim(),
        parentId: String(entry?.parentId || '').trim(),
        index: Number.isFinite(Number(entry?.index)) ? Number(entry.index) : 0,
        path: String(entry?.path || '').trim(),
        source: String(entry?.source || '删除').trim() || '删除',
        deletedAt: Number(entry?.deletedAt) || Date.now()
      }
    })(combineValue); return ((entry) => entry.recycleId && entry.url)(combinedResult) ? [combinedResult] : [] })
    .sort((left, right) => right.deletedAt - left.deletedAt)
}

function buildRecycleEntry(bookmark, source) {
  return {
    recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    bookmarkId: String(bookmark.id),
    title: bookmark.title || '未命名书签',
    url: bookmark.url,
    parentId: String(bookmark.parentId || ''),
    index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
    path: bookmark.path || '',
    source,
    deletedAt: Date.now()
  }
}

export function renderRecycleSection(callbacks) {
  syncSelectionSet(
    managerState.selectedRecycleIds,
    new Set(managerState.recycleBin.map((entry) => String(entry.recycleId)))
  )

  publishRecycleControls({
    busy: availabilityState.deleting,
    entryCount: managerState.recycleBin.length,
    locked: isInteractionLocked(),
    selectedCount: managerState.selectedRecycleIds.size
  })

  publishRecycleBin({
    entries: managerState.recycleBin,
    selectedIds: managerState.selectedRecycleIds,
    disabled: isInteractionLocked()
  })
}

export function clearRecycleSelection(callbacks) {
  managerState.selectedRecycleIds.clear()
  callbacks.renderAvailabilitySection()
}

export function toggleRecycleEntrySelection(recycleId, checked, callbacks) {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (isInteractionLocked() || !normalizedRecycleId) {
    return
  }

  if (checked === true) {
    managerState.selectedRecycleIds.add(normalizedRecycleId)
  } else if (checked === false) {
    managerState.selectedRecycleIds.delete(normalizedRecycleId)
  } else if (managerState.selectedRecycleIds.has(normalizedRecycleId)) {
    managerState.selectedRecycleIds.delete(normalizedRecycleId)
  } else {
    managerState.selectedRecycleIds.add(normalizedRecycleId)
  }
  callbacks.renderAvailabilitySection()
}

export function clearRecycleEntry(recycleId, callbacks) {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (isInteractionLocked() || !normalizedRecycleId) {
    return
  }

  void clearRecycleEntriesByIds([normalizedRecycleId], callbacks)
}

export function restoreRecycleEntry(recycleId, callbacks) {
  const normalizedRecycleId = String(recycleId || '').trim()
  if (isInteractionLocked() || !normalizedRecycleId) {
    return
  }

  restoreRecycleEntriesByIds([normalizedRecycleId], callbacks)
}

async function clearRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set<string>(recycleIds.flatMap(id => { const mappedResult = String(id); return mappedResult ? [mappedResult] : [] }))
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })

  if (!targetEntries.length || isInteractionLocked()) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: targetEntries.length === 1
          ? '清除这条回收站记录？'
          : `清除 ${targetEntries.length} 条回收站记录？`,
        copy: '这只会从扩展回收站中移除记录，之后无法再从扩展内恢复；不会再次修改 Chrome 书签。',
        confirmLabel: '清除记录',
        label: '清除回收站记录',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }
  if (isInteractionLocked()) {
    return
  }

  const releaseMutationLock = await callbacks.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }
  const lockedTargetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })
  if (!lockedTargetEntries.length) {
    releaseMutationLock()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  try {
    await removeRecycleEntries([...targetSet])
    managerState.recycleBin = managerState.recycleBin.filter((entry) => {
      return !targetSet.has(String(entry.recycleId))
    })
    for (const recycleId of targetSet) {
      managerState.selectedRecycleIds.delete(recycleId)
    }
    try {
      await refreshRecycleBinState()
      availabilityState.lastError = lockedTargetEntries.length === 1
        ? '已清除 1 条回收站记录。'
        : `已清除 ${lockedTargetEntries.length} 条回收站记录。`
    } catch (error) {
      const detail = error instanceof Error ? `：${error.message}` : ''
      availabilityState.lastError = `已清除 ${lockedTargetEntries.length} 条回收站记录，但刷新本地状态失败${detail}。`
    }
  } catch (error) {
    availabilityState.lastError =
      error instanceof Error ? `回收站记录清除失败：${error.message}` : '回收站记录清除失败。'
  } finally {
    availabilityState.deleting = false
    releaseMutationLock()
    callbacks.renderAvailabilitySection()
  }
}

export function selectAllRecycleEntries(callbacks) {
  if (isInteractionLocked()) {
    return
  }

  managerState.selectedRecycleIds = new Set(
    managerState.recycleBin.map((entry) => String(entry.recycleId))
  )
  callbacks.renderAvailabilitySection()
}

export async function restoreSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || isInteractionLocked()) {
    return
  }

  await restoreRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
  clearRecycleSelection(callbacks)
}

export async function clearSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || isInteractionLocked()) {
    return
  }

  await clearRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
}

async function restoreRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set(recycleIds.flatMap(id => { const mappedResult = String(id); return mappedResult ? [mappedResult] : [] }))
  if (isInteractionLocked()) {
    return
  }

  const releaseMutationLock = await callbacks.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })
  if (!targetEntries.length) {
    releaseMutationLock()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  let committedRestoredCount = 0
  let restoreError: unknown = null
  const reconciliationWarnings: string[] = []
  const committedRecycleIds = new Set<string>()

  try {
    const currentFolderIds = await loadCurrentFolderIds()
    await runRecycleEntriesSequentially(targetEntries, async (entry) => {
      const fallbackParentId = currentFolderIds.has(String(entry.parentId))
        ? entry.parentId
        : BOOKMARKS_BAR_ID

      await restoreBookmarkFromRecycleEntry(
        String(entry.recycleId),
        () => createBookmark({
          parentId: fallbackParentId,
          index: Number.isFinite(entry.index) ? entry.index : undefined,
          title: entry.title,
          url: entry.url
        })
      )
      committedRecycleIds.add(String(entry.recycleId))
      committedRestoredCount += 1
    })
  } catch (error) {
    restoreError = error
  } finally {
    if (committedRecycleIds.size) {
      managerState.recycleBin = managerState.recycleBin.filter((entry) => {
        return !committedRecycleIds.has(String(entry.recycleId))
      })
      committedRecycleIds.forEach((recycleId) => {
        managerState.selectedRecycleIds.delete(recycleId)
      })
    }

    try {
      await Promise.all([
        refreshRecycleBinState(),
        callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      ])
    } catch (error) {
      reconciliationWarnings.push(
        error instanceof Error ? `目录刷新失败：${error.message}` : '目录刷新失败'
      )
    }

    if (restoreError) {
      if (committedRestoredCount === 0) {
        const detail = restoreError instanceof Error ? `：${restoreError.message}` : ''
        const errorCode =
          typeof restoreError === 'object' &&
          restoreError !== null &&
          'code' in restoreError
            ? String(restoreError.code || '')
            : ''
        if (errorCode === RECYCLE_RESTORE_SOURCE_EXISTS_CODE) {
          availabilityState.lastError = restoreError instanceof Error
            ? restoreError.message
            : '原书签仍然存在，已取消重复恢复。'
        } else if (errorCode === RECYCLE_RESTORE_ROLLBACK_FAILED_CODE) {
          availabilityState.lastError =
            `恢复未提交${detail} 自动回滚也失败，可能已经创建了书签且回收站记录仍保留；` +
            '请先检查目标文件夹，不要立即重试。'
        } else {
          availabilityState.lastError =
            `恢复未提交${detail} 已撤销本次恢复，未创建重复书签。`
        }
      } else {
        availabilityState.lastError =
          restoreError instanceof Error
            ? `恢复过程中断，已提交 ${committedRestoredCount} 条：${restoreError.message}`
            : `恢复过程中断，已提交 ${committedRestoredCount} 条。`
      }
    } else {
      availabilityState.lastError = `已从回收站恢复 ${committedRestoredCount} 条书签。`
    }
    if (reconciliationWarnings.length) {
      availabilityState.lastError += ` 但本地状态同步未完全成功：${reconciliationWarnings.join('；')}。`
    }
    availabilityState.deleting = false
    releaseMutationLock()
    callbacks.renderAvailabilitySection()
  }
}

function runRecycleEntriesSequentially<T>(items: T[], task: (item: T, index: number) => Promise<void>): Promise<void> {
  return items.reduce<Promise<void>>((chain, item, index) => {
    return chain.then(() => task(item, index))
  }, Promise.resolve())
}

async function loadCurrentFolderIds(): Promise<Set<string>> {
  const tree = await getBookmarkTree()
  const folders = buildBookmarkCatalogSnapshot({ rootNode: tree[0] }).extracted.folderMap
  return new Set([...folders.keys(), BOOKMARKS_BAR_ID])
}

export async function clearRecycleBin(callbacks) {
  if (!managerState.recycleBin.length || isInteractionLocked()) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `清空 ${managerState.recycleBin.length} 条回收站记录？`,
        copy: '这些回收站记录会被永久移除，之后无法再从扩展内恢复。',
        confirmLabel: '清空回收站',
        label: '清空回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }
  if (isInteractionLocked()) {
    return
  }

  const releaseMutationLock = await callbacks.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }
  const recycleIds = managerState.recycleBin.map((entry) => String(entry.recycleId))
  if (!recycleIds.length) {
    releaseMutationLock()
    return
  }
  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  try {
    await removeRecycleEntries(recycleIds)
    managerState.recycleBin = []
    managerState.selectedRecycleIds.clear()
    try {
      await refreshRecycleBinState()
      availabilityState.lastError = '已清空回收站记录。'
    } catch (error) {
      const detail = error instanceof Error ? `：${error.message}` : ''
      availabilityState.lastError = `已清空回收站记录，但刷新本地状态失败${detail}。`
    }
  } catch (error) {
    availabilityState.lastError =
      error instanceof Error ? `清空回收站失败：${error.message}` : '清空回收站失败。'
  } finally {
    availabilityState.deleting = false
    releaseMutationLock()
    callbacks.renderAvailabilitySection()
  }
}

export async function deleteBookmarksToRecycle(bookmarkCandidates: unknown[], source: string, callbacks: any) {
  const candidateMap = new Map<string, { id: string; expectedUrl: string }>()
  for (const candidate of Array.isArray(bookmarkCandidates) ? bookmarkCandidates : []) {
    const candidateRecord = candidate && typeof candidate === 'object'
      ? candidate as { id?: unknown; expectedUrl?: unknown }
      : { id: candidate }
    const id = String(candidateRecord.id || '').trim()
    const expectedUrl = String(candidateRecord.expectedUrl || '').trim()
    if (id && expectedUrl) {
      candidateMap.set(id, { id, expectedUrl })
    }
  }
  const uniqueCandidates = [...candidateMap.values()]
  if (!uniqueCandidates.length || isInteractionLocked()) {
    return
  }

  const releaseMutationLock = await callbacks.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }
  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const removedIds = []
  const skippedIds = []
  const recycleEntries = []
  let removalError = null
  const reconciliationWarnings = []

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: inferDeleteBackupKind(source),
      source: 'options',
      reason: source || '删除书签前自动备份',
      targetBookmarkIds: uniqueCandidates.map((candidate) => candidate.id),
      estimatedChangeCount: uniqueCandidates.length
    })
    await runRecycleEntriesSequentially(uniqueCandidates, async (candidate) => {
      const bookmarkId = candidate.id
      const latestBookmark = await getBookmarkById(bookmarkId)
      if (
        !latestBookmark?.url ||
        candidate.expectedUrl !== String(latestBookmark.url)
      ) {
        skippedIds.push(bookmarkId)
        return
      }

      const recycleEntry = buildRecycleEntry(latestBookmark, source)
      const deleted = await deleteBookmarkToRecycle(
        bookmarkId,
        recycleEntry,
        { expectedUrl: candidate.expectedUrl }
      )
      if (!deleted) {
        skippedIds.push(bookmarkId)
        return
      }
      removedIds.push(bookmarkId)
      recycleEntries.push(recycleEntry)
    })
  } catch (error) {
    removalError = error
  } finally {
    if (removedIds.length) {
      managerState.recycleBin = mergeRecycleEntries(
        recycleEntries as RecycleEntry[],
        managerState.recycleBin as RecycleEntry[]
      )
      try {
        await refreshRecycleBinState()
      } catch (error) {
        reconciliationWarnings.push(
          error instanceof Error ? `回收站刷新失败：${error.message}` : '回收站刷新失败'
        )
      }
      try {
        callbacks.removeDeletedResultsFromState(removedIds)
        await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      } catch (error) {
        reconciliationWarnings.push(
          error instanceof Error ? `目录刷新失败：${error.message}` : '目录刷新失败'
        )
      }
      try {
        await callbacks.saveRedirectCache()
      } catch (error) {
        reconciliationWarnings.push(
          error instanceof Error ? `缓存保存失败：${error.message}` : '缓存保存失败'
        )
      }
    }

    try {
      if (removalError) {
        availabilityState.lastError =
          removalError instanceof Error
            ? `删除过程中断，已删除 ${removedIds.length} 条：${removalError.message}`
            : `删除过程中断，已删除 ${removedIds.length} 条。`
      } else if (removedIds.length) {
        const skippedCopy = skippedIds.length
          ? ` ${skippedIds.length} 条因 URL 已变化或书签不存在而跳过。`
          : ''
        availabilityState.lastError = `已删除 ${removedIds.length} 条书签，并移入回收站。可在左侧“回收站”查看并恢复。${skippedCopy}`.trim()
      } else if (skippedIds.length) {
        availabilityState.lastError = `${skippedIds.length} 条书签因 URL 已变化或已不存在而跳过，未执行删除。`
      }

      if (reconciliationWarnings.length) {
        availabilityState.lastError = `${availabilityState.lastError || `已删除 ${removedIds.length} 条书签。`} 但本地状态同步未完全成功：${reconciliationWarnings.join('；')}。`
      }
    } finally {
      availabilityState.deleting = false
      availabilityState.deleteModalOpen = false
      releaseMutationLock()
      callbacks.renderAvailabilitySection()
    }
  }
}

export async function refreshRecycleBinState(): Promise<void> {
  managerState.recycleBin = normalizeRecycleBin(await loadRecycleBinEntries())
  managerState.recycleBin = managerState.recycleBin.slice(0, RECYCLE_BIN_LIMIT)
}

function inferDeleteBackupKind(source: string): DangerousOperationKind {
  if (/重复/.test(source)) {
    return 'duplicate-cleanup'
  }
  if (/异常|坏链|高置信/.test(source)) {
    return 'availability-cleanup'
  }
  return 'batch-delete'
}
