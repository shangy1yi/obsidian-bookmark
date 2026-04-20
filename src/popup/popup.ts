// @ts-nocheck
import {
  BOOKMARKS_BAR_ID,
  ROOT_ID,
  RECYCLE_BIN_LIMIT,
  STORAGE_KEYS,
  UNDO_WINDOW_MS
} from '../shared/constants.js'
import {
  extractBookmarkData,
  findBookmarksBar,
  findNodeById
} from '../shared/bookmark-tree.js'
import {
  displayUrl,
  normalizeText,
  normalizeUrl,
  stripCommonUrlPrefix
} from '../shared/text.js'
import {
  createBookmark,
  createTab,
  getBookmarkTree,
  moveBookmark,
  removeBookmark,
  updateBookmark
} from '../shared/bookmarks-api.js'
import {
  appendRecycleEntry,
  removeRecycleEntry
} from '../shared/recycle-bin.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'

const SEARCH_DEBOUNCE_MS = 140
const MAX_RESULTS = 20

const state = {
  isLoading: true,
  loadError: '',
  rawTreeRoot: null,
  bookmarksBarNode: null,
  allBookmarks: [],
  allFolders: [],
  bookmarkMap: new Map(),
  folderMap: new Map(),
  expandedFolders: new Set(),
  moveExpandedFolders: new Set(),
  searchQuery: '',
  debouncedQuery: '',
  selectedFolderFilterId: null,
  isFilterPickerOpen: false,
  filterSearchQuery: '',
  searchResults: [],
  activeResultIndex: 0,
  searchTimer: null,
  activeMenuBookmarkId: null,
  moveTargetBookmarkId: null,
  moveSearchQuery: '',
  editTargetBookmarkId: null,
  confirmDeleteBookmarkId: null,
  lastDeletedBookmark: null,
  toasts: [],
  toastTimers: new Map()
}

const dom = {}

document.addEventListener('DOMContentLoaded', () => {
  cacheDom()
  bindEvents()
  render()
  refreshData({ initial: true, preserveSearch: false }).finally(() => {
    dom.searchInput.focus()
  })
})

function cacheDom() {
  dom.heroSubtitle = document.getElementById('hero-subtitle')
  dom.openSettings = document.getElementById('open-settings')
  dom.searchInput = document.getElementById('search-input')
  dom.clearSearch = document.getElementById('clear-search')
  dom.viewCaption = document.getElementById('view-caption')
  dom.folderFilterTrigger = document.getElementById('folder-filter-trigger')
  dom.clearFolderFilter = document.getElementById('clear-folder-filter')
  dom.errorBanner = document.getElementById('error-banner')
  dom.loadingState = document.getElementById('loading-state')
  dom.emptyState = document.getElementById('empty-state')
  dom.content = document.getElementById('content')
  dom.modalBackdrop = document.getElementById('modal-backdrop')
  dom.filterModal = document.getElementById('filter-modal')
  dom.filterSearchInput = document.getElementById('filter-search-input')
  dom.filterFolderList = document.getElementById('filter-folder-list')
  dom.closeFilterModal = document.getElementById('close-filter-modal')
  dom.moveModal = document.getElementById('move-modal')
  dom.moveBookmarkTitle = document.getElementById('move-bookmark-title')
  dom.moveBookmarkPath = document.getElementById('move-bookmark-path')
  dom.moveSearchInput = document.getElementById('move-search-input')
  dom.moveFolderList = document.getElementById('move-folder-list')
  dom.closeMoveModal = document.getElementById('close-move-modal')
  dom.editModal = document.getElementById('edit-modal')
  dom.editBookmarkPath = document.getElementById('edit-bookmark-path')
  dom.editTitleInput = document.getElementById('edit-title-input')
  dom.editUrlInput = document.getElementById('edit-url-input')
  dom.closeEditModal = document.getElementById('close-edit-modal')
  dom.cancelEdit = document.getElementById('cancel-edit')
  dom.saveEdit = document.getElementById('save-edit')
  dom.deleteModal = document.getElementById('delete-modal')
  dom.deleteBookmarkTitle = document.getElementById('delete-bookmark-title')
  dom.deleteBookmarkPath = document.getElementById('delete-bookmark-path')
  dom.cancelDelete = document.getElementById('cancel-delete')
  dom.confirmDelete = document.getElementById('confirm-delete')
  dom.toastRoot = document.getElementById('toast-root')
}

