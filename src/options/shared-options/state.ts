// @ts-nocheck
import {
  AI_NAMING_DEFAULT_BASE_URL,
  AI_NAMING_DEFAULT_MODEL,
  AI_NAMING_DEFAULT_TIMEOUT_MS,
  AI_NAMING_DEFAULT_BATCH_SIZE
} from './constants.js'

export function createEmptyIgnoreRules() {
  return {
    bookmarks: [],
    domains: [],
    folders: [],
    bookmarkIds: new Set(),
    domainValues: new Set(),
    folderIds: new Set()
  }
}

export function createEmptyRedirectCache() {
  return {
    savedAt: 0,
    scope: normalizeHistoryRunScope(),
    results: []
  }
}

export function createDefaultAiNamingSettings() {
  return {
    baseUrl: AI_NAMING_DEFAULT_BASE_URL,
    apiKey: '',
    model: AI_NAMING_DEFAULT_MODEL,
    customModels: [],
    apiStyle: 'responses',
    timeoutMs: AI_NAMING_DEFAULT_TIMEOUT_MS,
    batchSize: AI_NAMING_DEFAULT_BATCH_SIZE,
    autoSelectHighConfidence: true,
    systemPrompt: ''
  }
}

export function normalizeHistoryRunScope(scope) {
  if (!scope || typeof scope !== 'object') {
    return {
      key: 'all',
      type: 'all',
      folderId: '',
      label: '全部书签'
    }
  }

  const type = String(scope.type || 'all').trim() === 'folder' ? 'folder' : 'all'
  const folderId = type === 'folder' ? String(scope.folderId || '').trim() : ''
  const key = type === 'folder' && folderId ? `folder:${folderId}` : 'all'

  return {
    key,
    type,
    folderId,
    label: String(scope.label || (key === 'all' ? '全部书签' : '指定文件夹')).trim() || '全部书签'
  }
}

export const availabilityState = {
  catalogLoading: true,
  permissionPending: true,
  requestingPermission: false,
  storageLoading: true,
  probePermissionGranted: false,
  currentRunProbeEnabled: false,
  running: false,
  retestingSelection: false,
  retestSelectionTotal: 0,
  retestSelectionCompleted: 0,
  retestSelectionProbeEnabled: false,
  paused: false,
  stopRequested: false,
  deleting: false,
  deleteModalOpen: false,
  scopeFolderId: '',
  bookmarks: [],
  allBookmarks: [],
  allFolders: [],
  bookmarkMap: new Map(),
  folderMap: new Map(),
  runQueue: [],
  deletedBookmarkIds: new Set(),
  requestOrigins: [],
  totalBookmarks: 0,
  eligibleBookmarks: 0,
  checkedBookmarks: 0,
  availableCount: 0,
  redirectedCount: 0,
  reviewCount: 0,
  failedCount: 0,
  ignoredCount: 0,
  skippedCount: 0,
  reviewResults: [],
  failedResults: [],
  redirectResults: [],
  lastCompletedAt: 0,
  lastRunOutcome: '',
  lastError: ''
}

export const managerState = {
  ignoreRules: createEmptyIgnoreRules(),
  historyRuns: [],
  redirectCache: createEmptyRedirectCache(),
  previousHistoryMap: new Map(),
  historyLastRunAt: 0,
  historyRecoveredResults: [],
  historyNewCount: 0,
  historyPersistentCount: 0,
  suppressedResults: [],
  currentHistoryEntries: [],
  duplicateGroups: [],
  recycleBin: [],
  selectedAvailabilityIds: new Set(),
  selectedRedirectIds: new Set(),
  selectedDuplicateIds: new Set(),
  selectedRecycleIds: new Set(),
  historyLogsCollapsed: false,
  scopeModalOpen: false,
  scopeModalSource: 'availability',
  scopeSearchQuery: '',
  moveModalOpen: false,
  moveSearchQuery: '',
  moveSelectionSource: 'availability',
  aiModelModalOpen: false,
  aiRevealApiKey: false
}

export const aiNamingState = {
  scopeFolderId: '',
  bookmarks: [],
  requestOrigins: [],
  settingsDirty: false,
  testingConnection: false,
  running: false,
  stopRequested: false,
  applying: false,
  requestingPermission: false,
  permissionGranted: false,
  checkedBookmarks: 0,
  eligibleBookmarks: 0,
  suggestedCount: 0,
  manualReviewCount: 0,
  unchangedCount: 0,
  highConfidenceCount: 0,
  mediumConfidenceCount: 0,
  lowConfidenceCount: 0,
  failedCount: 0,
  results: [],
  selectedResultIds: new Set(),
  lastConnectivityTestAt: 0,
  lastConnectivityTestStatus: '',
  lastConnectivityTestMessage: '',
  lastCompletedAt: 0,
  lastError: ''
}

export const aiNamingManagerState = {
  settings: createDefaultAiNamingSettings()
}
