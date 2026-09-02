import { useEffect } from 'react'
import {
  AUTO_ANALYZE_STATUS_ACTIVE_EXPIRE_MS,
  AUTO_ANALYZE_STATUS_FINAL_EXPIRE_MS,
  BOOKMARKS_BAR_ID,
  POPUP_COMMAND_INTENT_TTL_MS,
  ROOT_ID,
  STORAGE_KEYS,
  UNDO_WINDOW_MS
} from '../shared/constants.js'
import {
  extractBookmarkData,
  findBookmarksBar,
  findNodeById
} from '../shared/bookmark-tree.js'
import {
  formatBookmarkPath,
  formatFolderPath
} from '../shared/bookmark-path.js'
import {
  displayUrl,
  extractDomain,
  normalizeText
} from '../shared/text.js'
import { isExternallyCheckableUrl } from '../shared/sensitive-url.js'
import { normalizeBookmarkSaveUrl } from '../shared/bookmark-save-url.js'
import {
  createBookmark,
  createTab,
  getBookmarkTree,
  moveBookmark,
  updateBookmark
} from '../shared/bookmarks-api.js'
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '../shared/storage.js'
import { requestBookmarkSave } from '../shared/messages.js'
import { loadBookmarkTagIndex, normalizeBookmarkTags } from '../shared/bookmark-tags.js'
import {
  buildBookmarkCatalogSnapshot,
  type BookmarkCatalogSnapshot
} from '../shared/bookmark-catalog.js'
import {
  MAX_POPUP_SEARCH_RESULTS,
  POPUP_SEARCH_ASYNC_THRESHOLD,
  getQueryTerms,
  normalizeQuery,
  searchBookmarks,
  searchBookmarksCooperatively,
  searchBookmarksFirstBatch,
  type PopupSearchBookmark,
  type PopupSearchResult
} from './search.js'
import { parseSearchQuery } from '../shared/search-query.js'
import {
  DEFAULT_NEW_TAB_WORKSPACE_ID,
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  toggleNewTabWorkspacePin
} from '../shared/newtab-workspace-settings.js'
import type {
  NaturalSearchPlan,
  NaturalSearchResultSet
} from './natural-search.js'
import {
  buildLightPopupSearchIndex,
  buildLightPopupSearchIndexFromCatalog,
  enrichLightPopupSearchIndexWithPinyin,
  enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog,
  loadPopupSearchIndexSnapshotState,
  patchLightPopupSearchIndexFromCatalog,
  shouldWarmPopupSnapshotFullText
} from './search-index.js'
import { requiresPinyinTokens } from '../shared/search/pinyin-query.js'
import { state } from './state.js'
import {
  type PopupActionMenuViewModel,
  type PopupContentBookmarkRowViewModel,
  type PopupContentFolderRowViewModel,
  type PopupContentRowViewModel,
  type PopupContentSearchResultViewModel,
  type PopupContentViewModel,
  type PopupEmptyStateViewModel,
  type PopupFolderPickerState,
  type PopupFolderTreeOptionViewModel,
  type PopupSmartClassifierViewModel
} from './components/PopupViewModels.js'
import {
  dispatchPopupAutoAnalyzeStatusChange,
  dispatchPopupChromeChange,
  dispatchPopupSearchFocusRequest,
  dispatchPopupContentChange,
  dispatchPopupFolderPickerChange,
  dispatchPopupModalsChange,
  dispatchPopupSearchChipsChange,
  dispatchPopupSmartClassifierChange,
  dispatchPopupToastsChange,
  registerPopupActionHandlers,
  resetPopupViewStore,
  type PopupAutoAnalyzeStatusActionDetail,
  type PopupAutoAnalyzeStatusView,
  type PopupChromeActionDetail,
  type PopupChromeView,
  type PopupContentActionDetail,
  type PopupContentResultHoverDetail,
  type PopupFolderPickerActionDetail,
  type PopupModalActionDetail,
  type PopupModalsView,
  type PopupSearchChipView,
  type PopupSmartClassifierActionDetail,
  type PopupSmartClassifierTitleChangeDetail,
  type PopupToastActionDetail
} from './popup-controller-store.js'
import { getPopupSmartClassifierRenderStatus } from './popup-smart-classifier-status.js'
import {
  hydratePopupBaseData,
  hydratePopupDeferredEnhancements
} from './popup-hydration.js'
import { registerPopupBrowserEventActions } from './popup-browser-events-store.js'
import { getPopupSearchFocusPlan } from './popup-search-focus.js'
import {
  getBookmarkPaneKeyboardIndex,
  getFolderPaneKeyboardIndex,
  getFolderPaneTreeRoot,
  isBookmarkRowKeyboardActive,
  shouldBlurMainSearchForNavigation,
  shouldDelegatePopupDocumentNavigation,
  type PopupKeyboardTargetInfo
} from './popup-keyboard-navigation.js'
import {
  getPopupEditBookmarkDraftState,
  getPopupEditBookmarkSavePlan
} from './edit-bookmark-draft.js'
import {
  getPopupBookmarkMoveDestinationIndex,
  reorderPopupBookmarkIds
} from './popup-bookmark-reorder.js'
import {
  getPopupPrebootSearchAdoptionQuery,
  readPopupPrebootSearchSnapshot
} from './popup-preboot-input.js'
import { mark as perfMark, measure as perfMeasure } from '../shared/perf.js'
import { writeClipboardText } from '../shared/clipboard.js'
import { runIdle } from '../shared/idle.js'
import {
  SMART_LOADING_PROGRESS_COMPLETE_MS,
  SMART_LOADING_PROGRESS_FINISH_MS,
  SMART_LOADING_PROGRESS_SETTLE_HOLD_MS,
  SMART_LOADING_PROGRESS_TICK_MS,
  SMART_LOADING_STEP_COUNT,
  getSmartCheckpointProgress,
  getSmartDisplayProgress,
  getSmartEasedProgress,
  getSmartFinishProgress,
  getSmartProgressTarget,
  normalizeSmartLoadingStep
} from './smart-loading-progress.js'
const SEARCH_DEBOUNCE_MS = 140
const NATURAL_SEARCH_DEBOUNCE_MS = 520
const VIEW_NOTICE_MS = 1800
const MAX_VISIBLE_TOASTS = 2
const SEARCH_SNAPSHOT_WARM_DELAY_MS = 220
const KEYBOARD_NAVIGATION_SETTLE_MS = 120
const POPUP_PINYIN_BATCH_SIZE = 12
const POPUP_PINYIN_IDLE_TIMEOUT_MS = 500
const SMART_RECOMMENDATION_LIMIT = 3
const POPUP_DEFAULT_WORKSPACE_STORAGE = {
  activeWorkspaceId: DEFAULT_NEW_TAB_WORKSPACE_ID,
  workspaces: []
}
const DEFAULT_POPUP_PREFERENCES = {
  naturalSearchEnabled: false
}
let popupDialogReturnFocusElement: HTMLElement | null = null
let naturalSearchModulePromise: Promise<typeof import('./natural-search.js')> | null = null
let naturalSearchAiModulePromise: Promise<typeof import('./natural-search-ai.js')> | null = null
let aiSettingsModulePromise: Promise<typeof import('../options/sections/ai-settings.js')> | null = null
let smartClassifierModulePromise: Promise<typeof import('./smart-classifier.js')> | null = null
let recycleBinModulePromise: Promise<typeof import('../shared/recycle-bin.js')> | null = null
let smartProgressTimer: number | null = null
let smartClassificationAbortController: AbortController | null = null
// 缓动的锚点：最近一次"真实进度"的数值与发生时刻，节拍器据此按经过时间推算显示值。
let smartProgressBase = 0
let smartProgressBaseAtMs = 0
let smartProgressFinishFrame: number | null = null
let popupRefreshRunId = 0
let currentTabHydrationPromise: Promise<void> | null = null
let popupBookmarkCatalog: BookmarkCatalogSnapshot | null = null
let popupFolderBookmarkCounts = new Map<string, number>()
let unregisterPopupActionHandlers: (() => void) | null = null
let unregisterPopupBrowserEventActions: (() => void) | null = null
let queuedActiveResultIndex: number | null = null
let queuedActiveFolderIndex: number | null = null
let activeResultFrame = 0
let activeFolderFrame = 0
let keyboardNavigationSettleTimer = 0
interface PopupRefreshBaseData {
  refreshRunId: number
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
  bookmarksBarNode: chrome.bookmarks.BookmarkTreeNode | null
  catalog: BookmarkCatalogSnapshot
  indexedBookmarks: ReturnType<typeof buildLightPopupSearchIndex>
}
interface PopupRefreshDeferredData {
  tagIndex: Awaited<ReturnType<typeof loadBookmarkTagIndex>> | null
  snapshotState: Awaited<ReturnType<typeof loadPopupSearchIndexSnapshotState>>
}
function abortNaturalSearchRequest() {
  state.naturalSearchAbortController?.abort()
  state.naturalSearchAbortController = null
}
function abortSmartClassificationRequest() {
  smartClassificationAbortController?.abort()
  smartClassificationAbortController = null
}
function loadNaturalSearchModule(): Promise<typeof import('./natural-search.js')> {
  naturalSearchModulePromise ||= import('./natural-search.js')
  return naturalSearchModulePromise
}
function loadNaturalSearchAiModule(): Promise<typeof import('./natural-search-ai.js')> {
  naturalSearchAiModulePromise ||= import('./natural-search-ai.js')
  return naturalSearchAiModulePromise
}
function loadAiSettingsModule(): Promise<typeof import('../options/sections/ai-settings.js')> {
  aiSettingsModulePromise ||= import('../options/sections/ai-settings.js')
  return aiSettingsModulePromise
}
function loadSmartClassifierModule(): Promise<typeof import('./smart-classifier.js')> {
  smartClassifierModulePromise ||= import('./smart-classifier.js')
  return smartClassifierModulePromise
}
function loadRecycleBinModule(): Promise<typeof import('../shared/recycle-bin.js')> {
  recycleBinModulePromise ||= import('../shared/recycle-bin.js')
  return recycleBinModulePromise
}
let popupControllerStarted = false

export function usePopupController(): void {
  useEffect(() => startPopupController(), [])
}

function startPopupController(): () => void {
  if (popupControllerStarted) {
    return cleanupPopupController
  }
  popupControllerStarted = true

  perfMark('popup.domContentLoaded')
  bindEvents()
  adoptInitialPopupPrebootSearchQuery()
  render()
  perfMark('popup.firstRender')
  perfMeasure('popup.shellReady', 'popup.domContentLoaded', 'popup.firstRender')
  // 偏好加载与书签加载并行。
  // hydratePopupPreferences 最终只得出两个布尔值（语义搜索开关及其 AI 是否已配置），
  // 书签列表不读它们。但它里的 AI 配置检查要动态 import natural-search-ai
  // 及其依赖的 ai-settings，整条 chunk 的拉取与求值一旦串在前面，
  // 首屏数据就要白等一百多毫秒。
  void hydratePopupPreferences().finally(() => {
    render()
  })
  void refreshData({ initial: true, preserveSearch: true }).finally(() => {
    perfMark('popup.interactive')
    perfMeasure('popup.totalInteractive', 'popup.domContentLoaded', 'popup.interactive')
    void consumePopupCommandIntent().then((handled) => {
      if (!handled && !isSmartOverlayActive()) {
        focusSearchInput()
      }
    })
  })
  void hydrateAutoAnalyzeStatus()

  return cleanupPopupController
}

function bindEvents() {
  unregisterPopupActionHandlers = registerPopupActionHandlers({
    autoAnalyzeStatus: handleAutoAnalyzeStatusAction,
    chrome: handleChromeAction,
    content: handleContentAction,
    contentResultHover: handleContentResultHover,
    folderPicker: handleFolderPickerAction,
    modal: handleModalAction,
    smartClassifier: handleSmartClassifierAction,
    smartClassifierTitleChange: handleSmartClassifierTitleChange,
    toast: handleToastAction
  })
  unregisterPopupBrowserEventActions?.()
  unregisterPopupBrowserEventActions = registerPopupBrowserEventActions({
    onDocumentKeyDown: handleDocumentKeydown,
    onPageHide: cleanupPopupController,
    onStorageChanged: handlePopupStorageChanged
  })
}

function adoptInitialPopupPrebootSearchQuery(): void {
  const snapshot = readPopupPrebootSearchSnapshot()
  const nextQuery = getPopupPrebootSearchAdoptionQuery(snapshot, state.searchQuery)

  if (nextQuery === state.searchQuery) {
    return
  }

  state.searchQuery = nextQuery
  state.debouncedQuery = nextQuery.trim()
}

async function hydratePopupPreferences() {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.popupPreferences])
    const preferences = normalizePopupPreferences(stored[STORAGE_KEYS.popupPreferences])
    state.naturalSearchEnabled = preferences.naturalSearchEnabled
  } catch {
    state.naturalSearchEnabled = DEFAULT_POPUP_PREFERENCES.naturalSearchEnabled
  }
  const naturalSearchAiConfigured = await refreshNaturalSearchAiConfiguredState()
  if (!naturalSearchAiConfigured && state.naturalSearchEnabled) {
    state.naturalSearchEnabled = false
    void savePopupPreferences().catch(() => {})
  }
}
function normalizePopupPreferences(value) {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_POPUP_PREFERENCES }
  }
  return {
    naturalSearchEnabled: value.naturalSearchEnabled === true
  }
}
async function savePopupPreferences() {
  await setLocalStorage({
    [STORAGE_KEYS.popupPreferences]: {
      naturalSearchEnabled: state.naturalSearchEnabled
    }
  })
}
async function refreshNaturalSearchAiConfiguredState(): Promise<boolean> {
  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    const naturalSearchAiConfigured = naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)
    state.naturalSearchAiConfigured = naturalSearchAiConfigured
    return naturalSearchAiConfigured
  } catch {
    state.naturalSearchAiConfigured = false
    return false
  } finally {
    state.naturalSearchAiConfigChecked = true
  }
}
async function openSettingsPage(target: Event | 'general' | 'ai-provider' = 'general') {
  const hash = target === 'ai-provider' ? 'general:ai-provider' : 'general'
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`src/options/options.html#${hash}`)
    })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '设置页打开失败，请稍后重试。'
    })
  }
}
async function openBookmarkHistoryPage() {
  try {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html#bookmark-history')
    })
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? error.message : '添加历史打开失败，请稍后重试。'
    })
  }
}
async function hydrateAutoAnalyzeStatus() {
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.autoAnalyzeStatus])
    const currentStatus = normalizeAutoAnalyzeStatus(stored[STORAGE_KEYS.autoAnalyzeStatus])
    state.autoAnalyzeStatus = currentStatus
    renderAutoAnalyzeStatus()
    if (stored[STORAGE_KEYS.autoAnalyzeStatus] && !currentStatus) {
      await removeLocalStorage(STORAGE_KEYS.autoAnalyzeStatus)
    }
    await acknowledgeAutoAnalyzeBadge(currentStatus)
    await removeLocalStorage(STORAGE_KEYS.pendingAutoAnalyzeNotice)
  } catch (error) {
  }
}
async function dismissAutoAnalyzeStatus() {
  state.autoAnalyzeStatus = null
  renderAutoAnalyzeStatus()
  await removeLocalStorage([
    STORAGE_KEYS.autoAnalyzeStatus,
    STORAGE_KEYS.pendingAutoAnalyzeNotice
  ])
  await clearActionBadge()
}
async function acknowledgeAutoAnalyzeBadge(status = state.autoAnalyzeStatus) {
  if (!status) {
    return
  }
  await clearActionBadge()
  try {
    const stored = await getLocalStorage([STORAGE_KEYS.autoAnalyzeStatus])
    const currentStatus = normalizeAutoAnalyzeStatus(stored[STORAGE_KEYS.autoAnalyzeStatus])
    if (!currentStatus || currentStatus.bookmarkId !== status.bookmarkId) {
      return
    }
    await setLocalStorage({
      [STORAGE_KEYS.autoAnalyzeStatus]: {
        ...currentStatus,
        badgeVisible: false
      }
    })
  } catch {
  }
}
function clearActionBadge(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!chrome.action?.setBadgeText) {
      resolve()
      return
    }
    chrome.action.setBadgeText({ text: '' }, () => {
      resolve()
    })
  })
}
function handlePopupStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
) {
  if (areaName !== 'local') {
    return
  }
  if (changes[STORAGE_KEYS.aiProviderSettings]) {
    // Invalidate the logical search run as well as the fetch.  Some paths can
    // still be awaiting storage/module work (or a cached plan) when settings
    // change, so aborting the current fetch alone is not enough to stop an old
    // reasoning configuration from committing results afterwards.
    state.searchRunId += 1
    abortNaturalSearchRequest()
    clearSearchCaches()
    state.naturalSearchPlan = null
    state.naturalSearchAiConfigChecked = false
    state.naturalSearchError = ''
    state.naturalSearchPending = false
    state.searchPending = false
    // 智能分类会先抓取页面再调用模型；设置在抓取期间变化时也必须让旧 run
    // 失效，避免“保存之后才发出”的请求仍携带旧推理强度。
    resetSmartClassification()
    runSearch()
    render()
  }
  const statusChange = changes[STORAGE_KEYS.autoAnalyzeStatus]
  if (statusChange) {
    const nextStatus = normalizeAutoAnalyzeStatus(statusChange.newValue)
    state.autoAnalyzeStatus = nextStatus
    renderAutoAnalyzeStatus()
    if (nextStatus?.badgeVisible) {
      void acknowledgeAutoAnalyzeBadge(nextStatus)
    }
    if (statusChange.newValue && !nextStatus) {
      void removeLocalStorage(STORAGE_KEYS.autoAnalyzeStatus).finally(() => {
        void clearActionBadge()
      })
    }
  }
  const popupIntentChange = changes[STORAGE_KEYS.popupCommandIntent]
  if (popupIntentChange?.newValue) {
    void consumePopupCommandIntent(popupIntentChange.newValue)
  }
}
function handleAutoAnalyzeStatusAction(detail: PopupAutoAnalyzeStatusActionDetail) {
  const action = detail.action
  if (action === 'toggle') {
    state.autoAnalyzeCollapsed = !state.autoAnalyzeCollapsed
    renderAutoAnalyzeStatus()
    return
  }
  if (action === 'dismiss') {
    void dismissAutoAnalyzeStatus()
    return
  }
  if (action === 'history') {
    void openBookmarkHistoryPage()
  }
}

function handleChromeAction(detail: PopupChromeActionDetail) {
  const action = String(detail.action || '')
  if (action === 'open-settings') {
    void openSettingsPage()
    return
  }
  if (action === 'search-change') {
    setSearchQuery(String(detail?.value || ''))
    return
  }
  if (action === 'clear-search') {
    setSearchQuery('', { immediate: true })
    showViewNotice('已清空搜索')
    focusSearchInput()
    return
  }
  if (action === 'toggle-natural-search') {
    void toggleNaturalLanguageSearch(detail.returnFocusElement || null)
  }
}

function focusSearchInput({ select = false } = {}): void {
  dispatchPopupSearchFocusRequest(select)
}

function renderAutoAnalyzeStatus() {
  dispatchPopupAutoAnalyzeStatusChange(getAutoAnalyzeStatusViewModel())
}

