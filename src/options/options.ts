// @ts-nocheck
import {
  BOOKMARKS_BAR_ID,
  ROOT_ID,
  STORAGE_KEYS,
  RECYCLE_BIN_LIMIT
} from '../shared/constants.js'
import {
  getLocalStorage,
  setLocalStorage
} from '../shared/storage.js'
import {
  getBookmarkTree,
  moveBookmark,
  updateBookmark,
  removeBookmark,
  createBookmark
} from '../shared/bookmarks-api.js'
import {
  extractBookmarkData
} from '../shared/bookmark-tree.js'
import {
  normalizeText,
  stripCommonUrlPrefix,
  normalizeUrl,
  displayUrl,
  extractDomain,
  buildDuplicateKey
} from '../shared/text.js'
import { requestNavigationCheck } from '../shared/messages.js'
import {
  FETCH_TIMEOUT_MS,
  buildNavigationSuccess,
  buildFailureClassification,
  shouldRetryNavigation,
  summarizeNavigationEvidence,
  shouldClassifyAsHighConfidence,
  shouldFallbackToGet,
  classifyProbeResponse,
  classifyProbeError,
  isRedirectedNavigation,
  normalizeNavigationUrl
} from './sections/classifier.js'
import {
  SECTION_META,
  NAVIGATION_TIMEOUT_MS,
  NAVIGATION_RETRY_TIMEOUT_MS,
  AVAILABILITY_CONCURRENCY,
  AI_NAMING_DEFAULT_BASE_URL,
  AI_NAMING_DEFAULT_MODEL,
  AI_NAMING_DEFAULT_TIMEOUT_MS,
  AI_NAMING_DEFAULT_BATCH_SIZE,
  AI_NAMING_MAX_BATCH_SIZE,
  AI_NAMING_MAX_TEXT_LENGTH,
  AI_NAMING_MANAGE_MODELS_VALUE,
  AI_NAMING_PRESET_MODELS,
  AI_NAMING_RESPONSE_SCHEMA
} from './shared-options/constants.js'
import {
  availabilityState,
  managerState,
  aiNamingState,
  aiNamingManagerState,
  createEmptyIgnoreRules,
  createEmptyRedirectCache,
  createDefaultAiNamingSettings
} from './shared-options/state.js'
import { dom, cacheDom } from './shared-options/dom.js'
import { escapeHtml, escapeAttr } from './shared-options/html.js'
import {
  isInteractionLocked,
  compareByPathTitle,
  syncSelectionSet,
  formatDateTime,
  setModalHidden
} from './shared-options/utils.js'
import {
  normalizeIgnoreRules,
  serializeIgnoreRules,
  saveIgnoreRules,
  matchesIgnoreRules,
  renderIgnoreSection,
  handleIgnoreRulesClick,
  clearIgnoreRules
} from './sections/ignore.js'
import {
  normalizeRecycleBin,
  saveRecycleBin,
  renderRecycleSection,
  handleRecycleResultsClick,
  clearRecycleSelection,
  selectAllRecycleEntries,
  restoreSelectedRecycleEntries,
  clearRecycleBin,
  deleteBookmarksToRecycle
} from './sections/recycle.js'
import {
  buildDuplicateGroups,
  renderDuplicateSection,
  handleDuplicateGroupsClick,
  clearDuplicateSelection,
  deleteSelectedDuplicates
} from './sections/duplicates.js'
import {
  normalizeRedirectCache,
  saveRedirectCache,
  synchronizeRedirectResults,
  getRedirectSectionState,
  persistRedirectCacheSnapshot,
  removeRedirectIdsFromState,
  renderRedirectSection,
  handleRedirectResultsClick,
  clearRedirectSelection,
  selectAllRedirects,
  updateSelectedRedirects,
  deleteSelectedRedirects,
  deleteAllRedirects
} from './sections/redirects.js'
import {
  hydrateDetectionHistory,
  getHistoryRunsForScope,
  getHistoricalAbnormalStreak,
  syncHistoryComparisonScope,
  finalizeDetectionHistory,
  renderAvailabilityHistory,
  clearDetectionHistoryLogs,
  toggleHistoryLogsCollapsed,
  syncHistoryEntryStatus,
  upsertAvailabilityHistoryEntry
} from './sections/history.js'

let availabilityRenderFrame = 0
let availabilityPauseResolvers = []

const recycleCallbacks = {
  renderAvailabilitySection,
  hydrateAvailabilityCatalog,
  getBookmarkRecord,
  removeDeletedResultsFromState,
  saveRedirectCache
}

const duplicatesCallbacks = {
  renderAvailabilitySection,
  recycleCallbacks
}

const redirectsCallbacks = {
  renderAvailabilitySection,
  getCurrentAvailabilityScopeMeta,
  hydrateAvailabilityCatalog,
  recycleCallbacks
}

const historyCallbacks = {
  renderAvailabilitySection,
  getCurrentAvailabilityScopeMeta
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom()
  bindEvents()

  if (!SECTION_META[getCurrentSectionKey()]) {
    window.history.replaceState(null, '', '#availability')
  }

  syncPageSection()
  window.addEventListener('hashchange', syncPageSection)

  await hydratePersistentState()
  await hydrateAvailabilityCatalog()
  await hydrateProbePermission()
  await hydrateAiNamingPermissionState()
  renderAvailabilitySection()
})

async function hydratePersistentState() {
  availabilityState.storageLoading = true
  scheduleAvailabilityRender()

  try {
    const stored = await getLocalStorage([
      STORAGE_KEYS.ignoreRules,
      STORAGE_KEYS.detectionHistory,
      STORAGE_KEYS.redirectCache,
      STORAGE_KEYS.recycleBin,
      STORAGE_KEYS.aiNamingSettings
    ])

    managerState.ignoreRules = normalizeIgnoreRules(stored[STORAGE_KEYS.ignoreRules])
    hydrateDetectionHistory(stored[STORAGE_KEYS.detectionHistory], historyCallbacks)
    managerState.redirectCache = normalizeRedirectCache(stored[STORAGE_KEYS.redirectCache])
    managerState.recycleBin = normalizeRecycleBin(stored[STORAGE_KEYS.recycleBin])
    aiNamingManagerState.settings = normalizeAiNamingSettings(stored[STORAGE_KEYS.aiNamingSettings])
  } catch (error) {
    availabilityState.lastError =
      error instanceof Error ? error.message : '本地规则读取失败，请刷新页面后重试。'
  } finally {
    availabilityState.storageLoading = false
    renderAvailabilitySection()
  }
}

function normalizeAiNamingSettings(rawSettings) {
  const defaults = createDefaultAiNamingSettings()
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {}
  const apiStyle = String(source.apiStyle || defaults.apiStyle).trim()
  const timeoutMs = Number(source.timeoutMs)
  const batchSize = Number(source.batchSize)

  return {
    baseUrl: String(source.baseUrl || defaults.baseUrl).trim() || defaults.baseUrl,
    apiKey: String(source.apiKey || defaults.apiKey).trim(),
    model: String(source.model || defaults.model).trim() || defaults.model,
    customModels: normalizeAiNamingCustomModels(source.customModels),
    apiStyle: apiStyle === 'chat_completions' ? 'chat_completions' : 'responses',
    timeoutMs: Number.isFinite(timeoutMs) ? Math.max(5000, Math.min(timeoutMs, 120000)) : defaults.timeoutMs,
    batchSize: Number.isFinite(batchSize)
      ? Math.max(1, Math.min(Math.round(batchSize), AI_NAMING_MAX_BATCH_SIZE))
      : defaults.batchSize,
    autoSelectHighConfidence:
      typeof source.autoSelectHighConfidence === 'boolean'
        ? source.autoSelectHighConfidence
        : defaults.autoSelectHighConfidence,
    systemPrompt: String(source.systemPrompt || defaults.systemPrompt).trim()
  }
}

function normalizeAiNamingCustomModels(rawModels) {
  const values = Array.isArray(rawModels)
    ? rawModels
    : typeof rawModels === 'string'
      ? rawModels.split(/[\n,;]+/g)
      : []
  const seen = new Set()

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const normalized = normalizeText(value)
      if (!normalized || seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
    .slice(0, 40)
}

function serializeAiNamingSettings(settings = aiNamingManagerState.settings) {
  const normalized = normalizeAiNamingSettings(settings)
  return {
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
    customModels: normalized.customModels.slice(),
    apiStyle: normalized.apiStyle,
    timeoutMs: normalized.timeoutMs,
    batchSize: normalized.batchSize,
    autoSelectHighConfidence: normalized.autoSelectHighConfidence,
    systemPrompt: normalized.systemPrompt
  }
}

async function saveAiNamingSettings(settings = aiNamingManagerState.settings) {
  aiNamingManagerState.settings = normalizeAiNamingSettings(settings)
  await setLocalStorage({
    [STORAGE_KEYS.aiNamingSettings]: serializeAiNamingSettings(aiNamingManagerState.settings)
  })
}

function syncPageSection() {
  const rawKey = getCurrentSectionKey()
  const key = SECTION_META[rawKey] ? rawKey : 'availability'
  const section = SECTION_META[key]
  const links = document.querySelectorAll('[data-section-link]')
  const panels = document.querySelectorAll('[data-section-panel]')

  if (rawKey !== key) {
    window.history.replaceState(null, '', `#${key}`)
  }

  links.forEach((link) => {
    const isActive = link.getAttribute('data-section-link') === key
    link.classList.toggle('active', isActive)
    if (isActive) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })

  panels.forEach((panel) => {
    panel.hidden = panel.getAttribute('data-section-panel') !== key
  })

  document.title = `${section.title} · 黑曜书签`
}


function bindEvents() {
  const ignoreCallbacks = {
    onIgnoreRulesChanged() {
      repartitionAvailabilityResultsByIgnoreRules()
      renderAvailabilitySection()
    }
  }


  dom.availabilityScopeTrigger?.addEventListener('click', () => openScopeModal('availability'))
  dom.historyScopeTrigger?.addEventListener('click', () => openScopeModal('history'))
  dom.aiScopeTrigger?.addEventListener('click', () => openScopeModal('ai'))
  dom.aiSaveSettings?.addEventListener('click', saveAiNamingSettingsFromDom)
  dom.aiTestConnection?.addEventListener('click', handleAiConnectivityTest)
  dom.aiAction?.addEventListener('click', handleAiNamingAction)
  dom.aiStopAction?.addEventListener('click', requestAiNamingStop)
  dom.aiSelectAll?.addEventListener('click', selectAllAiNamingResults)
  dom.aiSelectHighConfidence?.addEventListener('click', selectHighConfidenceAiResults)
  dom.aiClearSelection?.addEventListener('click', clearAiNamingSelection)
  dom.aiApplySelection?.addEventListener('click', applySelectedAiNamingResults)
  dom.aiResults?.addEventListener('click', handleAiResultsClick)
  dom.aiResults?.addEventListener('change', handleAiResultsChange)
  dom.aiBaseUrl?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiApiKey?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiRevealApiKey?.addEventListener('change', handleAiRevealApiKeyChange)
  dom.aiModelSelect?.addEventListener('change', handleAiModelSelectChange)
  dom.aiManageModels?.addEventListener('click', openAiModelModal)
  dom.aiApiStyle?.addEventListener('change', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiTimeoutMs?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiBatchSize?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiAutoSelectHigh?.addEventListener('change', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.aiSystemPrompt?.addEventListener('input', () => syncAiNamingSettingsDraftFromDom({ markDirty: true }))
  dom.availabilityAction?.addEventListener('click', handleAvailabilityAction)
  dom.availabilityPauseAction?.addEventListener('click', toggleAvailabilityPause)
  dom.availabilityStopAction?.addEventListener('click', requestAvailabilityStop)
  dom.availabilityReviewResults?.addEventListener('click', handleReviewResultAction)
  dom.availabilityResults?.addEventListener('click', handleFailedResultAction)
  dom.availabilityClearHistory?.addEventListener('click', () => clearDetectionHistoryLogs(historyCallbacks))
  dom.availabilityToggleHistoryLogs?.addEventListener('click', () => toggleHistoryLogsCollapsed(historyCallbacks))
  dom.availabilityClearSelection?.addEventListener('click', clearAvailabilitySelection)
  dom.availabilitySelectionRetest?.addEventListener('click', retestSelectedAvailabilityResults)
  dom.availabilitySelectionPromote?.addEventListener('click', () => {
    moveSelectedAvailabilityResults('failed')
  })
  dom.availabilitySelectionDemote?.addEventListener('click', () => {
    moveSelectedAvailabilityResults('review')
  })
  dom.availabilitySelectionMove?.addEventListener('click', () => {
    openMoveModal('availability')
  })
  dom.availabilitySelectionIgnoreBookmark?.addEventListener('click', () => {
    ignoreSelectedAvailabilityResults('bookmark')
  })
  dom.availabilitySelectionIgnoreDomain?.addEventListener('click', () => {
    ignoreSelectedAvailabilityResults('domain')
  })
  dom.availabilitySelectionIgnoreFolder?.addEventListener('click', () => {
    ignoreSelectedAvailabilityResults('folder')
  })
  dom.availabilitySelectionDelete?.addEventListener('click', deleteSelectedAvailabilityResults)
  dom.availabilitySelectAllReview?.addEventListener('click', () => {
    selectAvailabilityResultsByStatus('review')
  })
  dom.availabilitySelectAllFailed?.addEventListener('click', () => {
    selectAvailabilityResultsByStatus('failed')
  })
  dom.redirectResults?.addEventListener('click', (event) => handleRedirectResultsClick(event, redirectsCallbacks))
  dom.redirectClearSelection?.addEventListener('click', () => clearRedirectSelection(redirectsCallbacks))
  dom.redirectBatchUpdate?.addEventListener('click', () => updateSelectedRedirects(redirectsCallbacks))
  dom.redirectDeleteSelection?.addEventListener('click', () => deleteSelectedRedirects(redirectsCallbacks))
  dom.redirectSelectAll?.addEventListener('click', () => selectAllRedirects(redirectsCallbacks))
  dom.redirectDeleteAll?.addEventListener('click', () => deleteAllRedirects(redirectsCallbacks))
  dom.duplicateGroups?.addEventListener('click', (event) => handleDuplicateGroupsClick(event, duplicatesCallbacks))
  dom.duplicateClearSelection?.addEventListener('click', () => clearDuplicateSelection(duplicatesCallbacks))
  dom.duplicateDeleteSelection?.addEventListener('click', () => deleteSelectedDuplicates(duplicatesCallbacks))
  dom.ignoreBookmarkRules?.addEventListener('click', (event) => handleIgnoreRulesClick(event, ignoreCallbacks))
  dom.ignoreDomainRules?.addEventListener('click', (event) => handleIgnoreRulesClick(event, ignoreCallbacks))
  dom.ignoreFolderRules?.addEventListener('click', (event) => handleIgnoreRulesClick(event, ignoreCallbacks))
  dom.ignoreClearBookmarks?.addEventListener('click', () => clearIgnoreRules('bookmark', ignoreCallbacks))
  dom.ignoreClearDomains?.addEventListener('click', () => clearIgnoreRules('domain', ignoreCallbacks))
  dom.ignoreClearFolders?.addEventListener('click', () => clearIgnoreRules('folder', ignoreCallbacks))
  dom.recycleResults?.addEventListener('click', (event) => handleRecycleResultsClick(event, recycleCallbacks))
  dom.recycleClearSelection?.addEventListener('click', () => clearRecycleSelection(recycleCallbacks))
  dom.recycleRestoreSelection?.addEventListener('click', () => restoreSelectedRecycleEntries(recycleCallbacks))
  dom.recycleSelectAll?.addEventListener('click', () => selectAllRecycleEntries(recycleCallbacks))
  dom.recycleClearAll?.addEventListener('click', () => clearRecycleBin(recycleCallbacks))
  dom.deleteFailedBookmarks?.addEventListener('click', openDeleteModal)
  dom.cancelDeleteModal?.addEventListener('click', closeDeleteModal)
  dom.confirmDeleteModal?.addEventListener('click', confirmDeleteFailedBookmarks)
  dom.moveSearchInput?.addEventListener('input', (event) => {
    managerState.moveSearchQuery = event.target.value
    renderMoveModal()
  })
  dom.moveFolderResults?.addEventListener('click', handleMoveFolderResultsClick)
  dom.cancelMoveModal?.addEventListener('click', closeMoveModal)
  dom.scopeSearchInput?.addEventListener('input', (event) => {
    managerState.scopeSearchQuery = event.target.value
    renderScopeModal()
  })
  dom.scopeFolderResults?.addEventListener('click', handleScopeFolderResultsClick)
  dom.cancelScopeModal?.addEventListener('click', closeScopeModal)
  dom.closeAiModelModal?.addEventListener('click', closeAiModelModal)
  dom.cancelAiModelModal?.addEventListener('click', closeAiModelModal)
  dom.saveAiModelModal?.addEventListener('click', saveAiModelModalSettings)
  document.addEventListener('keydown', handleKeydown)
  dom.deleteModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.deleteModalBackdrop) {
      closeDeleteModal()
    }
  })
  dom.moveModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.moveModalBackdrop) {
      closeMoveModal()
    }
  })
  dom.scopeModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.scopeModalBackdrop) {
      closeScopeModal()
    }
  })
  dom.aiModelModalBackdrop?.addEventListener('click', (event) => {
    if (event.target === dom.aiModelModalBackdrop) {
      closeAiModelModal()
    }
  })
}

