// @ts-nocheck
import {
  BOOKMARKS_BAR_ID,
  STORAGE_KEYS,
  RECYCLE_BIN_LIMIT
} from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { createBookmark, removeBookmark } from '../../shared/bookmarks-api.js'
import { displayUrl } from '../../shared/text.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import { syncSelectionSet, formatDateTime } from '../shared-options/utils.js'

export function normalizeRecycleBin(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return []
  }

  return rawEntries
    .map((entry) => {
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
    })
    .filter((entry) => entry.recycleId && entry.url)
    .sort((left, right) => right.deletedAt - left.deletedAt)
}

export async function saveRecycleBin() {
  await setLocalStorage({
    [STORAGE_KEYS.recycleBin]: managerState.recycleBin.slice(0, RECYCLE_BIN_LIMIT)
  })
}

function appendRecycleEntries(entries) {
  managerState.recycleBin = [...entries, ...managerState.recycleBin]
    .sort((left, right) => right.deletedAt - left.deletedAt)
    .slice(0, RECYCLE_BIN_LIMIT)
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
  if (!dom.recycleResults) {
    return
  }

  syncSelectionSet(
    managerState.selectedRecycleIds,
    new Set(managerState.recycleBin.map((entry) => String(entry.recycleId)))
  )

  dom.recycleCount.textContent = `${managerState.recycleBin.length} 条回收站条目`
  dom.recycleSelectionGroup.classList.toggle('hidden', managerState.selectedRecycleIds.size === 0)
  dom.recycleSelectionCount.textContent = `${managerState.selectedRecycleIds.size} 条已选择`
  dom.recycleRestoreSelection.disabled = availabilityState.deleting || managerState.selectedRecycleIds.size === 0
  dom.recycleSelectAll.disabled = managerState.recycleBin.length === 0
  dom.recycleClearAll.disabled = managerState.recycleBin.length === 0 || availabilityState.deleting

  if (!managerState.recycleBin.length) {
    dom.recycleResults.innerHTML = '<div class="detect-empty">回收站当前为空。</div>'
    return
  }

  dom.recycleResults.innerHTML = managerState.recycleBin
    .map((entry) => buildRecycleEntryCard(entry))
    .join('')
}

function buildRecycleEntryCard(entry) {
  const selected = managerState.selectedRecycleIds.has(String(entry.recycleId))

  return `
    <article class="detect-result-card ${selected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <label class="detect-result-check">
            <input
              type="checkbox"
              data-recycle-select="true"
              data-recycle-id="${escapeAttr(entry.recycleId)}"
              ${selected ? 'checked' : ''}
              ${availabilityState.deleting ? 'disabled' : ''}
            >
            <span>选择</span>
          </label>
          <span class="options-chip muted">回收站</span>
        </div>
        <div class="detect-result-actions">
          <button
            class="detect-result-action"
            type="button"
            data-recycle-restore="${escapeAttr(entry.recycleId)}"
            ${availabilityState.deleting ? 'disabled' : ''}
          >
            恢复书签
          </button>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(entry.title || '未命名书签')}</strong>
        <div class="detect-result-url">${escapeHtml(displayUrl(entry.url))}</div>
        <div class="detect-result-detail">来源：${escapeHtml(entry.source || '删除')} · 删除于 ${escapeHtml(formatDateTime(entry.deletedAt))}</div>
        <div class="detect-result-path" title="${escapeAttr(entry.path || '未归档路径')}">${escapeHtml(entry.path || '未归档路径')}</div>
      </div>
    </article>
  `
}

export function handleRecycleResultsClick(event, callbacks) {
  const selectionInput = event.target.closest('input[data-recycle-select]')
  if (selectionInput) {
    const recycleId = String(selectionInput.getAttribute('data-recycle-id') || '').trim()
    if (selectionInput.checked) {
      managerState.selectedRecycleIds.add(recycleId)
    } else {
      managerState.selectedRecycleIds.delete(recycleId)
    }
    callbacks.renderAvailabilitySection()
    return
  }

  const restoreButton = event.target.closest('[data-recycle-restore]')
  if (!restoreButton || availabilityState.deleting) {
    return
  }

  restoreRecycleEntriesByIds(
    [String(restoreButton.getAttribute('data-recycle-restore') || '').trim()],
    callbacks
  )
}