function bindEvents() {
  dom.openSettings.addEventListener('click', openSettingsPage)
  dom.searchInput.addEventListener('input', (event) => {
    setSearchQuery(event.target.value)
  })

  dom.clearSearch.addEventListener('click', () => {
    setSearchQuery('', { immediate: true })
    dom.searchInput.focus()
  })
  dom.folderFilterTrigger.addEventListener('click', openFilterDialog)
  dom.clearFolderFilter.addEventListener('click', clearFolderFilter)

  dom.content.addEventListener('click', handleContentClick)
  dom.content.addEventListener('pointerover', handleContentPointerOver)
  dom.filterFolderList.addEventListener('click', handleFilterListClick)
  dom.filterSearchInput.addEventListener('input', (event) => {
    state.filterSearchQuery = event.target.value
    renderFilterModal()
  })
  dom.closeFilterModal.addEventListener('click', closeDialogs)
  dom.moveFolderList.addEventListener('click', handleMoveListClick)
  dom.moveSearchInput.addEventListener('input', (event) => {
    state.moveSearchQuery = event.target.value
    renderMoveModal()
  })
  dom.closeMoveModal.addEventListener('click', closeDialogs)
  dom.closeEditModal.addEventListener('click', closeDialogs)
  dom.cancelEdit.addEventListener('click', closeDialogs)
  dom.saveEdit.addEventListener('click', saveEditedBookmark)
  dom.editTitleInput.addEventListener('keydown', handleEditInputKeydown)
  dom.editUrlInput.addEventListener('keydown', handleEditInputKeydown)
  dom.cancelDelete.addEventListener('click', closeDialogs)
  dom.confirmDelete.addEventListener('click', confirmDeleteBookmark)
  dom.modalBackdrop.addEventListener('click', (event) => {
    if (event.target === dom.modalBackdrop) {
      closeDialogs()
    }
  })

  dom.toastRoot.addEventListener('click', handleToastClick)

  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
}

async function openSettingsPage() {
  try {
    await chrome.runtime.openOptionsPage()
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '设置页打开失败，请稍后重试。'
    })
  }
}

async function refreshData({ initial = false, preserveSearch = true } = {}) {
  state.isLoading = true
  state.loadError = ''
  state.activeMenuBookmarkId = null
  render()

  try {
    const tree = await getBookmarkTree()
    const rootNode = Array.isArray(tree) ? tree[0] : tree

    state.rawTreeRoot = rootNode
    state.bookmarksBarNode = findBookmarksBar(rootNode)

    const extracted = extractBookmarkData(rootNode)
    state.allBookmarks = extracted.bookmarks
    state.allFolders = extracted.folders
    state.bookmarkMap = extracted.bookmarkMap
    state.folderMap = extracted.folderMap

    const folderIds = new Set(extracted.folders.map((folder) => folder.id))
    const defaultExpanded = getDefaultExpandedFolders(state.bookmarksBarNode)
    const allExpanded = new Set(extracted.folders.map((folder) => folder.id))

    if (state.selectedFolderFilterId && !folderIds.has(state.selectedFolderFilterId)) {
      state.selectedFolderFilterId = null
    }

    if (initial || state.expandedFolders.size === 0) {
      state.expandedFolders = defaultExpanded
    } else {
      state.expandedFolders = new Set(
        [...state.expandedFolders].filter((folderId) => folderIds.has(folderId))
      )
      if (!state.expandedFolders.size) {
        state.expandedFolders = defaultExpanded
      }
    }

    if (initial || state.moveExpandedFolders.size === 0) {
      state.moveExpandedFolders = allExpanded
    } else {
      state.moveExpandedFolders = new Set(
        [...state.moveExpandedFolders].filter((folderId) => folderIds.has(folderId))
      )
      if (!state.moveExpandedFolders.size) {
        state.moveExpandedFolders = allExpanded
      }
    }

    if (preserveSearch) {
      state.debouncedQuery = state.searchQuery.trim()
      runSearch()
    } else {
      state.searchQuery = ''
      state.debouncedQuery = ''
      state.searchResults = []
      state.activeResultIndex = 0
      dom.searchInput.value = ''
    }
  } catch (error) {
    state.loadError = error instanceof Error ? error.message : '书签加载失败，请稍后重试。'
    state.searchResults = []
  } finally {
    state.isLoading = false
    render()
  }
}

function setSearchQuery(value, { immediate = false } = {}) {
  state.searchQuery = value
  state.activeMenuBookmarkId = null

  if (dom.searchInput.value !== value) {
    dom.searchInput.value = value
  }

  clearTimeout(state.searchTimer)

  if (immediate) {
    state.debouncedQuery = value.trim()
    runSearch()
    render()
    return
  }

  state.searchTimer = window.setTimeout(() => {
    state.debouncedQuery = value.trim()
    runSearch()
    render()
  }, SEARCH_DEBOUNCE_MS)

  render()
}

function runSearch() {
  const query = state.debouncedQuery

  if (!query) {
    state.searchResults = []
    state.activeResultIndex = 0
    return
  }

  try {
    state.searchResults = searchBookmarks(query, getFilteredBookmarks()).slice(0, MAX_RESULTS)
    state.activeResultIndex = Math.min(
      state.activeResultIndex,
      Math.max(state.searchResults.length - 1, 0)
    )
  } catch (error) {
    state.searchResults = []
    state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
  }
}

function render() {
  renderBanner()
  renderToolbar()
  renderFilterBar()
  renderMainContent()
  renderFilterModal()
  renderMoveModal()
  renderEditModal()
  renderDeleteModal()
  renderToasts()
}