function getAutoAnalyzeStatusViewModel(): PopupAutoAnalyzeStatusView {
  const status = state.autoAnalyzeStatus
  if (!status) {
    return {
      collapsed: true,
      detail: '',
      showHistory: false,
      status: null,
      title: ''
    }
  }

  const view = getAutoAnalyzeStatusView(status)
  return {
    collapsed: state.autoAnalyzeCollapsed,
    detail: view.detail,
    showHistory: status.status === 'completed',
    status: status.status,
    title: view.title
  }
}
function getAutoAnalyzeStatusView(status) {
  const title = cleanSmartText(status.title || '新增书签', 44) || '新增书签'
  const folderPath = cleanSmartText(status.folderPath || '', 48)
  const error = cleanSmartText(status.error || '', 80)
  const detail = cleanSmartText(status.detail || '', 80)
  if (status.status === 'queued') {
    return {
      title: '已加入自动分析',
      detail: detail || `正在整理标签和命名：${title}`
    }
  }
  if (status.status === 'processing') {
    return {
      title: '自动分析进行中',
      detail: detail || `正在整理标签和命名：${title}`
    }
  }
  if (status.status === 'failed') {
    const retryHint = status.maxAttempts && status.attempts < status.maxAttempts
      ? `，稍后重试 ${status.attempts}/${status.maxAttempts}`
      : ''
    const failureMessage = detail || error || '可重试；若持续失败，请检查 AI 设置'
    return {
      title: '自动分析失败',
      detail: `${failureMessage}${retryHint}`.includes('AI 设置')
        ? `${failureMessage}${retryHint}`
        : `${failureMessage}${retryHint}；可重试或检查 AI 设置`
    }
  }
  return {
    title: '自动分析结果已保存',
    detail: detail || (folderPath ? `结果已保存到 ${folderPath}：${title}` : `结果已保存：${title}`)
  }
}
function normalizeAutoAnalyzeStatus(rawStatus) {
  if (!rawStatus || typeof rawStatus !== 'object') {
    return null
  }
  const status = String(rawStatus.status || '').trim()
  if (!['queued', 'processing', 'completed', 'failed'].includes(status)) {
    return null
  }
  const bookmarkId = String(rawStatus.bookmarkId || '').trim()
  if (!bookmarkId) {
    return null
  }
  const updatedAt = Number(rawStatus.updatedAt) || Date.now()
  const createdAt = Number(rawStatus.createdAt) || updatedAt
  const expiresAt = Number(rawStatus.expiresAt) || updatedAt + getAutoAnalyzeStatusTtl(status)
  if (expiresAt <= Date.now()) {
    return null
  }
  return {
    status,
    bookmarkId,
    title: cleanSmartText(rawStatus.title || '新增书签', 80) || '新增书签',
    url: String(rawStatus.url || '').trim(),
    folderPath: cleanSmartText(rawStatus.folderPath || '', 120),
    confidence: normalizeSmartConfidence(rawStatus.confidence),
    error: cleanSmartText(rawStatus.error || '', 160),
    detail: cleanSmartText(rawStatus.detail || '', 160),
    attempts: Math.max(0, Math.round(Number(rawStatus.attempts) || 0)),
    maxAttempts: Math.max(0, Math.round(Number(rawStatus.maxAttempts) || 0)),
    badgeVisible: rawStatus.badgeVisible !== false,
    createdAt,
    updatedAt,
    expiresAt
  }
}
function getAutoAnalyzeStatusTtl(status) {
  return status === 'queued' || status === 'processing'
    ? AUTO_ANALYZE_STATUS_ACTIVE_EXPIRE_MS
    : AUTO_ANALYZE_STATUS_FINAL_EXPIRE_MS
}
async function consumePopupCommandIntent(rawIntent = undefined): Promise<boolean> {
  let intentSource = rawIntent
  if (typeof rawIntent === 'undefined') {
    const stored = await getLocalStorage([STORAGE_KEYS.popupCommandIntent])
    intentSource = stored[STORAGE_KEYS.popupCommandIntent]
  }
  const intent = normalizePopupCommandIntent(intentSource)
  if (!intent) {
    if (intentSource) {
      await removeLocalStorage(STORAGE_KEYS.popupCommandIntent).catch(() => {})
    }
    return false
  }
  const clearCommandIntent = removeLocalStorage(STORAGE_KEYS.popupCommandIntent).catch(() => {})
  if (intent.action === 'feedback') {
    await clearCommandIntent
    showCommandFeedbackIntent(intent)
    return false
  }
  if (intent.action === 'smart-classifier') {
    await clearCommandIntent
    await runSmartClassifierFromCommand(intent)
    return true
  }
  await clearCommandIntent
  focusSearchFromCommand(intent)
  return true
}
function normalizePopupCommandIntent(rawIntent) {
  if (!rawIntent || typeof rawIntent !== 'object') {
    return null
  }
  const action = String(rawIntent.action || '').trim()
  if (!['search', 'smart-classifier', 'feedback'].includes(action)) {
    return null
  }
  const tone = String(rawIntent.tone || '').trim()
  const createdAt = Number(rawIntent.createdAt) || Date.now()
  const expiresAt = Number(rawIntent.expiresAt) || createdAt + POPUP_COMMAND_INTENT_TTL_MS
  if (expiresAt <= Date.now()) {
    return null
  }
  return {
    action,
    sourceCommand: String(rawIntent.sourceCommand || '').trim(),
    message: cleanSmartText(rawIntent.message || '', 120),
    tone: ['success', 'warning', 'danger', 'info'].includes(tone) ? tone : 'info',
    createdAt,
    expiresAt
  }
}
function showCommandFeedbackIntent(intent) {
  const message = intent.message || '快捷键操作已完成。'
  showViewNotice(message)
  showToast({
    type: intent.tone === 'success' ? 'success' : 'error',
    message
  })
}
function focusSearchFromCommand(intent) {
  if (hasOpenModal()) {
    closeDialogs()
  }
  if (['loading', 'results', 'error', 'permission'].includes(state.smartStatus)) {
    resetSmartClassification()
  }
  render()
  window.requestAnimationFrame(() => {
    focusSearchInput(getPopupSearchFocusPlan('command-intent'))
    showViewNotice(intent.message || (state.searchQuery ? '已聚焦搜索框，可继续编辑查询' : '已聚焦搜索框，可直接输入'))
  })
}
async function runSmartClassifierFromCommand(intent) {
  await ensureCurrentTabStateHydrated()
  if (hasOpenModal()) {
    closeDialogs()
  }
  const currentUrl = String(state.currentTab?.url || '').trim()
  if (!isSmartClassifiableUrl(currentUrl)) {
    showToast({
      type: 'error',
      message: '当前页面无法进行智能分类。'
    })
    focusSearchInput()
    return
  }
  if (state.smartStatus === 'unavailable') {
    state.smartStatus = 'idle'
  }
  render()
  showViewNotice(intent.message || '正在智能分类当前页面。')
  await classifyCurrentPage()
}
async function refreshData({ initial = false, preserveSearch = true } = {}) {
  const refreshRunId = popupRefreshRunId + 1
  popupRefreshRunId = refreshRunId
  perfMark('popup.refreshData.start')
  // 已经向用户呈现过内容（会话快照或上一轮数据）时静默刷新：
  // 不再把可见内容拉回骨架 + 渐隐态，数据就绪后直接原地替换。
  state.isLoading = !state.hasPresentedContent
  state.loadError = ''
  render()
  try {
    const { deferredHydration } = await hydratePopupBaseData({
      loadBaseData: () => loadPopupBaseRefreshData(refreshRunId),
      applyBaseData: (baseData) => {
        if (refreshRunId !== popupRefreshRunId) {
          return
        }
        applyPopupBaseRefreshData(baseData, { initial, preserveSearch })
        perfMark('popup.refreshData.baseReady.end')
        perfMeasure('popup.refreshData.baseReady', 'popup.refreshData.start', 'popup.refreshData.baseReady.end')
      },
      startDeferredHydration: (baseData) => hydratePopupDeferredRefreshData(baseData)
    })
    void deferredHydration.catch((error) => {
      console.warn('[Curator] popup 延后数据补齐失败', error)
    })
  } catch (error) {
    if (refreshRunId !== popupRefreshRunId) {
      return
    }
    state.searchRunId += 1
    state.searchPending = false
    state.naturalSearchPending = false
    state.loadError = error instanceof Error ? error.message : '书签加载失败，请稍后重试。'
    state.searchResults = []
  } finally {
    if (refreshRunId !== popupRefreshRunId) {
      return
    }
    state.isLoading = false
    render()
  }
}
async function loadPopupBaseRefreshData(refreshRunId: number): Promise<PopupRefreshBaseData> {
  const tree = await getBookmarkTree()
  perfMark('popup.bookmarkTreeLoaded')
  const rootNode = Array.isArray(tree) ? tree[0] : tree
  const bookmarksBarNode = findBookmarksBar(rootNode)
  const catalog = buildBookmarkCatalogSnapshot({
    rootNode,
    tagIndex: null,
    snapshotState: null,
    includeFullText: false
  })
  const indexedBookmarks = buildLightPopupSearchIndexFromCatalog(catalog)
  perfMark('popup.indexBuilt')
  perfMeasure('popup.indexBuildMs', 'popup.bookmarkTreeLoaded', 'popup.indexBuilt')
  return {
    refreshRunId,
    rootNode,
    bookmarksBarNode,
    catalog,
    indexedBookmarks
  }
}
function applyPopupBaseRefreshData(
  baseData: PopupRefreshBaseData,
  { initial, preserveSearch }: { initial: boolean; preserveSearch: boolean }
): void {
  state.rawTreeRoot = baseData.rootNode
  state.bookmarksBarNode = baseData.bookmarksBarNode
  applyPopupIndexedBookmarkData({
    catalog: baseData.catalog,
    indexedBookmarks: baseData.indexedBookmarks,
  })
  syncPopupExpandedFolderState(baseData.catalog.extracted, initial)
  reconcileBookmarkReorderModeAfterRefresh()
  resetSearchForPopupRefresh(preserveSearch)
}
function applyPopupIndexedBookmarkData({
  catalog,
  indexedBookmarks,
}: {
  catalog: BookmarkCatalogSnapshot
  indexedBookmarks: ReturnType<typeof buildLightPopupSearchIndex>
}): void {
  state.allBookmarks = indexedBookmarks
  state.allFolders = catalog.extracted.folders
  state.bookmarkMap = new Map(indexedBookmarks.map((bookmark) => [bookmark.id, bookmark]))
  state.bookmarkDuplicateKeyMap = buildPopupBookmarkDuplicateKeyMap(indexedBookmarks)
  popupFolderBookmarkCounts = buildPopupFolderBookmarkCounts(indexedBookmarks)
  state.folderMap = catalog.extracted.folderMap
  popupBookmarkCatalog = catalog
  state.searchTagIndex = catalog.tagIndex
  state.searchSnapshotState = catalog.snapshotState
  state.searchCache.setVersion(catalog.version)
  resetPopupSearchEnhancementReadiness()
  clearSearchCaches()
}

function applyPopupIndexedBookmarkEnhancements(catalog: BookmarkCatalogSnapshot): void {
  patchLightPopupSearchIndexFromCatalog(state.allBookmarks, catalog)
  popupBookmarkCatalog = catalog
  state.searchTagIndex = catalog.tagIndex
  state.searchSnapshotState = catalog.snapshotState
  state.searchCache.setVersion(catalog.version)
  resetPopupSearchEnhancementReadiness()
  clearSearchCaches()
}

function resetPopupSearchEnhancementReadiness(): void {
  state.searchSnapshotFullTextReady = false
  state.searchSnapshotFullTextPending = false
  state.searchSnapshotFullTextRunId += 1
  state.pinyinEnrichmentReady = false
  state.pinyinEnrichmentPending = false
  state.pinyinEnrichmentRunId += 1
}
function syncPopupExpandedFolderState(
  extracted: ReturnType<typeof extractBookmarkData>,
  initial: boolean
): void {
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
}
function resetSearchForPopupRefresh(preserveSearch: boolean): void {
  if (preserveSearch) {
    state.debouncedQuery = state.searchQuery.trim()
    runSearch()
    return
  }
  state.searchRunId += 1
  state.searchQuery = ''
  state.debouncedQuery = ''
  state.searchResults = []
  state.activeResultIndex = -1
  state.searchPending = false
  state.naturalSearchPending = false
  state.naturalSearchError = ''
  state.naturalSearchPlan = null
  abortNaturalSearchRequest()
  state.searchHighlightQuery = ''
}
function hydratePopupDeferredRefreshData(baseData: PopupRefreshBaseData): Promise<unknown> {
  const indexHydration = hydratePopupDeferredEnhancements({
    baseData,
    loadDeferredData: loadPopupSearchEnhancementData,
    applyDeferredData: applyPopupSearchEnhancementData
  })
  const currentTabHydration = hydrateCurrentTabState(baseData.refreshRunId)
  currentTabHydrationPromise = currentTabHydration
  void currentTabHydration.then(() => {
    if (baseData.refreshRunId !== popupRefreshRunId) {
      return
    }
    render()
  }).finally(() => {
    if (currentTabHydrationPromise === currentTabHydration) {
      currentTabHydrationPromise = null
    }
  })
  void hydrateNewTabPinnedState(baseData.refreshRunId).then(() => {
    if (baseData.refreshRunId !== popupRefreshRunId) {
      return
    }
    render()
  })
  return indexHydration
}
async function loadPopupSearchEnhancementData(): Promise<PopupRefreshDeferredData> {
  const [tagIndex, snapshotState] = await Promise.all([
    loadBookmarkTagIndex().catch(() => null),
    loadPopupSearchIndexSnapshotState()
  ])
  return { tagIndex, snapshotState }
}
function applyPopupSearchEnhancementData(
  baseData: PopupRefreshBaseData,
  deferredData: PopupRefreshDeferredData
): void {
  if (baseData.refreshRunId !== popupRefreshRunId) {
    return
  }
  const catalog = buildBookmarkCatalogSnapshot({
    rootNode: baseData.rootNode,
    tagIndex: deferredData.tagIndex,
    snapshotState: deferredData.snapshotState,
    includeFullText: false,
    extracted: baseData.catalog.extracted
  })
  applyPopupIndexedBookmarkEnhancements(catalog)
  perfMark('popup.searchIndexReady.end')
  perfMeasure('popup.searchIndexReady', 'popup.bookmarkTreeLoaded', 'popup.searchIndexReady.end')
  if (state.currentTab) {
    applyCurrentTabBookmarkMatch()
  }
  if (state.debouncedQuery) {
    runSearch()
  }
  render()
}
function schedulePinyinEnrichment(runId: number): void {
  if (state.pinyinEnrichmentReady || state.pinyinEnrichmentPending) {
    return
  }
  if (runId !== state.pinyinEnrichmentRunId) {
    return
  }
  if (!state.allBookmarks.length) {
    return
  }
  state.pinyinEnrichmentPending = true
  perfMark('popup.pinyinEnrichmentStart')
  const targets = state.allBookmarks
  const startEnrichment = () => {
    if (runId !== state.pinyinEnrichmentRunId) {
      return
    }
    enrichLightPopupSearchIndexWithPinyin(targets, {
      batchSize: POPUP_PINYIN_BATCH_SIZE,
      isActive: () => runId === state.pinyinEnrichmentRunId,
      yieldWork: yieldPopupPinyinWork
    })
      .then((result) => {
        if (runId !== state.pinyinEnrichmentRunId) {
          return
        }
        state.pinyinEnrichmentPending = false
        if (result.aborted) {
          return
        }
        state.pinyinEnrichmentReady = true
        perfMark('popup.pinyinEnrichmentReady')
        perfMeasure(
          'popup.pinyinEnrichmentMs',
          'popup.pinyinEnrichmentStart',
          'popup.pinyinEnrichmentReady'
        )
        clearSearchCaches()
        if (state.debouncedQuery || state.searchQuery) {
          runSearch()
        }
        render()
      })
      .catch((error) => {
        if (runId !== state.pinyinEnrichmentRunId) {
          return
        }
        state.pinyinEnrichmentPending = false
        console.warn('[Curator] 拼音索引补齐失败', error)
      })
  }
  runIdle(startEnrichment, { timeout: POPUP_PINYIN_IDLE_TIMEOUT_MS })
}

function yieldPopupPinyinWork(): Promise<void> {
  return new Promise((resolve) => {
    runIdle(resolve, { timeout: 120 })
  })
}
function ensurePinyinEnrichmentForQuery(query: string): void {
  if (state.pinyinEnrichmentReady || state.pinyinEnrichmentPending) {
    return
  }
  if (!state.allBookmarks.length) {
    return
  }
  if (!requiresPinyinTokens(query)) {
    return
  }
  schedulePinyinEnrichment(state.pinyinEnrichmentRunId)
}
async function hydrateCurrentTabState(refreshRunId = popupRefreshRunId) {
  if (refreshRunId !== popupRefreshRunId) {
    return
  }
  const currentTab = await getActiveTab().catch(() => null)
  state.currentTab = currentTab
  applyCurrentTabBookmarkMatch()
}
async function ensureCurrentTabStateHydrated(): Promise<void> {
  if (currentTabHydrationPromise) {
    await currentTabHydrationPromise
    return
  }
  await hydrateCurrentTabState()
}
function applyCurrentTabBookmarkMatch() {
  const currentUrl = String(state.currentTab?.url || '').trim()
  const normalizedCurrentUrl = normalizeBookmarkSaveUrl(currentUrl)
  const matchedBookmark = normalizedCurrentUrl
    ? state.bookmarkDuplicateKeyMap.get(normalizedCurrentUrl)
    : null
  state.currentPageBookmarkId = matchedBookmark?.id || null
  if (!isSmartClassifiableUrl(currentUrl)) {
    state.smartStatus = 'unavailable'
    state.smartRecommendations = []
    state.smartSelectedRecommendationId = ''
    return
  }
  if (!['loading', 'results', 'permission', 'saving'].includes(state.smartStatus)) {
    state.smartStatus = 'idle'
  }
}
async function hydrateNewTabPinnedState(refreshRunId = popupRefreshRunId) {
  try {
    if (refreshRunId !== popupRefreshRunId) {
      return
    }
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    const settings = normalizeNewTabWorkspaceSettings(
      stored[STORAGE_KEYS.newTabWorkspaceSettings] || POPUP_DEFAULT_WORKSPACE_STORAGE,
      { validBookmarkIds: state.bookmarkMap.keys() }
    )
    state.newTabPinnedIds = new Set(getActiveNewTabWorkspace(settings).pinnedIds)
  } catch {
    if (refreshRunId !== popupRefreshRunId) {
      return
    }
    state.newTabPinnedIds = new Set()
  }
}
function buildPopupBookmarkDuplicateKeyMap(bookmarks) {
  const map = new Map()
  for (const bookmark of bookmarks) {
    const duplicateKey = String(bookmark.duplicateKey || '').trim()
    if (duplicateKey && !map.has(duplicateKey)) {
      map.set(duplicateKey, bookmark)
    }
  }
  return map
}
function cleanupPopupController() {
  unregisterPopupActionHandlers?.()
  unregisterPopupActionHandlers = null
  unregisterPopupBrowserEventActions?.()
  unregisterPopupBrowserEventActions = null
  popupControllerStarted = false
  abortNaturalSearchRequest()
  abortSmartClassificationRequest()
  stopSmartProgressTicker()
  clearQueuedKeyboardNavigation()
  clearTimeout(state.searchTimer)
  state.searchTimer = null
  clearViewNotice()
  clearEditDiscardGuard()
  for (const timeoutId of state.toastTimers.values()) {
    clearTimeout(timeoutId)
  }
  state.toastTimers.clear()
  state.toasts = []
  state.contentRenderedViewModel = null
  state.filteredBookmarksCacheKey = ''
  state.filteredBookmarksCache = []
  resetPopupSessionStateForNextOpen()
  resetPopupViewStore()
  clearSearchCaches()
}