function getCurrentSectionKey() {
  return window.location.hash.replace(/^#/, '') || 'availability'
}

function handleKeydown(event) {
  if (event.key !== 'Escape') {
    return
  }

  if (managerState.aiModelModalOpen) {
    event.preventDefault()
    closeAiModelModal()
    return
  }

  if (managerState.scopeModalOpen) {
    event.preventDefault()
    closeScopeModal()
    return
  }

  if (managerState.moveModalOpen) {
    event.preventDefault()
    closeMoveModal()
    return
  }

  if (availabilityState.deleteModalOpen) {
    event.preventDefault()
    closeDeleteModal()
  }
}

function handleReviewResultAction(event) {
  const selectionInput = event.target.closest('input[data-availability-select]')
  if (selectionInput) {
    toggleAvailabilitySelection(selectionInput.getAttribute('data-bookmark-id'), selectionInput.checked)
    return
  }

  const actionButton = event.target.closest('[data-review-action="promote-failed"]')
  if (
    !actionButton ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  const bookmarkId = String(actionButton.getAttribute('data-bookmark-id') || '').trim()
  if (!bookmarkId) {
    return
  }

  promoteReviewResultToFailed(bookmarkId)
}

function handleFailedResultAction(event) {
  const selectionInput = event.target.closest('input[data-availability-select]')
  if (selectionInput) {
    toggleAvailabilitySelection(selectionInput.getAttribute('data-bookmark-id'), selectionInput.checked)
    return
  }

  const actionButton = event.target.closest('[data-failed-action="demote-review"]')
  if (
    !actionButton ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  const bookmarkId = String(actionButton.getAttribute('data-bookmark-id') || '').trim()
  if (!bookmarkId) {
    return
  }

  demoteFailedResultToReview(bookmarkId)
}

async function hydrateAvailabilityCatalog({ preserveResults = false } = {}) {
  availabilityState.catalogLoading = true
  availabilityState.lastError = ''
  scheduleAvailabilityRender()

  try {
    const tree = await getBookmarkTree()
    const rootNode = Array.isArray(tree) ? tree[0] : tree
    const extracted = extractBookmarkData(rootNode)
    const bookmarks = extracted.bookmarks

    availabilityState.allBookmarks = bookmarks
    availabilityState.allFolders = extracted.folders
    availabilityState.bookmarkMap = extracted.bookmarkMap
    availabilityState.folderMap = extracted.folderMap
    managerState.duplicateGroups = buildDuplicateGroups(bookmarks)
    applyAvailabilityScope({ preserveResults })
    syncAiNamingCatalog({ preserveResults })
  } catch (error) {
    availabilityState.allBookmarks = []
    availabilityState.allFolders = []
    availabilityState.bookmarkMap = new Map()
    availabilityState.folderMap = new Map()
    availabilityState.bookmarks = []
    availabilityState.requestOrigins = []
    availabilityState.totalBookmarks = 0
    availabilityState.eligibleBookmarks = 0
    availabilityState.skippedCount = 0
    resetDetectionResults()
    managerState.duplicateGroups = []
    syncAiNamingCatalog({ preserveResults: false })
    availabilityState.lastError =
      error instanceof Error ? error.message : '书签列表读取失败，请刷新页面后重试。'
  } finally {
    availabilityState.catalogLoading = false
    renderAvailabilitySection()
  }
}

async function hydrateProbePermission() {
  availabilityState.permissionPending = true
  scheduleAvailabilityRender()

  try {
    if (!availabilityState.requestOrigins.length) {
      availabilityState.probePermissionGranted = false
      return
    }

    availabilityState.probePermissionGranted = await containsPermissions({
      origins: availabilityState.requestOrigins
    })
  } catch (error) {
    availabilityState.probePermissionGranted = false
  } finally {
    availabilityState.permissionPending = false
    renderAvailabilitySection()
  }
}

function applyAvailabilityScope({ preserveResults = false } = {}) {
  if (availabilityState.scopeFolderId && !availabilityState.folderMap.has(String(availabilityState.scopeFolderId))) {
    availabilityState.scopeFolderId = ''
  }

  const scopedBookmarks = getScopedBookmarks()
  const eligibleBookmarks = scopedBookmarks.filter((bookmark) => isCheckableUrl(bookmark.url))

  availabilityState.bookmarks = eligibleBookmarks
  availabilityState.requestOrigins = collectRequestOrigins(eligibleBookmarks)
  availabilityState.totalBookmarks = scopedBookmarks.length
  availabilityState.eligibleBookmarks = eligibleBookmarks.length
  availabilityState.skippedCount = Math.max(scopedBookmarks.length - eligibleBookmarks.length, 0)

  syncHistoryComparisonScope(historyCallbacks)

  if (preserveResults) {
    reconcileCatalogAfterMutation()
  } else {
    resetCurrentAvailabilityRunState()
    clearAvailabilitySelection()
    clearRedirectSelection(redirectsCallbacks)
    clearDuplicateSelection(duplicatesCallbacks)
    clearRecycleSelection(recycleCallbacks)
  }

  if (!eligibleBookmarks.length) {
    availabilityState.lastError = '当前检测范围内没有可检测的 http/https 书签。'
  }
}

function getScopedBookmarks() {
  if (!availabilityState.scopeFolderId) {
    return availabilityState.allBookmarks.slice()
  }

  return availabilityState.allBookmarks.filter((bookmark) => {
    return (bookmark.ancestorIds || []).includes(String(availabilityState.scopeFolderId))
  })
}

function getCurrentAvailabilityScopeMeta() {
  const folderId = String(availabilityState.scopeFolderId || '').trim()
  if (!folderId) {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  }

  const folder = availabilityState.folderMap.get(folderId)
  return {
    key: `folder:${folderId}`,
    type: 'folder',
    folderId,
    label: folder?.path || folder?.title || '指定文件夹'
  }
}

function getAiNamingScopedBookmarks() {
  if (!aiNamingState.scopeFolderId) {
    return availabilityState.allBookmarks.slice()
  }

  return availabilityState.allBookmarks.filter((bookmark) => {
    return (bookmark.ancestorIds || []).includes(String(aiNamingState.scopeFolderId))
  })
}

function getCurrentAiNamingScopeMeta() {
  const folderId = String(aiNamingState.scopeFolderId || '').trim()
  if (!folderId) {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  }

  const folder = availabilityState.folderMap.get(folderId)
  return {
    key: `folder:${folderId}`,
    type: 'folder',
    folderId,
    label: folder?.path || folder?.title || '指定文件夹'
  }
}

function resetAiNamingRunState() {
  aiNamingState.checkedBookmarks = 0
  aiNamingState.suggestedCount = 0
  aiNamingState.manualReviewCount = 0
  aiNamingState.unchangedCount = 0
  aiNamingState.highConfidenceCount = 0
  aiNamingState.mediumConfidenceCount = 0
  aiNamingState.lowConfidenceCount = 0
  aiNamingState.failedCount = 0
  aiNamingState.results = []
  aiNamingState.selectedResultIds = new Set()
  aiNamingState.lastCompletedAt = 0
  aiNamingState.lastError = ''
}

function syncAiNamingCatalog({ preserveResults = false } = {}) {
  if (aiNamingState.scopeFolderId && !availabilityState.folderMap.has(String(aiNamingState.scopeFolderId))) {
    aiNamingState.scopeFolderId = ''
  }

  const scopedBookmarks = getAiNamingScopedBookmarks()
  const eligibleBookmarks = scopedBookmarks.filter((bookmark) => isCheckableUrl(bookmark.url))
  aiNamingState.bookmarks = eligibleBookmarks
  aiNamingState.requestOrigins = collectRequestOrigins(eligibleBookmarks)
  aiNamingState.eligibleBookmarks = eligibleBookmarks.length

  if (preserveResults) {
    aiNamingState.results = syncAiNamingResultMetadata(aiNamingState.results)
    syncSelectionSet(
      aiNamingState.selectedResultIds,
      new Set(
        aiNamingState.results
          .filter((result) => result.status === 'suggested')
          .map((result) => String(result.id))
      )
    )
    recalculateAiNamingSummary()
  } else if (!aiNamingState.running && !aiNamingState.applying) {
    resetAiNamingRunState()
  }
}

function syncAiNamingResultMetadata(results) {
  return results
    .map((result) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(result.id))
      if (!latestBookmark) {
        return null
      }

      return {
        ...result,
        status:
          result.status === 'suggested' &&
          normalizeText(String(result.suggestedTitle || '')) === normalizeText(latestBookmark.title)
            ? 'unchanged'
            : result.status,
        currentTitle: latestBookmark.title,
        url: latestBookmark.url,
        displayUrl: latestBookmark.displayUrl,
        path: latestBookmark.path,
        domain: latestBookmark.domain,
        ancestorIds: latestBookmark.ancestorIds,
        parentId: latestBookmark.parentId,
        index: latestBookmark.index
      }
    })
    .filter(Boolean)
}

function recalculateAiNamingSummary() {
  aiNamingState.suggestedCount = aiNamingState.results.filter((result) => result.status === 'suggested').length
  aiNamingState.manualReviewCount = aiNamingState.results.filter((result) => result.status === 'manual_review').length
  aiNamingState.unchangedCount = aiNamingState.results.filter((result) => result.status === 'unchanged').length
  aiNamingState.failedCount = aiNamingState.results.filter((result) => result.status === 'failed').length
  aiNamingState.highConfidenceCount = aiNamingState.results.filter((result) => result.confidence === 'high').length
  aiNamingState.mediumConfidenceCount = aiNamingState.results.filter((result) => result.confidence === 'medium').length
  aiNamingState.lowConfidenceCount = aiNamingState.results.filter((result) => result.confidence === 'low').length
}

async function hydrateAiNamingPermissionState() {
  aiNamingState.requestingPermission = true
  scheduleAvailabilityRender()

  try {
    const permissionOrigins = getAiNamingPermissionOrigins()
    if (!permissionOrigins.length) {
      aiNamingState.permissionGranted = false
      return
    }

    aiNamingState.permissionGranted = await containsPermissions({
      origins: permissionOrigins
    })
  } catch (error) {
    aiNamingState.permissionGranted = false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

function resetCurrentAvailabilityRunState() {
  resetDetectionResults()
  availabilityState.lastCompletedAt = 0
  availabilityState.lastRunOutcome = ''
  availabilityState.currentRunProbeEnabled = false
  availabilityState.retestingSelection = false
  availabilityState.retestSelectionTotal = 0
  availabilityState.retestSelectionCompleted = 0
  availabilityState.retestSelectionProbeEnabled = false
}

async function ensureProbePermissionForRun({ interactive = true } = {}) {
  if (!availabilityState.requestOrigins.length) {
    availabilityState.probePermissionGranted = false
    return false
  }

  if (availabilityState.probePermissionGranted) {
    return true
  }

  if (!interactive) {
    return false
  }

  availabilityState.requestingPermission = true
  scheduleAvailabilityRender()

  try {
    availabilityState.probePermissionGranted = await requestPermissions({
      origins: availabilityState.requestOrigins
    })
    return availabilityState.probePermissionGranted
  } catch (error) {
    availabilityState.probePermissionGranted = false
    return false
  } finally {
    availabilityState.requestingPermission = false
    renderAvailabilitySection()
  }
}

async function handleAvailabilityAction() {
  if (
    availabilityState.running ||
    availabilityState.retestingSelection ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    availabilityState.deleting
  ) {
    return
  }

  if (!availabilityState.bookmarks.length) {
    availabilityState.lastError = '当前没有可检测的 http/https 书签。'
    renderAvailabilitySection()
    return
  }

  const probeEnabled = await ensureProbePermissionForRun({ interactive: true })
  availabilityState.currentRunProbeEnabled = probeEnabled
  await runAvailabilityDetection({ probeEnabled })
}

async function handleAvailabilityScopeChange(nextScopeFolderId) {
  availabilityState.lastError = ''
  availabilityState.scopeFolderId = String(nextScopeFolderId || '').trim()
  applyAvailabilityScope({ preserveResults: false })
  renderAvailabilitySection()
  await hydrateProbePermission()
}

function toggleAvailabilityPause() {
  if (!availabilityState.running || availabilityState.deleting || availabilityState.stopRequested) {
    return
  }

  availabilityState.paused = !availabilityState.paused

  if (!availabilityState.paused) {
    releaseAvailabilityPauseResolvers()
  }

  renderAvailabilitySection()
}

function requestAvailabilityStop() {
  if (!availabilityState.running || availabilityState.deleting || availabilityState.stopRequested) {
    return
  }

  availabilityState.stopRequested = true
  availabilityState.paused = false
  releaseAvailabilityPauseResolvers()
  renderAvailabilitySection()
}

async function runAvailabilityDetection({ probeEnabled }) {
  const redirectCacheScope = getCurrentAvailabilityScopeMeta()
  availabilityState.running = true
  availabilityState.paused = false
  availabilityState.stopRequested = false
  availabilityState.lastError = ''
  availabilityState.lastCompletedAt = 0
  availabilityState.lastRunOutcome = ''
  availabilityState.runQueue = availabilityState.bookmarks.slice()
  availabilityState.deletedBookmarkIds = new Set()
  resetDetectionResults()
  clearAvailabilitySelection()
  clearRedirectSelection(redirectsCallbacks)
  renderAvailabilitySection()

  try {
    let nextIndex = 0
    const workerCount = Math.min(AVAILABILITY_CONCURRENCY, availabilityState.runQueue.length)

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < availabilityState.runQueue.length) {
          const canContinue = await waitForAvailabilityRun()
          if (!canContinue) {
            return
          }

          const currentIndex = nextIndex
          nextIndex += 1

          const bookmark = availabilityState.runQueue[currentIndex]
          if (!bookmark || isBookmarkRemovedDuringRun(bookmark.id)) {
            continue
          }

          const result = await inspectBookmarkAvailability(bookmark, { probeEnabled })
          if (!result) {
            if (availabilityState.stopRequested) {
              return
            }
            continue
          }

          if (isBookmarkRemovedDuringRun(result.id)) {
            continue
          }

          applyAvailabilityResult(result)
        }
      })
    )

    sortResultsByPath(availabilityState.reviewResults)
    sortResultsByPath(availabilityState.failedResults)
    sortResultsByPath(availabilityState.redirectResults)
    if (!availabilityState.stopRequested) {
      await finalizeDetectionHistory(historyCallbacks)
    }
    availabilityState.lastCompletedAt = Date.now()
    availabilityState.lastRunOutcome = availabilityState.stopRequested ? 'stopped' : 'completed'
  } catch (error) {
    availabilityState.lastRunOutcome = ''
    availabilityState.lastError =
      error instanceof Error ? error.message : '书签可用性检测失败，请稍后重试。'
  } finally {
    availabilityState.running = false
    availabilityState.paused = false
    availabilityState.stopRequested = false
    availabilityState.runQueue = []
    availabilityState.deletedBookmarkIds = new Set()
    releaseAvailabilityPauseResolvers()
    try {
      await persistRedirectCacheSnapshot(redirectsCallbacks, {
        savedAt: availabilityState.lastCompletedAt || Date.now(),
        scope: redirectCacheScope
      })
    } catch {}
    renderAvailabilitySection()
  }
}