function renderBanner() {
  dom.heroSubtitle.textContent = state.loadError
    ? '读取失败时不会上传数据，请检查扩展权限后重试'
    : '本地读取，不上传任何书签内容'

  dom.errorBanner.textContent = state.loadError
  dom.errorBanner.classList.toggle('hidden', !state.loadError)
  dom.clearSearch.classList.toggle('hidden', !state.searchQuery)
}

function renderToolbar() {
  if (state.debouncedQuery) {
    dom.viewCaption.textContent = `搜索结果 · ${state.searchResults.length} 条`
    return
  }

  const currentRoot = getCurrentTreeRoot()
  dom.viewCaption.textContent = currentRoot?.title || '书签栏'
}

function renderFilterBar() {
  const selectedFolder = state.selectedFolderFilterId
    ? state.folderMap.get(state.selectedFolderFilterId)
    : null

  dom.folderFilterTrigger.textContent = selectedFolder
    ? `文件夹：${selectedFolder.path || selectedFolder.title}`
    : '全部文件夹'
  dom.folderFilterTrigger.title = selectedFolder?.path || ''
  dom.clearFolderFilter.classList.toggle('hidden', !selectedFolder)
}

function renderMainContent() {
  const hasQuery = Boolean(state.debouncedQuery)
  const showEmptySearch = hasQuery && !state.searchResults.length && !state.isLoading
  const currentRoot = getCurrentTreeRoot()
  const showEmptyTree =
    !hasQuery &&
    !state.isLoading &&
    (!currentRoot || !(currentRoot.children || []).length)

  dom.loadingState.classList.toggle('hidden', !state.isLoading)
  dom.content.classList.toggle('hidden', state.isLoading || showEmptySearch || showEmptyTree)
  dom.emptyState.classList.toggle('hidden', !(showEmptySearch || showEmptyTree))

  if (showEmptySearch) {
    dom.emptyState.textContent = state.selectedFolderFilterId
      ? '当前文件夹筛选下未找到相关书签'
      : '未找到相关书签'
  } else if (showEmptyTree) {
    dom.emptyState.textContent = state.selectedFolderFilterId
      ? '当前筛选文件夹下暂无可展示内容'
      : '未找到可展示的书签栏内容'
  }

  if (state.isLoading) {
    return
  }

  dom.content.innerHTML = hasQuery ? renderSearchResults() : renderTreeView()
  updateActiveResultVisibility()
}

function renderTreeView() {
  const currentRoot = getCurrentTreeRoot()
  if (!currentRoot) {
    return ''
  }

  return renderFolderNode(currentRoot, 0)
}

function renderFolderNode(node, depth) {
  const currentRoot = getCurrentTreeRoot()
  const isPinnedRoot = depth === 0 && currentRoot?.id === node.id
  const isExpanded =
    isPinnedRoot || state.expandedFolders.has(node.id)
  const children = Array.isArray(node.children) ? node.children : []
  const folderInfo = state.folderMap.get(node.id)
  const childMarkup = isExpanded
    ? children
        .map((child) => {
          if (child.url) {
            const bookmark = state.bookmarkMap.get(child.id)
            return bookmark ? renderBookmarkRow(bookmark, depth + 1) : ''
          }

          return renderFolderNode(child, depth + 1)
        })
        .join('')
    : ''

  const toggleMarkup = isPinnedRoot
    ? '<span class="tree-toggle-spacer" aria-hidden="true"></span>'
    : `
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        data-toggle-folder="${escapeAttr(node.id)}"
        aria-label="${isExpanded ? '折叠文件夹' : '展开文件夹'}"
      ></button>
    `

  const cardMarkup = isPinnedRoot
    ? `
      <div class="folder-card root-folder-card">
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(node.title || '未命名文件夹')}</span>
          <span class="row-subtitle">${escapeHtml(describeFolder(folderInfo))}</span>
        </span>
      </div>
    `
    : `
      <button
        class="folder-card"
        type="button"
        data-toggle-folder="${escapeAttr(node.id)}"
        aria-expanded="${isExpanded}"
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(node.title || '未命名文件夹')}</span>
          <span class="row-subtitle">${escapeHtml(describeFolder(folderInfo))}</span>
        </span>
      </button>
    `

  return `
    <div class="tree-row folder-row ${isPinnedRoot ? 'root-folder-row' : ''}" style="--depth:${depth}">
      ${toggleMarkup}
      ${cardMarkup}
    </div>
    ${childMarkup}
  `
}

function renderBookmarkRow(bookmark, depth) {
  return `
    <div class="tree-row bookmark-row" style="--depth:${depth}">
      <button class="bookmark-card" type="button" data-open-bookmark="${escapeAttr(bookmark.id)}">
        <span class="bookmark-kind" aria-hidden="true"></span>
        <span class="row-main">
          <span class="row-title">${escapeHtml(bookmark.title)}</span>
          <span class="row-subtitle" title="${escapeAttr(bookmark.url)}">${escapeHtml(bookmark.displayUrl)}</span>
        </span>
      </button>
      <div class="menu-anchor">
        <button class="icon-button" type="button" data-open-menu="${escapeAttr(bookmark.id)}" aria-label="打开操作菜单"></button>
        ${renderActionMenu(bookmark.id)}
      </div>
    </div>
  `
}