function resetPopupSessionStateForNextOpen() {
  state.isLoading = true
  state.loadError = ''
  state.currentTab = null
  state.currentPageBookmarkId = null
  state.smartStatus = 'idle'
  state.smartError = ''
  state.smartStep = 0
  state.smartProgressPercent = 0
  state.smartSuggestedTitle = ''
  state.smartSummary = ''
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartFolderPickerOpen = false
  state.smartFolderSearchQuery = ''
  state.smartSaving = false
  state.smartSaved = false
  state.smartPermissionRequest = null
  resetBookmarkReorderModeState()
  state.pendingActionIds.clear()
}
function maybeWarmPopupSnapshotFullTextForSearch() {
  if (
    state.searchSnapshotFullTextReady ||
    state.searchSnapshotFullTextPending ||
    !state.debouncedQuery.trim()
  ) {
    return
  }
  const snapshotState = state.searchSnapshotState
  const warmupRunId = state.searchSnapshotFullTextRunId + 1
  state.searchSnapshotFullTextRunId = warmupRunId
  if (!shouldWarmPopupSnapshotFullText(snapshotState)) {
    state.searchSnapshotFullTextPending = false
    state.searchSnapshotFullTextReady = false
    return
  }
  state.searchSnapshotFullTextPending = true
  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      void warmPopupSnapshotFullTextIndex(snapshotState, warmupRunId)
    })
  }, SEARCH_SNAPSHOT_WARM_DELAY_MS)
}
async function warmPopupSnapshotFullTextIndex(snapshotState, warmupRunId) {
  if (state.searchSnapshotFullTextRunId !== warmupRunId || !snapshotState?.index) {
    return
  }
  const catalog = buildBookmarkCatalogSnapshot({
    rootNode: state.rawTreeRoot,
    tagIndex: state.searchTagIndex,
    snapshotState,
    includeFullText: true,
    extracted: popupBookmarkCatalog?.extracted || null
  })

  if (state.searchSnapshotFullTextRunId !== warmupRunId) {
    return
  }
  await enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog(state.allBookmarks, catalog, {
    isActive: () => state.searchSnapshotFullTextRunId === warmupRunId
  })

  popupBookmarkCatalog = catalog
  state.searchCache.setVersion(catalog.version)
  state.searchSnapshotFullTextReady = true
  state.searchSnapshotFullTextPending = false
  state.pinyinEnrichmentReady = false
  state.pinyinEnrichmentPending = false
  state.pinyinEnrichmentRunId += 1
  clearSearchCaches()
  if (state.debouncedQuery) {
    runSearch()
  }
  render()
}
function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(tabs?.[0] || null)
    })
  })
}
function setSearchQuery(value, { immediate = false } = {}) {
  if (String(value || '').trim() && state.bookmarkReorderMode) {
    resetBookmarkReorderModeState()
  }
  if (String(value || '').trim() && state.keyboardPane === 'folders') {
    clearQueuedKeyboardNavigation()
    state.keyboardPane = 'bookmarks'
    state.activeFolderKeyboardIndex = -1
    state.activeResultIndex = -1
  }
  state.searchQuery = value
  state.naturalSearchSetupRequired = false
  clearViewNotice()
  clearTimeout(state.searchTimer)
  ensurePinyinEnrichmentForQuery(value)
  if (immediate) {
    applyDebouncedSearchQuery(value)
    render()
    return
  }
  const debounceMs = state.naturalSearchEnabled ? NATURAL_SEARCH_DEBOUNCE_MS : SEARCH_DEBOUNCE_MS
  state.searchTimer = window.setTimeout(() => {
    applyDebouncedSearchQuery(value)
    render()
  }, debounceMs)
  render()
}
function applyDebouncedSearchQuery(value: string): void {
  const nextQuery = value.trim()
  if (nextQuery !== state.debouncedQuery) {
    clearQueuedKeyboardNavigation()
    state.activeResultIndex = -1
  }
  state.debouncedQuery = nextQuery
  runSearch()
}
function syncActiveSearchResultIndex(): void {
  if (!state.debouncedQuery) {
    state.activeResultIndex = -1
    return
  }

  // Search results always own keyboard selection. Without this reset, a folder
  // row focused before searching can keep the workspace indicator in the sidebar.
  state.keyboardPane = 'bookmarks'
  state.activeFolderKeyboardIndex = -1

  if (!state.searchResults.length) {
    state.activeResultIndex = -1
    return
  }

  if (state.activeResultIndex < 0) {
    state.activeResultIndex = 0
    return
  }
  state.activeResultIndex = Math.min(state.activeResultIndex, state.searchResults.length - 1)
}
async function toggleNaturalLanguageSearch(returnFocusElement: HTMLElement | null = null) {
  const enabled = !state.naturalSearchEnabled
  if (enabled) {
    const naturalSearchAiConfigured = await refreshNaturalSearchAiConfiguredState()
    if (!naturalSearchAiConfigured) {
      state.naturalSearchEnabled = false
      state.naturalSearchSetupRequired = false
      state.naturalSearchPending = false
      state.naturalSearchError = ''
      state.naturalSearchPlan = null
      state.searchHighlightQuery = ''
      abortNaturalSearchRequest()
      openAiProviderPromptDialog(returnFocusElement)
      void savePopupPreferences().catch(() => {})
      return
    }
  }
  state.naturalSearchEnabled = enabled
  state.naturalSearchSetupRequired = false
  state.naturalSearchPending = false
  state.naturalSearchError = ''
  state.naturalSearchPlan = null
  abortNaturalSearchRequest()
  state.searchHighlightQuery = ''
  state.searchRunId += 1
  render()
  void savePopupPreferences().catch(() => {})
  if (enabled) {
    await prepareNaturalLanguageSearchAi()
  }
  if (state.naturalSearchEnabled !== enabled) {
    void savePopupPreferences().catch(() => {})
    return
  }
  setSearchQuery(state.searchQuery, { immediate: true })
  focusSearchInput()
}
async function prepareNaturalLanguageSearchAi() {
  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      state.naturalSearchAiConfigured = false
      state.naturalSearchEnabled = false
      state.naturalSearchError = ''
      openAiProviderPromptDialog()
      return
    }
    state.naturalSearchAiConfigured = true
    state.naturalSearchAiConfigChecked = true
    naturalSearchAi.validateNaturalSearchAiProvider(settings)
    await naturalSearchAi.ensureNaturalSearchAiPermissions(settings, { interactive: true })
  } catch {
    state.naturalSearchError = 'AI 未就绪，请检查 AI 渠道配置或授权。'
  }
}
function runSearch() {
  const query = state.debouncedQuery
  const normalizedQuery = normalizeQuery(query)
  const runId = state.searchRunId + 1
  state.searchRunId = runId
  state.searchHighlightQuery = normalizedQuery
  state.naturalSearchSetupRequired = false
  state.naturalSearchError = ''
  if (!normalizedQuery) {
    state.searchResults = []
    state.activeResultIndex = -1
    state.searchPending = false
    state.naturalSearchPending = false
    state.naturalSearchPlan = null
    state.filteredBookmarksCacheKey = ''
    state.filteredBookmarksCache = []
    abortNaturalSearchRequest()
    return
  }
  // Searches are also rerun after preboot adoption and deferred index patches,
  // so the canonical search path must re-arm any invalidated pinyin enrichment.
  ensurePinyinEnrichmentForQuery(query)
  maybeWarmPopupSnapshotFullTextForSearch()
  if (state.naturalSearchEnabled) {
    runNaturalSearch(query, normalizedQuery, runId)
    return
  }
  abortNaturalSearchRequest()
  state.naturalSearchPending = false
  state.naturalSearchPlan = null
  try {
    const cacheKey = getSearchCacheKey(normalizedQuery)
    const cachedResults = state.searchCache.get(cacheKey)
    const bookmarks = getFilteredBookmarks()
    if (cachedResults) {
      state.searchPending = false
      state.searchResults = cachedResults.slice(0, MAX_POPUP_SEARCH_RESULTS)
      syncActiveSearchResultIndex()
      return
    }
    if (bookmarks.length < POPUP_SEARCH_ASYNC_THRESHOLD) {
      const results = searchBookmarks(normalizedQuery, bookmarks)
      cacheSearchResults(cacheKey, results)
      state.searchPending = false
      state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
      syncActiveSearchResultIndex()
      return
    }
    state.searchPending = true
    state.searchResults = []
    syncActiveSearchResultIndex()
    const firstBatch = searchBookmarksFirstBatch(
      normalizedQuery,
      bookmarks,
      MAX_POPUP_SEARCH_RESULTS
    )
    if (firstBatch.results.length) {
      state.searchResults = firstBatch.results.slice(0, MAX_POPUP_SEARCH_RESULTS)
      syncActiveSearchResultIndex()
      render()
    }
    searchBookmarksCooperatively(normalizedQuery, bookmarks, {
      isActive: () => state.searchRunId === runId,
      yieldWork
    })
      .then((results) => {
        if (state.searchRunId !== runId) {
          return
        }
        cacheSearchResults(cacheKey, results)
        state.searchPending = false
        state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
        syncActiveSearchResultIndex()
        render()
      })
      .catch((error) => {
        if (state.searchRunId !== runId) {
          return
        }
        state.searchPending = false
        state.searchResults = []
        syncActiveSearchResultIndex()
        state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
        render()
      })
  } catch (error) {
    state.searchPending = false
    state.searchResults = []
    syncActiveSearchResultIndex()
    state.loadError = error instanceof Error ? error.message : '查询失败，请重试。'
  }
}
async function runNaturalSearch(query, normalizedQuery, runId) {
  abortNaturalSearchRequest()
  const controller = new AbortController()
  state.naturalSearchAbortController = controller
  const cacheKey = getSearchCacheKey(`natural:${getNaturalSearchDateBucket()}:${normalizedQuery}`)
  const planCacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const cachedResults = state.searchCache.get(cacheKey)
  if (!cachedResults) {
    state.searchPending = true
    state.naturalSearchPending = true
    state.searchResults = []
    syncActiveSearchResultIndex()
  }
  try {
    if (state.searchRunId !== runId) {
      return
    }
    const naturalSearch = await loadNaturalSearchModule()
    if (cachedResults) {
      if (state.searchRunId !== runId) {
        return
      }
      const cachedPlanResult = await resolveCachedNaturalSearchPlan(
        query,
        planCacheKey,
        naturalSearch,
        runId
      )
      if (state.searchRunId !== runId) {
        return
      }
      if (cachedPlanResult.canReuseResults) {
        state.naturalSearchPlan = cachedPlanResult.plan
        state.searchHighlightQuery = cachedPlanResult.plan.highlightQuery || normalizedQuery
        state.searchPending = false
        state.naturalSearchPending = false
        state.searchResults = cachedResults.slice(0, MAX_POPUP_SEARCH_RESULTS)
        syncActiveSearchResultIndex()
        render()
        return
      }
      state.searchCache.delete(cacheKey)
      state.searchPending = true
      state.naturalSearchPending = true
      state.searchResults = []
      syncActiveSearchResultIndex()
    }
    if (state.searchRunId !== runId) {
      return
    }
    const plan = await resolveNaturalSearchPlan(query, normalizedQuery, naturalSearch, {
      signal: controller.signal,
      runId
    })
    if (state.searchRunId !== runId) {
      return
    }
    state.naturalSearchPlan = plan
    state.searchHighlightQuery = plan.highlightQuery || normalizedQuery
    const bookmarks = naturalSearch.filterBookmarksByNaturalDateRange(getFilteredBookmarks(), plan)
    const resultSets = await Promise.all(plan.queries.map(async (naturalQuery): Promise<NaturalSearchResultSet> => {
      if (state.searchRunId !== runId) {
        throw new Error('search-cancelled')
      }
      const results = await searchNaturalQuery(naturalQuery, bookmarks, runId)
      return { query: naturalQuery, results }
    }))
    const searchRunStillCurrent = state.searchRunId === runId
    if (!searchRunStillCurrent) {
      return
    }
    const results = naturalSearch.mergeNaturalSearchResultSets(plan, resultSets)
    cacheSearchResults(cacheKey, results)
    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = results.slice(0, MAX_POPUP_SEARCH_RESULTS)
    syncActiveSearchResultIndex()
    render()
  } catch (error) {
    if (
      state.searchRunId !== runId ||
      controller.signal.aborted ||
      (error instanceof Error && error.message === 'search-cancelled')
    ) {
      return
    }
    state.searchPending = false
    state.naturalSearchPending = false
    state.searchResults = []
    syncActiveSearchResultIndex()
    if (error instanceof Error && error.message === 'ai-provider-not-configured') {
      state.naturalSearchEnabled = false
      state.naturalSearchPlan = null
      state.naturalSearchError = ''
      state.searchHighlightQuery = normalizedQuery
      runSearch()
      render()
      return
    }
    state.loadError = error instanceof Error ? error.message : 'AI 搜索失败，请重试。'
    render()
  } finally {
    if (state.naturalSearchAbortController === controller) {
      state.naturalSearchAbortController = null
    }
  }
}
async function resolveCachedNaturalSearchPlan(
  query,
  planCacheKey,
  naturalSearch: typeof import('./natural-search.js'),
  runId: number
): Promise<{ plan: NaturalSearchPlan; canReuseResults: boolean }> {
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  const cachedPlan = state.naturalSearchPlanCache.get(planCacheKey)
  if (!cachedPlan || cachedPlan.source !== 'ai') {
    return { plan: localPlan, canReuseResults: false }
  }
  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (state.searchRunId !== runId) {
      return { plan: localPlan, canReuseResults: false }
    }
    if (naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      return { plan: cachedPlan, canReuseResults: true }
    }
  } catch {
    // Fall through to local parsing when provider settings cannot be read.
  }
  if (state.searchRunId !== runId) {
    return { plan: localPlan, canReuseResults: false }
  }
  state.naturalSearchPlanCache.delete(planCacheKey)
  state.naturalSearchAiConfigured = false
  state.naturalSearchAiConfigChecked = true
  state.naturalSearchEnabled = false
  state.naturalSearchError = ''
  void savePopupPreferences().catch(() => {})
  openAiProviderPromptDialog()
  return { plan: localPlan, canReuseResults: false }
}
async function resolveNaturalSearchPlan(
  query,
  normalizedQuery,
  naturalSearch: typeof import('./natural-search.js'),
  options: { signal?: AbortSignal | null; runId: number }
): Promise<NaturalSearchPlan> {
  const cacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  let settings
  try {
    const naturalSearchAi = await loadNaturalSearchAiModule()
    settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    if (state.searchRunId !== options.runId || options.signal?.aborted) {
      return localPlan
    }
  } catch (error) {
    if (
      state.searchRunId !== options.runId ||
      options.signal?.aborted
    ) {
      throw error
    }
    const naturalSearchAi = await loadNaturalSearchAiModule()
    if (state.searchRunId !== options.runId || options.signal?.aborted) {
      throw error
    }
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    throw error
  }
  const naturalSearchAi = await loadNaturalSearchAiModule()
  if (state.searchRunId !== options.runId || options.signal?.aborted) {
    return localPlan
  }
  if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
    state.naturalSearchAiConfigured = false
    state.naturalSearchAiConfigChecked = true
    state.naturalSearchEnabled = false
    state.naturalSearchError = ''
    void savePopupPreferences().catch(() => {})
    openAiProviderPromptDialog()
    throw new Error('ai-provider-not-configured')
  }
  state.naturalSearchAiConfigured = true
  state.naturalSearchAiConfigChecked = true
  const cachedPlan = state.naturalSearchPlanCache.get(cacheKey)
  if (cachedPlan) {
    return cachedPlan
  }
  try {
    const plan = await naturalSearchAi.requestNaturalSearchAiPlan({
      query,
      localPlan,
      settings,
      signal: options.signal
    })
    if (state.searchRunId !== options.runId || options.signal?.aborted) {
      return localPlan
    }
    state.naturalSearchError = ''
    state.naturalSearchPlanCache.set(cacheKey, plan)
    return plan
  } catch (error) {
    if (
      state.searchRunId !== options.runId ||
      options.signal?.aborted
    ) {
      throw error
    }
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    throw error
  }
}
async function searchNaturalQuery(query, bookmarks, runId): Promise<PopupSearchResult[]> {
  if (!query || !bookmarks.length) {
    return []
  }
  if (bookmarks.length < POPUP_SEARCH_ASYNC_THRESHOLD) {
    return searchBookmarks(query, bookmarks)
  }
  return searchBookmarksCooperatively(query, bookmarks, {
    isActive: () => state.searchRunId === runId,
    yieldWork
  })
}
function render() {
  renderChrome()
  renderAutoAnalyzeStatus()
  renderSmartClassifier()
  renderMainContent()
  renderModals()
  renderToasts()
}
function renderChrome() {
  dispatchPopupChromeChange(getPopupChromeViewModel())
  renderSearchTools()
}

function getPopupChromeViewModel(): PopupChromeView {
  const naturalSearchPending = state.naturalSearchPending
  return {
    loadError: state.loadError,
    search: {
      ariaLabel: getSearchInputAriaLabel(),
      clearVisible: Boolean(state.searchQuery),
      fallback: isNaturalSearchLocalFallback(),
      label: getNaturalSearchToggleText(),
      notConfigured: !state.naturalSearchAiConfigured && !state.naturalSearchEnabled,
      pending: naturalSearchPending,
      placeholder: getSearchInputPlaceholder(),
      pressed: state.naturalSearchEnabled,
      query: state.searchQuery,
      title: getNaturalSearchToggleTitle(naturalSearchPending)
    },
    viewCaption: getViewCaptionText()
  }
}
function renderSearchTools() {
  const parsed = parseSearchQuery(state.searchQuery)
  const chips = parsed.chips
  dispatchPopupSearchChipsChange(
    chips.map((chip): PopupSearchChipView => ({
      kind: String(chip.kind || ''),
      label: String(chip.label || '')
    }))
  )
}
function getSearchInputPlaceholder() {
  return state.naturalSearchEnabled ? 'AI 语义搜索' : '关键词搜索'
}
function getSearchInputAriaLabel() {
  return state.naturalSearchEnabled
    ? 'AI 语义搜索书签'
    : '关键词搜索书签标题、网址、标签或高级语法'
}
function isNaturalSearchLocalFallback() {
  return Boolean(state.naturalSearchEnabled && state.naturalSearchError)
}
function getNaturalSearchToggleText() {
  if (!state.naturalSearchEnabled) {
    return '语义'
  }
  if (state.naturalSearchPending) {
    return '思考中'
  }
  return 'AI'
}
function getNaturalSearchToggleTitle(isPending: boolean) {
  if (!state.naturalSearchEnabled) {
    return state.naturalSearchAiConfigured
      ? '开启 AI 语义搜索'
      : '需要先配置 AI 渠道'
  }
  if (isPending) {
    return '正在用 AI 理解搜索意图，点击关闭'
  }
  return state.naturalSearchError || 'AI 已改写查询；点击关闭语义搜索'
}
function getViewCaptionText(): string {
  if (state.viewNoticeMessage && !state.isLoading && !state.searchPending && !state.naturalSearchPending) {
    return state.viewNoticeMessage
  }
  if (state.debouncedQuery) {
    if (state.naturalSearchEnabled) {
      return state.searchPending
        ? getNaturalSearchPendingCaption()
        : `${getNaturalSearchResultCaption()} · ${state.searchResults.length} 条`
    }
    return state.searchPending
      ? '本地搜索中…'
      : `本地匹配 · ${state.searchResults.length} 条`
  }
  const currentRoot = getCurrentTreeRoot()
  return currentRoot?.title || '书签栏'
}
function getNaturalSearchPendingCaption() {
  return 'AI 语义搜索解析中…'
}
function getNaturalSearchResultCaption() {
  const plan = state.naturalSearchPlan
  const modeLabel = 'AI 改写后匹配'
  const statusLabel = getNaturalSearchStatusLabelFallback(plan)
  const detail = statusLabel.replace(/^(AI 解析|本地解析)( · )?/, '').trim()
  return detail ? `${modeLabel} · ${detail}` : modeLabel
}
function getNaturalSearchStatusLabelFallback(plan: NaturalSearchPlan | null): string {
  if (!plan) {
    return '自然语言搜索'
  }
  const parts = [plan.source === 'ai' ? 'AI 解析' : '本地解析']
  if (plan.dateRange?.label) {
    parts.push(plan.dateRange.label)
  }
  const keywordSummary = getNaturalKeywordSummaryFallback(plan)
  if (keywordSummary) {
    parts.push(`关键词 ${keywordSummary}`)
  }
  const exclusionSummary = formatNaturalTermsFallback(plan.excludedTerms, 2)
  if (exclusionSummary) {
    parts.push(`排除 ${exclusionSummary}`)
  }
  return parts.join(' · ')
}
function getNaturalKeywordSummaryFallback(plan: NaturalSearchPlan): string {
  const excludedTerms = new Set(plan.excludedTerms)
  const terms = getQueryTerms(plan.highlightQuery)
    .filter((term) => !excludedTerms.has(term))
  return formatNaturalTermsFallback(terms, 3)
}
function formatNaturalTermsFallback(terms: string[], limit: number): string {
  const uniqueTerms = [...new Set(terms)]
  const visibleTerms = uniqueTerms
    .slice(0, Math.max(1, limit)).flatMap(term => { const mappedResult = cleanSmartText(term, 20); return mappedResult ? [mappedResult] : [] })
  if (!visibleTerms.length) {
    return ''
  }
  const suffix = uniqueTerms.length > visibleTerms.length ? ` 等 ${uniqueTerms.length} 个` : ''
  return `${visibleTerms.join(' / ')}${suffix}`
}
function showViewNotice(message, { durationMs = VIEW_NOTICE_MS } = {}) {
  const normalizedMessage = cleanViewNotice(message)
  if (!normalizedMessage) {
    return
  }
  clearViewNotice()
  state.viewNoticeMessage = normalizedMessage
  renderChrome()
  state.viewNoticeTimer = window.setTimeout(() => {
    if (state.viewNoticeMessage === normalizedMessage) {
      state.viewNoticeMessage = ''
      renderChrome()
    }
    state.viewNoticeTimer = null
  }, durationMs)
}
function clearViewNotice() {
  if (state.viewNoticeTimer) {
    window.clearTimeout(state.viewNoticeTimer)
    state.viewNoticeTimer = null
  }
  state.viewNoticeMessage = ''
}
function cleanViewNotice(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= 72) {
    return text
  }
  return `${text.slice(0, 71).trim()}…`
}
function getPopupActionKey(action, targetId = '') {
  return `${String(action || 'action')}:${String(targetId || 'global')}`
}
function isPopupActionPending(action, targetId = '') {
  return state.pendingActionIds.has(getPopupActionKey(action, targetId))
}
function setPopupActionPending(action, targetId, pending) {
  const key = getPopupActionKey(action, targetId)
  if (pending) {
    state.pendingActionIds.add(key)
  } else {
    state.pendingActionIds.delete(key)
  }
}
function hasBlockingPopupActionPending() {
  return [...state.pendingActionIds].some((key) => {
    return (
      key.startsWith('move:') ||
      key.startsWith('edit:') ||
      key.startsWith('delete:') ||
      key.startsWith('undo-delete:') ||
      key.startsWith('save-current-page:')
    )
  })
}
function renderSmartClassifier() {
  const currentUrl = String(state.currentTab?.url || '').trim()
  const status = getPopupSmartClassifierRenderStatus({
    currentUrl,
    isLoading: state.isLoading,
    smartStatus: state.smartStatus
  })

  dispatchPopupSmartClassifierChange(getPopupSmartClassifierViewModel(status))
}
function getPopupSmartClassifierViewModel(
  status: PopupSmartClassifierViewModel['status']
): PopupSmartClassifierViewModel {
  const step = normalizeSmartLoadingStep(state.smartStep)
  const targetProgress = getSmartProgressTarget(step)
  const progress = status === 'loading'
    ? getSmartDisplayProgress(state.smartProgressPercent, step)
    : targetProgress

  return {
    error: state.smartError || '',
    loadingLabel: getSmartLoadingLabel(),
    loadingProgress: progress,
    loadingStep: step,
    loadingStepCount: SMART_LOADING_STEP_COUNT,
    page: getPopupSmartPageViewModel(),
    permissionOrigins: Array.isArray(state.smartPermissionRequest?.origins)
      ? [...new Set(state.smartPermissionRequest.origins)].flatMap((combineValue, combineIndex, combineArray) => { if (!(Boolean)(combineValue)) return []; const combinedResult = (formatPermissionOrigin)(combineValue); return [combinedResult] })
      : [],
    recommendations: getPopupSmartRecommendationViewModels(),
    saved: state.smartSaved,
    saving: state.smartSaving,
    status,
    suggestedTitle: state.smartSuggestedTitle || getCurrentPageTitle()
  }
}