async function inspectBookmarkAvailability(bookmark, { probeEnabled }) {
  if (!(await waitForAvailabilityRun())) {
    return null
  }

  const attempts = []

  const firstNavigation = await runNavigationAttempt(bookmark.url, NAVIGATION_TIMEOUT_MS)
  if (availabilityState.stopRequested) {
    return null
  }
  attempts.push(firstNavigation)

  if (firstNavigation.status === 'available') {
    return buildNavigationSuccess(bookmark, firstNavigation, '首轮后台导航成功')
  }

  if (shouldRetryNavigation(firstNavigation)) {
    if (!(await waitForAvailabilityRun())) {
      return null
    }

    const secondNavigation = await runNavigationAttempt(bookmark.url, NAVIGATION_RETRY_TIMEOUT_MS)
    if (availabilityState.stopRequested) {
      return null
    }
    attempts.push(secondNavigation)

    if (secondNavigation.status === 'available') {
      return buildNavigationSuccess(bookmark, secondNavigation, '二次后台导航成功')
    }
  }

  let probe = null
  if (probeEnabled) {
    if (!(await waitForAvailabilityRun())) {
      return null
    }

    probe = await probeBookmarkUrl(bookmark.url)
    if (availabilityState.stopRequested) {
      return null
    }
  }

  return buildFailureClassification(bookmark, attempts, probe, probeEnabled)
}

async function waitForAvailabilityRun() {
  while (availabilityState.paused && !availabilityState.stopRequested) {
    await new Promise((resolve) => {
      availabilityPauseResolvers.push(resolve)
    })
  }

  return !availabilityState.stopRequested
}

function releaseAvailabilityPauseResolvers() {
  const resolvers = availabilityPauseResolvers
  availabilityPauseResolvers = []

  resolvers.forEach((resolve) => {
    resolve()
  })
}

function isBookmarkRemovedDuringRun(bookmarkId) {
  return availabilityState.deletedBookmarkIds.has(String(bookmarkId || '').trim())
}

async function runNavigationAttempt(url, timeoutMs) {
  try {
    const result = await requestNavigationCheck(url, timeoutMs)

    return {
      status: result?.status || 'failed',
      finalUrl: result?.finalUrl || url,
      detail: result?.detail || '后台导航失败。',
      errorCode: result?.errorCode || ''
    }
  } catch (error) {
    return {
      status: 'failed',
      finalUrl: url,
      detail: error instanceof Error ? error.message : '后台导航失败。',
      errorCode: 'runtime-message-failed'
    }
  }
}