function renderSearchResults() {
  return state.searchResults
    .map((bookmark, index) => {
      const isActive = index === state.activeResultIndex

      return `
        <article class="result-card ${isActive ? 'active' : ''}" data-result-index="${index}">
          <button class="result-main" type="button" data-open-bookmark="${escapeAttr(bookmark.id)}">
            <span class="bookmark-kind" aria-hidden="true"></span>
            <span class="result-copy">
              <span class="result-title">${highlightText(bookmark.title, state.debouncedQuery)}</span>
              <span class="result-url" title="${escapeAttr(bookmark.url)}">${highlightText(bookmark.displayUrl, state.debouncedQuery)}</span>
              <span class="result-path-shell">
                <span
                  class="result-path"
                  title="${escapeAttr(bookmark.path || '未归档路径')}"
                >${escapeHtml(bookmark.path || '未归档路径')}</span>
              </span>
            </span>
          </button>
          <div class="menu-anchor">
            <button class="icon-button" type="button" data-open-menu="${escapeAttr(bookmark.id)}" aria-label="打开操作菜单"></button>
            ${renderActionMenu(bookmark.id)}
          </div>
        </article>
      `
    })
    .join('')
}

function renderActionMenu(bookmarkId) {
  if (state.activeMenuBookmarkId !== bookmarkId) {
    return ''
  }

  return `
    <div class="action-menu" role="menu">
      <button type="button" data-menu-action="edit" data-bookmark-id="${escapeAttr(bookmarkId)}">编辑</button>
      <button type="button" data-menu-action="move" data-bookmark-id="${escapeAttr(bookmarkId)}">移动至</button>
      <button class="danger" type="button" data-menu-action="delete" data-bookmark-id="${escapeAttr(bookmarkId)}">删除</button>
    </div>
  `
}

function renderFilterModal() {
  dom.filterModal.classList.toggle('hidden', !state.isFilterPickerOpen)

  if (!state.isFilterPickerOpen) {
    syncBackdropVisibility()
    return
  }

  dom.filterSearchInput.value = state.filterSearchQuery
  dom.filterFolderList.innerHTML = renderFilterFolderList()
  syncBackdropVisibility()
}

function renderMoveModal() {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  dom.moveModal.classList.toggle('hidden', !isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.moveBookmarkTitle.textContent = bookmark.title
  dom.moveBookmarkPath.textContent = bookmark.path || '未归档路径'
  dom.moveSearchInput.value = state.moveSearchQuery
  dom.moveFolderList.innerHTML = renderMoveFolderList(bookmark)
  syncBackdropVisibility()
}

function renderEditModal() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  dom.editModal.classList.toggle('hidden', !isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.editBookmarkPath.textContent = bookmark.path || '未归档路径'
  dom.editTitleInput.value = bookmark.title
  dom.editUrlInput.value = bookmark.url
  syncBackdropVisibility()
}

function renderDeleteModal() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null
  const isOpen = Boolean(bookmark)

  dom.deleteModal.classList.toggle('hidden', !isOpen)

  if (!isOpen) {
    syncBackdropVisibility()
    return
  }

  dom.deleteBookmarkTitle.textContent = bookmark.title
  dom.deleteBookmarkPath.textContent = bookmark.path || '未归档路径'
  syncBackdropVisibility()
}

function syncBackdropVisibility() {
  const hasOpenModal = Boolean(
    state.isFilterPickerOpen ||
      state.moveTargetBookmarkId ||
      state.editTargetBookmarkId ||
      state.confirmDeleteBookmarkId
  )
  dom.modalBackdrop.classList.toggle('hidden', !hasOpenModal)
  dom.modalBackdrop.setAttribute('aria-hidden', String(!hasOpenModal))
}

function renderFilterFolderList() {
  const query = normalizeText(state.filterSearchQuery)
  const folders = query
    ? state.allFolders.filter((folder) => {
        return (
          folder.normalizedTitle.includes(query) ||
          folder.normalizedPath.includes(query)
        )
      })
    : state.allFolders

  const folderItems = folders
    .map((folder) => {
      const isSelected = state.selectedFolderFilterId === folder.id
      return `
        <button
          class="filter-option ${isSelected ? 'selected' : ''}"
          type="button"
          data-select-filter-folder="${escapeAttr(folder.id)}"
          title="${escapeAttr(folder.path)}"
        >
          <span class="folder-kind" aria-hidden="true"></span>
          <span class="filter-option-copy">
            <span class="filter-option-title">${highlightText(folder.title, state.filterSearchQuery)}</span>
            <span class="filter-option-path">${highlightText(folder.path, state.filterSearchQuery)}</span>
          </span>
        </button>
      `
    })
    .join('')

  if (!folderItems && query) {
    return '<div class="state-panel compact">未找到相关文件夹</div>'
  }

  return folderItems
}

function renderMoveFolderList(bookmark) {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.moveSearchQuery)
  const markup = roots
    .map((node) => renderMoveFolderNode(node, 0, query, bookmark))
    .join('')

  if (!markup.trim()) {
    return '<div class="state-panel">未找到相关文件夹</div>'
  }

  return markup
}