function getPopupSmartPageViewModel() {
  const title = getCurrentPageTitle()
  const url = String(state.currentTab?.url || '').trim()
  const favicon = String(state.currentTab?.favIconUrl || '')
  const bookmark = state.currentPageBookmarkId
    ? state.bookmarkMap.get(state.currentPageBookmarkId)
    : null

  if (!isSmartClassifiableUrl(url)) {
    return null
  }

  if (!bookmark) {
    return {
      bookmarked: false,
      fallbackIcon: getSmartFallbackIconLabel(title),
      favicon,
      pinLabel: '',
      pinPending: false,
      pinned: false,
      status: '未收藏 · 可快速保存到文件夹',
      statusTitle: '',
      title
    }
  }

  const pinned = state.newTabPinnedIds.has(String(bookmark.id))
  return {
    bookmarked: true,
    fallbackIcon: getSmartFallbackIconLabel(title),
    favicon,
    pinLabel: pinned ? '已固定到newtabs' : '固定到newtabs',
    pinPending: isPopupActionPending('pin-newtab', bookmark.id),
    pinned,
    status: `已收藏 · ${formatBookmarkPath(bookmark.path) || '未归档路径'}`,
    statusTitle: bookmark.path || '',
    title
  }
}

function getPopupSmartRecommendationViewModels() {
  const selectedId = state.smartSelectedRecommendationId
  return (state.smartRecommendations || []).map((recommendation) => {
    const path = recommendation.path || recommendation.title || ''
    const formattedPath = formatBookmarkPath(path) || path
    return {
      confidence: Math.round(Math.max(0, Math.min(Number(recommendation.confidence) || 0, 1)) * 100),
      id: String(recommendation.id || ''),
      isNew: recommendation.kind === 'new',
      path: formattedPath || '未归档路径',
      selected: recommendation.id === selectedId,
      title: recommendation.title || path || '未命名文件夹'
    }
  })
}
function renderMainContent({ preserveScroll }: { preserveScroll?: boolean } = {}) {
  const hasQuery = Boolean(state.debouncedQuery)
  const showNaturalSearchSetup =
    state.naturalSearchSetupRequired &&
    !state.isLoading &&
    !state.searchPending &&
    !state.naturalSearchPending
  const showSearchLoading =
    hasQuery &&
    state.searchPending &&
    !state.searchResults.length &&
    !state.isLoading
  const showEmptySearch =
    hasQuery &&
    !state.searchPending &&
    !state.searchResults.length &&
    !state.isLoading
  const currentRoot = getCurrentTreeRoot()
  const showEmptyTree =
    !hasQuery &&
    !state.isLoading &&
    (!currentRoot || !(currentRoot.children || []).length)
  const emptyState = getPopupEmptyStateViewModel({
    showEmptySearch,
    showEmptyTree,
    showNaturalSearchSetup
  })
  let mainState: PopupContentViewModel['mainState'] | undefined

  if (!state.isLoading && showSearchLoading) {
    mainState = {
      kind: 'loading',
      label: state.naturalSearchEnabled ? '正在用 AI 理解搜索意图…' : '正在搜索书签…'
    }
  } else if (showNaturalSearchSetup) {
    mainState = {
      kind: 'natural-setup',
      state: emptyState
    }
  } else if (showEmptySearch) {
    mainState = {
      kind: 'search-empty',
      state: emptyState
    }
  } else if (showEmptyTree) {
    mainState = {
      kind: 'empty',
      label: state.selectedFolderFilterId
        ? '当前文件夹下暂无书签'
        : '未找到可展示的书签栏内容'
    }
  }

  const shouldPreserveScroll = preserveScroll ?? (!hasQuery || Boolean(state.isLoading))
  replaceContentViewModel(getPopupContentViewModel({ loading: state.isLoading, mainState, searchMode: hasQuery }), {
    preserveScroll: shouldPreserveScroll
  })
}

function getPopupEmptyStateViewModel({
  showEmptySearch,
  showEmptyTree,
  showNaturalSearchSetup
}: {
  showEmptySearch: boolean
  showEmptyTree: boolean
  showNaturalSearchSetup: boolean
}): PopupEmptyStateViewModel {
  if (showNaturalSearchSetup) {
    return { kind: 'natural-setup' }
  }

  if (showEmptyTree) {
    return {
      kind: 'message',
      message: state.selectedFolderFilterId
        ? '当前筛选文件夹下暂无可展示内容'
        : '未找到可展示的书签栏内容'
    }
  }

  if (!showEmptySearch) {
    return { kind: 'none' }
  }

  const naturalSearchActive = state.naturalSearchEnabled
  const hasFolderFilter = Boolean(state.selectedFolderFilterId)
  const title = naturalSearchActive
    ? (hasFolderFilter ? '当前文件夹未匹配 AI 语义条件' : '未找到符合 AI 语义条件的书签')
    : (hasFolderFilter ? '当前文件夹未找到相关书签' : '未找到相关书签')
  const hint = naturalSearchActive
    ? '可以清除筛选、查看全部，或关闭 AI 语义搜索改用普通搜索。'
    : '可以清除筛选、查看全部，或试试 site:github.com、folder:"前端 资料"、最近 2 周、-视频 等高级语法。'
  const actions = [
    {
      action: 'clear-query',
      label: '清空搜索',
      primary: true
    },
    hasFolderFilter
      ? {
          action: 'clear-filter',
          label: '清除筛选'
        }
      : null,
    {
      action: 'show-all',
      label: '查看全部'
    },
    {
      action: 'toggle-natural',
      label: naturalSearchActive ? '关闭 AI 语义' : 'AI 语义搜索'
    }
  ].filter(Boolean)

  return {
    actions,
    hint,
    kind: 'search',
    title
  }
}
/**
 * 视图模型的结构等值比较。
 *
 * 这里原本是 `JSON.stringify(nextViewModel)` 再比字符串：为了判断「要不要重
 * 渲染」，先把整棵视图模型序列化一遍，代价比它想省下的渲染还大，而且每次
 * 都要分配一个大字符串。改成短路比较后语义不变（视图模型是可 JSON 序列化
 * 的纯数据），但遇到第一处差异就返回，且不产生中间字符串。
 */
function isSameContentViewModel(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }
  if (typeof left !== typeof right || left === null || right === null) {
    return false
  }
  if (typeof left !== 'object') {
    return false
  }

  const leftIsArray = Array.isArray(left)
  if (leftIsArray !== Array.isArray(right)) {
    return false
  }

  if (leftIsArray) {
    const leftArray = left as unknown[]
    const rightArray = right as unknown[]
    if (leftArray.length !== rightArray.length) {
      return false
    }
    for (let index = 0; index < leftArray.length; index += 1) {
      if (!isSameContentViewModel(leftArray[index], rightArray[index])) {
        return false
      }
    }
    return true
  }

  const leftKeys = Object.keys(left as object)
  const rightKeys = Object.keys(right as object)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false
    }
    if (!isSameContentViewModel(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key]
    )) {
      return false
    }
  }
  return true
}

function replaceContentViewModel(nextViewModel: PopupContentViewModel, { preserveScroll = false } = {}) {
  if (!nextViewModel.loading && ((nextViewModel.rows?.length ?? 0) || (nextViewModel.mainRows?.length ?? 0) || (nextViewModel.sidebarRows?.length ?? 0))) {
    state.hasPresentedContent = true
  }
  if (
    state.contentRenderedViewModel &&
    isSameContentViewModel(state.contentRenderedViewModel, nextViewModel)
  ) {
    return
  }

  state.contentRenderedViewModel = nextViewModel
  dispatchPopupContentChange(nextViewModel, { preserveScroll })
}

function getPopupContentViewModel({
  loading = false,
  mainState,
  searchMode
}: {
  loading?: boolean
  mainState?: PopupContentViewModel['mainState']
  searchMode: boolean
}): PopupContentViewModel {
  const currentRoot = getCurrentTreeRoot()
  const sidebarRoot = getFolderPaneTreeRoot(currentRoot, state.bookmarksBarNode)
  const sidebarRows = sidebarRoot ? getSidebarFolderRows(sidebarRoot) : []
  const currentRootTitle = currentRoot?.title || '书签栏'
  const reorder = getPopupBookmarkReorderViewModel(currentRoot)

  if (searchMode) {
    const mainRows = getSearchResultRows()
    return {
      emptyLabel: '未找到相关书签',
      keyboardPane: state.keyboardPane,
      loading,
      mainState,
      mainRows,
      meta: `${mainRows.length} 条`,
      mode: 'search',
      rows: mainRows,
      sidebarRows,
      title: state.naturalSearchEnabled ? 'AI 匹配结果' : '搜索结果'
    }
  }

  const mainRows = reorder.active ? getBookmarkReorderRows(currentRoot) : getTreeBookmarkRows()
  return {
    emptyLabel: '当前文件夹下暂无书签',
    keyboardPane: state.keyboardPane,
    loading,
    mainState,
    mainRows,
    meta: reorder.active
      ? `${reorder.folderTitle} · ${mainRows.length} 个直属书签`
      : `${mainRows.length} 个书签`,
    mode: 'tree',
    reorder,
    rows: [...sidebarRows, ...mainRows],
    sidebarRows,
    title: reorder.active ? '调整顺序' : currentRootTitle
  }
}

function getPopupBookmarkReorderViewModel(
  currentRoot: chrome.bookmarks.BookmarkTreeNode | null | undefined
): NonNullable<PopupContentViewModel['reorder']> {
  const directBookmarks = getDirectBookmarkRecords(currentRoot)
  const folderId = String(currentRoot?.id || '')
  const folderTitle = currentRoot?.title || '书签栏'
  const active = Boolean(
    state.bookmarkReorderMode &&
    folderId &&
    state.bookmarkReorderFolderId === folderId
  )

  return {
    active,
    announcement: active ? state.bookmarkReorderAnnouncement : '',
    busy: active && state.bookmarkReorderBusy,
    canEnter: directBookmarks.length > 1,
    directCount: directBookmarks.length,
    folderId,
    folderTitle
  }
}

function getSidebarFolderRows(
  currentRoot = getFolderPaneTreeRoot(getCurrentTreeRoot(), state.bookmarksBarNode)
): PopupContentFolderRowViewModel[] {
  if (!currentRoot) {
    return []
  }

  const rows = buildSidebarFolderRows(currentRoot, 0)
    .map((row, index) => ({ ...row, index }))
  const ki = state.activeFolderKeyboardIndex
  if (state.keyboardPane === 'folders' && ki >= 0 && ki < rows.length) {
    rows[ki] = { ...rows[ki], keyboardActive: true }
  }
  return rows
}

function buildSidebarFolderRows(node, depth): PopupContentFolderRowViewModel[] {
  const isPinnedRoot = depth === 0
  const isExpanded = true
  const children = Array.isArray(node.children) ? node.children : []
  const folderInfo = state.folderMap.get(node.id)
  const toggleLabel = getPopupFolderToggleLabel(
    isExpanded ? '折叠文件夹' : '展开文件夹',
    folderInfo ? formatFolderPath(folderInfo, state.folderMap) || folderInfo.title : node.title
  )

  const currentRow: PopupContentRowViewModel = {
    active: (!state.selectedFolderFilterId && isPinnedRoot) || state.selectedFolderFilterId === String(node.id || ''),
    keyboardActive: false,
    countLabel: getSidebarFolderCountLabel(node, folderInfo, isPinnedRoot),
    depth,
    expanded: isExpanded,
    folderId: String(node.id || ''),
    index: -1,
    kind: 'folder',
    root: isPinnedRoot,
    subtitle: describeFolder(folderInfo),
    title: node.title || '未命名文件夹',
    toggleLabel
  }

  const childRows = isExpanded
    ? children.flatMap((child) => {
        if (child.url) {
          return []
        }

        return buildSidebarFolderRows(child, depth + 1)
      })
    : []

  return [currentRow, ...childRows]
}

function getSidebarFolderCountLabel(node, folderInfo, isPinnedRoot): string {
  const folderId = String(node?.id || '')
  const count = isPinnedRoot
    ? state.allBookmarks.length
    : (popupFolderBookmarkCounts.get(folderId) || 0)
  return String(count)
}

function buildPopupFolderBookmarkCounts(
  bookmarks: PopupSearchBookmark[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const bookmark of bookmarks) {
    for (const folderId of bookmark.ancestorIds) {
      counts.set(folderId, (counts.get(folderId) || 0) + 1)
    }
  }
  return counts
}

function getDirectBookmarkRecords(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
): PopupSearchBookmark[] {
  const bookmarks: PopupSearchBookmark[] = []
  for (const child of folderNode?.children || []) {
    if (!child.url) continue
    const bookmark = state.bookmarkMap.get(String(child.id || ''))
    if (bookmark) bookmarks.push(bookmark)
  }
  return bookmarks
}

function getBookmarkReorderRows(
  currentRoot = getCurrentTreeRoot()
): PopupContentBookmarkRowViewModel[] {
  const directBookmarks = getDirectBookmarkRecords(currentRoot)
  const directBookmarkById = new Map(directBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  const orderedIds: string[] = []
  const orderedIdSet = new Set<string>()
  for (const bookmarkId of state.bookmarkReorderOrderIds) {
    if (!directBookmarkById.has(bookmarkId)) continue
    orderedIds.push(bookmarkId)
    orderedIdSet.add(bookmarkId)
  }
  for (const bookmark of directBookmarks) {
    const bookmarkId = String(bookmark.id)
    if (orderedIdSet.has(bookmarkId)) continue
    orderedIds.push(bookmarkId)
    orderedIdSet.add(bookmarkId)
  }
  state.bookmarkReorderOrderIds = orderedIds

  const rows: PopupContentBookmarkRowViewModel[] = []
  for (let index = 0; index < orderedIds.length; index += 1) {
    const bookmark = directBookmarkById.get(orderedIds[index])
    if (bookmark) rows.push(buildBookmarkRowViewModel(bookmark, 1, false, index))
  }
  return rows
}

function getTreeBookmarkRows(): PopupContentBookmarkRowViewModel[] {
  const rootId = String(getCurrentTreeRoot()?.id || '')
  const bookmarks = getFilteredBookmarks()
  if (!rootId || !bookmarks.length) {
    return []
  }
  const baseDepth = state.folderMap.get(rootId)?.depth || 1
  return bookmarks.map((bookmark, index) => {
    const depth = Math.max(1, Number(bookmark.ancestorIds?.length || baseDepth) - baseDepth + 1)
    return buildBookmarkRowViewModel(
      bookmark,
      depth,
      isBookmarkRowKeyboardActive(state.keyboardPane, index, state.activeResultIndex),
      index
    )
  })
}

function buildBookmarkRowViewModel(bookmark, depth, active = false, index = -1): PopupContentBookmarkRowViewModel {
  return {
    active,
    bookmarkId: String(bookmark.id || ''),
    depth,
    displayUrl: bookmark.displayUrl || '',
    index,
    kind: 'bookmark',
    menu: buildActionMenuViewModel(bookmark.id),
    menuLabel: getBookmarkActionMenuLabel(bookmark),
    parentId: String(bookmark.parentId || ''),
    path: formatBookmarkPath(bookmark.path) || bookmark.path || '',
    title: bookmark.title || '未命名书签',
    url: bookmark.url || ''
  }
}

function getSearchResultRows(): PopupContentSearchResultViewModel[] {
  return state.searchResults
    .map((bookmark, index) => {
      const isActive = isBookmarkRowKeyboardActive(state.keyboardPane, index, state.activeResultIndex)
      const reasonTokens = summarizeMatchReasonTokens(bookmark.matchReasons)
      const reasonTitle = Array.isArray(bookmark.matchReasons) && bookmark.matchReasons.length
        ? bookmark.matchReasons.join(' · ')
        : ''

      return {
        active: isActive,
        bookmarkId: String(bookmark.id || ''),
        depth: 0,
        displayUrl: bookmark.displayUrl || '',
        highlightQuery: state.searchHighlightQuery || state.debouncedQuery,
        index,
        kind: 'result',
        menu: buildActionMenuViewModel(bookmark.id),
        menuLabel: getBookmarkActionMenuLabel(bookmark),
        path: bookmark.path || '未归档路径',
        reasonLabel: reasonTokens.length ? `命中原因：${reasonTokens.join('、')}` : '',
        reasonTitle,
        reasonTokens,
        title: bookmark.title || '未命名书签',
        url: bookmark.url || ''
      }
    })
}
const MATCH_REASON_TOKEN_PATTERNS: Array<{ test: RegExp; label: string }> = [
  { test: /^命中：标题/, label: '标题命中' },
  { test: /^命中：网址/, label: 'URL 命中' },
  { test: /^命中：文件夹/, label: '路径命中' },
  { test: /^命中：标签|^标签：/, label: '标签命中' },
  { test: /^命中：主题|^主题：/, label: '标签命中' },
  { test: /^命中：别名/, label: '别名命中' },
  { test: /^命中：摘要/, label: '摘要命中' },
  { test: /^命中：类型/, label: '类型命中' },
  { test: /^命中：拼音/, label: '拼音命中' },
  { test: /^命中：首字母/, label: '首字母命中' },
  { test: /^命中：模糊匹配|^命中：近似/, label: '模糊命中' },
  { test: /^筛选：站点/, label: '站点筛选' },
  { test: /^筛选：文件夹/, label: '文件夹筛选' },
  { test: /^筛选：类型/, label: '类型筛选' },
  { test: /^筛选：/, label: '时间筛选' },
  { test: /^排除：/, label: '已排除' }
]

function findMatchReasonTokenPattern(text: string): { test: RegExp; label: string } | null {
  for (const entry of MATCH_REASON_TOKEN_PATTERNS) {
    if (entry.test.test(text)) {
      return entry
    }
  }
  return null
}

function summarizeMatchReasonTokens(reasons: unknown): string[] {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return []
  }
  const tokens: string[] = []
  const seen = new Set<string>()
  for (const value of reasons) {
    const text = String(value || '').trim()
    if (!text) continue
    const matched = findMatchReasonTokenPattern(text)
    if (!matched) continue
    if (seen.has(matched.label)) continue
    seen.add(matched.label)
    tokens.push(matched.label)
    if (tokens.length >= 3) break
  }
  return tokens
}
function getBookmarkActionMenuLabel(bookmark) {
  const title = cleanSmartText(bookmark?.title || '未命名书签', 48)
  return `打开 ${title} 的操作菜单`
}
function getBookmarkActionLabel(action, bookmarkId) {
  const bookmark = state.bookmarkMap.get(String(bookmarkId || ''))
  const title = cleanSmartText(bookmark?.title || bookmark?.displayUrl || bookmarkId || '未命名书签', 48)
  return `${action}：${title || '未命名书签'}`
}
function getPopupFolderToggleLabel(action, folderPath) {
  const target = cleanSmartText(folderPath || '未命名文件夹', 72)
  return `${action}：${target || '未命名文件夹'}`
}
function buildActionMenuViewModel(bookmarkId): PopupActionMenuViewModel {
  const menuBusy = hasBlockingPopupActionPending()
  const copyBusy = isPopupActionPending('copy-url', bookmarkId)
  const openBusy = isPopupActionPending('open-current-tab', bookmarkId)
  const moveBusy = isPopupActionPending('move', bookmarkId)
  const editBusy = isPopupActionPending('edit', bookmarkId)
  const deleteBusy = isPopupActionPending('delete', bookmarkId)
  const editLabel = getBookmarkActionLabel('编辑书签', bookmarkId)
  const copyLabel = getBookmarkActionLabel('复制书签链接', bookmarkId)
  const openLabel = getBookmarkActionLabel('当前页打开书签', bookmarkId)
  const moveLabel = getBookmarkActionLabel('移动书签', bookmarkId)
  const deleteLabel = getBookmarkActionLabel('删除书签', bookmarkId)

  return {
    items: [
      {
        action: 'edit',
        ariaLabel: editLabel,
        bookmarkId: String(bookmarkId || ''),
        danger: false,
        disabled: menuBusy || editBusy,
        label: '编辑'
      },
      {
        action: 'copy-url',
        ariaLabel: copyLabel,
        bookmarkId: String(bookmarkId || ''),
        danger: false,
        disabled: copyBusy,
        label: '复制链接'
      },
      {
        action: 'open-current-tab',
        ariaLabel: openLabel,
        bookmarkId: String(bookmarkId || ''),
        danger: false,
        disabled: menuBusy || openBusy,
        label: '当前页打开'
      },
      {
        action: 'move',
        ariaLabel: moveLabel,
        bookmarkId: String(bookmarkId || ''),
        danger: false,
        disabled: menuBusy || moveBusy,
        label: '移动至'
      },
      {
        action: 'delete',
        ariaLabel: deleteLabel,
        bookmarkId: String(bookmarkId || ''),
        danger: true,
        disabled: menuBusy || deleteBusy,
        label: '删除'
      }
    ]
  }
}
function renderModals() {
  const viewModel = getPopupModalsViewModel()
  dispatchPopupModalsChange(viewModel)
}