export function clearRecycleSelection(callbacks) {
  managerState.selectedRecycleIds.clear()
  callbacks.renderAvailabilitySection()
}

export function selectAllRecycleEntries(callbacks) {
  managerState.selectedRecycleIds = new Set(
    managerState.recycleBin.map((entry) => String(entry.recycleId))
  )
  callbacks.renderAvailabilitySection()
}

export async function restoreSelectedRecycleEntries(callbacks) {
  if (!managerState.selectedRecycleIds.size || availabilityState.deleting) {
    return
  }

  await restoreRecycleEntriesByIds([...managerState.selectedRecycleIds], callbacks)
  clearRecycleSelection(callbacks)
}

async function restoreRecycleEntriesByIds(recycleIds, callbacks) {
  const targetSet = new Set(recycleIds.map((id) => String(id)).filter(Boolean))
  const targetEntries = managerState.recycleBin.filter((entry) => {
    return targetSet.has(String(entry.recycleId))
  })

  if (!targetEntries.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const restoredIds = []
  let restoreError = null

  try {
    for (const entry of targetEntries) {
      const fallbackParentId = availabilityState.folderMap.has(String(entry.parentId))
        ? entry.parentId
        : BOOKMARKS_BAR_ID

      await createBookmark({
        parentId: fallbackParentId,
        index: Number.isFinite(entry.index) ? entry.index : undefined,
        title: entry.title,
        url: entry.url
      })
      restoredIds.push(String(entry.recycleId))
    }
  } catch (error) {
    restoreError = error
  } finally {
    availabilityState.deleting = false

    if (restoredIds.length) {
      managerState.recycleBin = managerState.recycleBin.filter((entry) => {
        return !new Set(restoredIds).has(String(entry.recycleId))
      })
      await saveRecycleBin()
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (restoreError) {
      availabilityState.lastError =
        restoreError instanceof Error
          ? `恢复过程中断，已恢复 ${restoredIds.length} 条：${restoreError.message}`
          : `恢复过程中断，已恢复 ${restoredIds.length} 条。`
    } else {
      availabilityState.lastError = `已从回收站恢复 ${restoredIds.length} 条书签。`
    }

    callbacks.renderAvailabilitySection()
  }
}

export async function clearRecycleBin(callbacks) {
  if (!managerState.recycleBin.length || availabilityState.deleting) {
    return
  }

  if (!window.confirm(`确认清空回收站中的 ${managerState.recycleBin.length} 条记录？此操作不会再恢复这些记录。`)) {
    return
  }

  managerState.recycleBin = []
  await saveRecycleBin()
  clearRecycleSelection(callbacks)
  availabilityState.lastError = '已清空回收站记录。'
  callbacks.renderAvailabilitySection()
}

export async function deleteBookmarksToRecycle(bookmarkIds, source, callbacks) {
  const uniqueIds = [...new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))]
  if (!uniqueIds.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const removedIds = []
  const recycleEntries = []
  let removalError = null

  try {
    for (const bookmarkId of uniqueIds) {
      const bookmark = callbacks.getBookmarkRecord(bookmarkId)
      if (!bookmark?.url) {
        continue
      }

      await removeBookmark(bookmarkId)
      removedIds.push(bookmarkId)
      recycleEntries.push(buildRecycleEntry(bookmark, source))
    }
  } catch (error) {
    removalError = error
  } finally {
    if (removedIds.length) {
      appendRecycleEntries(recycleEntries)
      callbacks.removeDeletedResultsFromState(removedIds)
      await saveRecycleBin()
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      await callbacks.saveRedirectCache()
    }

    availabilityState.deleting = false
    availabilityState.deleteModalOpen = false

    if (removalError) {
      availabilityState.lastError =
        removalError instanceof Error
          ? `删除过程中断，已删除 ${removedIds.length} 条：${removalError.message}`
          : `删除过程中断，已删除 ${removedIds.length} 条。`
    } else if (removedIds.length) {
      availabilityState.lastError = `已删除 ${removedIds.length} 条书签，并移入回收站。`
    }

    callbacks.renderAvailabilitySection()
  }
}