function renderMoveFolderNode(node, depth, query, bookmark) {
  if (node.id === ROOT_ID) {
    return ''
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return ''
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childMarkup = childFolders
    .map((child) => renderMoveFolderNode(child, depth + 1, query, bookmark))
    .join('')

  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childMarkup) {
    return ''
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const isCurrentFolder = bookmark.parentId === node.id

  return `
    <div class="picker-row ${isCurrentFolder ? 'current' : ''}" style="--depth:${depth}">
      <button
        class="tree-toggle ${isExpanded ? 'expanded' : ''}"
        type="button"
        ${childFolders.length ? '' : 'data-disabled="true"'}
        data-toggle-move-folder="${escapeAttr(node.id)}"
        aria-label="${isExpanded ? '折叠文件夹' : '展开文件夹'}"
      ></button>
      <button
        class="picker-folder-card"
        type="button"
        data-select-folder="${escapeAttr(node.id)}"
      >
        <span class="folder-kind" aria-hidden="true"></span>
        <span class="picker-folder-main">
          <span class="row-title">${highlightText(folder.title, state.moveSearchQuery)}</span>
          <span class="picker-path" title="${escapeAttr(folder.path)}">${highlightText(folder.path, state.moveSearchQuery)}</span>
          ${isCurrentFolder ? '<span class="picker-badge">当前位置</span>' : ''}
        </span>
      </button>
    </div>
    ${isExpanded ? childMarkup : ''}
  `
}

function renderToasts() {
  dom.toastRoot.innerHTML = state.toasts
    .map((toast) => {
      return `
        <div class="toast ${escapeAttr(toast.type)}" data-toast-id="${escapeAttr(toast.id)}">
          <div class="toast-copy">
            <p class="toast-message">${escapeHtml(toast.message)}</p>
          </div>
          ${
            toast.action
              ? `<button class="toast-action" type="button" data-toast-action="${escapeAttr(
                  toast.action
                )}" data-toast-id="${escapeAttr(toast.id)}">${escapeHtml(toast.actionLabel || '操作')}</button>`
              : ''
          }
          <button class="toast-dismiss" type="button" data-dismiss-toast="${escapeAttr(toast.id)}">关闭</button>
        </div>
      `
    })
    .join('')
}

function handleContentClick(event) {
  const folderToggle = event.target.closest('[data-toggle-folder]')
  if (folderToggle) {
    const folderId = folderToggle.getAttribute('data-toggle-folder')
    toggleFolder(folderId)
    return
  }

  const menuToggle = event.target.closest('[data-open-menu]')
  if (menuToggle) {
    const bookmarkId = menuToggle.getAttribute('data-open-menu')
    state.activeMenuBookmarkId =
      state.activeMenuBookmarkId === bookmarkId ? null : bookmarkId
    renderMainContent()
    return
  }

  const actionButton = event.target.closest('[data-menu-action]')
  if (actionButton) {
    const bookmarkId = actionButton.getAttribute('data-bookmark-id')
    const action = actionButton.getAttribute('data-menu-action')

    if (action === 'edit') {
      openEditDialog(bookmarkId)
      return
    }

    if (action === 'move') {
      openMoveDialog(bookmarkId)
      return
    }

    if (action === 'delete') {
      openDeleteDialog(bookmarkId)
    }

    return
  }

  const bookmarkButton = event.target.closest('[data-open-bookmark]')
  if (bookmarkButton) {
    const bookmarkId = bookmarkButton.getAttribute('data-open-bookmark')
    openBookmark(bookmarkId)
  }
}

function handleContentPointerOver(event) {
  const resultCard = event.target.closest('[data-result-index]')
  if (!resultCard || !state.debouncedQuery) {
    return
  }

  const nextIndex = Number(resultCard.getAttribute('data-result-index'))
  if (!Number.isNaN(nextIndex)) {
    setActiveResultIndex(nextIndex)
  }
}

function handleFilterListClick(event) {
  const filterButton = event.target.closest('[data-select-filter-folder]')
  if (!filterButton) {
    return
  }

  const folderId = filterButton.getAttribute('data-select-filter-folder')
  applyFolderFilter(folderId === 'all' ? null : folderId)
}

function handleMoveListClick(event) {
  const toggle = event.target.closest('[data-toggle-move-folder]')
  if (toggle && !state.moveSearchQuery.trim()) {
    const folderId = toggle.getAttribute('data-toggle-move-folder')
    if (!toggle.hasAttribute('data-disabled')) {
      toggleMoveFolder(folderId)
    }
    return
  }

  const folderButton = event.target.closest('[data-select-folder]')
  if (folderButton) {
    const folderId = folderButton.getAttribute('data-select-folder')
    moveBookmarkToFolder(folderId)
  }
}

function handleDocumentPointerDown(event) {
  if (!state.activeMenuBookmarkId) {
    return
  }

  if (!event.target.closest('.menu-anchor')) {
    state.activeMenuBookmarkId = null
    renderMainContent()
  }
}

function handleDocumentKeydown(event) {
  if (event.isComposing) {
    return
  }

  if (event.key === 'Escape') {
    if (handleEscapeAction()) {
      event.preventDefault()
    }
    return
  }

  if (hasOpenModal()) {
    return
  }

  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setActiveResultIndex(state.activeResultIndex + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    setActiveResultIndex(state.activeResultIndex - 1)
    return
  }

  if (event.key === 'Enter') {
    const activeResult = state.searchResults[state.activeResultIndex]
    if (activeResult) {
      event.preventDefault()
      openBookmark(activeResult.id)
    }
  }
}

function handleEscapeAction() {
  if (hasOpenModal()) {
    closeDialogs()
    return true
  }

  if (state.activeMenuBookmarkId) {
    state.activeMenuBookmarkId = null
    renderMainContent()
    return true
  }

  if (state.searchQuery) {
    setSearchQuery('', { immediate: true })
    return true
  }

  return false
}

function handleEditInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEditedBookmark()
  }
}

function handleToastClick(event) {
  const dismissButton = event.target.closest('[data-dismiss-toast]')
  if (dismissButton) {
    dismissToast(dismissButton.getAttribute('data-dismiss-toast'))
    return
  }

  const actionButton = event.target.closest('[data-toast-action]')
  if (!actionButton) {
    return
  }

  const toastId = actionButton.getAttribute('data-toast-id')
  const action = actionButton.getAttribute('data-toast-action')

  dismissToast(toastId)

  if (action === 'undo-delete') {
    undoDelete()
  }
}

function toggleFolder(folderId) {
  if (!folderId) {
    return
  }

  if (state.expandedFolders.has(folderId)) {
    state.expandedFolders.delete(folderId)
  } else {
    state.expandedFolders.add(folderId)
  }

  renderMainContent()
}

function toggleMoveFolder(folderId) {
  if (!folderId) {
    return
  }

  if (state.moveExpandedFolders.has(folderId)) {
    state.moveExpandedFolders.delete(folderId)
  } else {
    state.moveExpandedFolders.add(folderId)
  }

  renderMoveModal()
}

function openFilterDialog() {
  state.activeMenuBookmarkId = null
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.isFilterPickerOpen = true
  state.filterSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.filterSearchInput.focus()
  })
}

function openMoveDialog(bookmarkId) {
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = null
  state.moveTargetBookmarkId = bookmarkId
  state.moveSearchQuery = ''
  render()

  window.requestAnimationFrame(() => {
    dom.moveSearchInput.focus()
  })
}

function openEditDialog(bookmarkId) {
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = bookmarkId
  render()

  window.requestAnimationFrame(() => {
    dom.editTitleInput.focus()
    dom.editTitleInput.select()
  })
}

function openDeleteDialog(bookmarkId) {
  state.activeMenuBookmarkId = null
  state.isFilterPickerOpen = false
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = bookmarkId
  render()

  window.requestAnimationFrame(() => {
    dom.cancelDelete.focus()
  })
}

function closeDialogs() {
  state.isFilterPickerOpen = false
  state.filterSearchQuery = ''
  state.moveTargetBookmarkId = null
  state.moveSearchQuery = ''
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  render()
  dom.searchInput.focus()
}

function applyFolderFilter(folderId) {
  state.selectedFolderFilterId = folderId
  state.isFilterPickerOpen = false
  state.filterSearchQuery = ''
  state.activeMenuBookmarkId = null
  runSearch()
  render()
  dom.searchInput.focus()
}

function clearFolderFilter() {
  if (!state.selectedFolderFilterId) {
    return
  }

  applyFolderFilter(null)
}

async function moveBookmarkToFolder(folderId) {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null

  if (!bookmark || !folderId) {
    return
  }

  if (bookmark.parentId === folderId) {
    showToast({
      type: 'success',
      message: '书签已在当前文件夹中'
    })
    return
  }

  try {
    await moveBookmark(bookmark.id, folderId)
    showToast({
      type: 'success',
      message: '移动成功'
    })
    closeDialogs()
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。'
    })
  }
}

async function saveEditedBookmark() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null

  if (!bookmark) {
    return
  }

  const nextTitle = dom.editTitleInput.value.trim() || '未命名书签'
  const nextUrl = dom.editUrlInput.value.trim()

  if (!nextUrl) {
    showToast({
      type: 'error',
      message: '网址不能为空'
    })
    dom.editUrlInput.focus()
    return
  }

  try {
    new URL(nextUrl)
  } catch (error) {
    showToast({
      type: 'error',
      message: '请输入有效的网址'
    })
    dom.editUrlInput.focus()
    return
  }

  try {
    await updateBookmark(bookmark.id, {
      title: nextTitle,
      url: nextUrl
    })
    showToast({
      type: 'success',
      message: '保存成功'
    })
    closeDialogs()
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  }
}

async function confirmDeleteBookmark() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null

  if (!bookmark) {
    return
  }

  try {
    state.lastDeletedBookmark = {
      title: bookmark.title,
      url: bookmark.url,
      parentId: bookmark.parentId,
      index: bookmark.index,
      recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    }

    await removeBookmark(bookmark.id)
    await appendRecycleEntry({
      recycleId: state.lastDeletedBookmark.recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title,
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: bookmark.path || '',
      source: '弹窗删除',
      deletedAt: Date.now()
    })

    showToast({
      type: 'success',
      message: '删除成功',
      action: 'undo-delete',
      actionLabel: '撤销'
    })

    closeDialogs()
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `删除失败：${error.message}` : '删除失败，请稍后重试。'
    })
  }
}

async function undoDelete() {
  if (!state.lastDeletedBookmark) {
    return
  }

  const payload = state.lastDeletedBookmark
  state.lastDeletedBookmark = null

  try {
    await createBookmark(payload)
    if (payload.recycleId) {
      await removeRecycleEntry(payload.recycleId)
    }
    showToast({
      type: 'success',
      message: '已撤销删除'
    })
    await refreshData({ preserveSearch: true })
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `撤销失败：${error.message}` : '撤销失败，请稍后重试。'
    })
  }
}

async function openBookmark(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)

  if (!bookmark?.url) {
    return
  }

  try {
    await createTab({ url: bookmark.url })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `打开失败：${error.message}` : '打开失败，请稍后重试。'
    })
  }
}

function updateActiveResultVisibility() {
  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  const activeResult = dom.content.querySelector(
    `[data-result-index="${state.activeResultIndex}"]`
  )
  if (!activeResult) {
    return
  }

  const maxScrollTop = Math.max(0, dom.content.scrollHeight - dom.content.clientHeight)

  if (state.activeResultIndex === 0) {
    dom.content.scrollTop = 0
    return
  }

  if (state.activeResultIndex === state.searchResults.length - 1) {
    dom.content.scrollTop = maxScrollTop
    return
  }

  const resultTop = activeResult.offsetTop
  const resultBottom = resultTop + activeResult.offsetHeight
  const viewportTop = dom.content.scrollTop
  const viewportBottom = viewportTop + dom.content.clientHeight

  if (resultTop < viewportTop) {
    dom.content.scrollTop = Math.max(0, resultTop)
    return
  }

  if (resultBottom > viewportBottom) {
    dom.content.scrollTop = Math.min(maxScrollTop, resultBottom - dom.content.clientHeight)
  }
}

function setActiveResultIndex(nextIndex) {
  if (!state.debouncedQuery || !state.searchResults.length) {
    return
  }

  const clampedIndex = Math.max(0, Math.min(nextIndex, state.searchResults.length - 1))
  if (clampedIndex === state.activeResultIndex) {
    return
  }

  const previousIndex = state.activeResultIndex
  state.activeResultIndex = clampedIndex
  updateActiveSearchResult(previousIndex, clampedIndex)
  updateActiveResultVisibility()
}

function updateActiveSearchResult(previousIndex, nextIndex) {
  const previousCard = dom.content.querySelector(`[data-result-index="${previousIndex}"]`)
  const nextCard = dom.content.querySelector(`[data-result-index="${nextIndex}"]`)

  if (!previousCard && !nextCard) {
    renderMainContent()
    return
  }

  previousCard?.classList.remove('active')
  nextCard?.classList.add('active')
}

function searchBookmarks(query, bookmarks) {
  const normalizedQuery = normalizeQuery(query)
  const queryTerms = getQueryTerms(normalizedQuery)

  return bookmarks
    .map((bookmark) => {
      const score = scoreBookmark(bookmark, normalizedQuery, queryTerms)
      return score > 0 ? { ...bookmark, score } : null
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.title.length !== right.title.length) {
        return left.title.length - right.title.length
      }

      return left.path.localeCompare(right.path, 'zh-Hans-CN')
    })
}

function scoreBookmark(bookmark, normalizedQuery, queryTerms) {
  const title = bookmark.normalizedTitle
  const url = bookmark.normalizedUrl
  let score = 0
  let matched = false

  if (!normalizedQuery) {
    return 0
  }

  if (title === normalizedQuery) {
    score += 620
    matched = true
  }

  if (title.startsWith(normalizedQuery)) {
    score += 420
    matched = true
  }

  const titleIndex = title.indexOf(normalizedQuery)
  if (titleIndex !== -1) {
    score += 300 - Math.min(titleIndex, 120)
    matched = true
  }

  if (url.startsWith(normalizedQuery)) {
    score += 250
    matched = true
  }

  const urlIndex = url.indexOf(normalizedQuery)
  if (urlIndex !== -1) {
    score += 190 - Math.min(urlIndex, 100)
    matched = true
  }

  let allTermsPresent = queryTerms.length > 0

  for (const term of queryTerms) {
    let termMatched = false
    const termTitleIndex = title.indexOf(term)
    const termUrlIndex = url.indexOf(term)

    if (termTitleIndex !== -1) {
      score += 72 - Math.min(termTitleIndex, 40)
      termMatched = true
      matched = true
    }

    if (termUrlIndex !== -1) {
      score += 45 - Math.min(termUrlIndex, 40)
      termMatched = true
      matched = true
    }

    if (!termMatched) {
      allTermsPresent = false
    }
  }

  if (allTermsPresent && queryTerms.length > 1) {
    score += 120
  }

  const titleFuzzy = subsequenceScore(title, normalizedQuery)
  const urlFuzzy = subsequenceScore(url, normalizedQuery)
  const fuzzyScore = Math.max(titleFuzzy * 2, urlFuzzy)

  if (fuzzyScore > 0) {
    score += fuzzyScore
    matched = true
  }

  if (title.includes(normalizedQuery) && url.includes(normalizedQuery)) {
    score += 38
  }

  score -= Math.floor(bookmark.title.length / 28)

  return matched ? Math.max(score, 0) : 0
}

function subsequenceScore(text, query) {
  if (!text || !query || query.length < 2) {
    return 0
  }

  let textIndex = 0
  let queryIndex = 0
  let streak = 0
  let bestStreak = 0
  let gapPenalty = 0

  while (textIndex < text.length && queryIndex < query.length) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex += 1
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
    } else if (queryIndex > 0) {
      streak = 0
      gapPenalty += 1
    }

    textIndex += 1
  }

  if (queryIndex !== query.length) {
    return 0
  }

  return 40 + query.length * 10 + bestStreak * 10 - gapPenalty
}

function getCurrentTreeRoot() {
  if (state.selectedFolderFilterId) {
    return findNodeById(state.rawTreeRoot, state.selectedFolderFilterId) || state.bookmarksBarNode
  }

  return state.bookmarksBarNode
}

function getFilteredBookmarks() {
  if (!state.selectedFolderFilterId) {
    return state.allBookmarks
  }

  return state.allBookmarks.filter((bookmark) => {
    return bookmark.ancestorIds.includes(state.selectedFolderFilterId)
  })
}

function hasOpenModal() {
  return Boolean(
    state.isFilterPickerOpen ||
      state.moveTargetBookmarkId ||
      state.editTargetBookmarkId ||
      state.confirmDeleteBookmarkId
  )
}

function getDefaultExpandedFolders(node) {
  if (!node || node.url) {
    return new Set()
  }

  return new Set([node.id])
}

function describeFolder(folder) {
  if (!folder) {
    return '文件夹'
  }

  const parts = []
  if (folder.folderCount) {
    parts.push(`${folder.folderCount} 个文件夹`)
  }
  if (folder.bookmarkCount) {
    parts.push(`${folder.bookmarkCount} 个书签`)
  }

  return parts.join(' · ') || '空文件夹'
}

function getQueryTerms(query) {
  return [...new Set(query.split(/\s+/).filter(Boolean))]
}

function normalizeQuery(value) {
  return normalizeText(stripCommonUrlPrefix(value))
}

function highlightText(text, query) {
  const safeText = String(text || '')
  const terms = getQueryTerms(normalizeQuery(query))

  if (!terms.length || !safeText) {
    return escapeHtml(safeText)
  }

  const lowerText = safeText.toLowerCase()
  const ranges = []

  for (const term of terms.sort((left, right) => right.length - left.length)) {
    let fromIndex = 0
    while (fromIndex < lowerText.length) {
      const matchIndex = lowerText.indexOf(term, fromIndex)
      if (matchIndex === -1) {
        break
      }
      ranges.push([matchIndex, matchIndex + term.length])
      fromIndex = matchIndex + term.length
    }
  }

  if (!ranges.length) {
    return escapeHtml(safeText)
  }

  ranges.sort((left, right) => left[0] - right[0])
  const mergedRanges = []

  for (const currentRange of ranges) {
    const previousRange = mergedRanges.at(-1)
    if (!previousRange || currentRange[0] > previousRange[1]) {
      mergedRanges.push([...currentRange])
      continue
    }

    previousRange[1] = Math.max(previousRange[1], currentRange[1])
  }

  let cursor = 0
  let output = ''

  for (const [start, end] of mergedRanges) {
    output += escapeHtml(safeText.slice(cursor, start))
    output += `<mark>${escapeHtml(safeText.slice(start, end))}</mark>`
    cursor = end
  }

  output += escapeHtml(safeText.slice(cursor))
  return output
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value) {
  return escapeHtml(value)
}

function showToast({ type = 'success', message, action = '', actionLabel = '' }) {
  const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const toast = {
    id,
    type,
    message,
    action,
    actionLabel
  }

  state.toasts = [...state.toasts, toast]
  renderToasts()

  const timeoutId = window.setTimeout(() => {
    dismissToast(id)
  }, action === 'undo-delete' ? UNDO_WINDOW_MS : 3200)

  state.toastTimers.set(id, timeoutId)
}

function dismissToast(toastId) {
  if (!toastId) {
    return
  }

  const timeoutId = state.toastTimers.get(toastId)
  if (timeoutId) {
    clearTimeout(timeoutId)
    state.toastTimers.delete(toastId)
  }

  state.toasts = state.toasts.filter((toast) => toast.id !== toastId)
  renderToasts()
}