function getPopupModalsViewModel(): PopupModalsView {
  return {
    active: getActivePopupModal(),
    aiProvider: getAiProviderPromptModalView(),
    delete: getDeleteModalView(),
    edit: getEditModalView(),
    move: getMoveModalView(),
    open: hasOpenModal(),
    smartFolder: getSmartFolderModalView()
  }
}

function getActivePopupModal(): PopupModalsView['active'] {
  if (state.moveTargetBookmarkId) {
    return 'move'
  }
  if (state.smartFolderPickerOpen) {
    return 'smart-folder'
  }
  if (state.aiProviderPromptOpen) {
    return 'ai-provider'
  }
  if (state.editTargetBookmarkId) {
    return 'edit'
  }
  if (state.confirmDeleteBookmarkId) {
    return 'delete'
  }
  return null
}

function getMoveModalView(): PopupModalsView['move'] {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null
  if (bookmark) {
    dispatchPopupFolderPickerChange('move', getMoveFolderPickerState(bookmark))
  }
  return {
    open: Boolean(bookmark),
    path: bookmark ? formatBookmarkPath(bookmark.path) || '未归档路径' : '',
    query: state.moveSearchQuery,
    title: bookmark?.title || ''
  }
}

function getSmartFolderModalView(): PopupModalsView['smartFolder'] {
  if (state.smartFolderPickerOpen) {
    dispatchPopupFolderPickerChange('smart', getSmartFolderPickerState())
  }
  return {
    open: state.smartFolderPickerOpen,
    query: state.smartFolderSearchQuery,
    title: state.smartSuggestedTitle || getCurrentPageTitle(),
    urlLabel: getSmartFolderTargetPathLabel()
  }
}

function getAiProviderPromptModalView(): PopupModalsView['aiProvider'] {
  return {
    open: state.aiProviderPromptOpen
  }
}

function getEditModalView(): PopupModalsView['edit'] {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  const open = Boolean(bookmark)
  if (!bookmark) {
    return {
      cancelDisabled: false,
      closeDisabled: false,
      dirty: false,
      folderPickerOpen: false,
      folderQuery: '',
      folderSearchDisabled: false,
      open,
      path: '',
      pathChanged: false,
      saveDisabled: true,
      saveLabel: '未修改',
      title: '',
      titleDisabled: false,
      url: '',
      urlDisabled: false
    }
  }
  if (state.editDraftBookmarkId !== bookmark.id) {
    resetEditDraft(bookmark)
  }
  const draftFolder = state.editDraftParentId ? state.folderMap.get(state.editDraftParentId) : null
  const draftPath = draftFolder
    ? formatFolderPath(draftFolder, state.folderMap) || draftFolder.title
    : bookmark.path || '未归档路径'
  if (open) {
    dispatchPopupFolderPickerChange(
      'edit',
      state.editFolderPickerOpen
        ? getEditFolderPickerState(bookmark)
        : {
            empty: null,
            mode: 'edit',
            query: '',
            treeOptions: []
          }
    )
  }
  const bookmarkId = state.editTargetBookmarkId || state.editDraftBookmarkId
  const saving = state.editSaving || isPopupActionPending('edit', bookmarkId || '')
  const dirty = Boolean(state.editDraftDirty)
  return {
    cancelDisabled: saving,
    closeDisabled: saving,
    dirty,
    folderPickerOpen: state.editFolderPickerOpen,
    folderQuery: state.editFolderSearchQuery,
    folderSearchDisabled: saving,
    open,
    path: draftPath || '未归档路径',
    pathChanged: state.editDraftParentId !== String(bookmark.parentId || ''),
    saveDisabled: saving || !dirty,
    saveLabel: saving ? '保存中…' : dirty ? '保存' : '未修改',
    title: state.editDraftTitle,
    titleDisabled: saving,
    url: state.editDraftUrl,
    urlDisabled: saving
  }
}

function getDeleteModalView(): PopupModalsView['delete'] {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null
  const deleting = bookmark ? isPopupActionPending('delete', bookmark.id) : false
  return {
    cancelDisabled: deleting,
    confirmDisabled: deleting,
    confirmLabel: deleting ? '删除中…' : '删除',
    open: Boolean(bookmark),
    path: bookmark?.path || '未归档路径',
    title: bookmark?.title || ''
  }
}
function resetEditDraft(bookmark) {
  clearEditDiscardGuard()
  state.editDraftBookmarkId = String(bookmark?.id || '')
  state.editDraftTitle = String(bookmark?.title || '')
  state.editDraftUrl = String(bookmark?.url || '')
  state.editDraftParentId = String(bookmark?.parentId || '')
  state.editFolderPickerOpen = false
  state.editFolderSearchQuery = ''
  state.editDraftDirty = false
  state.editSaving = false
}
function clearEditDraft() {
  clearEditDiscardGuard()
  state.editDraftBookmarkId = ''
  state.editDraftTitle = ''
  state.editDraftUrl = ''
  state.editDraftParentId = ''
  state.editFolderPickerOpen = false
  state.editFolderSearchQuery = ''
  state.editDraftDirty = false
  state.editSaving = false
}
function updateEditDraftField(field: 'title' | 'url', value: string) {
  if (!state.editTargetBookmarkId || state.editSaving) {
    return
  }
  state.editDraftBookmarkId = String(state.editTargetBookmarkId)
  if (field === 'title') {
    state.editDraftTitle = value
  } else {
    state.editDraftUrl = value
  }
  state.editDraftDirty = isCurrentEditDraftDirty()
  clearEditDiscardGuard()
  renderModals()
}
function clearEditDiscardGuard() {
  if (state.editDiscardTimer) {
    window.clearTimeout(state.editDiscardTimer)
    state.editDiscardTimer = null
  }
  state.editDiscardArmed = false
}
function shouldBlockDirtyEditClose() {
  if (!state.editTargetBookmarkId || !state.editDraftDirty) {
    return false
  }
  if (state.editDiscardArmed) {
    clearEditDiscardGuard()
    return false
  }
  state.editDiscardArmed = true
  showToast({
    type: 'info',
    message: '编辑尚未保存，再次取消将放弃修改。'
  })
  state.editDiscardTimer = window.setTimeout(() => {
    state.editDiscardArmed = false
    state.editDiscardTimer = null
  }, 1800)
  return true
}
function isCurrentEditDraftDirty() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  if (!bookmark) {
    return false
  }
  return (
    getPopupEditBookmarkDraftState({
      bookmark,
      draftTitle: state.editDraftTitle,
      draftUrl: state.editDraftUrl,
      draftParentId: state.editDraftParentId
    }).dirty
  )
}
function getMoveFolderPickerState(bookmark): PopupFolderPickerState {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.moveSearchQuery)
  const treeOptions = roots.flatMap((node) => buildMoveFolderNodeViewModels(node, 0, query, bookmark))

  return {
    empty: treeOptions.length ? null : { message: '未找到相关文件夹' },
    mode: 'move',
    query: state.moveSearchQuery,
    treeOptions
  }
}

function getEditFolderPickerState(bookmark): PopupFolderPickerState {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.editFolderSearchQuery)
  const treeOptions = roots.flatMap((node) => buildEditFolderNodeViewModels(node, 0, query, bookmark))

  return {
    empty: treeOptions.length ? null : { message: '未找到相关文件夹' },
    mode: 'edit',
    query: state.editFolderSearchQuery,
    treeOptions
  }
}

function getSmartFolderPickerState(): PopupFolderPickerState {
  const roots = (state.rawTreeRoot?.children || []).filter((node) => !node.url)
  const query = normalizeText(state.smartFolderSearchQuery)
  const treeOptions = roots.flatMap((node) => buildSmartFolderNodeViewModels(node, 0, query))

  return {
    empty: treeOptions.length ? null : { message: '未找到相关文件夹' },
    mode: 'smart',
    query: state.smartFolderSearchQuery,
    treeOptions
  }
}