async function probeBookmarkUrl(url) {
  try {
    const headResponse = await fetchWithTimeout(url, 'HEAD')
    if (!shouldFallbackToGet(headResponse.status)) {
      return classifyProbeResponse(headResponse, 'HEAD')
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        kind: 'unknown',
        method: 'HEAD',
        label: '探测超时',
        detail: `网络探测超时，超过 ${Math.round(FETCH_TIMEOUT_MS / 1000)} 秒仍未返回。`
      }
    }
  }

  try {
    const getResponse = await fetchWithTimeout(url, 'GET')
    return classifyProbeResponse(getResponse, 'GET')
  } catch (error) {
    return classifyProbeError(error)
  }
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, {
      method,
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchWithRequestTimeout(url, options = {}, timeoutMs = AI_NAMING_DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, Math.max(1000, Number(timeoutMs) || AI_NAMING_DEFAULT_TIMEOUT_MS))

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

function applyAvailabilityResult(result) {
  availabilityState.checkedBookmarks += 1

  if (result.status === 'available') {
    availabilityState.availableCount += 1
    scheduleAvailabilityRender()
    return
  }

  if (result.status === 'redirected') {
    availabilityState.redirectedCount += 1
    availabilityState.redirectResults.push({
      ...result,
      finalUrl: result.finalUrl || result.url
    })
    scheduleAvailabilityRender()
    return
  }

  const historyStatus = managerState.previousHistoryMap.has(result.id) ? 'persistent' : 'new'
  const abnormalStreak = managerState.previousHistoryMap.has(result.id)
    ? getHistoricalAbnormalStreak(result.id, historyCallbacks) + 1
    : 1
  const nextResult = {
    ...result,
    historyStatus,
    abnormalStreak
  }

  managerState.currentHistoryEntries.push({
    id: nextResult.id,
    title: nextResult.title,
    url: nextResult.url,
    path: nextResult.path,
    status: nextResult.status,
    streak: abnormalStreak
  })

  if (matchesIgnoreRules(nextResult)) {
    managerState.suppressedResults.push(nextResult)
    availabilityState.ignoredCount = managerState.suppressedResults.length
    scheduleAvailabilityRender()
    return
  }

  if (nextResult.status === 'review') {
    availabilityState.reviewResults.push(nextResult)
    availabilityState.reviewCount = availabilityState.reviewResults.length
  } else {
    availabilityState.failedResults.push(nextResult)
    availabilityState.failedCount = availabilityState.failedResults.length
  }

  scheduleAvailabilityRender()
}

function renderAvailabilitySection() {
  if (!dom.availabilityAction) {
    return
  }

  synchronizeRedirectResults()
  renderAvailabilityScopeControls()
  const scopeMeta = getCurrentAvailabilityScopeMeta()

  dom.availabilityPermissionBadge.className = `options-chip ${getModeBadgeTone()}`
  dom.availabilityPermissionBadge.textContent = getModeBadgeText()
  dom.availabilityPermissionCopy.textContent = getModeCopyText()

  dom.availabilityAction.disabled =
    availabilityState.running ||
    availabilityState.retestingSelection ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    availabilityState.deleting
  dom.availabilityAction.textContent = getAvailabilityActionText()
  dom.availabilityPauseAction?.classList.toggle('hidden', !availabilityState.running)
  dom.availabilityStopAction?.classList.toggle('hidden', !availabilityState.running)

  if (dom.availabilityPauseAction) {
    dom.availabilityPauseAction.disabled =
      !availabilityState.running ||
      availabilityState.deleting ||
      availabilityState.stopRequested
    dom.availabilityPauseAction.textContent = availabilityState.paused ? '继续检测' : '暂停检测'
  }

  if (dom.availabilityStopAction) {
    dom.availabilityStopAction.disabled =
      !availabilityState.running ||
      availabilityState.deleting ||
      availabilityState.stopRequested
    dom.availabilityStopAction.textContent = availabilityState.stopRequested ? '停止中…' : '停止本次检测'
  }

  const progressTotal = availabilityState.retestingSelection
    ? availabilityState.retestSelectionTotal
    : availabilityState.eligibleBookmarks
  const progressCompleted = availabilityState.retestingSelection
    ? availabilityState.retestSelectionCompleted
    : availabilityState.checkedBookmarks
  const progressLabel = progressTotal
    ? `${progressCompleted} / ${progressTotal}`
    : '未开始'
  const progressValue = progressTotal
    ? Math.round((progressCompleted / progressTotal) * 100)
    : 0

  dom.availabilityProgressText.textContent = availabilityState.retestingSelection
    ? `重测中 ${progressLabel}`
    : availabilityState.running
    ? availabilityState.stopRequested
      ? `正在停止 ${progressLabel}`
      : availabilityState.paused
        ? `已暂停 ${progressLabel}`
        : `检测中 ${progressLabel}`
    : availabilityState.lastCompletedAt
      ? availabilityState.lastRunOutcome === 'stopped'
        ? `已停止 ${progressLabel}`
        : `已完成 ${progressLabel}`
      : progressLabel
  dom.availabilityProgressBar.style.width = `${Math.max(0, Math.min(progressValue, 100))}%`
  dom.availabilityStatusCopy.textContent = getAvailabilityStatusCopy()

  if (dom.availabilityTotalLabel) {
    dom.availabilityTotalLabel.textContent = scopeMeta.type === 'all' ? '全部书签' : '当前范围'
  }
  dom.availabilityTotal.textContent = String(availabilityState.totalBookmarks)
  dom.availabilityEligible.textContent = String(availabilityState.eligibleBookmarks)
  dom.availabilityAvailable.textContent = String(availabilityState.availableCount)
  dom.availabilityRedirected.textContent = String(availabilityState.redirectedCount)
  dom.availabilityReview.textContent = String(availabilityState.reviewCount)
  dom.availabilityFailed.textContent = String(availabilityState.failedCount)
  dom.availabilityIgnored.textContent = String(availabilityState.ignoredCount)
  dom.availabilitySkipped.textContent = String(availabilityState.skippedCount)

  dom.availabilityReviewSubtitle.textContent = availabilityState.currentRunProbeEnabled
    ? '导航失败但证据不足以直接判定为高置信异常，已归为低置信异常'
    : '当前轮未启用第二层网络探测，因此这些结果暂归为低置信异常'
  dom.availabilityReviewCount.textContent = `${availabilityState.reviewCount} 条低置信异常`
  dom.availabilityLastRun.textContent = availabilityState.lastCompletedAt
    ? `${availabilityState.lastRunOutcome === 'stopped' ? '最近一次停止于' : '最近一次完成于'} ${formatDateTime(availabilityState.lastCompletedAt)}`
    : '尚未执行检测'
  dom.availabilityErrorCount.textContent = `${availabilityState.failedCount} 条异常`

  dom.deleteFailedBookmarks.disabled =
    isInteractionLocked() ||
    availabilityState.failedResults.length === 0
  dom.deleteFailedBookmarks.textContent = availabilityState.deleting ? '正在删除…' : '批量删除'

  renderAvailabilityHistory(historyCallbacks)
  renderAiNamingSection()
  renderAvailabilitySelectionGroup()
  renderReviewResults()
  renderFailedResults()
  renderRedirectSection(redirectsCallbacks)
  renderDuplicateSection()
  renderIgnoreSection()
  renderRecycleSection()
  renderScopeModal()
  renderMoveModal()
  renderDeleteModal()
  renderAiModelModal()
}

function syncAiNamingSettingsDraftFromDom({ markDirty = false } = {}) {
  if (!dom.aiBaseUrl) {
    return aiNamingManagerState.settings
  }

  const selectedModel = dom.aiModelSelect?.value === AI_NAMING_MANAGE_MODELS_VALUE
    ? aiNamingManagerState.settings.model
    : dom.aiModelSelect?.value

  aiNamingManagerState.settings = normalizeAiNamingSettings({
    baseUrl: dom.aiBaseUrl.value,
    apiKey: dom.aiApiKey.value,
    model: selectedModel,
    customModels: aiNamingManagerState.settings.customModels,
    apiStyle: dom.aiApiStyle.value,
    timeoutMs: dom.aiTimeoutMs.value,
    batchSize: dom.aiBatchSize.value,
    autoSelectHighConfidence: dom.aiAutoSelectHigh.checked,
    systemPrompt: dom.aiSystemPrompt.value
  })

  if (markDirty) {
    aiNamingState.settingsDirty = true
    resetAiNamingConnectivityState()
    renderAiNamingSection()
  }

  return aiNamingManagerState.settings
}

function resetAiNamingConnectivityState() {
  aiNamingState.testingConnection = false
  aiNamingState.lastConnectivityTestAt = 0
  aiNamingState.lastConnectivityTestStatus = ''
  aiNamingState.lastConnectivityTestMessage = ''
}

async function saveAiNamingSettingsFromDom() {
  try {
    const settings = syncAiNamingSettingsDraftFromDom()
    validateAiNamingSettings(settings)
    await saveAiNamingSettings(settings)
    aiNamingState.settingsDirty = false
    aiNamingState.lastError = ''
    await hydrateAiNamingPermissionState()
  } catch (error) {
    aiNamingState.lastError =
      error instanceof Error ? error.message : 'AI 配置保存失败，请稍后重试。'
  } finally {
    renderAvailabilitySection()
  }
}

async function handleAiConnectivityTest() {
  if (aiNamingState.testingConnection || aiNamingState.running || aiNamingState.applying) {
    return
  }

  try {
    const settings = syncAiNamingSettingsDraftFromDom()
    validateAiNamingSettings(settings)
    aiNamingState.lastError = ''
    resetAiNamingConnectivityState()
    aiNamingState.testingConnection = true
    renderAvailabilitySection()

    const permissionGranted = await ensureAiNamingProviderPermission({
      interactive: true,
      baseUrl: settings.baseUrl
    })
    if (!permissionGranted) {
      throw new Error('未授予 AI 服务地址访问权限，无法执行连通性测试。')
    }

    aiNamingState.lastConnectivityTestMessage = await requestAiNamingConnectivityTest(settings)
    aiNamingState.lastConnectivityTestStatus = 'success'
    aiNamingState.lastConnectivityTestAt = Date.now()
  } catch (error) {
    aiNamingState.lastConnectivityTestStatus = 'error'
    aiNamingState.lastConnectivityTestAt = Date.now()
    aiNamingState.lastConnectivityTestMessage = normalizeAiNamingConnectivityError(
      error,
      aiNamingManagerState.settings.timeoutMs
    )
  } finally {
    aiNamingState.testingConnection = false
    await hydrateAiNamingPermissionState()
    renderAvailabilitySection()
  }
}

function renderAiNamingSection() {
  if (!dom.aiAction) {
    return
  }

  const settings = aiNamingManagerState.settings
  if (dom.aiBaseUrl && dom.aiBaseUrl !== document.activeElement) {
    dom.aiBaseUrl.value = settings.baseUrl
  }
  if (dom.aiApiKey && dom.aiApiKey !== document.activeElement) {
    dom.aiApiKey.value = settings.apiKey
    dom.aiApiKey.type = managerState.aiRevealApiKey ? 'text' : 'password'
  }
  if (dom.aiRevealApiKey) {
    dom.aiRevealApiKey.checked = managerState.aiRevealApiKey
  }
  if (dom.aiModelSelect && dom.aiModelSelect !== document.activeElement) {
    renderAiNamingModelOptions(settings)
  }
  if (dom.aiApiStyle && dom.aiApiStyle !== document.activeElement) {
    dom.aiApiStyle.value = settings.apiStyle
  }
  if (dom.aiTimeoutMs && dom.aiTimeoutMs !== document.activeElement) {
    dom.aiTimeoutMs.value = String(settings.timeoutMs)
  }
  if (dom.aiBatchSize && dom.aiBatchSize !== document.activeElement) {
    dom.aiBatchSize.value = String(settings.batchSize)
  }
  if (dom.aiAutoSelectHigh) {
    dom.aiAutoSelectHigh.checked = Boolean(settings.autoSelectHighConfidence)
  }
  if (dom.aiSystemPrompt && dom.aiSystemPrompt !== document.activeElement) {
    dom.aiSystemPrompt.value = settings.systemPrompt
  }

  const hasRequiredConfig = Boolean(settings.baseUrl && settings.apiKey && settings.model)
  const configTone = aiNamingState.settingsDirty
    ? 'warning'
    : hasRequiredConfig
      ? 'success'
      : 'muted'
  const configText = aiNamingState.settingsDirty
    ? '待保存'
    : hasRequiredConfig
      ? '已配置'
      : '待配置'
  const connectivityMeta = getAiNamingConnectivityMeta()

  if (dom.aiProviderNoticeText) {
    dom.aiProviderNoticeText.textContent = aiNamingState.settingsDirty
      ? '有未保存的配置改动。API Key 仅保存在当前扩展的本地存储里。'
      : hasRequiredConfig
        ? '已填写密钥和模型，可以直接生成建议。API Key 仅保存在当前扩展的本地存储里。'
        : '需要填写密钥后才可用。API Key 仅保存在当前扩展的本地存储里。'
  }

  dom.aiConfigStatus.className = `options-chip ${configTone}`
  dom.aiConfigStatus.textContent = configText
  if (dom.aiManageModels) {
    dom.aiManageModels.disabled = aiNamingState.running || aiNamingState.applying || aiNamingState.testingConnection
  }
  if (dom.aiConnectivityCopy) {
    dom.aiConnectivityCopy.className = `ai-provider-connectivity ${connectivityMeta.tone}`
    dom.aiConnectivityCopy.textContent = connectivityMeta.copy
  }

  dom.aiRunBadge.className = `options-chip ${getAiNamingBadgeTone()}`
  dom.aiRunBadge.textContent = getAiNamingBadgeText()
  dom.aiStatusCopy.textContent = getAiNamingStatusCopy()
  dom.aiProgressCopy.textContent = getAiNamingProgressCopy()

  const progressLabel = aiNamingState.eligibleBookmarks
    ? `${aiNamingState.checkedBookmarks} / ${aiNamingState.eligibleBookmarks}`
    : '未开始'
  const progressValue = aiNamingState.eligibleBookmarks
    ? Math.round((aiNamingState.checkedBookmarks / aiNamingState.eligibleBookmarks) * 100)
    : 0

  dom.aiProgressText.textContent = aiNamingState.running
    ? aiNamingState.stopRequested
      ? `正在停止 ${progressLabel}`
      : `生成中 ${progressLabel}`
    : aiNamingState.lastCompletedAt
      ? `已完成 ${progressLabel}`
      : progressLabel
  dom.aiProgressBar.style.width = `${Math.max(0, Math.min(progressValue, 100))}%`

  dom.aiAction.disabled =
    availabilityState.catalogLoading ||
    !hasRequiredConfig ||
    aiNamingState.testingConnection ||
    aiNamingState.running ||
    aiNamingState.applying ||
    aiNamingState.requestingPermission
  dom.aiAction.textContent = aiNamingState.lastCompletedAt ? '重新生成建议' : '开始生成建议'
  dom.aiStopAction.classList.toggle('hidden', !aiNamingState.running)
  dom.aiStopAction.disabled = !aiNamingState.running || aiNamingState.stopRequested
  dom.aiStopAction.textContent = aiNamingState.stopRequested ? '停止中…' : '停止本次生成'
  dom.aiSaveSettings.disabled = aiNamingState.running || aiNamingState.applying || aiNamingState.testingConnection
  dom.aiSaveSettings.textContent = aiNamingState.settingsDirty || !hasRequiredConfig ? '保存 AI 配置' : '已保存配置'
  if (dom.aiTestConnection) {
    dom.aiTestConnection.disabled =
      !hasRequiredConfig ||
      aiNamingState.testingConnection ||
      aiNamingState.running ||
      aiNamingState.applying ||
      aiNamingState.requestingPermission
    dom.aiTestConnection.textContent = aiNamingState.testingConnection ? '测试中…' : '测试连接'
  }

  dom.aiEligible.textContent = String(aiNamingState.eligibleBookmarks)
  dom.aiSuggested.textContent = String(aiNamingState.suggestedCount)
  dom.aiManualReview.textContent = String(aiNamingState.manualReviewCount)
  dom.aiUnchanged.textContent = String(aiNamingState.unchangedCount)
  dom.aiHighConfidence.textContent = String(aiNamingState.highConfidenceCount)
  dom.aiMediumConfidence.textContent = String(aiNamingState.mediumConfidenceCount)
  dom.aiLowConfidence.textContent = String(aiNamingState.lowConfidenceCount)
  dom.aiFailed.textContent = String(aiNamingState.failedCount)

  const selectableResults = getSelectableAiNamingResults()
  const highConfidenceResults = selectableResults.filter((result) => result.confidence === 'high')
  const selectedResults = getSelectedAiNamingResults()
  dom.aiSelectionGroup.classList.toggle('hidden', selectableResults.length === 0)
  dom.aiSelectionCount.textContent = `${selectedResults.length} 条已选择`
  dom.aiSelectAll.disabled =
    aiNamingState.running ||
    aiNamingState.applying ||
    selectableResults.length === 0
  dom.aiSelectHighConfidence.disabled =
    aiNamingState.running ||
    aiNamingState.applying ||
    highConfidenceResults.length === 0
  dom.aiClearSelection.disabled = selectedResults.length === 0
  dom.aiApplySelection.disabled = aiNamingState.running || aiNamingState.applying || selectedResults.length === 0

  dom.aiResultCount.textContent = `${aiNamingState.results.length} 条结果`
  dom.aiResultsSubtitle.textContent = aiNamingState.lastCompletedAt
    ? `最近一次完成于 ${formatDateTime(aiNamingState.lastCompletedAt)}。建议改名 ${aiNamingState.suggestedCount} 条，待确认 ${aiNamingState.manualReviewCount} 条，失败 ${aiNamingState.failedCount} 条。`
    : '配置 AI 提供方后，开始生成建议，这里会展示当前标题、建议标题、置信度与原因。'

  renderAiNamingResults()
}

function renderAiNamingModelOptions(settings = aiNamingManagerState.settings) {
  if (!dom.aiModelSelect) {
    return
  }

  const options = getAiNamingModelOptions(settings)
  dom.aiModelSelect.innerHTML = options
    .map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`)
    .join('')
  dom.aiModelSelect.value = options.some((option) => option.value === settings.model)
    ? settings.model
    : AI_NAMING_DEFAULT_MODEL
}

function getAiNamingModelOptions(settings = aiNamingManagerState.settings) {
  const options = []
  const seen = new Set()
  const appendOption = (value, label = value) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) {
      return
    }

    const dedupeKey = normalizeText(normalizedValue)
    if (!dedupeKey || seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    options.push({
      value: normalizedValue,
      label: String(label || normalizedValue).trim() || normalizedValue
    })
  }

  AI_NAMING_PRESET_MODELS.forEach((model) => appendOption(model))
  settings.customModels.forEach((model) => appendOption(model))
  appendOption(settings.model, `${settings.model}（当前）`)
  options.push({
    value: AI_NAMING_MANAGE_MODELS_VALUE,
    label: '设置更多模型'
  })

  return options
}

function handleAiRevealApiKeyChange(event) {
  managerState.aiRevealApiKey = Boolean(event?.target?.checked)
  renderAiNamingSection()
}

function handleAiModelSelectChange() {
  const selectedValue = String(dom.aiModelSelect?.value || '').trim()
  if (selectedValue === AI_NAMING_MANAGE_MODELS_VALUE) {
    openAiModelModal()
    return
  }

  syncAiNamingSettingsDraftFromDom({ markDirty: true })
}

function openAiModelModal() {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  if (dom.aiModelSelect) {
    dom.aiModelSelect.value = aiNamingManagerState.settings.model
  }
  managerState.aiModelModalOpen = true
  renderAiModelModal()

  window.setTimeout(() => {
    dom.aiCustomModelsInput?.focus()
  }, 0)
}

function closeAiModelModal() {
  managerState.aiModelModalOpen = false
  renderAiModelModal()
}

function renderAiModelModal() {
  if (!dom.aiModelModalBackdrop) {
    return
  }

  setModalHidden(dom.aiModelModalBackdrop, managerState.aiModelModalOpen)

  if (!managerState.aiModelModalOpen) {
    return
  }

  if (dom.aiCustomModelsInput && dom.aiCustomModelsInput !== document.activeElement) {
    dom.aiCustomModelsInput.value = formatAiCustomModelsInput(aiNamingManagerState.settings.customModels)
  }
}

function formatAiCustomModelsInput(models) {
  return normalizeAiNamingCustomModels(models).join('\n')
}

async function saveAiModelModalSettings() {
  const customModels = normalizeAiNamingCustomModels(dom.aiCustomModelsInput?.value)
  aiNamingManagerState.settings = normalizeAiNamingSettings({
    ...aiNamingManagerState.settings,
    customModels
  })
  aiNamingState.settingsDirty = true
  resetAiNamingConnectivityState()
  closeAiModelModal()
  renderAvailabilitySection()
}

function renderAiNamingResults() {
  if (!dom.aiResults) {
    return
  }

  if (aiNamingState.running && !aiNamingState.results.length) {
    dom.aiResults.innerHTML = '<div class="detect-empty">正在抓取网页元信息并生成命名建议，请稍候。</div>'
    return
  }

  if (!aiNamingState.results.length) {
    dom.aiResults.innerHTML = aiNamingState.lastError
      ? `<div class="detect-empty">${escapeHtml(aiNamingState.lastError)}</div>`
      : aiNamingState.lastCompletedAt
        ? '<div class="detect-empty">最近一次生成已完成，当前没有待处理的 AI 命名结果。</div>'
        : '<div class="detect-empty">保存 AI 配置并开始生成建议后，这里会展示批量预览结果。</div>'
    return
  }

  dom.aiResults.innerHTML = aiNamingState.results
    .map((result) => buildAiNamingResultCard(result))
    .join('')
}

function buildAiNamingResultCard(result) {
  const selectable = result.status === 'suggested'
  const interactionLocked = aiNamingState.running || aiNamingState.applying
  const isSelected = aiNamingState.selectedResultIds.has(String(result.id))
  const badgeTone = result.status === 'failed'
    ? 'danger'
    : result.confidence === 'high'
      ? 'success'
      : result.confidence === 'medium'
        ? 'warning'
        : 'muted'
  const statusLabel = getAiNamingStatusLabel(result)

  return `
    <article class="detect-result-card ${isSelected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <label class="detect-result-check">
            <input
              type="checkbox"
              data-ai-select="${escapeAttr(result.id)}"
              ${selectable && isSelected ? 'checked' : ''}
              ${selectable && !interactionLocked ? '' : 'disabled'}
            >
            <span>${selectable ? '选择' : '不可直接应用'}</span>
          </label>
          <span class="options-chip ${badgeTone}">${escapeHtml(statusLabel)}</span>
          <span class="options-chip muted">${escapeHtml(getAiNamingConfidenceLabel(result.confidence))}</span>
        </div>
        <div class="detect-result-actions">
          <a class="detect-result-open" href="${escapeAttr(result.url)}" target="_blank" rel="noreferrer noopener">打开页面</a>
          ${selectable ? `<button class="detect-result-action" type="button" data-ai-apply="${escapeAttr(result.id)}" ${interactionLocked ? 'disabled' : ''}>应用建议</button>` : ''}
        </div>
      </div>
      <div class="detect-result-copy ai-result-copy">
        <strong>${escapeHtml(result.currentTitle || '未命名书签')}</strong>
        <p class="ai-result-suggested">${escapeHtml(result.suggestedTitle || '未生成建议标题')}</p>
        <p class="detect-result-url">${escapeHtml(displayUrl(result.url))}</p>
        <p class="detect-result-path">${escapeHtml(result.path || '未归档路径')}</p>
        <p class="detect-result-detail">${escapeHtml(result.reason || result.detail || '')}</p>
      </div>
    </article>
  `
}

function getSelectableAiNamingResults() {
  return aiNamingState.results.filter((result) => result.status === 'suggested')
}

function getSelectedAiNamingResults() {
  const resultMap = new Map(
    getSelectableAiNamingResults().map((result) => [String(result.id), result])
  )

  return [...aiNamingState.selectedResultIds]
    .map((bookmarkId) => resultMap.get(String(bookmarkId)))
    .filter(Boolean)
}

function clearAiNamingSelection() {
  aiNamingState.selectedResultIds.clear()
  renderAvailabilitySection()
}

function selectAllAiNamingResults() {
  aiNamingState.selectedResultIds = new Set(
    getSelectableAiNamingResults().map((result) => String(result.id))
  )
  renderAvailabilitySection()
}

function selectHighConfidenceAiResults() {
  aiNamingState.selectedResultIds = new Set(
    getSelectableAiNamingResults()
      .filter((result) => result.confidence === 'high')
      .map((result) => String(result.id))
  )
  renderAvailabilitySection()
}

function handleAiResultsChange(event) {
  if (aiNamingState.running || aiNamingState.applying) {
    return
  }

  const selectionInput = event.target.closest('input[data-ai-select]')
  if (!selectionInput) {
    return
  }

  const bookmarkId = String(selectionInput.getAttribute('data-ai-select') || '').trim()
  if (!bookmarkId) {
    return
  }

  if (selectionInput.checked) {
    aiNamingState.selectedResultIds.add(bookmarkId)
  } else {
    aiNamingState.selectedResultIds.delete(bookmarkId)
  }

  renderAvailabilitySection()
}

function handleAiResultsClick(event) {
  const applyButton = event.target.closest('[data-ai-apply]')
  if (!applyButton || aiNamingState.running || aiNamingState.applying) {
    return
  }

  const bookmarkId = String(applyButton.getAttribute('data-ai-apply') || '').trim()
  if (!bookmarkId) {
    return
  }

  applyAiNamingResultsByIds([bookmarkId])
}

async function handleAiNamingAction() {
  if (availabilityState.catalogLoading || aiNamingState.running || aiNamingState.applying) {
    return
  }

  try {
    const settings = syncAiNamingSettingsDraftFromDom()
    validateAiNamingSettings(settings)
    await saveAiNamingSettings(settings)
    aiNamingState.settingsDirty = false

    if (!aiNamingState.bookmarks.length) {
      throw new Error('当前范围内没有可处理的 http/https 书签。')
    }

    const permissionGranted = await ensureAiNamingPermissionsForRun({ interactive: true })
    if (!permissionGranted) {
      throw new Error('未授予网页抓取或 AI 服务访问权限，无法生成命名建议。')
    }

    await runAiNamingSuggestions()
  } catch (error) {
    aiNamingState.lastError =
      error instanceof Error ? error.message : 'AI 命名失败，请稍后重试。'
    renderAvailabilitySection()
  }
}

function requestAiNamingStop() {
  if (!aiNamingState.running || aiNamingState.stopRequested) {
    return
  }

  aiNamingState.stopRequested = true
  renderAvailabilitySection()
}

async function ensureAiNamingPermissionsForRun({ interactive = true } = {}) {
  const permissionOrigins = getAiNamingPermissionOrigins()
  if (!permissionOrigins.length) {
    aiNamingState.permissionGranted = false
    return false
  }

  try {
    if (await containsPermissions({ origins: permissionOrigins })) {
      aiNamingState.permissionGranted = true
      return true
    }
  } catch (error) {
    aiNamingState.permissionGranted = false
  }

  if (!interactive) {
    return false
  }

  aiNamingState.requestingPermission = true
  renderAvailabilitySection()

  try {
    aiNamingState.permissionGranted = await requestPermissions({
      origins: permissionOrigins
    })
    return aiNamingState.permissionGranted
  } catch (error) {
    aiNamingState.permissionGranted = false
    return false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

async function ensureAiNamingProviderPermission({ interactive = true, baseUrl = aiNamingManagerState.settings.baseUrl } = {}) {
  const providerOrigin = getAiNamingProviderPermissionOrigin(baseUrl)
  if (!providerOrigin) {
    return false
  }

  try {
    if (await containsPermissions({ origins: [providerOrigin] })) {
      return true
    }
  } catch (error) {
  }

  if (!interactive) {
    return false
  }

  aiNamingState.requestingPermission = true
  renderAvailabilitySection()

  try {
    return await requestPermissions({
      origins: [providerOrigin]
    })
  } catch (error) {
    return false
  } finally {
    aiNamingState.requestingPermission = false
    renderAvailabilitySection()
  }
}

function getAiNamingPermissionOrigins() {
  const origins = new Set(aiNamingState.requestOrigins)
  const providerOrigin = getOriginPermissionPattern(aiNamingManagerState.settings.baseUrl)
  if (providerOrigin) {
    origins.add(providerOrigin)
  }
  return [...origins]
}

function getAiNamingProviderPermissionOrigin(baseUrl = aiNamingManagerState.settings.baseUrl) {
  return getOriginPermissionPattern(baseUrl)
}

async function handleAiScopeChange(nextScopeFolderId) {
  aiNamingState.scopeFolderId = String(nextScopeFolderId || '').trim()
  aiNamingState.lastError = ''
  syncAiNamingCatalog({ preserveResults: false })
  await hydrateAiNamingPermissionState()
  renderAvailabilitySection()
}

async function applySelectedAiNamingResults() {
  const selectedResults = getSelectedAiNamingResults()
  if (!selectedResults.length) {
    return
  }

  await applyAiNamingResultsByIds(selectedResults.map((result) => result.id))
}

async function applyAiNamingResultsByIds(bookmarkIds) {
  const targetIds = new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))
  const targetResults = aiNamingState.results.filter((result) => {
    return targetIds.has(String(result.id)) && result.status === 'suggested'
  })

  if (!targetResults.length) {
    return
  }

  aiNamingState.applying = true
  aiNamingState.lastError = ''
  renderAvailabilitySection()

  const appliedIds = []
  let applyError = null

  try {
    for (const result of targetResults) {
      await updateBookmark(result.id, {
        title: result.suggestedTitle
      })
      appliedIds.push(String(result.id))
    }
  } catch (error) {
    applyError = error
  } finally {
    aiNamingState.applying = false

    if (appliedIds.length) {
      const appliedIdSet = new Set(appliedIds)
      aiNamingState.results = aiNamingState.results.filter((result) => {
        return !appliedIdSet.has(String(result.id))
      })
      aiNamingState.selectedResultIds = new Set(
        [...aiNamingState.selectedResultIds].filter((id) => !appliedIdSet.has(String(id)))
      )
      recalculateAiNamingSummary()
      await hydrateAvailabilityCatalog({ preserveResults: true })
    }

    if (applyError) {
      aiNamingState.lastError =
        applyError instanceof Error
          ? `应用建议过程中断，已应用 ${appliedIds.length} 条：${applyError.message}`
          : `应用建议过程中断，已应用 ${appliedIds.length} 条。`
    } else if (appliedIds.length) {
      aiNamingState.lastError = `已应用 ${appliedIds.length} 条书签命名建议。`
    }

    renderAvailabilitySection()
  }
}

function validateAiNamingSettings(settings) {
  const normalized = normalizeAiNamingSettings(settings)
  if (!normalized.baseUrl) {
    throw new Error('请填写 Base URL。')
  }

  try {
    const parsedUrl = new URL(normalized.baseUrl)
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      throw new Error('仅支持 http/https Base URL。')
    }
  } catch (error) {
    throw new Error('Base URL 格式无效。')
  }

  if (!normalized.apiKey) {
    throw new Error('请填写 API Key。')
  }

  if (!normalized.model) {
    throw new Error('请填写 AI 模型名称。')
  }
}

function getAiNamingBadgeTone() {
  if (aiNamingState.requestingPermission || availabilityState.catalogLoading) {
    return 'warning'
  }

  if (aiNamingState.lastError) {
    return 'danger'
  }

  if (!aiNamingManagerState.settings.apiKey || !aiNamingManagerState.settings.model) {
    return 'muted'
  }

  return aiNamingState.permissionGranted ? 'success' : 'muted'
}

function getAiNamingBadgeText() {
  if (availabilityState.catalogLoading) {
    return '读取中'
  }

  if (aiNamingState.requestingPermission) {
    return '授权中'
  }

  if (!aiNamingManagerState.settings.apiKey || !aiNamingManagerState.settings.model) {
    return '待配置'
  }

  if (aiNamingState.running) {
    return '生成中'
  }

  return aiNamingState.permissionGranted ? '已就绪' : '待授权'
}

function getAiNamingStatusCopy() {
  if (aiNamingState.lastError) {
    return aiNamingState.lastError
  }

  if (aiNamingState.testingConnection) {
    return '系统正在测试当前 AI 服务连通性。'
  }

  if (!aiNamingManagerState.settings.apiKey || !aiNamingManagerState.settings.model) {
    return '请先填写并保存 Base URL、API Key 与 AI 模型，然后再启动智能命名。'
  }

  if (aiNamingState.settingsDirty) {
    return 'AI 配置已经修改但尚未保存；开始生成前会自动按当前输入内容保存。'
  }

  if (aiNamingState.running) {
    return '系统正在抓取网页元信息并调用 AI 生成命名建议。你可以随时停止当前批次。'
  }

  if (aiNamingState.lastCompletedAt) {
    return `最近一次 AI 命名建议完成于 ${formatDateTime(aiNamingState.lastCompletedAt)}。`
  }

  return '保存配置后，系统会先抓取网页标题与元信息，再分批调用 AI 生成命名建议。建议生成后，你可以先预览并手动选择要应用的标题。'
}

function getAiNamingProgressCopy() {
  const scopeMeta = getCurrentAiNamingScopeMeta()
  return `当前范围：${scopeMeta.label}。本轮会处理 ${aiNamingState.eligibleBookmarks} 条 http/https 书签，并调用模型 ${aiNamingManagerState.settings.model || '未配置'} 生成建议。`
}

function getAiNamingConnectivityMeta() {
  if (aiNamingState.testingConnection) {
    return {
      tone: 'warning',
      copy: '正在测试当前 AI 接口连通性，请稍候。'
    }
  }

  if (aiNamingState.lastConnectivityTestStatus === 'success') {
    return {
      tone: 'success',
      copy: `${aiNamingState.lastConnectivityTestMessage || '连通性测试通过。'}${aiNamingState.settingsDirty ? '当前改动尚未保存。' : ''}`
    }
  }

  if (aiNamingState.lastConnectivityTestStatus === 'error') {
    return {
      tone: 'danger',
      copy: aiNamingState.lastConnectivityTestMessage || '连通性测试失败。'
    }
  }

  return {
    tone: 'muted',
    copy: '连通性测试会向当前接口发送一条最小请求，用于验证 Base URL、API Key、模型与接口类型是否可用。'
  }
}

function getAiNamingStatusLabel(result) {
  if (result.status === 'failed') {
    return '生成失败'
  }

  if (result.status === 'unchanged') {
    return '无需改名'
  }

  if (result.status === 'manual_review') {
    return '待人工确认'
  }

  return '建议改名'
}

function getAiNamingConfidenceLabel(confidence) {
  if (confidence === 'high') {
    return '高置信'
  }

  if (confidence === 'medium') {
    return '中置信'
  }

  if (confidence === 'low') {
    return '低置信'
  }

  return '未分类'
}

async function runAiNamingSuggestions() {
  aiNamingState.running = true
  aiNamingState.stopRequested = false
  resetAiNamingRunState()
  aiNamingState.eligibleBookmarks = aiNamingState.bookmarks.length
  renderAvailabilitySection()

  try {
    const settings = aiNamingManagerState.settings
    const bookmarks = aiNamingState.bookmarks.slice()

    for (let start = 0; start < bookmarks.length; start += settings.batchSize) {
      if (aiNamingState.stopRequested) {
        break
      }

      const chunk = bookmarks.slice(start, start + settings.batchSize)
      const preparedItems = []
      const retryCandidates = []

      for (const bookmark of chunk) {
        if (aiNamingState.stopRequested) {
          break
        }

        try {
          preparedItems.push(await buildAiNamingPreparedItem(bookmark, settings.timeoutMs))
        } catch (error) {
          retryCandidates.push({
            bookmark,
            initialError: error
          })
        } finally {
          aiNamingState.checkedBookmarks += 1
          recalculateAiNamingSummary()
          scheduleAvailabilityRender()
        }
      }

      if (!preparedItems.length || aiNamingState.stopRequested) {
        if (retryCandidates.length && !aiNamingState.stopRequested) {
          await retryAiNamingBookmarks(retryCandidates, settings)
        }
        continue
      }

      try {
        const aiResponseItems = await requestAiNamingBatch(preparedItems)
        const failedPreparedItems = mergeAiNamingBatchResults(preparedItems, aiResponseItems)
        retryCandidates.push(...failedPreparedItems.map((preparedItem) => {
          return {
            bookmark: preparedItem.bookmark,
            initialError: new Error('AI 返回中缺少该书签的命名结果。')
          }
        }))
      } catch (error) {
        retryCandidates.push(...preparedItems.map((preparedItem) => {
          return {
            bookmark: preparedItem.bookmark,
            initialError: error
          }
        }))
      }

      if (retryCandidates.length && !aiNamingState.stopRequested) {
        await retryAiNamingBookmarks(retryCandidates, settings)
      }

      recalculateAiNamingSummary()
      scheduleAvailabilityRender()
    }

    aiNamingState.lastCompletedAt = Date.now()
    if (aiNamingState.stopRequested) {
      aiNamingState.lastError = `已手动停止，本轮保留 ${aiNamingState.results.length} 条已生成结果。`
    }
  } finally {
    aiNamingState.running = false
    aiNamingState.stopRequested = false
    recalculateAiNamingSummary()
    renderAvailabilitySection()
  }
}

async function retryAiNamingBookmarks(retryCandidates, settings = aiNamingManagerState.settings) {
  for (const candidate of retryCandidates) {
    if (aiNamingState.stopRequested) {
      break
    }

    try {
      const modelItem = await generateAiNamingResultForBookmark(candidate.bookmark, settings)
      commitAiNamingResult(candidate.bookmark, modelItem, settings)
    } catch (retryError) {
      upsertAiNamingResult(
        buildAiNamingRetriedFailureResult(candidate.bookmark, candidate.initialError, retryError)
      )
    }

    recalculateAiNamingSummary()
    scheduleAvailabilityRender()
  }

  sortAiNamingResults()
  scheduleAvailabilityRender()
}

async function generateAiNamingResultForBookmark(bookmark, settings = aiNamingManagerState.settings) {
  const preparedItem = await buildAiNamingPreparedItem(bookmark, settings.timeoutMs)
  const aiResponseItems = await requestAiNamingBatch([preparedItem])
  const modelItem = aiResponseItems.find((item) => String(item.bookmarkId) === String(bookmark.id))
  if (!modelItem) {
    throw new Error('AI 返回中缺少该书签的命名结果。')
  }

  return modelItem
}

function commitAiNamingResult(bookmark, modelItem, settings = aiNamingManagerState.settings) {
  const nextResult = buildAiNamingResultFromModelItem(bookmark, modelItem)
  upsertAiNamingResult(nextResult)

  if (
    nextResult.status === 'suggested' &&
    modelItem.confidence === 'high' &&
    settings.autoSelectHighConfidence
  ) {
    aiNamingState.selectedResultIds.add(String(bookmark.id))
  }
}

function buildAiNamingResultFromModelItem(bookmark, modelItem) {
  const normalizedTitle = cleanAiSuggestedTitle(modelItem.suggestedTitle || bookmark.title)
  const sameAsCurrent = normalizeText(normalizedTitle) === normalizeText(bookmark.title)
  const status = modelItem.action === 'keep'
    ? 'unchanged'
    : modelItem.action === 'manual_review'
      ? 'manual_review'
      : sameAsCurrent || !normalizedTitle
        ? 'unchanged'
        : 'suggested'

  return {
    id: String(bookmark.id),
    currentTitle: bookmark.title,
    suggestedTitle: status === 'suggested' ? normalizedTitle : bookmark.title,
    status,
    confidence: status === 'failed' ? 'low' : modelItem.confidence,
    reason: modelItem.reason || 'AI 未提供额外说明。',
    url: bookmark.url,
    displayUrl: bookmark.displayUrl,
    path: bookmark.path,
    domain: bookmark.domain,
    ancestorIds: bookmark.ancestorIds,
    parentId: bookmark.parentId,
    index: bookmark.index
  }
}

function buildAiNamingRetriedFailureResult(bookmark, initialError, retryError) {
  const initialMessage = getAiNamingFailureMessage(initialError)
  const retryMessage = getAiNamingFailureMessage(retryError)
  return {
    ...buildAiNamingFailedResult(bookmark, retryError),
    reason:
      initialMessage === retryMessage
        ? `重试 1 次后仍失败：${retryMessage}`
        : `首次失败：${initialMessage}；重试后仍失败：${retryMessage}`
  }
}

function getAiNamingFailureMessage(error) {
  return error instanceof Error ? error.message : '生成建议失败。'
}

async function buildAiNamingPreparedItem(bookmark, timeoutMs) {
  const metadata = await fetchBookmarkMetadataForAi(bookmark.url, timeoutMs)
  return {
    bookmark,
    requestItem: {
      bookmark_id: String(bookmark.id),
      current_title: String(bookmark.title || '未命名书签'),
      url: String(bookmark.url || ''),
      final_url: String(metadata.finalUrl || bookmark.url || ''),
      folder_path: String(bookmark.path || ''),
      domain: String(bookmark.domain || extractDomain(metadata.finalUrl || bookmark.url || '')),
      page_meta: {
        title: metadata.title,
        og_title: metadata.ogTitle,
        twitter_title: metadata.twitterTitle,
        h1: metadata.h1,
        site_name: metadata.siteName,
        description: metadata.description
      }
    }
  }
}

async function fetchBookmarkMetadataForAi(url, timeoutMs) {
  const response = await fetchWithRequestTimeout(url, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
    referrerPolicy: 'no-referrer'
  }, timeoutMs)
  const finalUrl = String(response.url || url || '')
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()

  if (!contentType.includes('text/html')) {
    return {
      finalUrl,
      title: '',
      ogTitle: '',
      twitterTitle: '',
      h1: '',
      siteName: '',
      description: ''
    }
  }

  const html = await response.text()
  return {
    finalUrl,
    ...extractAiMetadataFromHtml(html)
  }
}

async function requestAiNamingConnectivityTest(settings = aiNamingManagerState.settings) {
  const endpoint = getAiNamingEndpoint(settings)
  const response = await fetchWithRequestTimeout(endpoint, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(buildAiNamingConnectivityRequestBody(settings))
  }, settings.timeoutMs)

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  return `连通性测试通过，模型 ${settings.model} 可正常访问。`
}

function buildAiNamingConnectivityRequestBody(settings = aiNamingManagerState.settings) {
  if (settings.apiStyle === 'chat_completions') {
    return {
      model: settings.model,
      messages: [
        {
          role: 'user',
          content: 'Reply with OK.'
        }
      ]
    }
  }

  return {
    model: settings.model,
    input: 'Reply with OK.'
  }
}

function extractAiMetadataFromHtml(html) {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(String(html || ''), 'text/html')
  const queryMeta = (selector) => {
    const node = documentNode.querySelector(selector)
    return normalizeAiMetadataText(node?.getAttribute('content') || '')
  }
  const title = normalizeAiMetadataText(documentNode.querySelector('title')?.textContent || '')
  const h1 = normalizeAiMetadataText(documentNode.querySelector('h1')?.textContent || '')

  return {
    title,
    ogTitle: queryMeta('meta[property="og:title"]'),
    twitterTitle: queryMeta('meta[name="twitter:title"]'),
    h1,
    siteName: queryMeta('meta[property="og:site_name"]'),
    description:
      queryMeta('meta[name="description"]') ||
      queryMeta('meta[property="og:description"]')
  }
}

function normalizeAiMetadataText(value) {
  return truncateText(
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim(),
    280
  )
}

function normalizeAiNamingConnectivityError(error, timeoutMs = aiNamingManagerState.settings.timeoutMs) {
  if (error?.name === 'AbortError') {
    return `连通性测试超时，当前超时设置为 ${Math.max(1, Math.round((Number(timeoutMs) || AI_NAMING_DEFAULT_TIMEOUT_MS) / 1000))} 秒。`
  }

  return error instanceof Error ? error.message : '连通性测试失败，请稍后重试。'
}

async function requestAiNamingBatch(preparedItems) {
  const settings = aiNamingManagerState.settings
  const endpoint = getAiNamingEndpoint(settings)
  const requestBody = buildAiNamingRequestBody(preparedItems, settings)
  const response = await fetchWithRequestTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(requestBody)
  }, settings.timeoutMs)

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(extractAiErrorMessage(payload, response.status))
  }

  const rawJsonText = settings.apiStyle === 'responses'
    ? extractResponsesJsonText(payload)
    : extractChatCompletionsJsonText(payload)
  let parsedPayload = null
  try {
    parsedPayload = JSON.parse(rawJsonText)
  } catch (error) {
    throw new Error('AI 返回了无法解析的 JSON 结果。')
  }
  return normalizeAiNamingResponseItems(parsedPayload, preparedItems)
}

function buildAiNamingRequestBody(preparedItems, settings) {
  const systemPrompt = settings.systemPrompt || getDefaultAiNamingSystemPrompt()
  const userPrompt = buildAiNamingUserPrompt(preparedItems)

  if (settings.apiStyle === 'chat_completions') {
    return {
      model: settings.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'bookmark_naming_batch',
          strict: true,
          schema: AI_NAMING_RESPONSE_SCHEMA
        }
      }
    }
  }

  return {
    model: settings.model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: systemPrompt
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: userPrompt
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'bookmark_naming_batch',
        strict: true,
        schema: AI_NAMING_RESPONSE_SCHEMA
      }
    }
  }
}

function getDefaultAiNamingSystemPrompt() {
  return [
    '你是一个面向中文用户的浏览器书签整理助手。',
    '你的任务是根据 current_title、url、final_url、folder_path、domain 和 page_meta，为每条书签生成更适合长期保存、回看和检索的标题。',
    '标题风格要像中文用户手动整理过的书签：清晰、克制、稳定、便于再次查找，而不是网页 SEO 标题或营销文案。',
    '优先提炼页面真正的主题词、对象名、文档名、文章名、产品名或工具名；必要时可保留版本号、年份、平台名、作者名、语言、文档类型等关键信息。',
    '删除无信息价值的噪音，例如站点名堆叠、首页、欢迎语、广告语、登录提示、促销词、重复后缀、无意义分隔符。',
    '默认优先输出自然中文标题；但如果页面主体明显是英文或其他语言，则翻译原语言核心标题，在源语言核心标题后方用冒号添加译文。格式示例：`核心标题: 中文译文`。',
    '不要凭空补充页面中没有出现的实体、结论、时间或用途。',
    `建议标题应尽量精炼，通常不超过 ${AI_NAMING_MAX_TEXT_LENGTH} 个字符。`,
    '如果当前标题已经足够清晰、稳定且适合检索，请返回 keep。',
    '如果页面信息过少、噪音过多、含义不明确，或无法可靠判断该怎样命名，请返回 manual_review。',
    '当 action 为 keep 或 manual_review 时，suggested_title 请填写当前标题或仅做最小清理后的标题。',
    'reason 要简短说明判断依据，适合给中文用户阅读。',
    '必须严格返回 JSON Schema 指定的数据，不要输出任何额外文本。'
  ].join('\n')
}

function buildAiNamingUserPrompt(preparedItems) {
  const payload = preparedItems.map((item) => item.requestItem)
  return [
    '请逐条判断这些书签是否需要改名，并返回结构化结果。',
    '优先语言：与页面标题的主要语言保持一致；若信息不足，则保留当前标题或标记为 manual_review。',
    '输入数据如下：',
    JSON.stringify({ items: payload }, null, 2)
  ].join('\n\n')
}

function normalizeAiNamingResponseItems(payload, preparedItems) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new Error('AI 返回结果缺少 items 数组。')
  }

  const validIds = new Set(preparedItems.map((item) => String(item.bookmark.id)))
  return payload.items
    .map((item) => {
      const bookmarkId = String(item?.bookmark_id || '').trim()
      if (!validIds.has(bookmarkId)) {
        return null
      }

      const action = String(item?.action || '').trim()

      return {
        bookmarkId,
        action:
          action === 'rename' || action === 'keep' || action === 'manual_review'
            ? action
            : 'manual_review',
        suggestedTitle: cleanAiSuggestedTitle(item?.suggested_title),
        confidence: normalizeAiConfidence(item?.confidence),
        reason: String(item?.reason || '').replace(/\s+/g, ' ').trim()
      }
    })
    .filter(Boolean)
}

function mergeAiNamingBatchResults(preparedItems, aiResponseItems) {
  const responseMap = new Map(aiResponseItems.map((item) => [String(item.bookmarkId), item]))
  const failedPreparedItems = []

  for (const preparedItem of preparedItems) {
    const bookmark = preparedItem.bookmark
    const modelItem = responseMap.get(String(bookmark.id))
    if (!modelItem) {
      failedPreparedItems.push(preparedItem)
      continue
    }

    commitAiNamingResult(bookmark, modelItem)
  }

  sortAiNamingResults()
  return failedPreparedItems
}

function upsertAiNamingResult(result) {
  const bookmarkId = String(result?.id || '').trim()
  if (!bookmarkId) {
    return
  }

  const index = aiNamingState.results.findIndex((entry) => String(entry.id) === bookmarkId)
  if (index === -1) {
    aiNamingState.results.push(result)
    return
  }

  aiNamingState.results.splice(index, 1, result)
}

function sortAiNamingResults() {
  const confidenceRank = {
    high: 0,
    medium: 1,
    low: 2
  }
  const statusRank = {
    suggested: 0,
    manual_review: 1,
    failed: 2,
    unchanged: 3
  }

  aiNamingState.results.sort((left, right) => {
    return (
      (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9) ||
      (confidenceRank[left.confidence] ?? 9) - (confidenceRank[right.confidence] ?? 9) ||
      compareByPathTitle(
        {
          path: left.path,
          title: left.currentTitle
        },
        {
          path: right.path,
          title: right.currentTitle
        }
      )
    )
  })
}

function buildAiNamingFailedResult(bookmark, error) {
  return {
    id: String(bookmark.id),
    currentTitle: bookmark.title,
    suggestedTitle: bookmark.title,
    status: 'failed',
    confidence: 'low',
    reason: error instanceof Error ? error.message : '生成建议失败。',
    url: bookmark.url,
    displayUrl: bookmark.displayUrl,
    path: bookmark.path,
    domain: bookmark.domain,
    ancestorIds: bookmark.ancestorIds,
    parentId: bookmark.parentId,
    index: bookmark.index
  }
}

function extractResponsesJsonText(payload) {
  const contentItems = Array.isArray(payload?.output)
    ? payload.output.flatMap((entry) => Array.isArray(entry?.content) ? entry.content : [])
    : []
  const refusalNode = contentItems.find((item) => typeof item?.refusal === 'string' && item.refusal.trim())
  if (refusalNode?.refusal) {
    throw new Error(buildAiStructuredOutputRefusalError(refusalNode.refusal))
  }

  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text
  }

  const textNode = contentItems.find((item) => typeof item?.text === 'string' && item.text.trim())
  if (textNode?.text) {
    return textNode.text
  }

  throw new Error('Responses API 返回中未找到可解析的 JSON 文本。')
}

function extractChatCompletionsJsonText(payload) {
  const message = payload?.choices?.[0]?.message
  if (typeof message?.refusal === 'string' && message.refusal.trim()) {
    throw new Error(buildAiStructuredOutputRefusalError(message.refusal))
  }

  const content = message?.content
  if (typeof content === 'string' && content.trim()) {
    return content
  }

  if (Array.isArray(content)) {
    const refusalNode = content.find((item) => typeof item?.refusal === 'string' && item.refusal.trim())
    if (refusalNode?.refusal) {
      throw new Error(buildAiStructuredOutputRefusalError(refusalNode.refusal))
    }

    const textNode = content.find((item) => typeof item?.text === 'string' && item.text.trim())
    if (textNode?.text) {
      return textNode.text
    }
  }

  throw new Error('Chat Completions 返回中未找到可解析的 JSON 文本。')
}

function extractAiErrorMessage(payload, statusCode) {
  const message = payload?.error?.message || payload?.message || ''
  return message
    ? `AI 请求失败（${statusCode}）：${message}`
    : `AI 请求失败（${statusCode}）。`
}

function buildAiStructuredOutputRefusalError(refusal) {
  const normalizedRefusal = String(refusal || '').replace(/\s+/g, ' ').trim()
  return normalizedRefusal
    ? `模型拒绝生成结构化结果：${truncateText(normalizedRefusal, 120)}`
    : '模型拒绝生成结构化结果。'
}

function normalizeAiConfidence(confidence) {
  const normalized = String(confidence || '').trim()
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized
  }
  return 'low'
}

function cleanAiSuggestedTitle(title) {
  return truncateText(
    String(title || '')
      .replace(/\s+/g, ' ')
      .trim(),
    AI_NAMING_MAX_TEXT_LENGTH
  )
}

function getAiNamingEndpoint(settings) {
  const baseUrl = String(settings.baseUrl || '').replace(/\/+$/, '')
  const suffix = settings.apiStyle === 'chat_completions' ? 'chat/completions' : 'responses'
  return baseUrl.endsWith(`/${suffix}`) ? baseUrl : `${baseUrl}/${suffix}`
}

function renderAvailabilitySelectionGroup() {
  if (!dom.availabilitySelectionGroup) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  const selectedReviewCount = selectedResults.filter((result) => result.status === 'review').length
  const selectedFailedCount = selectedResults.filter((result) => result.status === 'failed').length
  const interactionLocked = isInteractionLocked()

  dom.availabilitySelectionGroup.classList.toggle('hidden', selectedResults.length === 0)
  dom.availabilitySelectionCount.textContent = `${selectedResults.length} 条已选择`
  dom.availabilitySelectionRetest.disabled =
    interactionLocked ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission ||
    selectedResults.length === 0
  dom.availabilitySelectionRetest.textContent = availabilityState.retestingSelection ? '重新测试中…' : '重新测试'
  dom.availabilitySelectionPromote.disabled = interactionLocked || selectedReviewCount === 0
  dom.availabilitySelectionDemote.disabled = interactionLocked || selectedFailedCount === 0
  dom.availabilitySelectionMove.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionIgnoreBookmark.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionIgnoreDomain.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionIgnoreFolder.disabled = interactionLocked || selectedResults.length === 0
  dom.availabilitySelectionDelete.disabled = interactionLocked || selectedResults.length === 0
}

function renderAvailabilityScopeControls() {
  const scopeMeta = getCurrentAvailabilityScopeMeta()
  const aiScopeMeta = getCurrentAiNamingScopeMeta()
  renderScopeTriggerControl(
    dom.availabilityScopeTrigger,
    dom.availabilityScopeLabel,
    dom.availabilityScopeCopy,
    {
      disabled: availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting || availabilityState.catalogLoading,
      label: scopeMeta.label,
      copy: `当前范围：${scopeMeta.label}。本轮只会检测该范围内的书签，历史对比也只与同范围的上一次检测结果进行比较。`
    }
  )
  renderScopeTriggerControl(
    dom.historyScopeTrigger,
    dom.historyScopeLabel,
    dom.historyScopeCopy,
    {
      disabled: availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting || availabilityState.catalogLoading,
      label: scopeMeta.label,
      copy: `当前显示范围：${scopeMeta.label}。这里只展示该检测范围对应的历史日志、异常趋势和已恢复记录。`
    }
  )
  renderScopeTriggerControl(
    dom.aiScopeTrigger,
    dom.aiScopeLabel,
    dom.aiScopeCopy,
    {
      disabled: aiNamingState.running || aiNamingState.applying || availabilityState.catalogLoading,
      label: aiScopeMeta.label,
      copy: `当前范围：${aiScopeMeta.label}。AI 命名只会抓取该范围里的 http/https 书签，并基于网页元信息生成标题建议。`
    }
  )
}

function renderScopeTriggerControl(triggerElement, labelElement, copyElement, { disabled, label, copy }) {
  if (!triggerElement || !labelElement || !copyElement) {
    return
  }

  labelElement.textContent = label
  triggerElement.disabled = disabled
  triggerElement.title = label
  copyElement.textContent = copy
}

function renderScopeModal() {
  if (!dom.scopeModalBackdrop) {
    return
  }

  setModalHidden(dom.scopeModalBackdrop, managerState.scopeModalOpen)

  if (!managerState.scopeModalOpen) {
    return
  }

  const sourceLabel =
    managerState.scopeModalSource === 'history'
      ? '历史范围'
      : managerState.scopeModalSource === 'ai'
        ? 'AI 命名范围'
        : '检测范围'
  const normalizedQuery = normalizeText(managerState.scopeSearchQuery)
  const folders = availabilityState.allFolders
    .filter((folder) => {
      if (!normalizedQuery) {
        return true
      }

      return folder.normalizedTitle.includes(normalizedQuery) || folder.normalizedPath.includes(normalizedQuery)
    })
    .sort((left, right) => compareByPathTitle(left, right))

  dom.scopeModalCopy.textContent = managerState.scopeModalSource === 'ai'
    ? '请选择一个文件夹作为当前 AI 命名范围，支持搜索文件夹名称或路径；选择后会立即更新可处理书签列表。'
    : `请选择一个文件夹作为当前${sourceLabel}，支持搜索文件夹名称或路径；选择后会立即更新可用性检测与历史记录视图。`
  dom.scopeSearchInput.value = managerState.scopeSearchQuery

  const activeScopeFolderId = managerState.scopeModalSource === 'ai'
    ? aiNamingState.scopeFolderId
    : availabilityState.scopeFolderId
  const allSelected = !activeScopeFolderId
  const allOption = `
    <button
      class="scope-folder-card ${allSelected ? 'current' : ''}"
      type="button"
      data-scope-folder-id=""
    >
      <div class="scope-folder-head">
        <span class="scope-folder-icon" aria-hidden="true"></span>
        <strong>全部书签</strong>
      </div>
      <span>不限制来源文件夹</span>
    </button>
  `

  if (!folders.length) {
    dom.scopeFolderResults.innerHTML = `${allOption}<div class="detect-empty">没有匹配的文件夹。</div>`
    return
  }

  dom.scopeFolderResults.innerHTML = `
    ${allOption}
    ${folders.map((folder) => buildScopeFolderCard(folder)).join('')}
  `
}

function buildScopeFolderCard(folder) {
  const activeScopeFolderId = managerState.scopeModalSource === 'ai'
    ? aiNamingState.scopeFolderId
    : availabilityState.scopeFolderId
  const isCurrent = String(folder.id) === String(activeScopeFolderId || '')

  return `
    <button
      class="scope-folder-card ${isCurrent ? 'current' : ''}"
      type="button"
      data-scope-folder-id="${escapeAttr(folder.id)}"
      title="${escapeAttr(folder.path || folder.title || '未命名文件夹')}"
    >
      <div class="scope-folder-head">
        <span class="scope-folder-icon" aria-hidden="true"></span>
        <strong>${escapeHtml(folder.title || '未命名文件夹')}</strong>
      </div>
      <span>${escapeHtml(folder.path || folder.title || '未命名文件夹')}</span>
    </button>
  `
}

function renderReviewResults() {
  if (!dom.availabilityReviewResults) {
    return
  }

  if (availabilityState.running && !availabilityState.reviewResults.length) {
    dom.availabilityReviewResults.innerHTML = '<div class="detect-empty">正在多层检测，暂时还没有低置信异常书签。</div>'
    return
  }

  if (!availabilityState.lastCompletedAt && !availabilityState.running) {
    dom.availabilityReviewResults.innerHTML = '<div class="detect-empty">开始检测后，这里会展示证据不足以直接判定为高置信异常的书签。</div>'
    return
  }

  if (!availabilityState.reviewResults.length) {
    dom.availabilityReviewResults.innerHTML = '<div class="detect-empty">最近一次检测没有低置信异常书签。</div>'
    return
  }

  dom.availabilityReviewResults.innerHTML = availabilityState.reviewResults
    .map((result) => buildAvailabilityResultCard(result, 'warning'))
    .join('')
}

function renderFailedResults() {
  if (!dom.availabilityResults) {
    return
  }

  if (availabilityState.running && !availabilityState.failedResults.length) {
    dom.availabilityResults.innerHTML = '<div class="detect-empty">正在多层检测，暂时还没有发现高置信异常书签。</div>'
    return
  }

  if (availabilityState.lastError && !availabilityState.lastCompletedAt && !availabilityState.failedResults.length) {
    dom.availabilityResults.innerHTML = `<div class="detect-empty">${escapeHtml(availabilityState.lastError)}</div>`
    return
  }

  if (!availabilityState.lastCompletedAt && !availabilityState.running) {
    dom.availabilityResults.innerHTML = '<div class="detect-empty">开始检测后，这里会展示多层验证后仍可判定为高置信异常的书签。</div>'
    return
  }

  if (!availabilityState.failedResults.length) {
    dom.availabilityResults.innerHTML = '<div class="detect-empty">最近一次检测未发现高置信异常书签。</div>'
    return
  }

  dom.availabilityResults.innerHTML = availabilityState.failedResults
    .map((result) => buildAvailabilityResultCard(result, 'danger'))
    .join('')
}

function renderMoveModal() {
  if (!dom.moveModalBackdrop) {
    return
  }

  setModalHidden(dom.moveModalBackdrop, managerState.moveModalOpen)

  if (!managerState.moveModalOpen) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  const normalizedQuery = normalizeText(managerState.moveSearchQuery)
  const folders = availabilityState.allFolders
    .filter((folder) => String(folder.id) !== ROOT_ID)
    .filter((folder) => {
      if (!normalizedQuery) {
        return true
      }

      return folder.normalizedTitle.includes(normalizedQuery) || folder.normalizedPath.includes(normalizedQuery)
    })
    .sort((left, right) => compareByPathTitle(left, right))

  dom.moveModalCopy.textContent = selectedResults.length
    ? `请选择一个目标文件夹，已选 ${selectedResults.length} 条书签会被一起移动到该位置。`
    : '请选择一个目标文件夹，所选书签会被一起移动到该位置。'
  dom.moveSearchInput.value = managerState.moveSearchQuery

  if (!folders.length) {
    dom.moveFolderResults.innerHTML = '<div class="detect-empty">没有匹配的目标文件夹。</div>'
    return
  }

  dom.moveFolderResults.innerHTML = folders
    .map((folder) => buildMoveFolderCard(folder))
    .join('')
}

function buildAvailabilityResultCard(result, tone) {
  const selected = managerState.selectedAvailabilityIds.has(String(result.id))
  const interactionLocked = isInteractionLocked()
  const actionButton = tone === 'warning'
    ? `
        <button
          class="detect-result-action"
          type="button"
          data-review-action="promote-failed"
          data-bookmark-id="${escapeAttr(result.id)}"
          ${interactionLocked ? 'disabled' : ''}
        >
          移入高置信异常
        </button>
      `
    : `
        <button
          class="detect-result-action"
          type="button"
          data-failed-action="demote-review"
          data-bookmark-id="${escapeAttr(result.id)}"
          ${interactionLocked ? 'disabled' : ''}
        >
          移回低置信异常
        </button>
      `

  return `
    <article class="detect-result-card ${selected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <label class="detect-result-check">
            <input
              type="checkbox"
              data-availability-select="true"
              data-bookmark-id="${escapeAttr(result.id)}"
              ${selected ? 'checked' : ''}
              ${interactionLocked ? 'disabled' : ''}
            >
            <span>选择</span>
          </label>
          <span class="options-chip ${tone}">${escapeHtml(result.badgeText || '检测结果')}</span>
        </div>
        <div class="detect-result-actions">
          ${actionButton}
          <a
            class="detect-result-open"
            href="${escapeAttr(result.url)}"
            target="_blank"
            rel="noreferrer noopener"
          >
            打开链接
          </a>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(result.title || '未命名书签')}</strong>
        <a
          class="detect-result-url"
          href="${escapeAttr(result.url)}"
          target="_blank"
          rel="noreferrer noopener"
        >
          ${escapeHtml(displayUrl(result.url))}
        </a>
        <p class="detect-result-detail">${escapeHtml(result.detail)}</p>
        <p class="detect-result-path" title="${escapeAttr(result.path || '未归档路径')}">${escapeHtml(result.path || '未归档路径')}</p>
      </div>
    </article>
  `
}

function buildMoveFolderCard(folder) {
  return `
    <button
      class="move-folder-card"
      type="button"
      data-move-target-folder="${escapeAttr(folder.id)}"
      ${isInteractionLocked() ? 'disabled' : ''}
    >
      <strong>${escapeHtml(folder.title || '未命名文件夹')}</strong>
      <span>${escapeHtml(folder.path || folder.title || '文件夹')}</span>
    </button>
  `
}

function promoteReviewResultToFailed(bookmarkId) {
  const reviewIndex = availabilityState.reviewResults.findIndex((result) => {
    return String(result.id) === String(bookmarkId)
  })

  if (reviewIndex === -1) {
    return
  }

  const [result] = availabilityState.reviewResults.splice(reviewIndex, 1)
  const movedResult = {
    ...result,
    status: 'failed',
    badgeText: '手动移入异常',
    detail: appendManualPromotionDetail(result.detail)
  }

  availabilityState.reviewCount = availabilityState.reviewResults.length
  upsertResult(availabilityState.failedResults, movedResult)
  availabilityState.failedCount = availabilityState.failedResults.length
  syncHistoryEntryStatus(bookmarkId, 'failed')
  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)
  renderAvailabilitySection()
}

function appendManualPromotionDetail(detail) {
  const normalizedDetail = normalizeManualMoveDetail(detail)
  const promotionNote = '已由你手动移入高置信异常，可参与批量删除。'

  if (!normalizedDetail) {
    return promotionNote
  }

  if (normalizedDetail.includes(promotionNote)) {
    return normalizedDetail
  }

  return `${normalizedDetail} ${promotionNote}`
}

function demoteFailedResultToReview(bookmarkId) {
  const failedIndex = availabilityState.failedResults.findIndex((result) => {
    return String(result.id) === String(bookmarkId)
  })

  if (failedIndex === -1) {
    return
  }

  const [result] = availabilityState.failedResults.splice(failedIndex, 1)
  const movedResult = {
    ...result,
    status: 'review',
    badgeText: '手动移回低置信',
    detail: appendManualReviewDetail(result.detail)
  }

  availabilityState.failedCount = availabilityState.failedResults.length
  upsertResult(availabilityState.reviewResults, movedResult)
  availabilityState.reviewCount = availabilityState.reviewResults.length
  syncHistoryEntryStatus(bookmarkId, 'review')
  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)
  renderAvailabilitySection()
}

function appendManualReviewDetail(detail) {
  const normalizedDetail = normalizeManualMoveDetail(detail)
  const reviewNote = '已由你手动移回低置信异常，不再参与批量删除。'

  if (!normalizedDetail) {
    return reviewNote
  }

  if (normalizedDetail.includes(reviewNote)) {
    return normalizedDetail
  }

  return `${normalizedDetail} ${reviewNote}`
}

function normalizeManualMoveDetail(detail) {
  return String(detail || '')
    .replace(/\s*已由你手动移入高置信异常，可参与批量删除。/g, '')
    .replace(/\s*已由你手动移回低置信异常，不再参与批量删除。/g, '')
    .trim()
}

function upsertResult(collection, nextResult) {
  const existingIndex = collection.findIndex((result) => {
    return String(result.id) === String(nextResult.id)
  })

  if (existingIndex === -1) {
    collection.push(nextResult)
    return
  }

  collection[existingIndex] = nextResult
}

function sortResultsByPath(results) {
  results.sort((left, right) => compareByPathTitle(left, right))
}

function toggleAvailabilitySelection(bookmarkId, checked) {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  if (checked) {
    managerState.selectedAvailabilityIds.add(normalizedId)
  } else {
    managerState.selectedAvailabilityIds.delete(normalizedId)
  }

  renderAvailabilitySection()
}

function clearAvailabilitySelection() {
  managerState.selectedAvailabilityIds.clear()
  renderAvailabilitySection()
}

function getSelectedAvailabilityResults() {
  const resultMap = new Map(
    [...availabilityState.reviewResults, ...availabilityState.failedResults].map((result) => [
      String(result.id),
      result
    ])
  )

  return [...managerState.selectedAvailabilityIds]
    .map((bookmarkId) => resultMap.get(String(bookmarkId)))
    .filter(Boolean)
}

function selectAvailabilityResultsByStatus(status) {
  const targetResults = (status === 'failed'
    ? availabilityState.failedResults
    : availabilityState.reviewResults
  )
    .map((result) => String(result.id))

  managerState.selectedAvailabilityIds = new Set([
    ...managerState.selectedAvailabilityIds,
    ...targetResults
  ])

  renderAvailabilitySection()
}

function moveSelectedAvailabilityResults(targetStatus) {
  if (isInteractionLocked()) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  selectedResults.forEach((result) => {
    if (targetStatus === 'failed' && result.status === 'review') {
      promoteReviewResultToFailed(result.id)
    }

    if (targetStatus === 'review' && result.status === 'failed') {
      demoteFailedResultToReview(result.id)
    }
  })
}

async function retestSelectedAvailabilityResults() {
  if (
    isInteractionLocked() ||
    availabilityState.catalogLoading ||
    availabilityState.requestingPermission
  ) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  const targetBookmarks = selectedResults
    .map((result) => availabilityState.bookmarkMap.get(String(result.id)) || result)
    .filter((bookmark) => isCheckableUrl(bookmark?.url))

  if (!targetBookmarks.length) {
    availabilityState.lastError = '所选书签中没有可重新测试的 http/https 链接。'
    renderAvailabilitySection()
    return
  }

  availabilityState.lastError = ''
  const probeEnabled = await ensureProbePermissionForRun({ interactive: true })
  availabilityState.retestingSelection = true
  availabilityState.retestSelectionTotal = targetBookmarks.length
  availabilityState.retestSelectionCompleted = 0
  availabilityState.retestSelectionProbeEnabled = probeEnabled
  renderAvailabilitySection()

  let processedCount = 0

  try {
    let nextIndex = 0
    const workerCount = Math.min(AVAILABILITY_CONCURRENCY, targetBookmarks.length)

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < targetBookmarks.length) {
          const currentIndex = nextIndex
          nextIndex += 1

          const bookmark = targetBookmarks[currentIndex]
          try {
            if (bookmark && !isBookmarkRemovedDuringRun(bookmark.id)) {
              const result = await inspectBookmarkAvailability(bookmark, { probeEnabled })
              if (result && !isBookmarkRemovedDuringRun(result.id)) {
                applyRetestedAvailabilityResult(result)
                processedCount += 1
              }
            }
          } finally {
            availabilityState.retestSelectionCompleted += 1
            scheduleAvailabilityRender()
          }
        }
      })
    )

    sortResultsByPath(availabilityState.reviewResults)
    sortResultsByPath(availabilityState.failedResults)
    sortResultsByPath(availabilityState.redirectResults)

    try {
      await persistRedirectCacheSnapshot(redirectsCallbacks, {
        savedAt: Date.now(),
        scope: getCurrentAvailabilityScopeMeta()
      })
    } catch {}

    availabilityState.lastError = `已重新测试 ${processedCount} 条已选书签。`
  } catch (error) {
    availabilityState.lastError =
      error instanceof Error
        ? `重新测试所选书签失败：${error.message}`
        : '重新测试所选书签失败，请稍后重试。'
  } finally {
    availabilityState.retestingSelection = false
    availabilityState.retestSelectionTotal = 0
    availabilityState.retestSelectionCompleted = 0
    availabilityState.retestSelectionProbeEnabled = false
    renderAvailabilitySection()
  }
}

function applyRetestedAvailabilityResult(result) {
  const bookmarkId = String(result?.id || '').trim()
  if (!bookmarkId) {
    return
  }

  const shouldKeepSelected = managerState.selectedAvailabilityIds.has(bookmarkId)
  removeAvailabilityResultById(bookmarkId)

  if (result.status === 'available') {
    availabilityState.availableCount += 1
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    return
  }

  if (result.status === 'redirected') {
    upsertResult(availabilityState.redirectResults, {
      ...result,
      finalUrl: result.finalUrl || result.url
    })
    availabilityState.redirectedCount = availabilityState.redirectResults.length
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    return
  }

  const historyStatus = managerState.previousHistoryMap.has(bookmarkId) ? 'persistent' : 'new'
  const abnormalStreak = managerState.previousHistoryMap.has(bookmarkId)
    ? getHistoricalAbnormalStreak(bookmarkId, historyCallbacks) + 1
    : 1
  const nextResult = {
    ...result,
    historyStatus,
    abnormalStreak
  }

  upsertAvailabilityHistoryEntry(nextResult)

  if (matchesIgnoreRules(nextResult)) {
    upsertResult(managerState.suppressedResults, nextResult)
    availabilityState.ignoredCount = managerState.suppressedResults.length
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    return
  }

  if (nextResult.status === 'review') {
    upsertResult(availabilityState.reviewResults, nextResult)
    availabilityState.reviewCount = availabilityState.reviewResults.length
  } else {
    upsertResult(availabilityState.failedResults, nextResult)
    availabilityState.failedCount = availabilityState.failedResults.length
  }

  if (shouldKeepSelected) {
    managerState.selectedAvailabilityIds.add(bookmarkId)
  }
}

function removeAvailabilityResultById(bookmarkId) {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  availabilityState.reviewResults = availabilityState.reviewResults.filter((result) => {
    return String(result.id) !== normalizedId
  })
  availabilityState.failedResults = availabilityState.failedResults.filter((result) => {
    return String(result.id) !== normalizedId
  })
  managerState.suppressedResults = managerState.suppressedResults.filter((result) => {
    return String(result.id) !== normalizedId
  })
  managerState.currentHistoryEntries = managerState.currentHistoryEntries.filter((entry) => {
    return String(entry.id) !== normalizedId
  })
  removeRedirectIdsFromState([normalizedId])

  availabilityState.reviewCount = availabilityState.reviewResults.length
  availabilityState.failedCount = availabilityState.failedResults.length
  availabilityState.ignoredCount = managerState.suppressedResults.length
}

async function ignoreSelectedAvailabilityResults(kind) {
  if (isInteractionLocked()) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  let addedCount = 0

  if (kind === 'bookmark') {
    for (const result of selectedResults) {
      if (managerState.ignoreRules.bookmarkIds.has(result.id)) {
        continue
      }

      managerState.ignoreRules.bookmarks.push({
        bookmarkId: String(result.id),
        title: result.title,
        url: result.url,
        createdAt: Date.now()
      })
      managerState.ignoreRules.bookmarkIds.add(String(result.id))
      addedCount += 1
    }
  }

  if (kind === 'domain') {
    for (const result of selectedResults) {
      if (!result.domain || managerState.ignoreRules.domainValues.has(result.domain)) {
        continue
      }

      managerState.ignoreRules.domains.push({
        domain: result.domain,
        createdAt: Date.now()
      })
      managerState.ignoreRules.domainValues.add(result.domain)
      addedCount += 1
    }
  }

  if (kind === 'folder') {
    for (const result of selectedResults) {
      const folderId = String(result.parentId || '').trim()
      if (!folderId || managerState.ignoreRules.folderIds.has(folderId)) {
        continue
      }

      const folder = availabilityState.folderMap.get(folderId)
      managerState.ignoreRules.folders.push({
        folderId,
        title: folder?.title || '未命名文件夹',
        path: folder?.path || result.path || '',
        createdAt: Date.now()
      })
      managerState.ignoreRules.folderIds.add(folderId)
      addedCount += 1
    }
  }

  if (!addedCount) {
    availabilityState.lastError = '没有新增忽略规则。'
    renderAvailabilitySection()
    return
  }

  await saveIgnoreRules()
  repartitionAvailabilityResultsByIgnoreRules()
  clearAvailabilitySelection()
  availabilityState.lastError = `已新增 ${addedCount} 条忽略规则。`
  renderAvailabilitySection()
}

async function deleteSelectedAvailabilityResults() {
  if (isInteractionLocked()) {
    return
  }

  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    return
  }

  if (!window.confirm(`确认删除这 ${selectedResults.length} 条已选书签，并移入回收站？`)) {
    return
  }

  await deleteBookmarksToRecycle(
    selectedResults.map((result) => result.id),
    '异常书签批量删除',
    recycleCallbacks
  )
  clearAvailabilitySelection()
}

function openMoveModal(source) {
  if (isInteractionLocked()) {
    return
  }

  if (source === 'availability' && !getSelectedAvailabilityResults().length) {
    return
  }

  managerState.moveSelectionSource = source
  managerState.moveSearchQuery = ''
  managerState.moveModalOpen = true
  renderMoveModal()

  window.setTimeout(() => {
    dom.moveSearchInput?.focus()
  }, 0)
}

function openScopeModal(source) {
  const locked = source === 'ai'
    ? aiNamingState.running || aiNamingState.applying || availabilityState.catalogLoading
    : availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting || availabilityState.catalogLoading

  if (locked) {
    return
  }

  managerState.scopeModalSource = source
  managerState.scopeSearchQuery = ''
  managerState.scopeModalOpen = true
  renderScopeModal()

  window.setTimeout(() => {
    dom.scopeSearchInput?.focus()
  }, 0)
}

function closeMoveModal() {
  if (availabilityState.deleting) {
    return
  }

  managerState.moveModalOpen = false
  managerState.moveSearchQuery = ''
  renderMoveModal()
}

function closeScopeModal() {
  if (availabilityState.deleting) {
    return
  }

  managerState.scopeModalOpen = false
  managerState.scopeSearchQuery = ''
  renderScopeModal()
}

async function handleMoveFolderResultsClick(event) {
  const targetButton = event.target.closest('[data-move-target-folder]')
  if (!targetButton || isInteractionLocked()) {
    return
  }

  const folderId = String(targetButton.getAttribute('data-move-target-folder') || '').trim()
  if (!folderId) {
    return
  }

  await moveSelectedAvailabilityToFolder(folderId)
}

async function handleScopeFolderResultsClick(event) {
  const targetButton = event.target.closest('[data-scope-folder-id]')
  if (
    !targetButton ||
    availabilityState.catalogLoading
  ) {
    return
  }

  const folderId = String(targetButton.getAttribute('data-scope-folder-id') || '').trim()
  const source = managerState.scopeModalSource
  if (source === 'ai' && (aiNamingState.running || aiNamingState.applying)) {
    return
  }

  if (source !== 'ai' && (availabilityState.running || availabilityState.retestingSelection || availabilityState.deleting)) {
    return
  }

  closeScopeModal()
  if (source === 'ai') {
    await handleAiScopeChange(folderId)
    return
  }

  await handleAvailabilityScopeChange(folderId)
}

async function moveSelectedAvailabilityToFolder(folderId) {
  const selectedResults = getSelectedAvailabilityResults()
  if (!selectedResults.length) {
    closeMoveModal()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  renderAvailabilitySection()

  const movedIds = []
  let moveError = null

  try {
    for (const result of selectedResults) {
      await moveBookmark(result.id, folderId)
      movedIds.push(result.id)
    }
  } catch (error) {
    moveError = error
  } finally {
    availabilityState.deleting = false
    closeMoveModal()

    if (movedIds.length) {
      await hydrateAvailabilityCatalog({ preserveResults: true })
    }

    clearAvailabilitySelection()
    const targetFolder = availabilityState.folderMap.get(folderId)

    if (moveError) {
      availabilityState.lastError =
        moveError instanceof Error
          ? `批量移动过程中断，已移动 ${movedIds.length} 条：${moveError.message}`
          : `批量移动过程中断，已移动 ${movedIds.length} 条。`
    } else if (movedIds.length) {
      availabilityState.lastError = `已将 ${movedIds.length} 条书签移动到 ${targetFolder?.path || targetFolder?.title || '目标文件夹'}。`
    }

    renderAvailabilitySection()
  }
}

function openDeleteModal() {
  if (
    !availabilityState.failedResults.length ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  availabilityState.deleteModalOpen = true
  renderDeleteModal()
}

function closeDeleteModal() {
  if (availabilityState.deleting) {
    return
  }

  availabilityState.deleteModalOpen = false
  renderDeleteModal()
}

async function confirmDeleteFailedBookmarks() {
  if (
    !availabilityState.failedResults.length ||
    availabilityState.deleting ||
    availabilityState.stopRequested ||
    (availabilityState.running && !availabilityState.paused)
  ) {
    return
  }

  availabilityState.deleteModalOpen = false
  renderDeleteModal()

  await deleteBookmarksToRecycle(
    availabilityState.failedResults.map((result) => result.id),
    '高置信异常批量删除',
    recycleCallbacks
  )
}

function removeDeletedResultsFromState(bookmarkIds) {
  const removedIdSet = new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))
  if (!removedIdSet.size) {
    return
  }

  removedIdSet.forEach((bookmarkId) => {
    availabilityState.deletedBookmarkIds.add(bookmarkId)
    managerState.selectedAvailabilityIds.delete(bookmarkId)
    managerState.selectedDuplicateIds.delete(bookmarkId)
  })

  availabilityState.reviewResults = availabilityState.reviewResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  availabilityState.failedResults = availabilityState.failedResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  managerState.suppressedResults = managerState.suppressedResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  managerState.currentHistoryEntries = managerState.currentHistoryEntries.filter((entry) => {
    return !removedIdSet.has(String(entry.id))
  })
  removeRedirectIdsFromState([...removedIdSet])

  availabilityState.reviewCount = availabilityState.reviewResults.length
  availabilityState.failedCount = availabilityState.failedResults.length
  availabilityState.redirectedCount = availabilityState.redirectResults.length
  availabilityState.ignoredCount = managerState.suppressedResults.length
}

function getBookmarkRecord(bookmarkId) {
  const normalizedId = String(bookmarkId || '').trim()
  return (
    availabilityState.bookmarkMap.get(normalizedId) ||
    availabilityState.reviewResults.find((result) => String(result.id) === normalizedId) ||
    availabilityState.failedResults.find((result) => String(result.id) === normalizedId) ||
    availabilityState.redirectResults.find((result) => String(result.id) === normalizedId) ||
    managerState.suppressedResults.find((result) => String(result.id) === normalizedId) ||
    null
  )
}

function renderDeleteModal() {
  if (!dom.deleteModalBackdrop) {
    return
  }

  setModalHidden(dom.deleteModalBackdrop, availabilityState.deleteModalOpen)
  dom.deleteModalCopy.textContent = availabilityState.failedResults.length
    ? `确认删除当前 ${availabilityState.failedResults.length} 条高置信异常书签？这些书签会从 Chrome 书签中移除，并先进入回收站；低置信异常结果会保留。`
    : '这些书签会从 Chrome 书签中移除，并先进入回收站；低置信异常结果会保留。'
  dom.confirmDeleteModal.disabled = availabilityState.deleting
  dom.confirmDeleteModal.textContent = availabilityState.deleting ? '正在删除…' : '确认删除'
}

function reconcileCatalogAfterMutation() {
  availabilityState.reviewResults = syncBookmarkMetadataForResults(availabilityState.reviewResults)
  availabilityState.failedResults = syncBookmarkMetadataForResults(availabilityState.failedResults)
  availabilityState.redirectResults = syncBookmarkMetadataForResults(availabilityState.redirectResults)
  managerState.suppressedResults = syncBookmarkMetadataForResults(managerState.suppressedResults)
  managerState.currentHistoryEntries = managerState.currentHistoryEntries
    .map((entry) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(entry.id))
      if (!latestBookmark) {
        return null
      }

      return {
        ...entry,
        title: latestBookmark.title,
        url: latestBookmark.url,
        path: latestBookmark.path
      }
    })
    .filter(Boolean)

  repartitionAvailabilityResultsByIgnoreRules()
  availabilityState.redirectedCount = availabilityState.redirectResults.length
}

function syncBookmarkMetadataForResults(results) {
  return results
    .map((result) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(result.id))
      if (!latestBookmark) {
        return null
      }

      return {
        ...result,
        title: latestBookmark.title,
        url: latestBookmark.url,
        displayUrl: latestBookmark.displayUrl,
        path: latestBookmark.path,
        ancestorIds: latestBookmark.ancestorIds,
        parentId: latestBookmark.parentId,
        index: latestBookmark.index,
        domain: latestBookmark.domain,
        normalizedTitle: latestBookmark.normalizedTitle,
        normalizedUrl: latestBookmark.normalizedUrl,
        duplicateKey: latestBookmark.duplicateKey
      }
    })
    .filter(Boolean)
}

function repartitionAvailabilityResultsByIgnoreRules() {
  const combinedResults = dedupeResultsById([
    ...availabilityState.reviewResults,
    ...availabilityState.failedResults,
    ...managerState.suppressedResults
  ])

  availabilityState.reviewResults = []
  availabilityState.failedResults = []
  managerState.suppressedResults = []

  for (const result of combinedResults) {
    if (matchesIgnoreRules(result)) {
      managerState.suppressedResults.push(result)
      continue
    }

    if (result.status === 'failed') {
      availabilityState.failedResults.push(result)
    } else {
      availabilityState.reviewResults.push(result)
    }
  }

  availabilityState.reviewCount = availabilityState.reviewResults.length
  availabilityState.failedCount = availabilityState.failedResults.length
  availabilityState.ignoredCount = managerState.suppressedResults.length
  sortResultsByPath(availabilityState.reviewResults)
  sortResultsByPath(availabilityState.failedResults)

  syncSelectionSet(
    managerState.selectedAvailabilityIds,
    new Set(
      [...availabilityState.reviewResults, ...availabilityState.failedResults].map((result) => String(result.id))
    )
  )
}

function dedupeResultsById(results) {
  const resultMap = new Map()

  for (const result of results) {
    const bookmarkId = String(result?.id || '').trim()
    if (!bookmarkId) {
      continue
    }

    resultMap.set(bookmarkId, result)
  }

  return [...resultMap.values()]
}


function getModeBadgeTone() {
  if (availabilityState.catalogLoading || availabilityState.permissionPending || availabilityState.requestingPermission) {
    return 'warning'
  }

  return availabilityState.probePermissionGranted ? 'success' : 'muted'
}

function getModeBadgeText() {
  if (availabilityState.catalogLoading) {
    return '准备中'
  }

  if (availabilityState.requestingPermission) {
    return '授权中'
  }

  if (availabilityState.permissionPending) {
    return '读取中'
  }

  return availabilityState.probePermissionGranted ? '多层校验' : '后台导航'
}

function getModeCopyText() {
  if (availabilityState.catalogLoading) {
    return '正在读取书签并准备多层可用性校验。'
  }

  if (!availabilityState.bookmarks.length) {
    return '当前没有可检测的 http/https 书签，因此不会启动后台标签页或第二层网络探测。'
  }

  if (availabilityState.probePermissionGranted) {
    return `当前会按“后台导航 -> 失败重试 -> 网络探测”三层方式校验。后台导航单条超时 ${Math.round(NAVIGATION_TIMEOUT_MS / 1000)} 秒，重试超时 ${Math.round(NAVIGATION_RETRY_TIMEOUT_MS / 1000)} 秒。`
  }

  return '当前默认会先做后台导航检测。点击开始检测时会尝试申请第二层网络探测权限；如果未授权，系统仍会继续做后台导航检测。'
}

function getAvailabilityActionText() {
  const scopeMeta = getCurrentAvailabilityScopeMeta()
  const scopeActionLabel = scopeMeta.type === 'all' ? '全部书签' : '当前范围'

  if (availabilityState.catalogLoading) {
    return '正在准备检测…'
  }

  if (availabilityState.requestingPermission) {
    return '正在准备第二层探测…'
  }

  if (availabilityState.retestingSelection) {
    return '正在重新测试…'
  }

  if (availabilityState.running) {
    if (availabilityState.stopRequested) {
      return '停止中…'
    }

    if (availabilityState.paused) {
      return '检测已暂停'
    }

    return '正在检测…'
  }

  return availabilityState.lastCompletedAt ? `重新检测${scopeActionLabel}` : `开始检测${scopeActionLabel}`
}

function getAvailabilityStatusCopy() {
  if (availabilityState.lastError) {
    return availabilityState.lastError
  }

  if (availabilityState.catalogLoading) {
    return '正在读取书签并准备检测目录。'
  }

  if (availabilityState.storageLoading) {
    return '正在读取忽略规则、检测历史与回收站。'
  }

  if (availabilityState.requestingPermission) {
    return '正在为第二层网络探测申请当前书签来源站点的访问权限。'
  }

  if (availabilityState.retestingSelection) {
    return availabilityState.retestSelectionProbeEnabled
      ? `正在重新测试已选书签，当前进度 ${availabilityState.retestSelectionCompleted} / ${availabilityState.retestSelectionTotal}。本次会继续执行后台导航、失败重试和网络探测。`
      : `正在重新测试已选书签，当前进度 ${availabilityState.retestSelectionCompleted} / ${availabilityState.retestSelectionTotal}。本次仅执行后台导航与失败重试。`
  }

  if (availabilityState.running) {
    if (availabilityState.stopRequested) {
      return '正在停止本次检测。当前已开始的检测步骤结束后，会保留已完成结果并停止继续排队。'
    }

    if (availabilityState.paused) {
      return '检测已暂停。继续后会从当前进度继续；已经开始的单条检测会在当前步骤结束后暂停。'
    }

    if (availabilityState.currentRunProbeEnabled) {
      return `本轮依次执行后台导航、失败重试和网络探测。后台导航超时 ${Math.round(NAVIGATION_TIMEOUT_MS / 1000)} 秒，重试超时 ${Math.round(NAVIGATION_RETRY_TIMEOUT_MS / 1000)} 秒。`
    }

    return `本轮仅执行后台导航和失败重试，因为未启用第二层网络探测。后台导航超时 ${Math.round(NAVIGATION_TIMEOUT_MS / 1000)} 秒，重试超时 ${Math.round(NAVIGATION_RETRY_TIMEOUT_MS / 1000)} 秒。`
  }

  if (availabilityState.lastCompletedAt) {
    if (availabilityState.lastRunOutcome === 'stopped') {
      return `本轮检测范围为“${getCurrentAvailabilityScopeMeta().label}”，已手动停止，已完成 ${availabilityState.checkedBookmarks} 条书签，可访问 ${availabilityState.availableCount} 条，重定向 ${availabilityState.redirectedCount} 条，低置信异常 ${availabilityState.reviewCount} 条，高置信异常 ${availabilityState.failedCount} 条。`
    }

    return `本轮检测范围为“${getCurrentAvailabilityScopeMeta().label}”，共检查 ${availabilityState.eligibleBookmarks} 条书签，可访问 ${availabilityState.availableCount} 条，重定向 ${availabilityState.redirectedCount} 条，低置信异常 ${availabilityState.reviewCount} 条，高置信异常 ${availabilityState.failedCount} 条，已忽略 ${availabilityState.ignoredCount} 条。`
  }

  return '仅检测 http/https 书签，默认会做后台导航；若允许第二层网络探测，则会进一步交叉验证。'
}

function scheduleAvailabilityRender() {
  if (availabilityRenderFrame) {
    return
  }

  availabilityRenderFrame = window.requestAnimationFrame(() => {
    availabilityRenderFrame = 0
    renderAvailabilitySection()
  })
}

function resetDetectionResults() {
  availabilityState.checkedBookmarks = 0
  availabilityState.availableCount = 0
  availabilityState.redirectedCount = 0
  availabilityState.reviewCount = 0
  availabilityState.failedCount = 0
  availabilityState.ignoredCount = 0
  availabilityState.reviewResults = []
  availabilityState.failedResults = []
  availabilityState.redirectResults = []
  managerState.suppressedResults = []
  managerState.currentHistoryEntries = []
}

function collectRequestOrigins(bookmarks) {
  const origins = new Set()

  for (const bookmark of bookmarks) {
    try {
      const parsedUrl = new URL(bookmark.url)
      if (/^https?:$/i.test(parsedUrl.protocol)) {
        origins.add(`${parsedUrl.origin}/*`)
      }
    } catch (error) {
      continue
    }
  }

  return [...origins].sort((left, right) => left.localeCompare(right))
}

function truncateText(value, maxLength) {
  const safeText = String(value || '').trim()
  const limit = Math.max(1, Number(maxLength) || 1)
  if (safeText.length <= limit) {
    return safeText
  }

  return `${safeText.slice(0, Math.max(limit - 1, 1)).trim()}…`
}

function isCheckableUrl(url) {
  return /^https?:\/\//i.test(String(url || ''))
}

function getOriginPermissionPattern(url) {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return ''
    }

    return `${parsedUrl.origin}/*`
  } catch (error) {
    return ''
  }
}

function containsPermissions(query) {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

function requestPermissions(query) {
  return new Promise((resolve, reject) => {
    chrome.permissions.request(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}