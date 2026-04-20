// @ts-nocheck
import { displayUrl } from '../../shared/text.js'
import { availabilityState, managerState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import {
  isInteractionLocked,
  compareByPathTitle,
  syncSelectionSet
} from '../shared-options/utils.js'
import { deleteBookmarksToRecycle } from './recycle.js'

export function buildDuplicateGroups(bookmarks) {
  const groupMap = new Map()

  for (const bookmark of bookmarks) {
    if (!bookmark?.url) {
      continue
    }

    const duplicateKey = String(bookmark.duplicateKey || '').trim()
    if (!duplicateKey) {
      continue
    }

    if (!groupMap.has(duplicateKey)) {
      groupMap.set(duplicateKey, [])
    }

    groupMap.get(duplicateKey).push(bookmark)
  }

  return [...groupMap.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => {
      const sortedItems = items.slice().sort((left, right) => {
        return (
          (Number(right.dateAdded) || 0) - (Number(left.dateAdded) || 0) ||
          compareByPathTitle(left, right)
        )
      })
      const seenFolders = new Set()
      const folders = []

      for (const item of sortedItems) {
        const folderId = String(item.parentId || '')
        if (seenFolders.has(folderId)) {
          continue
        }

        seenFolders.add(folderId)
        folders.push({
          id: folderId,
          title: availabilityState.folderMap.get(folderId)?.title || item.path || '文件夹',
          path: availabilityState.folderMap.get(folderId)?.path || item.path || '未归档路径'
        })
      }

      return {
        id: `duplicate-${sortedItems[0].id}`,
        key,
        displayUrl: displayUrl(sortedItems[0].url),
        items: sortedItems,
        folders
      }
    })
    .sort((left, right) => {
      return right.items.length - left.items.length || left.displayUrl.localeCompare(right.displayUrl, 'zh-CN')
    })
}

export function renderDuplicateSection() {
  if (!dom.duplicateGroups) {
    return
  }

  const validIds = new Set(
    managerState.duplicateGroups.flatMap((group) => group.items.map((item) => String(item.id)))
  )
  syncSelectionSet(managerState.selectedDuplicateIds, validIds)

  dom.duplicateGroupCount.textContent = `${managerState.duplicateGroups.length} 组重复`
  dom.duplicateSelectionGroup.classList.toggle('hidden', managerState.selectedDuplicateIds.size === 0)
  dom.duplicateSelectionCount.textContent = `${managerState.selectedDuplicateIds.size} 条已选择`
  dom.duplicateDeleteSelection.disabled = isInteractionLocked() || managerState.selectedDuplicateIds.size === 0

  if (!availabilityState.catalogLoading && !managerState.duplicateGroups.length) {
    dom.duplicateGroups.innerHTML = '<div class="detect-empty">当前未发现重复书签。</div>'
    return
  }

  dom.duplicateGroups.innerHTML = managerState.duplicateGroups.length
    ? managerState.duplicateGroups.map((group) => buildDuplicateGroupCard(group)).join('')
    : '<div class="detect-empty">正在分析重复书签。</div>'
}

function buildDuplicateGroupCard(group) {
  const folderOptions = group.folders
    .map((folder) => {
      return `<option value="${escapeAttr(folder.id)}">${escapeHtml(folder.path || folder.title)}</option>`
    })
    .join('')

  return `
    <article class="detect-result-card duplicate-group-card">
      <div class="duplicate-group-header">
        <div class="duplicate-group-copy">
          <strong>${escapeHtml(group.displayUrl)}</strong>
          <p class="detect-results-subtitle">${group.items.length} 条重复书签 · 归一化地址 ${escapeHtml(group.key)}</p>
        </div>
        <div class="duplicate-group-actions">
          <button
            class="options-button secondary small"
            type="button"
            data-duplicate-keep-newest="${escapeAttr(group.id)}"
            ${isInteractionLocked() ? 'disabled' : ''}
          >
            保留最新
          </button>
          <select class="duplicate-folder-select" data-duplicate-folder-select="${escapeAttr(group.id)}">
            ${folderOptions}
          </select>
          <button
            class="options-button secondary small"
            type="button"
            data-duplicate-keep-folder="${escapeAttr(group.id)}"
            ${isInteractionLocked() ? 'disabled' : ''}
          >
            保留指定文件夹
          </button>
        </div>
      </div>
      <div class="duplicate-item-list">
        ${group.items.map((item, index) => buildDuplicateItemCard(item, index === 0)).join('')}
      </div>
    </article>
  `
}

function buildDuplicateItemCard(item, isNewest) {
  const selected = managerState.selectedDuplicateIds.has(String(item.id))

  return `
    <div class="duplicate-item-row ${selected ? 'selected' : ''}">
      <label class="detect-result-check">
        <input
          type="checkbox"
          data-duplicate-select="true"
          data-bookmark-id="${escapeAttr(item.id)}"
          ${selected ? 'checked' : ''}
          ${isInteractionLocked() ? 'disabled' : ''}
        >
        <span>选择</span>
      </label>
      <div class="duplicate-item-copy">
        <div class="duplicate-item-meta">
          <strong>${escapeHtml(item.title || '未命名书签')}</strong>
          ${isNewest ? '<span class="options-chip success">最新</span>' : ''}
        </div>
        <div class="detect-result-url">${escapeHtml(displayUrl(item.url))}</div>
        <div class="detect-result-path" title="${escapeAttr(item.path || '未归档路径')}">${escapeHtml(item.path || '未归档路径')}</div>
      </div>
    </div>
  `
}

export function handleDuplicateGroupsClick(event, callbacks) {
  const selectionInput = event.target.closest('input[data-duplicate-select]')
  if (selectionInput) {
    const bookmarkId = String(selectionInput.getAttribute('data-bookmark-id') || '').trim()
    if (selectionInput.checked) {
      managerState.selectedDuplicateIds.add(bookmarkId)
    } else {
      managerState.selectedDuplicateIds.delete(bookmarkId)
    }
    callbacks.renderAvailabilitySection()
    return
  }

  const keepNewestButton = event.target.closest('[data-duplicate-keep-newest]')
  if (keepNewestButton && !isInteractionLocked()) {
    keepNewestInDuplicateGroup(
      String(keepNewestButton.getAttribute('data-duplicate-keep-newest') || '').trim(),
      callbacks
    )
    return
  }

  const keepFolderButton = event.target.closest('[data-duplicate-keep-folder]')
  if (!keepFolderButton || isInteractionLocked()) {
    return
  }

  const groupId = String(keepFolderButton.getAttribute('data-duplicate-keep-folder') || '').trim()
  const select = event.currentTarget.querySelector(`[data-duplicate-folder-select="${CSS.escape(groupId)}"]`)
  const folderId = String(select?.value || '').trim()
  if (!groupId || !folderId) {
    return
  }

  keepDuplicateGroupFolder(groupId, folderId, callbacks)
}

export function clearDuplicateSelection(callbacks) {
  managerState.selectedDuplicateIds.clear()
  callbacks.renderAvailabilitySection()
}

export async function deleteSelectedDuplicates(callbacks) {
  if (isInteractionLocked() || !managerState.selectedDuplicateIds.size) {
    return
  }

  const targetIds = [...managerState.selectedDuplicateIds]
  if (!window.confirm(`确认删除这 ${targetIds.length} 条重复书签，并移入回收站？`)) {
    return
  }

  await deleteBookmarksToRecycle(targetIds, '重复书签批量删除', callbacks.recycleCallbacks)
  clearDuplicateSelection(callbacks)
}

async function keepNewestInDuplicateGroup(groupId, callbacks) {
  const group = managerState.duplicateGroups.find((entry) => entry.id === groupId)
  if (!group || group.items.length <= 1) {
    return
  }

  const [latest, ...duplicates] = group.items
  if (!duplicates.length) {
    return
  }

  await deleteBookmarksToRecycle(
    duplicates.map((item) => item.id),
    `重复书签清理：保留最新 ${latest.title || displayUrl(latest.url)}`,
    callbacks.recycleCallbacks
  )
}

async function keepDuplicateGroupFolder(groupId, folderId, callbacks) {
  const group = managerState.duplicateGroups.find((entry) => entry.id === groupId)
  if (!group || group.items.length <= 1) {
    return
  }

  const matchingItems = group.items
    .filter((item) => String(item.parentId) === String(folderId))
    .sort((left, right) => (Number(right.dateAdded) || 0) - (Number(left.dateAdded) || 0))

  if (!matchingItems.length) {
    return
  }

  const keepId = String(matchingItems[0].id)
  const removeIds = group.items
    .map((item) => String(item.id))
    .filter((bookmarkId) => bookmarkId !== keepId)

  if (!removeIds.length) {
    return
  }

  await deleteBookmarksToRecycle(
    removeIds,
    `重复书签清理：保留指定文件夹 ${matchingItems[0].path || matchingItems[0].title}`,
    callbacks.recycleCallbacks
  )
}