function buildSmartFolderNodeViewModels(node, depth, query): PopupFolderTreeOptionViewModel[] {
  if (node.id === ROOT_ID) {
    return []
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return []
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childOptions = childFolders.flatMap((child) => buildSmartFolderNodeViewModels(child, depth + 1, query))
  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childOptions.length) {
    return []
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const saving = state.smartSaving || isPopupActionPending('save-current-page', node.id)
  const folderPath = formatFolderPath(folder, state.folderMap) || folder.title || '未命名文件夹'
  const toggleLabel = getPopupFolderToggleLabel(isExpanded ? '折叠文件夹' : '展开文件夹', folderPath)

  return [
    {
      badges: [],
      depth,
      disabled: saving,
      expanded: isExpanded,
      hasChildren: Boolean(childFolders.length),
      id: String(node.id || ''),
      mode: 'smart',
      path: folderPath,
      rowCurrent: false,
      selected: false,
      title: folder.title || '未命名文件夹',
      toggleLabel
    },
    ...(isExpanded ? childOptions : [])
  ]
}

function buildMoveFolderNodeViewModels(node, depth, query, bookmark): PopupFolderTreeOptionViewModel[] {
  if (node.id === ROOT_ID) {
    return []
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return []
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childOptions = childFolders.flatMap((child) => buildMoveFolderNodeViewModels(child, depth + 1, query, bookmark))

  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childOptions.length) {
    return []
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const isCurrentFolder = bookmark.parentId === node.id
  const moving = isPopupActionPending('move', bookmark.id)
  const folderPath = formatFolderPath(folder, state.folderMap) || folder.title || '未命名文件夹'
  const toggleLabel = getPopupFolderToggleLabel(isExpanded ? '折叠文件夹' : '展开文件夹', folderPath)

  return [
    {
      badges: isCurrentFolder ? [{ label: '当前位置' }] : [],
      depth,
      disabled: moving,
      expanded: isExpanded,
      hasChildren: Boolean(childFolders.length),
      id: String(node.id || ''),
      mode: 'move',
      path: folderPath,
      rowCurrent: isCurrentFolder,
      selected: isCurrentFolder,
      title: folder.title || '未命名文件夹',
      toggleLabel
    },
    ...(isExpanded ? childOptions : [])
  ]
}

function buildEditFolderNodeViewModels(node, depth, query, bookmark): PopupFolderTreeOptionViewModel[] {
  if (node.id === ROOT_ID) {
    return []
  }

  const folder = state.folderMap.get(node.id)
  if (!folder) {
    return []
  }

  const childFolders = (node.children || []).filter((child) => !child.url)
  const isFilterMode = Boolean(query)
  const childOptions = childFolders.flatMap((child) => buildEditFolderNodeViewModels(child, depth + 1, query, bookmark))

  const matchesCurrent =
    !query ||
    folder.normalizedTitle.includes(query) ||
    folder.normalizedPath.includes(query)

  if (isFilterMode && !matchesCurrent && !childOptions.length) {
    return []
  }

  const isExpanded = isFilterMode || state.moveExpandedFolders.has(node.id)
  const isSelectedFolder = state.editDraftParentId === node.id
  const isOriginalFolder = bookmark.parentId === node.id
  const saving = state.editSaving || isPopupActionPending('edit', bookmark.id)
  const folderPath = formatFolderPath(folder, state.folderMap) || folder.title || '未命名文件夹'
  const toggleLabel = getPopupFolderToggleLabel(isExpanded ? '折叠文件夹' : '展开文件夹', folderPath)

  return [
    {
      badges: [
        isSelectedFolder ? { label: '已选择' } : null,
        !isSelectedFolder && isOriginalFolder ? { label: '原位置', muted: true } : null
      ].filter(Boolean),
      depth,
      disabled: saving,
      expanded: isExpanded,
      hasChildren: Boolean(childFolders.length),
      id: String(node.id || ''),
      mode: 'edit',
      path: folderPath,
      rowCurrent: isSelectedFolder,
      selected: isSelectedFolder,
      title: folder.title || '未命名文件夹',
      toggleLabel
    },
    ...(isExpanded ? childOptions : [])
  ]
}
function renderToasts() {
  dispatchPopupToastsChange(state.toasts)
}
function handleSmartClassifierAction(detail: PopupSmartClassifierActionDetail) {
  if (detail.action === 'current-page') {
    handleCurrentPageQuickAction(detail.currentPageAction || '', detail.returnFocusElement || null)
    return
  }
  if (detail.action === 'recommendation') {
    const nextRecommendationId = detail.recommendationId || ''
    if (nextRecommendationId !== state.smartSelectedRecommendationId) {
      state.smartSaved = false
    }
    state.smartSelectedRecommendationId = nextRecommendationId
    renderSmartClassifier()
    return
  }
  const action = detail.action || ''
  if (action === 'classify') {
    classifyCurrentPage()
    return
  }
  if (action === 'grant-permission') {
    grantSmartPermissionAndClassify()
    return
  }
  if (action === 'open-ai-settings') {
    void openSettingsPage('ai-provider')
    return
  }
  if (action === 'manual-folder') {
    openSmartFolderDialog(detail.returnFocusElement || null)
    return
  }
  if (action === 'reset') {
    resetSmartClassification()
    return
  }
  if (action === 'exit') {
    resetSmartClassification()
    return
  }
  if (action === 'save') {
    saveSmartRecommendation()
  }
}
function handleCurrentPageQuickAction(action, returnFocusElement: HTMLElement | null = null) {
  const bookmarkId = state.currentPageBookmarkId
  if (action === 'save') {
    openSmartFolderDialog(returnFocusElement)
    return
  }
  if (!bookmarkId) {
    showToast({ type: 'error', message: '当前页面尚未收藏。' })
    return
  }
  if (action === 'edit') {
    openEditDialog(bookmarkId, returnFocusElement)
    return
  }
  if (action === 'pin-newtab') {
    void pinCurrentPageToNewTab(bookmarkId)
  }
}
function handleSmartClassifierTitleChange(detail: PopupSmartClassifierTitleChangeDetail) {
  state.smartSuggestedTitle = String(detail.title || '')
  state.smartSaved = false
}
function handleContentAction(detail: PopupContentActionDetail) {
  if (detail.action === 'enter-bookmark-reorder') {
    enterBookmarkReorderMode()
    return
  }
  if (detail.action === 'exit-bookmark-reorder') {
    exitBookmarkReorderMode()
    return
  }
  if (detail.action === 'reorder-bookmark') {
    void reorderBookmarkWithinCurrentFolder(detail.bookmarkId || '', Number(detail.index))
    return
  }
  if (detail.action === 'filter-folder') {
    const folderId = detail.folderId || ''
    applyFolderFilter(folderId === 'all' ? null : folderId, { focusSearch: false })
    return
  }
  if (detail.action === 'keyboard-navigate') {
    handlePopupNavigationKey(detail.menuAction || '')
    return
  }
  if (detail.action === 'set-active-folder') {
    activateFolderKeyboardIndex(Number(detail.index))
    return
  }
  if (detail.action === 'set-active-result') {
    activateResultKeyboardIndex(Number(detail.index))
    return
  }
  if (detail.action === 'toggle-folder') {
    toggleFolder(detail.folderId)
    return
  }
  if (detail.action === 'menu-action') {
    const bookmarkId = detail.bookmarkId || ''
    const action = detail.menuAction || ''
    if (action === 'edit') {
      openEditDialog(bookmarkId, detail.returnFocusElement)
      return
    }
    if (action === 'move') {
      openMoveDialog(bookmarkId, detail.returnFocusElement)
      return
    }
    if (action === 'copy-url') {
      void copyBookmarkUrl(bookmarkId)
      return
    }
    if (action === 'open-current-tab') {
      void openBookmarkInCurrentTab(bookmarkId)
      return
    }
    if (action === 'delete') {
      openDeleteDialog(bookmarkId, detail.returnFocusElement)
    }
    return
  }
  if (detail.action === 'open-bookmark') {
    void openBookmark(detail.bookmarkId || '')
    return
  }
  if (detail.action === 'empty-action') {
    handleEmptySearchAction(detail.emptyAction || '')
  }
}
function handleEmptySearchAction(action) {
  if (action === 'clear-query') {
    setSearchQuery('', { immediate: true })
    showViewNotice('已清空搜索')
    focusSearchInput()
    return
  }
  if (action === 'clear-filter') {
    clearFolderFilter()
    return
  }
  if (action === 'show-all') {
    state.selectedFolderFilterId = null
    setSearchQuery('', { immediate: true })
    showViewNotice('已显示全部书签')
    focusSearchInput()
    return
  }
  if (action === 'toggle-natural') {
    void toggleNaturalLanguageSearch()
    return
  }
  if (action === 'open-ai-settings') {
    closeDialogs({ force: true })
    void openSettingsPage('ai-provider')
    return
  }
  if (action === 'dismiss-natural-setup') {
    state.naturalSearchSetupRequired = false
    state.naturalSearchEnabled = false
    render()
    focusSearchInput()
  }
}
function handleContentResultHover(detail: PopupContentResultHoverDetail) {
  if (!state.debouncedQuery) {
    return
  }
  const nextIndex = Number(detail.index)
  if (!Number.isNaN(nextIndex)) {
    setActiveResultIndex(nextIndex)
  }
}
function handleFolderPickerAction(detail: PopupFolderPickerActionDetail) {
  if (!detail.mode || !detail.folderId) {
    return
  }

  if (detail.mode === 'move') {
    handleMoveFolderPickerAction(detail)
    return
  }
  if (detail.mode === 'smart') {
    handleSmartFolderPickerAction(detail)
    return
  }
  handleEditFolderPickerAction(detail)
}

function handleModalAction(detail: PopupModalActionDetail) {
  const action = String(detail.action || '')
  const value = String(detail.value || '')

  if (action === 'close') {
    closeDialogs()
    return
  }
  if (action === 'open-ai-settings') {
    closeDialogs({ force: true })
    void openSettingsPage('ai-provider')
    return
  }
  if (action === 'move-query-change') {
    state.moveSearchQuery = value
    renderModals()
    return
  }
  if (action === 'smart-folder-query-change') {
    state.smartFolderSearchQuery = value
    renderModals()
    return
  }
  if (action === 'edit-folder-query-change') {
    state.editFolderSearchQuery = value
    renderModals()
    return
  }
  if (action === 'edit-title-change') {
    updateEditDraftField('title', value)
    return
  }
  if (action === 'edit-url-change') {
    updateEditDraftField('url', value)
    return
  }
  if (action === 'edit-toggle-folder-picker') {
    toggleEditFolderPicker()
    return
  }
  if (action === 'save-edit') {
    void saveEditedBookmark()
    return
  }
  if (action === 'confirm-delete') {
    void confirmDeleteBookmark()
  }
}

function handleMoveFolderPickerAction(detail: PopupFolderPickerActionDetail) {
  if (detail.action === 'toggle' && !state.moveSearchQuery.trim()) {
    toggleMoveFolder(detail.folderId)
    return
  }
  if (detail.action === 'select') {
    void moveBookmarkToFolder(detail.folderId)
  }
}

function handleSmartFolderPickerAction(detail: PopupFolderPickerActionDetail) {
  if (detail.action === 'toggle' && !state.smartFolderSearchQuery.trim()) {
    toggleMoveFolder(detail.folderId)
    return
  }
  if (detail.action === 'select') {
    void saveCurrentPageToFolder(detail.folderId)
  }
}

function handleEditFolderPickerAction(detail: PopupFolderPickerActionDetail) {
  if (detail.action === 'toggle' && !state.editFolderSearchQuery.trim()) {
    toggleMoveFolder(detail.folderId)
    return
  }
  if (detail.action === 'select') {
    selectEditDraftFolder(detail.folderId)
  }
}
function toggleEditFolderPicker() {
  if (!state.editTargetBookmarkId || state.editSaving || hasBlockingPopupActionPending()) {
    return
  }
  state.editFolderPickerOpen = !state.editFolderPickerOpen
  if (!state.editFolderPickerOpen) {
    state.editFolderSearchQuery = ''
  }
  renderModals()
}
function selectEditDraftFolder(folderId) {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  if (!bookmark || state.editSaving || !folderId || !state.folderMap.has(folderId)) {
    return
  }
  state.editDraftBookmarkId = String(bookmark.id)
  state.editDraftParentId = folderId
  state.editFolderPickerOpen = false
  state.editFolderSearchQuery = ''
  state.editDraftDirty = isCurrentEditDraftDirty()
  clearEditDiscardGuard()
  renderModals()
}
function handleDocumentKeydown(event) {
  if (event.isComposing) {
    return
  }
  if (event.defaultPrevented) {
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
  if (handleSearchFocusShortcut(event)) {
    return
  }

  const targetInfo = getPopupKeyboardTargetInfo(event.target)
  if (shouldDelegatePopupDocumentNavigation(event.key, targetInfo)) {
    return
  }
  if (shouldBlurMainSearchForNavigation(event.key, targetInfo)) {
    blurKeyboardEventTarget(event.target)
  }

  if (handlePopupNavigationKey(event.key)) {
    event.preventDefault()
  }
}
function handleEscapeAction() {
  if (hasOpenModal()) {
    closeDialogs()
    return true
  }
  if (state.bookmarkReorderMode) {
    exitBookmarkReorderMode()
    return true
  }
  if (['loading', 'results', 'error'].includes(state.smartStatus)) {
    resetSmartClassification()
    return true
  }
  if (state.keyboardPane === 'folders') {
    switchKeyboardToBookmarks()
    showViewNotice('已返回书签列表')
    return true
  }
  if (state.searchQuery) {
    setSearchQuery('', { immediate: true })
    showViewNotice('已清空搜索')
    return true
  }
  if (state.selectedFolderFilterId) {
    applyFolderFilter(null, { focusSearch: false })
    return true
  }
  return false
}
function handleSearchFocusShortcut(event) {
  const key = String(event.key || '')
  const isCommandSearch = (event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k'
  const isSlashSearch = key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
  if ((!isCommandSearch && !isSlashSearch) || isEditableTarget(event.target)) {
    return false
  }
  if (isSmartOverlayActive()) {
    return false
  }
  event.preventDefault()
  renderMainContent()
  focusSearchInput(getPopupSearchFocusPlan('in-page-shortcut'))
  showViewNotice(state.searchQuery ? '已聚焦搜索框，可继续编辑查询' : '已聚焦搜索框，可直接输入')
  return true
}
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}
function getPopupKeyboardTargetInfo(target): PopupKeyboardTargetInfo {
  if (!(target instanceof HTMLElement)) {
    return {
      editable: false,
      interactive: false,
      mainSearchInput: false
    }
  }

  const mainSearchInput = Boolean(target.closest('#search-input'))
  const editable = isEditableTarget(target)
  const interactive = Boolean(
    target.closest('button, a[href], input, textarea, select, [contenteditable="true"], [role="treeitem"]')
  )

  return {
    editable,
    interactive,
    mainSearchInput
  }
}
function blurKeyboardEventTarget(target): void {
  if (target instanceof HTMLElement) {
    target.blur()
  }
}
function handlePopupNavigationKey(key: string): boolean {
  if ((key === 'ArrowLeft' || key === 'ArrowRight') && !state.debouncedQuery) {
    const sidebarRows = getSidebarFolderRows()
    if (!sidebarRows.length) {
      return false
    }
    if (key === 'ArrowLeft') {
      switchKeyboardToFolders(sidebarRows)
    } else {
      switchKeyboardToBookmarks()
    }
    return true
  }

  if ((key === 'ArrowDown' || key === 'ArrowUp') && state.keyboardPane === 'folders' && !state.debouncedQuery) {
    queueActiveFolderDelta(key === 'ArrowDown' ? 1 : -1)
    return true
  }

  if (key === 'Enter' && state.keyboardPane === 'folders' && !state.debouncedQuery) {
    const sidebarRows = getSidebarFolderRows()
    const folderIndex = queuedActiveFolderIndex ?? state.activeFolderKeyboardIndex
    if (folderIndex < 0 || folderIndex >= sidebarRows.length) {
      return false
    }

    const row = sidebarRows[folderIndex]
    applyFolderFilter(row.root ? null : row.folderId, { focusSearch: false })
    switchKeyboardToBookmarks()
    return true
  }

  const keyboardBookmarks = getKeyboardNavigationBookmarks()
  if (!keyboardBookmarks.length) {
    return false
  }
  if (key === 'ArrowDown') {
    queueActiveResultDelta(1)
    return true
  }
  if (key === 'ArrowUp') {
    queueActiveResultDelta(-1)
    return true
  }
  if (key === 'Enter') {
    const activeIndex = queuedActiveResultIndex ?? state.activeResultIndex
    if (activeIndex < 0) {
      return false
    }

    const activeBookmark = keyboardBookmarks[activeIndex]
    if (!activeBookmark) {
      return false
    }

    openBookmark(activeBookmark.id)
    return true
  }
  if (key === 'Escape') {
    return handleEscapeAction()
  }

  return false
}
function handleToastAction(detail: PopupToastActionDetail) {
  const toastId = String(detail?.toastId || '')
  const action = String(detail?.action || '')
  dismissToast(toastId)
  if (action === 'undo-delete') {
    undoDelete()
    return
  }
  if (action === 'open-bookmark-history') {
    void openBookmarkHistoryPage()
  }
}
function toggleFolder(folderId) {
  if (!folderId) {
    return
  }
  const wasExpanded = state.expandedFolders.has(folderId)
  if (wasExpanded) {
    state.expandedFolders.delete(folderId)
  } else {
    state.expandedFolders.add(folderId)
  }
  renderMainContent()
  showViewNotice(`${wasExpanded ? '已折叠' : '已展开'}：${getFolderNoticeLabel(folderId)}`)
}
function getFolderNoticeLabel(folderId) {
  const folder = state.folderMap.get(folderId)
  return folder?.path || folder?.title || '文件夹'
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
  renderModals()
}
function openMoveDialog(bookmarkId, returnFocusElement = null) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }
  rememberDialogReturnFocus(returnFocusElement)
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = null
  state.moveTargetBookmarkId = bookmarkId
  state.moveSearchQuery = ''
  render()
}
function openEditDialog(bookmarkId, returnFocusElement = null) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }
  const bookmark = state.bookmarkMap.get(String(bookmarkId || ''))
  if (!bookmark) {
    return
  }
  rememberDialogReturnFocus(returnFocusElement)
  state.moveTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.editTargetBookmarkId = bookmarkId
  resetEditDraft(bookmark)
  render()
}
function openDeleteDialog(bookmarkId, returnFocusElement = null) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }
  rememberDialogReturnFocus(returnFocusElement)
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = bookmarkId
  render()
}
function closeDialogs(options: { force?: boolean } | Event = {}) {
  const force = (options as { force?: boolean })?.force === true
  if (!force && (state.editSaving || hasBlockingPopupActionPending())) {
    return
  }
  if (!force && shouldBlockDirtyEditClose()) {
    return
  }
  state.moveTargetBookmarkId = null
  state.moveSearchQuery = ''
  state.smartFolderPickerOpen = false
  state.smartFolderSearchQuery = ''
  state.aiProviderPromptOpen = false
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  clearEditDraft()
  render()
  if (isSmartOverlayActive()) {
    return
  }
  restoreDialogReturnFocus()
}

function resetBookmarkReorderModeState() {
  state.bookmarkReorderMode = false
  state.bookmarkReorderFolderId = ''
  state.bookmarkReorderOrderIds = []
  state.bookmarkReorderBusy = false
  state.bookmarkReorderAnnouncement = ''
}

function enterBookmarkReorderMode() {
  if (state.debouncedQuery || state.searchQuery.trim()) {
    showViewNotice('清空搜索后再调整书签顺序')
    return
  }

  const currentRoot = getCurrentTreeRoot()
  const directBookmarks = getDirectBookmarkRecords(currentRoot)
  if (!currentRoot || directBookmarks.length < 2) {
    showViewNotice('当前文件夹至少需要 2 个直属书签才能排序')
    return
  }

  state.bookmarkReorderMode = true
  state.bookmarkReorderFolderId = String(currentRoot.id || '')
  state.bookmarkReorderOrderIds = directBookmarks.map((bookmark) => String(bookmark.id))
  state.bookmarkReorderBusy = false
  state.bookmarkReorderAnnouncement = `正在调整「${currentRoot.title || '书签栏'}」中的书签顺序`
  state.activeResultIndex = -1
  state.keyboardPane = 'bookmarks'
  clearQueuedKeyboardNavigation()
  renderMainContent({ preserveScroll: false })
  showViewNotice('排序模式只调整当前文件夹的直属书签')
}

function exitBookmarkReorderMode() {
  if (!state.bookmarkReorderMode) {
    return
  }
  resetBookmarkReorderModeState()
  renderMainContent({ preserveScroll: false })
  showViewNotice('已退出排序模式')
}

function reconcileBookmarkReorderModeAfterRefresh() {
  if (!state.bookmarkReorderMode || !state.bookmarkReorderFolderId) {
    return
  }

  const folderNode = findNodeById(state.rawTreeRoot, state.bookmarkReorderFolderId)
  if (!folderNode || folderNode.url) {
    resetBookmarkReorderModeState()
    return
  }

  state.bookmarkReorderOrderIds = getDirectBookmarkRecords(folderNode)
    .map((bookmark) => String(bookmark.id))
}

async function reorderBookmarkWithinCurrentFolder(bookmarkId: string, requestedIndex: number) {
  if (
    !state.bookmarkReorderMode ||
    state.bookmarkReorderBusy ||
    !state.bookmarkReorderFolderId
  ) {
    return
  }

  const folderId = state.bookmarkReorderFolderId
  const folderNode = findNodeById(state.rawTreeRoot, folderId)
  const currentIds = [...state.bookmarkReorderOrderIds]
  const sourceIndex = currentIds.indexOf(bookmarkId)
  if (!folderNode || folderNode.url || sourceIndex < 0 || !Number.isFinite(requestedIndex)) {
    return
  }

  const targetIndex = Math.max(0, Math.min(Math.trunc(requestedIndex), currentIds.length - 1))
  const bookmark = state.bookmarkMap.get(bookmarkId)
  const bookmarkTitle = bookmark?.title || '未命名书签'
  if (sourceIndex === targetIndex) {
    state.bookmarkReorderAnnouncement = requestedIndex < sourceIndex
      ? `${bookmarkTitle} 已在当前文件夹最前面`
      : `${bookmarkTitle} 已在当前文件夹最后面`
    renderMainContent({ preserveScroll: true })
    return
  }

  const destinationIndex = getPopupBookmarkMoveDestinationIndex(
    folderNode.children,
    bookmarkId,
    targetIndex
  )
  if (destinationIndex === null) {
    return
  }

  const nextIds = reorderPopupBookmarkIds(currentIds, bookmarkId, targetIndex)
  state.bookmarkReorderOrderIds = nextIds
  state.bookmarkReorderBusy = true
  state.bookmarkReorderAnnouncement = `正在移动 ${bookmarkTitle}`
  renderMainContent({ preserveScroll: true })

  try {
    await moveBookmark(bookmarkId, folderId, destinationIndex)
    await refreshData({ preserveSearch: true })
    if (state.bookmarkReorderMode && state.bookmarkReorderFolderId === folderId) {
      state.bookmarkReorderAnnouncement = `${bookmarkTitle} 已移动到第 ${targetIndex + 1} 位，共 ${nextIds.length} 个`
    }
  } catch (error) {
    if (state.bookmarkReorderMode && state.bookmarkReorderFolderId === folderId) {
      state.bookmarkReorderOrderIds = currentIds
      state.bookmarkReorderAnnouncement = `${bookmarkTitle} 顺序保存失败，已恢复原位置`
    }
    showToast({
      type: 'error',
      message: error instanceof Error ? `顺序保存失败：${error.message}` : '顺序保存失败，已恢复原位置'
    })
  } finally {
    state.bookmarkReorderBusy = false
    renderMainContent({ preserveScroll: true })
  }
}

function applyFolderFilter(folderId, { focusSearch = true } = {}) {
  resetBookmarkReorderModeState()
  const selectedFolder = folderId ? state.folderMap.get(folderId) : null
  state.selectedFolderFilterId = folderId
  runSearch()
  render()
  showViewNotice(selectedFolder ? `已筛选：${selectedFolder.path || selectedFolder.title}` : '已显示全部文件夹')
  if (focusSearch) {
    focusSearchInput()
  }
}
function clearFolderFilter() {
  if (!state.selectedFolderFilterId) {
    return
  }
  applyFolderFilter(null)
}
function openSmartFolderDialog(returnFocusElement: HTMLElement | null = null) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }
  if (!isSmartClassifiableUrl(state.currentTab?.url)) {
    showToast({ type: 'error', message: '当前页面无法保存为普通网页书签。' })
    return
  }
  rememberDialogReturnFocus(returnFocusElement)
  state.moveTargetBookmarkId = null
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.smartFolderPickerOpen = true
  state.smartFolderSearchQuery = ''
  render()
}
function openAiProviderPromptDialog(returnFocusElement: HTMLElement | null = null) {
  if (hasBlockingPopupActionPending()) {
    return
  }
  if (shouldBlockDirtyEditClose()) {
    return
  }
  rememberDialogReturnFocus(returnFocusElement)
  state.moveTargetBookmarkId = null
  state.smartFolderPickerOpen = false
  state.editTargetBookmarkId = null
  state.confirmDeleteBookmarkId = null
  state.aiProviderPromptOpen = true
  render()
}
function rememberDialogReturnFocus(preferredElement: HTMLElement | null = null) {
  popupDialogReturnFocusElement = preferredElement instanceof HTMLElement
    ? preferredElement
    : null
}
function restoreDialogReturnFocus() {
  const returnElement = popupDialogReturnFocusElement
  popupDialogReturnFocusElement = null
  window.requestAnimationFrame(() => {
    if (returnElement?.isConnected && !returnElement.hasAttribute('disabled')) {
      returnElement.focus()
      return
    }
    focusSearchInput()
  })
}
function isSmartOverlayActive(): boolean {
  const currentUrl = String(state.currentTab?.url || '').trim()
  return isSmartClassifiableUrl(currentUrl) &&
    ['loading', 'results', 'error', 'permission'].includes(state.smartStatus)
}
function resetSmartClassification() {
  abortSmartClassificationRequest()
  state.smartRunId += 1
  stopSmartProgressTicker()
  state.smartStatus = 'idle'
  state.smartError = ''
  state.smartStep = 0
  state.smartProgressPercent = 0
  state.smartSuggestedTitle = ''
  state.smartSummary = ''
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartSaving = false
  state.smartSaved = false
  state.smartPermissionRequest = null
  renderSmartClassifier()
}
async function classifyCurrentPage({ requestMissingPermissions = false } = {}) {
  if (state.smartStatus === 'loading' || state.smartSaving) {
    return
  }
  const currentUrl = String(state.currentTab?.url || '').trim()
  if (!isSmartClassifiableUrl(currentUrl)) {
    showToast({ type: 'error', message: '当前页面无法进行智能分类。' })
    return
  }
  abortSmartClassificationRequest()
  const controller = new AbortController()
  smartClassificationAbortController = controller
  const runId = state.smartRunId + 1
  state.smartRunId = runId
  state.smartStatus = 'loading'
  state.smartError = ''
  state.smartStep = 1
  state.smartProgressPercent = 0
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartSaved = false
  state.smartSuggestedTitle = getCurrentPageTitle()
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartPermissionRequest = null
  renderSmartClassifier()
  startSmartProgressTicker(runId)
  try {
    const smartClassifier = await loadSmartClassifierModule()
    updateSmartProgressCheckpoint(runId, 1, 0.08)
    const settings = await loadAiProviderSettings()
    const settingsRunStillCurrent = state.smartRunId === runId
    if (!settingsRunStillCurrent) return
    updateSmartProgressCheckpoint(runId, 1, 0.12)
    smartClassifier.validateSmartAiSettings(settings)
    const validationRunStillCurrent = state.smartRunId === runId
    if (!validationRunStillCurrent) return
    await smartClassifier.ensureSmartClassifyPermissions(settings, {
      interactive: requestMissingPermissions
    })
    const permissionsRunStillCurrent = state.smartRunId === runId
    if (!permissionsRunStillCurrent) return
    updateSmartProgressCheckpoint(runId, 1, 0.18)
    const pageContext = await smartClassifier.buildCurrentPageContext({
      currentUrl,
      currentTitle: getCurrentPageTitle(),
      settings,
      signal: controller.signal,
      onProgress: (checkpoint) => updateSmartProgressCheckpoint(runId, 1, checkpoint)
    })
    const contextRunStillCurrent = state.smartRunId === runId
    if (!contextRunStillCurrent) return
    if (!advanceSmartProgressStage(runId, 2)) return
    const aiResult = await smartClassifier.requestSmartClassification({
      settings,
      pageContext,
      currentUrl,
      currentTitle: getCurrentPageTitle(),
      allFolders: state.allFolders,
      signal: controller.signal,
      onProgress: (checkpoint) => updateSmartProgressCheckpoint(runId, 2, checkpoint)
    })
    const classificationRunStillCurrent = state.smartRunId === runId
    if (!classificationRunStillCurrent) return
    if (!advanceSmartProgressStage(runId, 3)) return
    updateSmartProgressCheckpoint(runId, 3, 0.18)
    const recommendations = buildSmartRecommendations(aiResult)
    updateSmartProgressCheckpoint(runId, 3, 0.58)
    state.smartSuggestedTitle = cleanSmartTitle(aiResult.title || getCurrentPageTitle())
    state.smartSummary = cleanSmartText(aiResult.summary, 360)
    state.smartContentType = cleanSmartText(aiResult.contentType, 80)
    state.smartTopics = normalizeSmartTextList(aiResult.topics, 8, 40)
    state.smartTags = normalizeBookmarkTags(aiResult.tags)
    state.smartAliases = normalizeSmartTextList(aiResult.aliases, 20, 40)
    state.smartConfidence = normalizeSmartConfidence(aiResult.confidence)
    state.smartModel = settings.model
    state.smartExtraction = smartClassifier.buildSmartExtractionSnapshot(pageContext)
    state.smartRecommendations = recommendations
    state.smartSelectedRecommendationId = recommendations[0]?.id || ''
    if (state.smartRunId !== runId) return
    await runSmartProgressFinish(runId)
    if (!isSmartLoadingRunActive(runId)) return
    state.smartStatus = 'results'
    renderSmartClassifier()
  } catch (error) {
    if (state.smartRunId !== runId || controller.signal.aborted) return
    stopSmartProgressTicker()
    if (isSmartPermissionRequiredError(error)) {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = error.smartPermissionRequest
      state.smartError = error.message
      renderSmartClassifier()
      return
    }
    state.smartStatus = 'error'
    state.smartError = normalizeSmartError(error)
    renderSmartClassifier()
  } finally {
    if (smartClassificationAbortController === controller) {
      smartClassificationAbortController = null
    }
  }
}
function advanceSmartProgressStage(runId: number, nextStep: number): boolean {
  if (!isSmartLoadingRunActive(runId)) {
    return false
  }

  const step = normalizeSmartLoadingStep(nextStep)
  state.smartStep = step
  state.smartProgressPercent = Math.max(
    state.smartProgressPercent,
    getSmartCheckpointProgress(step, 0)
  )
  anchorSmartProgress(state.smartProgressPercent)
  renderSmartClassifier()
  return true
}
function updateSmartProgressCheckpoint(runId: number, rawStep: number, checkpoint: number): void {
  if (!isSmartLoadingRunActive(runId)) {
    return
  }
  const step = normalizeSmartLoadingStep(rawStep)
  if (state.smartStep !== step) {
    return
  }
  const nextProgress = getSmartCheckpointProgress(step, checkpoint)
  if (nextProgress <= state.smartProgressPercent) {
    return
  }
  state.smartProgressPercent = nextProgress
  anchorSmartProgress(nextProgress)
  renderSmartClassifier()
}
function isSmartLoadingRunActive(runId: number): boolean {
  return state.smartRunId === runId && state.smartStatus === 'loading'
}
async function grantSmartPermissionAndClassify() {
  if (state.smartStatus === 'loading' || state.smartSaving) {
    return
  }
  const origins = Array.isArray(state.smartPermissionRequest?.origins)
    ? [...new Set(state.smartPermissionRequest.origins)].filter(Boolean)
    : []
  if (!origins.length) {
    await classifyCurrentPage({ requestMissingPermissions: true })
    return
  }
  try {
    const smartClassifier = await loadSmartClassifierModule()
    const granted = await smartClassifier.requestPermissions({ origins })
    if (!granted) {
      throw smartClassifier.createSmartPermissionRequiredError(origins, '未完成 AI 渠道授权，暂时无法智能分类。')
    }
    await classifyCurrentPage()
  } catch (error) {
    if (isSmartPermissionRequiredError(error)) {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = error.smartPermissionRequest
      state.smartError = error.message
    } else {
      state.smartStatus = 'permission'
      state.smartPermissionRequest = { origins }
      state.smartError = normalizeSmartError(error)
    }
    renderSmartClassifier()
  }
}
async function saveSmartRecommendation() {
  const recommendation = state.smartRecommendations.find((item) => item.id === state.smartSelectedRecommendationId)
  if (!recommendation || state.smartSaving || state.smartSaved) {
    return
  }
  await saveCurrentPageToSmartRecommendation(recommendation)
}
async function saveCurrentPageToSmartRecommendation(recommendation) {
  if (recommendation.kind === 'new') {
    await saveCurrentPageViaWorker({
      folderPath: recommendation.path
    }, { closeModal: false })
    return
  }
  await saveCurrentPageToFolder(recommendation.folderId, { closeModal: false })
}
async function saveCurrentPageToFolder(folderId, { closeModal = true } = {}) {
  await saveCurrentPageViaWorker({ parentId: folderId }, { closeModal })
}
async function saveCurrentPageViaWorker({ parentId = '', folderPath = '' } = {}, { closeModal = true } = {}) {
  const actionTargetId = parentId || folderPath || 'current-page'
  if (state.smartSaving || isPopupActionPending('save-current-page', actionTargetId)) {
    return
  }
  let savedWithoutRefresh = false
  try {
    setPopupActionPending('save-current-page', actionTargetId, true)
    state.smartSaving = true
    state.smartSaved = false
    renderSmartSaveSurfaces()
    const currentUrl = String(state.currentTab?.url || '').trim()
    if (!isSmartClassifiableUrl(currentUrl)) {
      throw new Error('当前页面不是可保存的普通网页。')
    }
    if (!parentId && !folderPath) {
      throw new Error('未找到可保存的目标文件夹。')
    }
    const nextTitle = cleanSmartTitle(state.smartSuggestedTitle || getCurrentPageTitle())
    const existingBookmark = state.currentPageBookmarkId
      ? state.bookmarkMap.get(state.currentPageBookmarkId)
      : null
    const savedBookmark = await requestBookmarkSave({
      parentId,
      folderPath,
      bookmarkId: existingBookmark?.id || state.currentPageBookmarkId || '',
      title: nextTitle,
      url: currentUrl,
      analysis: {
        summary: state.smartSummary,
        contentType: state.smartContentType,
        topics: state.smartTopics,
        tags: state.smartTags,
        aliases: state.smartAliases,
        confidence: state.smartConfidence,
        model: state.smartModel,
        extraction: state.smartExtraction
      }
    })
    state.currentPageBookmarkId = savedBookmark.bookmarkId || state.currentPageBookmarkId
    await finishSmartSave({
      message: getSmartSaveSuccessMessage(savedBookmark, { parentId, folderPath }),
      closeModal
    })
    savedWithoutRefresh = true
  } catch (error) {
    state.smartSaving = false
    state.smartSaved = false
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('save-current-page', actionTargetId, false)
    state.smartSaving = false
    if (!savedWithoutRefresh) {
      renderSmartSaveSurfaces()
    }
  }
}
function renderSmartSaveSurfaces() {
  renderSmartClassifier()
  renderModals()
}
async function pinCurrentPageToNewTab(bookmarkId) {
  const bookmark = state.bookmarkMap.get(String(bookmarkId || ''))
  if (!bookmark?.url || isPopupActionPending('pin-newtab', bookmark.id)) {
    return
  }
  try {
    setPopupActionPending('pin-newtab', bookmark.id, true)
    renderSmartClassifier()
    const stored = await getLocalStorage([STORAGE_KEYS.newTabWorkspaceSettings])
    const currentSettings = normalizeNewTabWorkspaceSettings(
      stored[STORAGE_KEYS.newTabWorkspaceSettings] || POPUP_DEFAULT_WORKSPACE_STORAGE,
      { validBookmarkIds: state.bookmarkMap.keys() }
    )
    const workspace = getActiveNewTabWorkspace(currentSettings)
    const nextSettings = toggleNewTabWorkspacePin(
      currentSettings,
      workspace.id,
      bookmark.id,
      { validBookmarkIds: state.bookmarkMap.keys() }
    )
    await setLocalStorage({ [STORAGE_KEYS.newTabWorkspaceSettings]: nextSettings })
    const pinned = nextSettings.workspaces
      .find((item) => item.id === workspace.id)
      ?.pinnedIds.includes(bookmark.id)
    state.newTabPinnedIds = new Set(getActiveNewTabWorkspace(nextSettings).pinnedIds)
    void chrome.runtime?.sendMessage?.({
      type: 'curator:newtab-speed-dial-state',
      bookmarkId: bookmark.id,
      pinned: Boolean(pinned)
    }).catch(() => {})
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `固定失败：${error.message}` : '固定到 newtab 失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('pin-newtab', bookmark.id, false)
    renderSmartClassifier()
  }
}
async function finishSmartSave({ message, closeModal = true }) {
  state.smartRunId += 1
  stopSmartProgressTicker()
  state.smartSaving = false
  state.smartSaved = true
  state.smartStatus = 'idle'
  state.smartError = ''
  state.smartStep = 0
  state.smartProgressPercent = 0
  state.smartSuggestedTitle = ''
  state.smartSummary = ''
  state.smartContentType = ''
  state.smartTopics = []
  state.smartTags = []
  state.smartAliases = []
  state.smartConfidence = 0
  state.smartModel = ''
  state.smartExtraction = { status: '', source: '', warnings: [] }
  state.smartRecommendations = []
  state.smartSelectedRecommendationId = ''
  state.smartPermissionRequest = null
  if (closeModal || state.smartFolderPickerOpen) {
    state.smartFolderPickerOpen = false
    state.smartFolderSearchQuery = ''
  }
  renderSmartSaveSurfaces()
  showToast({ type: 'success', message })
  showViewNotice('已保存，正在刷新书签列表')
  await refreshData({ preserveSearch: true })
  showViewNotice('已保存，书签列表已更新')
  window.requestAnimationFrame(() => {
    if (!hasOpenModal()) {
      focusSearchInput()
    }
  })
}
function getSmartSaveSuccessMessage(savedBookmark, { parentId = '', folderPath = '' } = {}) {
  const folderLabel = cleanSmartText(
    folderPath ||
      state.folderMap.get(savedBookmark?.parentId || parentId)?.path ||
      state.folderMap.get(parentId)?.path ||
      '',
    48
  )
  return folderLabel ? `已保存到 ${folderLabel}` : '保存成功'
}
async function moveBookmarkToFolder(folderId) {
  const bookmark = state.moveTargetBookmarkId
    ? state.bookmarkMap.get(state.moveTargetBookmarkId)
    : null
  if (!bookmark || !folderId || isPopupActionPending('move', bookmark?.id || '')) {
    return
  }
  if (bookmark.parentId === folderId) {
    showToast({
      type: 'success',
      message: '书签已在当前文件夹中'
    })
    showViewNotice('书签已在当前文件夹中')
    return
  }
  const movedTitle = bookmark.title
  setPopupActionPending('move', bookmark.id, true)
  renderModals()
  try {
    await moveBookmark(bookmark.id, folderId)
    showToast({
      type: 'success',
      message: '移动成功'
    })
    closeDialogs({ force: true })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已移动：${movedTitle}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `移动失败：${error.message}` : '移动失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('move', bookmark.id, false)
    renderModals()
  }
}
async function saveEditedBookmark() {
  const bookmark = state.editTargetBookmarkId
    ? state.bookmarkMap.get(state.editTargetBookmarkId)
    : null
  if (!bookmark || state.editSaving || isPopupActionPending('edit', bookmark?.id || '')) {
    return
  }
  const nextTitle = String(state.editDraftTitle).trim() || '未命名书签'
  const nextUrl = String(state.editDraftUrl).trim()
  const savePlan = getPopupEditBookmarkSavePlan({
    bookmark,
    draftTitle: nextTitle,
    draftUrl: nextUrl,
    draftParentId: state.editDraftParentId
  })
  state.editDraftDirty = savePlan.dirty
  if (!state.editDraftDirty) {
    renderModals()
    return
  }
  if (!nextUrl) {
    showToast({
      type: 'error',
      message: '网址不能为空'
    })
    return
  }
  try {
    new URL(nextUrl)
  } catch (error) {
    showToast({
      type: 'error',
      message: '请输入有效的网址'
    })
    return
  }
  state.editSaving = true
  setPopupActionPending('edit', bookmark.id, true)
  renderModals()
  try {
    if (savePlan.updateChanges) {
      await updateBookmark(bookmark.id, savePlan.updateChanges)
    }
    if (savePlan.parentChanged && savePlan.parentId) {
      await moveBookmark(bookmark.id, savePlan.parentId)
    }
    showToast({
      type: 'success',
      message: '保存成功'
    })
    state.editSaving = false
    setPopupActionPending('edit', bookmark.id, false)
    closeDialogs({ force: true })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已更新：${nextTitle}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `保存失败：${error.message}` : '保存失败，请稍后重试。'
    })
  } finally {
    state.editSaving = false
    setPopupActionPending('edit', bookmark.id, false)
    renderModals()
  }
}
async function confirmDeleteBookmark() {
  const bookmark = state.confirmDeleteBookmarkId
    ? state.bookmarkMap.get(state.confirmDeleteBookmarkId)
    : null
  if (!bookmark || isPopupActionPending('delete', bookmark?.id || '')) {
    return
  }
  setPopupActionPending('delete', bookmark.id, true)
  renderModals()
  try {
    const recycleBin = await loadRecycleBinModule()
    state.lastDeletedBookmark = {
      title: bookmark.title,
      url: bookmark.url,
      parentId: bookmark.parentId,
      index: bookmark.index,
      recycleId: `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    }
    const deleted = await recycleBin.deleteBookmarkToRecycle(bookmark.id, {
      recycleId: state.lastDeletedBookmark.recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title,
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: bookmark.path || '',
      source: '弹窗删除',
      deletedAt: Date.now()
    }, {
      expectedUrl: bookmark.url
    })
    if (!deleted) {
      throw new Error('书签地址已变化，已取消删除。')
    }
    showToast({
      type: 'success',
      message: '删除成功',
      action: 'undo-delete',
      actionLabel: '撤销'
    })
    closeDialogs({ force: true })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已删除：${bookmark.title}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `删除失败：${error.message}` : '删除失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('delete', bookmark.id, false)
    renderModals()
  }
}
async function undoDelete() {
  if (!state.lastDeletedBookmark) {
    return
  }
  const payload = state.lastDeletedBookmark
  const actionTargetId = payload.recycleId || payload.url || payload.title
  if (isPopupActionPending('undo-delete', actionTargetId)) {
    return
  }
  setPopupActionPending('undo-delete', actionTargetId, true)
  state.lastDeletedBookmark = null
  try {
    const parentId = await getRestorableParentId(payload.parentId)
    const recycleBin = await loadRecycleBinModule()
    await recycleBin.restoreBookmarkFromRecycleEntry(
      payload.recycleId,
      () => createBookmark({
        ...payload,
        parentId
      })
    )
    showToast({
      type: 'success',
      message: '已撤销删除'
    })
    await refreshData({ preserveSearch: true })
    showViewNotice(`已恢复：${payload.title}`)
  } catch (error) {
    state.lastDeletedBookmark = payload
    showToast({
      type: 'error',
      message: error instanceof Error ? `撤销失败：${error.message}` : '撤销失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('undo-delete', actionTargetId, false)
  }
}
async function getRestorableParentId(parentId) {
  const requestedParentId = String(parentId || '').trim()
  if (!requestedParentId) {
    return BOOKMARKS_BAR_ID
  }
  try {
    const tree = await getBookmarkTree()
    const rootNode = Array.isArray(tree) ? tree[0] : tree
    const target = findNodeById(rootNode, requestedParentId)
    return target && !target.url ? requestedParentId : BOOKMARKS_BAR_ID
  } catch {
    return BOOKMARKS_BAR_ID
  }
}
async function openBookmark(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)
  if (!bookmark?.url || hasBlockingPopupActionPending()) {
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
async function openBookmarkInCurrentTab(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)
  if (!bookmark?.url || hasBlockingPopupActionPending() || isPopupActionPending('open-current-tab', bookmarkId)) {
    return
  }
  setPopupActionPending('open-current-tab', bookmarkId, true)
  try {
    await updateCurrentTabUrl(bookmark.url)
    window.close()
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `打开失败：${error.message}` : '打开失败，请稍后重试。'
    })
  } finally {
    setPopupActionPending('open-current-tab', bookmarkId, false)
  }
}
function updateCurrentTabUrl(url) {
  return new Promise((resolve, reject) => {
    const tabId = Number(state.currentTab?.id)
    const updateProperties = { url }
    const callback = (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(tab)
    }
    if (Number.isFinite(tabId)) {
      chrome.tabs.update(tabId, updateProperties, callback)
      return
    }
    chrome.tabs.update(updateProperties, callback)
  })
}
async function copyBookmarkUrl(bookmarkId) {
  const bookmark = state.bookmarkMap.get(bookmarkId)
  if (isPopupActionPending('copy-url', bookmarkId)) {
    return
  }
  if (!bookmark?.url) {
    showToast({
      type: 'error',
      message: '复制失败：书签链接不存在。'
    })
    return
  }
  setPopupActionPending('copy-url', bookmarkId, true)
  try {
    await writeClipboardText(bookmark.url)
    showToast({
      type: 'success',
      message: '链接已复制'
    })
    showViewNotice(`已复制链接：${bookmark.title}`)
  } catch (error) {
    showToast({
      type: 'error',
      message: error instanceof Error ? `复制失败：${error.message}` : '复制失败，请手动复制链接。'
    })
  } finally {
    setPopupActionPending('copy-url', bookmarkId, false)
  }
}
async function loadAiProviderSettings() {
  const [stored, { normalizeAiNamingSettings }] = await Promise.all([
    getLocalStorage([STORAGE_KEYS.aiProviderSettings]),
    loadAiSettingsModule()
  ])
  return normalizeAiNamingSettings(stored[STORAGE_KEYS.aiProviderSettings])
}
function buildSmartRecommendations(aiResult) {
  const byFolderId = new Map()
  for (const suggestion of aiResult.existingFolders) {
    const folder = findBestExistingFolder(suggestion)
    if (!folder) {
      continue
    }
    const previous = byFolderId.get(folder.id)
    const confidence = normalizeSmartConfidence(suggestion.confidence)
    if (!previous || confidence > previous.confidence) {
      byFolderId.set(folder.id, {
        id: `folder:${folder.id}`,
        kind: 'existing',
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence,
        reason: suggestion.reason || ''
      })
    }
  }
  const existingRecommendations = [...byFolderId.values()]
    .sort((left, right) => {
      const leftFolder = state.folderMap.get(left.folderId)
      const rightFolder = state.folderMap.get(right.folderId)
      return (
        Number(right.confidence) - Number(left.confidence) ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
      )
    })
    .slice(0, SMART_RECOMMENDATION_LIMIT)
  if (existingRecommendations.length < SMART_RECOMMENDATION_LIMIT) {
    for (const fallback of buildLocalSmartFolderMatches()) {
      if (existingRecommendations.some((item) => item.folderId === fallback.folderId)) {
        continue
      }
      existingRecommendations.push(fallback)
      if (existingRecommendations.length >= SMART_RECOMMENDATION_LIMIT) {
        break
      }
    }
  }
  const newFolderPath = normalizeSmartFolderPath(aiResult.newFolder?.folderPath)
  const newRecommendation = newFolderPath
    ? [{
        id: 'new-folder',
        kind: 'new',
        folderId: '',
        title: getLastPathSegment(newFolderPath),
        path: newFolderPath,
        confidence: normalizeSmartConfidence(aiResult.newFolder?.confidence),
        reason: aiResult.newFolder?.reason || ''
      }]
    : []
  return [...existingRecommendations, ...newRecommendation]
}
function buildLocalSmartFolderMatches() {
  const titleText = normalizeText(getCurrentPageTitle())
  const urlText = normalizeText(state.currentTab?.url || '')
  const domainText = normalizeText(extractDomain(state.currentTab?.url || ''))
  const haystack = [titleText, urlText, domainText].filter(Boolean).join(' ')
  return state.allFolders.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((folder) => {
      const title = normalizeText(folder.title)
      const path = normalizeText(folder.path)
      let score = 0
      if (title && haystack.includes(title)) {
        score += 0.38
      }
      if (path && haystack.includes(path)) {
        score += 0.28
      }
      if (domainText && (title.includes(domainText) || path.includes(domainText))) {
        score += 0.22
      }
      score += Math.min(Number(folder.depth || 0), 6) * 0.025
      return {
        id: `folder:${folder.id}`,
        kind: 'existing',
        folderId: folder.id,
        title: folder.title,
        path: folder.path || folder.title,
        confidence: Math.max(0.52, Math.min(score, 0.82)),
        reason: '基于当前网页标题、域名和文件夹路径的本地补充匹配。'
      }
    })(combineValue); return ((item) => item.confidence > 0.54)(combinedResult) ? [combinedResult] : [] })
    .sort((left, right) => {
      const leftFolder = state.folderMap.get(left.folderId)
      const rightFolder = state.folderMap.get(right.folderId)
      return (
        Number(right.confidence) - Number(left.confidence) ||
        Number(rightFolder?.depth || 0) - Number(leftFolder?.depth || 0) ||
        String(left.path).localeCompare(String(right.path), 'zh-Hans-CN')
      )
    })
}
function normalizeSmartTextList(value, limit, itemLimit) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set()
  const output = []
  for (const item of values) {
    const text = cleanSmartText(item, itemLimit)
    const key = normalizeText(text)
    if (!text || seen.has(key)) {
      continue
    }
    seen.add(key)
    output.push(text)
    if (output.length >= limit) {
      break
    }
  }
  return output
}
function findBestExistingFolder(suggestion) {
  const folderId = typeof suggestion === 'string'
    ? ''
    : String(suggestion?.folderId || '').trim()
  if (folderId) {
    const exactIdMatch = state.folderMap.get(folderId)
    if (exactIdMatch) {
      return exactIdMatch
    }
  }

  const rawPath = typeof suggestion === 'string' ? suggestion : suggestion?.folderPath
  const normalizedPath = normalizeText(rawPath)
  if (!normalizedPath) {
    return null
  }
  const folders = state.allFolders.slice()
  const exactPathMatches = folders.filter((folder) => normalizeText(folder.path || folder.title) === normalizedPath)
  if (exactPathMatches.length) {
    return pickDeepestFolder(exactPathMatches)
  }
  const exactTitleMatches = folders.filter((folder) => normalizeText(folder.title) === normalizedPath)
  if (exactTitleMatches.length) {
    return pickDeepestFolder(exactTitleMatches)
  }
  const segment = normalizeText(getLastPathSegment(rawPath))
  const segmentMatches = folders.filter((folder) => normalizeText(folder.title) === segment)
  if (segmentMatches.length) {
    return pickDeepestFolder(segmentMatches)
  }
  const containsMatches = folders.filter((folder) => {
    const folderPath = normalizeText(folder.path || folder.title)
    return folderPath.includes(normalizedPath) || normalizedPath.includes(folderPath)
  })
  return containsMatches.length ? pickDeepestFolder(containsMatches) : null
}
function pickDeepestFolder(folders) {
  return folders.reduce((best, folder) => {
    if (!best) {
      return folder
    }
    const comparison = Number(folder.depth || 0) - Number(best.depth || 0) || String(best.path).localeCompare(String(folder.path), 'zh-Hans-CN')
    return comparison > 0 ? folder : best
  }, null)
}
function isSmartPermissionRequiredError(error) {
  return Boolean((error as { smartPermissionRequest?: { origins?: string[] } })?.smartPermissionRequest?.origins)
}
function formatPermissionOrigin(origin) {
  return String(origin || '').replace(/\/\*$/, '')
}
function queueActiveResultDelta(delta: number) {
  const keyboardBookmarks = getKeyboardNavigationBookmarks()
  if (!keyboardBookmarks.length) {
    return
  }

  const baseIndex = queuedActiveResultIndex ?? state.activeResultIndex
  const nextIndex = baseIndex < 0
    ? (delta < 0 ? keyboardBookmarks.length - 1 : 0)
    : Math.max(0, Math.min(baseIndex + delta, keyboardBookmarks.length - 1))
  const shouldActivateBookmarkPane = state.keyboardPane !== 'bookmarks' || state.activeFolderKeyboardIndex >= 0
  if (nextIndex === baseIndex && !shouldActivateBookmarkPane) {
    return
  }

  markKeyboardNavigationActive()
  queuedActiveResultIndex = nextIndex
  if (activeResultFrame) {
    return
  }

  activeResultFrame = window.requestAnimationFrame(flushQueuedActiveResultIndex)
}
function flushQueuedActiveResultIndex() {
  activeResultFrame = 0
  const nextIndex = queuedActiveResultIndex
  queuedActiveResultIndex = null
  if (nextIndex === null) {
    return
  }

  setActiveResultIndex(nextIndex)
}
function markKeyboardNavigationActive() {
  document.getElementById('popup-app-shell')?.setAttribute('data-keyboard-nav', 'true')
  if (keyboardNavigationSettleTimer) {
    window.clearTimeout(keyboardNavigationSettleTimer)
  }

  keyboardNavigationSettleTimer = window.setTimeout(() => {
    keyboardNavigationSettleTimer = 0
    document.getElementById('popup-app-shell')?.removeAttribute('data-keyboard-nav')
  }, KEYBOARD_NAVIGATION_SETTLE_MS)
}
function clearQueuedKeyboardNavigation() {
  if (activeResultFrame) {
    window.cancelAnimationFrame(activeResultFrame)
    activeResultFrame = 0
  }
  queuedActiveResultIndex = null
  if (activeFolderFrame) {
    window.cancelAnimationFrame(activeFolderFrame)
    activeFolderFrame = 0
  }
  queuedActiveFolderIndex = null
  if (keyboardNavigationSettleTimer) {
    window.clearTimeout(keyboardNavigationSettleTimer)
    keyboardNavigationSettleTimer = 0
  }
  document.getElementById('popup-app-shell')?.removeAttribute('data-keyboard-nav')
}
function switchKeyboardToFolders(sidebarRows: PopupContentFolderRowViewModel[]) {
  state.keyboardPane = 'folders'
  state.activeFolderKeyboardIndex = getFolderPaneKeyboardIndex(sidebarRows, state.selectedFolderFilterId)
  markKeyboardNavigationActive()
  renderMainContent({ preserveScroll: false })
}
function switchKeyboardToBookmarks() {
  const keyboardBookmarks = getKeyboardNavigationBookmarks()
  state.keyboardPane = 'bookmarks'
  state.activeResultIndex = getBookmarkPaneKeyboardIndex(state.activeResultIndex, keyboardBookmarks.length)
  state.activeFolderKeyboardIndex = -1
  markKeyboardNavigationActive()
  renderMainContent({ preserveScroll: false })
}
function queueActiveFolderDelta(delta: number) {
  const sidebarRows = getSidebarFolderRows()
  if (!sidebarRows.length) {
    return
  }
  const baseIndex = queuedActiveFolderIndex ?? state.activeFolderKeyboardIndex
  const nextIndex = baseIndex < 0
    ? (delta < 0 ? sidebarRows.length - 1 : 0)
    : Math.max(0, Math.min(baseIndex + delta, sidebarRows.length - 1))
  if (nextIndex === baseIndex) {
    return
  }
  markKeyboardNavigationActive()
  queuedActiveFolderIndex = nextIndex
  if (activeFolderFrame) {
    return
  }
  activeFolderFrame = window.requestAnimationFrame(flushQueuedActiveFolderIndex)
}
function flushQueuedActiveFolderIndex() {
  activeFolderFrame = 0
  const nextIndex = queuedActiveFolderIndex
  queuedActiveFolderIndex = null
  if (nextIndex === null) {
    return
  }
  setActiveFolderKeyboardIndex(nextIndex)
}
function setActiveFolderKeyboardIndex(nextIndex: number) {
  const sidebarRows = getSidebarFolderRows()
  if (!sidebarRows.length) {
    return
  }
  const clampedIndex = Math.max(0, Math.min(nextIndex, sidebarRows.length - 1))
  if (clampedIndex === state.activeFolderKeyboardIndex) {
    return
  }
  state.activeFolderKeyboardIndex = clampedIndex
  renderMainContent({ preserveScroll: false })
}
function activateFolderKeyboardIndex(nextIndex: number) {
  const sidebarRows = getSidebarFolderRows()
  if (!sidebarRows.length || !Number.isFinite(nextIndex)) {
    return
  }

  const clampedIndex = Math.max(0, Math.min(Math.trunc(nextIndex), sidebarRows.length - 1))
  if (state.keyboardPane === 'folders' && clampedIndex === state.activeFolderKeyboardIndex) {
    return
  }

  state.keyboardPane = 'folders'
  state.activeFolderKeyboardIndex = clampedIndex
  renderMainContent({ preserveScroll: true })
}
function setActiveResultIndex(nextIndex) {
  const keyboardBookmarks = getKeyboardNavigationBookmarks()
  if (!keyboardBookmarks.length) {
    return
  }
  const clampedIndex = Math.max(0, Math.min(nextIndex, keyboardBookmarks.length - 1))
  const shouldActivateBookmarkPane = state.keyboardPane !== 'bookmarks' || state.activeFolderKeyboardIndex >= 0
  if (clampedIndex === state.activeResultIndex && !shouldActivateBookmarkPane) {
    return
  }
  const previousIndex = state.activeResultIndex
  state.keyboardPane = 'bookmarks'
  state.activeFolderKeyboardIndex = -1
  state.activeResultIndex = clampedIndex
  updateActiveSearchResult(previousIndex, clampedIndex)
  renderMainContent({ preserveScroll: false })
}
function activateResultKeyboardIndex(nextIndex: number) {
  const keyboardBookmarks = getKeyboardNavigationBookmarks()
  if (!keyboardBookmarks.length || !Number.isFinite(nextIndex)) {
    return
  }

  const clampedIndex = Math.max(0, Math.min(Math.trunc(nextIndex), keyboardBookmarks.length - 1))
  const shouldActivateBookmarkPane = state.keyboardPane !== 'bookmarks' || state.activeFolderKeyboardIndex >= 0
  if (!shouldActivateBookmarkPane && clampedIndex === state.activeResultIndex) {
    return
  }

  const previousIndex = state.activeResultIndex
  state.keyboardPane = 'bookmarks'
  state.activeFolderKeyboardIndex = -1
  state.activeResultIndex = clampedIndex
  updateActiveSearchResult(previousIndex, clampedIndex)
  renderMainContent({ preserveScroll: true })
}
function getKeyboardNavigationBookmarks() {
  if (state.debouncedQuery) {
    return state.searchResults
  }
  if (state.bookmarkReorderMode) {
    return state.bookmarkReorderOrderIds
      .map((bookmarkId) => state.bookmarkMap.get(bookmarkId))
      .filter((bookmark): bookmark is NonNullable<typeof bookmark> => Boolean(bookmark))
  }
  return getFilteredBookmarks()
}
function updateActiveSearchResult(previousIndex, nextIndex) {
  void previousIndex
  void nextIndex
}
function getCurrentTreeRoot() {
  if (state.selectedFolderFilterId) {
    return findNodeById(state.rawTreeRoot, state.selectedFolderFilterId) || state.bookmarksBarNode
  }
  return state.bookmarksBarNode
}
function getFilteredBookmarks() {
  const cacheKey = state.selectedFolderFilterId || 'all'
  if (state.filteredBookmarksCacheKey === cacheKey) {
    return state.filteredBookmarksCache
  }
  const bookmarks = getFilteredBookmarksForFolder(state.selectedFolderFilterId)
  state.filteredBookmarksCacheKey = cacheKey
  state.filteredBookmarksCache = bookmarks
  return bookmarks
}
function getFilteredBookmarksForFolder(folderId) {
  return folderId
    ? state.allBookmarks.filter((bookmark) => bookmark.ancestorIds.includes(folderId))
    : state.allBookmarks
}
function getSearchCacheKey(normalizedQuery) {
  return `${state.selectedFolderFilterId || 'all'}\u0000${normalizedQuery}`
}
function getNaturalSearchDateBucket() {
  return formatLocalDate(Date.now())
}
function getNaturalSearchPlanCacheKey(normalizedQuery) {
  return `${getNaturalSearchDateBucket()}\u0000${normalizedQuery}`
}
function cacheSearchResults(cacheKey, results) {
  state.searchCache.set(cacheKey, results)
}
function clearSearchCaches() {
  state.searchCache.clear()
  state.naturalSearchPlanCache.clear()
  state.filteredBookmarksCacheKey = ''
  state.filteredBookmarksCache = []
}
function yieldWork() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve)
  })
}
function formatLocalDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function isSmartClassifiableUrl(url) {
  return isExternallyCheckableUrl(url)
}
function getCurrentPageTitle() {
  return String(state.currentTab?.title || '').trim() || '未命名网页'
}
function getSmartFallbackIconLabel(title) {
  const normalized = String(title || '').trim()
  return normalized ? normalized.slice(0, 1).toUpperCase() : 'C'
}
function getSmartLoadingLabel() {
  if (state.smartStep <= 1) {
    return '读取网页内容…'
  }
  if (state.smartStep === 2) {
    return 'AI 分析内容…'
  }
  return '匹配已有文件夹…'
}
function startSmartProgressTicker(runId: number) {
  stopSmartProgressTicker()
  anchorSmartProgress(state.smartProgressPercent)
  if (prefersReducedMotionForSmartProgress()) {
    return
  }

  const tick = () => {
    if (!isSmartLoadingRunActive(runId)) {
      smartProgressTimer = null
      return
    }

    const nextProgress = getSmartEasedProgress(
      state.smartStep,
      smartProgressBase,
      performance.now() - smartProgressBaseAtMs
    )
    if (nextProgress > state.smartProgressPercent) {
      state.smartProgressPercent = nextProgress
      renderSmartClassifier()
    }

    smartProgressTimer = window.setTimeout(tick, SMART_LOADING_PROGRESS_TICK_MS)
  }

  smartProgressTimer = window.setTimeout(tick, SMART_LOADING_PROGRESS_TICK_MS)
}
function prefersReducedMotionForSmartProgress(): boolean {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}
// 每次拿到真实进度就重新落锚，缓动从新数值重新起步（又快又平滑）而不是接着旧曲线的尾巴爬。
function anchorSmartProgress(progress: number): void {
  smartProgressBase = progress
  smartProgressBaseAtMs = performance.now()
}
function stopSmartProgressTicker() {
  cancelSmartProgressFinish()
  if (smartProgressTimer === null) {
    return
  }
  window.clearTimeout(smartProgressTimer)
  smartProgressTimer = null
}
function cancelSmartProgressFinish() {
  if (smartProgressFinishFrame === null) {
    return
  }
  window.cancelAnimationFrame(smartProgressFinishFrame)
  smartProgressFinishFrame = null
}
// 收尾：从当前值 ease-out 补到 100%，再让完成态停留一拍，替代原来的瞬间跳满。
function runSmartProgressFinish(runId: number): Promise<void> {
  stopSmartProgressTicker()

  const from = getSmartDisplayProgress(state.smartProgressPercent, state.smartStep)
  if (prefersReducedMotionForSmartProgress() || from >= 100) {
    state.smartProgressPercent = 100
    renderSmartClassifier()
    return waitForSmartProgressCompletion()
  }

  return new Promise((resolve) => {
    const startedAtMs = performance.now()
    const step = () => {
      if (!isSmartLoadingRunActive(runId)) {
        smartProgressFinishFrame = null
        resolve()
        return
      }

      const ratio = Math.min(1, (performance.now() - startedAtMs) / SMART_LOADING_PROGRESS_FINISH_MS)
      state.smartProgressPercent = getSmartFinishProgress(from, ratio)
      renderSmartClassifier()

      if (ratio >= 1) {
        smartProgressFinishFrame = null
        window.setTimeout(resolve, SMART_LOADING_PROGRESS_SETTLE_HOLD_MS)
        return
      }

      smartProgressFinishFrame = window.requestAnimationFrame(step)
    }

    smartProgressFinishFrame = window.requestAnimationFrame(step)
  })
}
function waitForSmartProgressCompletion() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, SMART_LOADING_PROGRESS_COMPLETE_MS)
      })
    })
  })
}
function cleanSmartTitle(value) {
  const title = cleanSmartText(value, 90)
  return title || getCurrentPageTitle()
}
function cleanSmartText(value, limit = 180) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`
}
function normalizeSmartConfidence(value) {
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(numeric, 1))
  }
  return 0
}
function normalizeSmartFolderPath(value) {
  const segments = splitSmartFolderPath(value)
  return segments.join(' / ')
}
function splitSmartFolderPath(value) {
  return String(value || '')
    .split(/\s*(?:\/|>|›|»|\\)\s*/g).flatMap(segment => { const mappedResult = segment.trim(); return mappedResult ? [mappedResult] : [] })
    .slice(0, 5)
}
function getLastPathSegment(value) {
  const segments = splitSmartFolderPath(value)
  return segments.at(-1) || cleanSmartText(value, 60) || '推荐文件夹'
}
function getSmartFolderTargetPathLabel() {
  const selectedRecommendation = state.smartRecommendations.find((item) => item.id === state.smartSelectedRecommendationId)
  if (selectedRecommendation) {
    return `当前推荐：${formatBookmarkPath(selectedRecommendation.path) || selectedRecommendation.title || '未命名文件夹'}`
  }
  return `当前页面：${displayUrl(state.currentTab?.url || '')}`
}
function normalizeSmartError(error) {
  if (error?.name === 'AbortError') {
    return '请求超时，请稍后重试或调大通用设置中的请求超时。'
  }
  return error instanceof Error ? error.message : '智能分类失败，请稍后重试。'
}
function hasOpenModal() {
  return Boolean(
    state.moveTargetBookmarkId ||
      state.smartFolderPickerOpen ||
      state.aiProviderPromptOpen ||
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
function showToast({ type = 'success', message, action = '', actionLabel = '' }) {
  const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const toast = {
    id,
    type,
    message,
    action,
    actionLabel
  }
  const nextToasts = [...state.toasts, toast]
  const overflowCount = Math.max(0, nextToasts.length - MAX_VISIBLE_TOASTS)
  if (overflowCount) {
    const removedToastIds = getOverflowToastIds(nextToasts, overflowCount)
    removedToastIds.forEach(clearToastTimer)
    state.toasts = nextToasts.filter((nextToast) => {
      return !removedToastIds.has(String(nextToast.id || ''))
    })
  } else {
    state.toasts = nextToasts
  }
  renderToasts()
  if (!state.toasts.some((visibleToast) => visibleToast.id === id)) {
    return
  }
  const timeoutId = window.setTimeout(() => {
    dismissToast(id)
  }, action === 'undo-delete' ? UNDO_WINDOW_MS : 3200)
  state.toastTimers.set(id, timeoutId)
}
function getOverflowToastIds(toasts, overflowCount) {
  const removedToastIds = new Set()
  for (const toast of toasts) {
    if (removedToastIds.size >= overflowCount) {
      break
    }
    if (toast.action) {
      continue
    }
    removedToastIds.add(String(toast.id || ''))
  }
  for (const toast of toasts) {
    if (removedToastIds.size >= overflowCount) {
      break
    }
    const toastId = String(toast.id || '')
    if (removedToastIds.has(toastId)) {
      continue
    }
    removedToastIds.add(toastId)
  }
  return removedToastIds
}
function dismissToast(toastId) {
  if (!toastId) {
    return
  }

  clearToastTimer(toastId)

  state.toasts = state.toasts.filter((toast) => toast.id !== toastId)
  renderToasts()
}
function clearToastTimer(toastId) {
  const timeoutId = state.toastTimers.get(String(toastId))
  if (timeoutId) {
    clearTimeout(timeoutId)
    state.toastTimers.delete(String(toastId))
  }
}
