import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import {
  BOOKMARKS_BAR_ID,
  STORAGE_KEYS
} from '../shared/constants.js'
import {
  findBookmarksBar
} from '../shared/bookmark-tree.js'
import { buildBookmarkCatalogSnapshot, type BookmarkCatalogSnapshot } from '../shared/bookmark-catalog.js'
import { getLocalStorage, setLocalStorage } from '../shared/storage.js'
import { consumeNewtabStartupData, getBookmarkTree } from './newtab-startup-data.js'
import { downloadBlobFile } from '../shared/download.js'
import { getMotionDurationMs, getMotionEasing, prefersReducedMotion } from '../shared/motion.js'
import { isBookmarkMenuInteractionTarget } from './bookmark-menu-interactions.js'
import {
  normalizeSettingsDrawerSection,
  type SettingsDrawerSection
} from './settings-group-sync.js'
import type { ExtractedBookmarkData, FolderRecord } from '../shared/types.js'
import {
  buildFolderCandidateRenderKey,
  getCachedFolderCandidates,
  type FolderCandidateCacheState,
  type NewTabFolderCandidate
} from './folder-candidate-cache.js'
import { parseSearchQuery } from '../shared/search-query.js'
import type { NaturalSearchPlan } from '../popup/natural-search.js'
import type {
  BookmarkTagExtraction,
  BookmarkTagIndex,
  BookmarkTagRecord,
  BookmarkTagSource
} from '../shared/bookmark-tags.js'
import type { ContentSnapshotIndex } from '../shared/content-snapshots.js'
import {
  DEFAULT_ICON_SETTINGS,
  ICON_LAYOUT_PRESETS,
  type IconLayoutPresetKey,
  type IconSettings,
  detectPresetFromValues,
  getEffectiveIconTileWidthPx,
  getFixedIconGridWidthPx,
  getFolderGapPx,
  getIconGapPx,
  getIconPageWidthPx,
  getResponsiveFixedIconColumns,
  getIconRowGapPx,
  normalizeIconSettings
} from './icon-settings.js'
import {
  dispatchIconPreviewViewForSettings,
  getIconPreviewSignature,
} from './icon-preview.js'
import {
  buildNewTabSearchIndex,
  buildNewTabSourceNavigationItems,
  createMissingFolderView,
  createNewTabPage,
  createStateView,
  collectPortalBookmarkSourceItems,
  createLoadingStateView,
  getNaturalSearchBookmarkSuggestionsFromIndex,
  getNewTabSourceAnchorId,
  getAutoCenteredSearchOffsetY,
  getPopupSearchBookmarkSuggestionsFromIndex,
  prepareNewTabSearchIndex,
  getAdaptiveSearchOffsetBounds,
  getAdaptiveSearchWidthBounds,
  getVerticalCenterCollisionOffset,
  normalizeNewTabSearchText,
  type AdaptiveSearchOffsetBounds,
  type NewTabContentState,
  type NewTabContentView,
  type NewTabBookmarksModule,
  resolveNewTabContentState,
  type NewTabPageModule,
  type NewTabSearchIndexEntry,
  type NewTabPreparedSearchIndex,
  type SearchBookmarkSuggestion
} from './content-state.js'
import {
  DEFAULT_FOLDER_SETTINGS,
  DEFAULT_NEW_TAB_FOLDER_TITLE,
  type NewTabBookmarkBrowseMode,
  type NewTabFolderSettings,
  findNewTabFolder,
  getDisplayableNewTabSourceFolders,
  getFolderBookmarkCounts,
  normalizeFolderIds,
  normalizeFolderSettings,
  normalizeFolderSettingsWithDefault
} from './folder-settings.js'
import { buildChromeFaviconUrl } from './favicon-cache.js'
import {
  BACKGROUND_URL_FETCH_TIMEOUT_MS,
  BACKGROUND_URL_FULL_MAX_BYTES,
  BACKGROUND_URL_PREVIEW_MAX_BYTES,
  applyBookmarkMoveOperationsToChildren,
  buildBookmarkOrderAfterInsert,
  buildMinimalBookmarkMoveOperations,
  resolveRestorableBookmarkParentId,
  resolveBookmarkDragInsertIndex,
  type BookmarkMoveOperation,
  type BookmarkDragSlotRectLike,
  validateBackgroundBlobSize,
  validateBackgroundContentLength
} from './interactions.js'
import {
  DEFAULT_ENABLED_SEARCH_ENGINE_IDS,
  SEARCH_ENGINE_CONFIG_BY_ID,
  SEARCH_MULTI_OPEN_LIMIT,
  normalizeEnabledSearchEngineIds,
  normalizeSearchEngineId,
  planSearchOpenTargets,
  type SearchEngineId
} from './search-engines.js'
import {
  canUseNewtabSearchFocus,
  getNewtabBlankPointerAction,
  getNewtabSearchFocusIntent,
  getNextNewtabSearchValue,
  type NewtabSearchFocusIntent
} from './newtab-search-focus.js'
import type { NewTabTimeSettings } from './time-settings.js'
import {
  buildNewTabModuleSettingRows,
  DEFAULT_NEW_TAB_MODULE_SETTINGS,
  getVisibleNewTabModules,
  normalizeNewTabModuleSettings,
  type NewTabModuleSettingKey,
  type NewTabModuleSettings
} from './module-settings.js'
import {
  DEFAULT_FEATURED_BACKGROUND_PREFERENCES,
  FEATURED_BACKGROUND_DISPLAY_LIMITS,
  getFeaturedBackgroundDisplayCss,
  normalizeFeaturedBackgroundPreferences,
  type FeaturedBackgroundDisplayCss,
  type FeaturedBackgroundPreferences
} from './featured-gallery-preferences.js'
import { openFeaturedBackgroundPickerContent } from './featured-gallery-picker.js'
import {
  buildFeaturedBackgroundPickerItems,
  buildFeaturedBackgroundPickerSections,
  type FeaturedBackgroundPickerSections
} from './featured-gallery-list.js'
import {
  FEATURED_BACKGROUND_PROVIDERS,
  isFeaturedBackgroundProvider
} from './featured-background-providers.js'
import { getSpeedDialFaviconLoadAttributes } from './speed-dial-load-attributes.js'
import { buildSpeedDialItems, createSpeedDialEmptyState } from './speed-dial.js'
import type { SpeedDialItem } from './speed-dial-types.js'
import {
  createFolderDragSectionRectSnapshot,
  getFolderFlipDeltasFromSnapshots,
  getFolderInsertIndexFromSnapshot,
  projectFolderDragSectionRectSnapshot,
  type FolderDragSectionRectSnapshot
} from './folder-drag-geometry.js'
import {
  getBookmarkCreationIncrementalResult,
  getBookmarkMoveIncrementalResult,
  getBookmarkRemovalIncrementalResult
} from './bookmark-change-incremental.js'
import type { FeaturedBackgroundItem } from './background-gallery.js'
import {
  clearInstantWallpaper,
  clearInstantWallpaperTarget,
  createInstantWallpaperDataUrl,
  createInstantWallpaperImageDataUrl,
  createInstantWallpaperVideoPosterDataUrl,
  readInstantWallpaper,
  readInstantWallpaperDataUrl,
  readInstantWallpaperImageDataUrl,
  readInstantWallpaperTarget,
  saveBackgroundMaskSnapshot,
  saveInstantWallpaper,
  saveInstantWallpaperTarget,
  getInstantWallpaperFallbackColor,
  normalizeInstantWallpaperColor,
  type InstantWallpaperTargetRecord
} from './instant-wallpaper.js'
import { createBackgroundObjectUrlCache } from './background-media-cache.js'
import {
  getActiveNewTabWorkspace,
  normalizeNewTabWorkspaceSettings,
  toggleNewTabWorkspacePin,
  updateNewTabWorkspace,
  type NewTabWorkspaceSettings
} from '../shared/newtab-workspace-settings.js'
import { mark as perfMark, measure as perfMeasure, measureNow } from '../shared/perf.js'
import { runIdle } from '../shared/idle.js'
import { writeClipboardText } from '../shared/clipboard.js'
import { readCustomIconFile } from './custom-icon-picker.js'
import type {
  FeaturedBackgroundHoverPreviewRequest,
  FeaturedBackgroundPickerCardViewModel,
  FeaturedBackgroundPickerGridSectionViewModel,
  FeaturedBackgroundPickerProviderGroupViewModel
} from './components/FeaturedBackgroundPicker.js'
import type { SpeedDialCardViewModel } from './components/NewtabSpeedDialPanel.js'
import {
  dispatchNewtabBookmarkContentView,
  getNewtabBookmarkContentNodes,
  getNewtabBookmarkContentView,
  patchNewtabBookmarkContentView,
  type BookmarkContentViewModel,
  type BookmarkFolderCardViewModel,
  type BookmarkFolderSectionViewModel,
  type BookmarkNavigationViewModel,
  type BookmarkTileViewModel,
  type BookmarkContentStyleState,
  type SourceNavigationState
} from './newtab-bookmark-content-store.js'
import { clearNewtabBookmarkPrebootSnapshot } from './newtab-bookmark-preboot.js'
import {
  createDefaultSearchWidgetInteractionState,
  dispatchNewtabSearchWidgetView,
  getNewtabSearchWidgetNodes,
  getNewtabSearchWidgetView,
  patchNewtabSearchWidgetView,
  type NewtabSearchWidgetNodes,
  type SearchChipViewModel,
  type SearchEngineMenuItemViewModel,
  type SearchHintState,
  type SearchSuggestionViewModel,
  type SearchWidgetEngineMenuState,
  type SearchWidgetShellState
} from './newtab-search-widget-store.js'
import {
  dispatchNewtabModuleSettingsView,
  registerNewtabModuleSettingsActions,
  type NewtabModuleSettingRowView
} from './newtab-module-settings-store.js'
import {
  dispatchNewtabFolderCandidateFocusRequest,
  dispatchNewtabFolderSourceView,
  registerNewtabFolderSourceActions,
  type NewtabFolderCandidateItemView,
  type NewtabFolderCandidateState,
  type NewtabGeneralSettingToggleKey,
  type NewtabSelectedFolderSourceItemView,
  type NewtabSelectedFolderSourceState
} from './newtab-folder-source-store.js'
import type {
  BookmarkMenuActionIcon,
  BookmarkMenuActionViewModel,
  BookmarkMenuTextFieldViewModel
} from './bookmark-menu-view-models.js'
import {
  dispatchNewtabSettingsDrawerActiveGroup,
  dispatchNewtabSettingsDrawerFocusFirstControl,
  dispatchNewtabSettingsDrawerFocusSection,
  getNewtabSettingsDrawerNodes,
  getNewtabSettingsDrawerView,
  dispatchNewtabSettingsDrawerOpen,
  dispatchNewtabSettingsDrawerScrollTop,
  dispatchNewtabSettingsDrawerSaveStatus,
  registerNewtabSettingsDrawerActions,
  subscribeNewtabSettingsDrawerNodes
} from './newtab-settings-drawer-store.js'
import {
  dispatchNewtabFeaturedBackgroundModalControls,
  dispatchNewtabFeaturedBackgroundModalOpen,
  getNewtabFeaturedBackgroundModalNodes,
  getNewtabFeaturedBackgroundModalOpen,
  registerNewtabFeaturedBackgroundModalActions
} from './newtab-featured-background-modal-store.js'
import {
  dispatchNewtabFeaturedBackgroundHoverPreviewHidden,
  dispatchNewtabFeaturedBackgroundHoverPreviewSrc,
  dispatchNewtabFeaturedBackgroundHoverPreviewView
} from './newtab-featured-background-hover-preview-store.js'
import {
  getNewtabContentLayoutNodes,
  getNewtabContentView,
  dispatchNewtabContentView,
  patchNewtabContentView,
  registerNewtabContentShellActions,
  subscribeNewtabContentLayoutNodes
} from './newtab-content-store.js'
import { registerNewtabKeyboardActions } from './newtab-keyboard-store.js'
import { registerNewtabLifecycleActions } from './newtab-lifecycle-store.js'
import { registerNewtabWindowActions } from './newtab-window-store.js'
import { dispatchNewtabClockView, type NewtabClockView } from './newtab-clock-store.js'
import {
  dispatchNewtabSpeedDialView,
  getNewtabSpeedDialNodes,
  getNewtabSpeedDialView,
  patchNewtabSpeedDialView
} from './newtab-speed-dial-store.js'
import {
  dispatchNewtabFeaturedBackgroundPickerInitialFocusRequest,
  dispatchNewtabFeaturedBackgroundPickerView,
  getNewtabFeaturedBackgroundPickerView
} from './newtab-featured-background-picker-store.js'
import {
  dispatchNewtabDeleteToastView,
  registerNewtabDeleteToastActions
} from './newtab-delete-toast-store.js'
import {
  dispatchNewtabBookmarkAddMenuClosing,
  dispatchNewtabBookmarkAddMenuView,
  dispatchNewtabBookmarkEditMenuClosing,
  dispatchNewtabBookmarkEditMenuView
} from './newtab-bookmark-menu-store.js'
import {
  registerNewtabBookmarkEventActions,
  type BookmarkChangeInfo,
  type BookmarkMoveInfo,
  type BookmarkRemoveInfo
} from './newtab-bookmark-events-store.js'
import {
  registerNewtabIconSettingsActions,
  type NewtabIconSettingsFieldKey
} from './newtab-icon-preview-store.js'
import {
  createNewtabTimeSettingsView,
  dispatchNewtabTimeSettingsView,
  registerNewtabTimeSettingsActions,
  type NewtabTimeSettingsFieldKey,
  type NewtabTimeSettingsToggleKey
} from './newtab-time-settings-store.js'
import {
  createNewtabSearchSettingsView,
  dispatchNewtabSearchSettingsView,
  registerNewtabSearchSettingsActions,
  type NewtabSearchSettingsFieldKey,
  type NewtabSearchSettingsToggleKey
} from './newtab-search-settings-store.js'
import {
  createNewtabBackgroundSettingsView,
  dispatchNewtabBackgroundSettingsView,
  registerNewtabBackgroundSettingsActions,
  type NewtabBackgroundSettingsFieldKey
} from './newtab-background-settings-store.js'
import {
  DEFAULT_BACKGROUND_MASK_BLUR,
  DEFAULT_BACKGROUND_MASK_FILTER_HOVER,
  DEFAULT_BACKGROUND_MASK_FILTER_SIZE,
  DEFAULT_BACKGROUND_MASK_FILTER_SPACING,
  DEFAULT_BACKGROUND_MASK_FILTER_STRENGTH,
  DEFAULT_BACKGROUND_MASK_OVERLAY,
  DEFAULT_BACKGROUND_MASK_STYLE,
  normalizeBackgroundMaskBlur,
  normalizeBackgroundMaskPercentage,
  normalizeBackgroundMaskStyle
} from './background-mask-settings.js'
import {
  dispatchNewtabBackgroundMediaView,
  getNewtabBackgroundMediaView
} from './newtab-background-media-store.js'
import {
  dispatchNewtabInstantWallpaperView,
  getNewtabInstantWallpaperView
} from './newtab-instant-wallpaper-store.js'
import {
  createOptimizedBackgroundImageBlob,
  waitForBackgroundVideoSourceReady
} from './background-media-capabilities.js'
import { dispatchNewtabDragUiView } from './newtab-drag-ui-store.js'
import {
  dispatchBookmarkDragGhostView,
  dispatchFolderDragGhostView,
  dispatchSpeedDialDragGhostView,
  patchBookmarkDragGhostView,
  patchFolderDragGhostView,
  patchSpeedDialDragGhostView,
} from './newtab-drag-layer-store.js'
const FAVICON_SIZE = 64
const BOOKMARK_DRAG_LONG_PRESS_MS = 320
const FOLDER_DRAG_LONG_PRESS_MS = BOOKMARK_DRAG_LONG_PRESS_MS
const POINTER_DRAG_START_THRESHOLD_PX = 6
const TOUCH_DRAG_CANCEL_THRESHOLD_PX = 10
const SETTINGS_SAVE_DEBOUNCE_MS = 260
const EAGER_FAVICON_LIMIT = 12
const HIGH_PRIORITY_FAVICON_LIMIT = 6
const BACKGROUND_MEDIA_DB_NAME = 'curatorNewTabBackgroundMedia'
const BACKGROUND_MEDIA_STORE = 'media'
const BACKGROUND_URL_CACHE_KEY = 'urlImage'
const BACKGROUND_URL_CACHE_KEY_PREFIX = `${BACKGROUND_URL_CACHE_KEY}:`
const FEATURED_BACKGROUND_PREVIEW_CACHE_KEY_PREFIX = 'featuredPreview:'
const FEATURED_BACKGROUND_PREVIEW_OBJECT_URL_WARM_CONCURRENCY = 2
const BACKGROUND_IMAGE_READY_TIMEOUT_MS = 2200
const REMOTE_BACKGROUND_READY_TIMEOUT_MS = 900
const BACKGROUND_STARTUP_CACHE_IDLE_DELAY_MS = 2400

type DragStartPointerEvent = Pick<
  PointerEvent,
  'button' | 'clientX' | 'clientY' | 'pointerId' | 'pointerType'
>
const INSTANT_WALLPAPER_STARTUP_CACHE_ATTEMPTS = [
  { maxDimension: 960, quality: 0.68 },
  { maxDimension: 720, quality: 0.62 },
  { maxDimension: 520, quality: 0.56 },
  { maxDimension: 360, quality: 0.5 }
] as const
const FEATURED_BACKGROUND_DAILY_REFRESH_GRACE_MS = 1500
const DEFAULT_BACKGROUND_SETTINGS = {
  type: 'color',
  color: '#101013',
  imageName: '',
  videoName: '',
  url: '',
  featuredId: '',
  maskEnabled: false,
  maskStyle: DEFAULT_BACKGROUND_MASK_STYLE,
  maskBlur: DEFAULT_BACKGROUND_MASK_BLUR,
  maskOverlay: DEFAULT_BACKGROUND_MASK_OVERLAY,
  maskFilterHover: DEFAULT_BACKGROUND_MASK_FILTER_HOVER,
  maskFilterStrength: DEFAULT_BACKGROUND_MASK_FILTER_STRENGTH,
  maskFilterSize: DEFAULT_BACKGROUND_MASK_FILTER_SIZE,
  maskFilterSpacing: DEFAULT_BACKGROUND_MASK_FILTER_SPACING
}
const DEFAULT_FEATURED_BACKGROUND_PLACEHOLDER_COLOR = '#18200f'
const SUPPORTED_BACKGROUND_TYPES = new Set(['featured', 'image', 'video', 'urls', 'color'])
const DEFAULT_SEARCH_SETTINGS = {
  enabled: true,
  webSearchEnabled: true,
  openInNewTab: false,
  engine: 'google' as SearchEngineId,
  enabledEngines: DEFAULT_ENABLED_SEARCH_ENGINE_IDS,
  placeholder: '搜索书签、网页，或输入 / 执行命令',
  naturalSearchEnabled: false,
  naturalSearchAiConfigured: false,
  autoVerticalCenter: false,
  width: 44,
  height: 40,
  offsetY: 0,
  background: 30
}
const DEFAULT_TIME_SETTINGS: NewTabTimeSettings = {
  enabled: true,
  showSeconds: false,
  hour12: false,
  clockSize: 100,
  dateFormat: 'year-month-day-weekday',
  timeZone: 'auto',
  displayMode: 'time-date',
  density: 'balanced'
}
const SEARCH_OFFSET_BOUNDS_FALLBACK: AdaptiveSearchOffsetBounds = { min: -32, max: 72 }
const SEARCH_OFFSET_ABSOLUTE_MIN = -240
const SEARCH_OFFSET_ABSOLUTE_MAX = 240
const AUTO_SEARCH_OFFSET_CACHE_KEY = 'curatorNewTabAutoSearchOffsetY'
const AUTO_SEARCH_LAYOUT_STABLE_FRAME_COUNT = 0
const AUTO_SEARCH_LAYOUT_PENDING_ATTRIBUTE = 'data-newtab-search-layout-pending'
const SEARCH_WIDTH_BOUNDS_FALLBACK = { min: 16, max: 72 }
const NEWTAB_LAYOUT_SAFE_GAP = 12
const NEWTAB_COMMAND_SCORE = -100000
const NEWTAB_COMMAND_SUGGESTION_LIMIT = 4

interface NewTabCommandSuggestion {
  id: string
  title: string
  subtitle: string
  keywords: string[]
  run: () => void | Promise<void>
}

type NewTabCommandSearchSuggestion = {
  suggestionType: 'command'
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  score: number
  order: number
  command: NewTabCommandSuggestion
}

type NewTabSearchSuggestion =
  | (SearchBookmarkSuggestion & { suggestionType?: 'bookmark' })
  | NewTabCommandSearchSuggestion
type BackgroundGalleryModule = typeof import('./background-gallery.js')
type BackgroundGalleryRefreshModule = typeof import('./background-gallery-refresh.js')
type TimeSettingsModule = typeof import('./time-settings.js')

let backgroundGalleryModulePromise: Promise<BackgroundGalleryModule> | null = null
let backgroundGalleryModule: BackgroundGalleryModule | null = null
let backgroundGalleryRefreshModulePromise: Promise<BackgroundGalleryRefreshModule> | null = null
let timeSettingsModulePromise: Promise<TimeSettingsModule> | null = null
let timeSettingsModule: TimeSettingsModule | null = null
let featuredBackgroundUiVersion = 0
let featuredBackgroundPickerRenderKey = ''
let clockHydrationVersion = 0

const SEARCH_SUGGESTION_LIMIT = 6
const SEARCH_SUGGESTION_DEBOUNCE_MS = 120
const SEARCH_SUGGESTION_CACHE_LIMIT = 24
const SEARCH_SUGGESTION_CACHE_TTL_MS = 2 * 60 * 1000

async function moveBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').moveBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').moveBookmark> {
  const { moveBookmark } = await import('../shared/bookmarks-api.js')
  return moveBookmark(...args)
}

async function updateBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').updateBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').updateBookmark> {
  const { updateBookmark } = await import('../shared/bookmarks-api.js')
  return updateBookmark(...args)
}

async function createBookmarkLazy(
  ...args: Parameters<typeof import('../shared/bookmarks-api.js').createBookmark>
): ReturnType<typeof import('../shared/bookmarks-api.js').createBookmark> {
  const { createBookmark } = await import('../shared/bookmarks-api.js')
  return createBookmark(...args)
}

async function deleteBookmarkToRecycleLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').deleteBookmarkToRecycle>
): ReturnType<typeof import('../shared/recycle-bin.js').deleteBookmarkToRecycle> {
  const { deleteBookmarkToRecycle } = await import('../shared/recycle-bin.js')
  return deleteBookmarkToRecycle(...args)
}

async function restoreBookmarkFromRecycleEntryLazy(
  ...args: Parameters<typeof import('../shared/recycle-bin.js').restoreBookmarkFromRecycleEntry>
): ReturnType<typeof import('../shared/recycle-bin.js').restoreBookmarkFromRecycleEntry> {
  const { restoreBookmarkFromRecycleEntry } = await import('../shared/recycle-bin.js')
  return restoreBookmarkFromRecycleEntry(...args)
}

function loadBackgroundGalleryModule(): Promise<BackgroundGalleryModule> {
  backgroundGalleryModulePromise ||= import('./background-gallery.js').then((mod) => {
    backgroundGalleryModule = mod
    migrateStoredFeaturedBackgroundId(mod)
    return mod
  })
  return backgroundGalleryModulePromise
}

function loadBackgroundGalleryRefreshModule(): Promise<BackgroundGalleryRefreshModule> {
  backgroundGalleryRefreshModulePromise ||= import('./background-gallery-refresh.js')
  return backgroundGalleryRefreshModulePromise
}

function loadTimeSettingsModule(): Promise<TimeSettingsModule> {
  timeSettingsModulePromise ||= import('./time-settings.js').then((mod) => {
    timeSettingsModule = mod
    return mod
  })
  return timeSettingsModulePromise
}

const BOOKMARK_TILE_INITIAL_RENDER_LIMIT = 72
const BOOKMARK_TILE_RENDER_CHUNK_SIZE = 48
const BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS = 320
const FEATURED_GALLERY_HIGH_PRIORITY_PREVIEW_LIMIT = 12
const FEATURED_BACKGROUND_HOVER_PREVIEW_DELAY_MS = 220
const FEATURED_BACKGROUND_DOWNLOAD_TIMEOUT_MS = 30000
const FEATURED_BACKGROUND_PROVIDER_ORDER: FeaturedBackgroundItem['provider'][] = [...FEATURED_BACKGROUND_PROVIDERS]
const FEATURED_BACKGROUND_PROVIDER_LABELS: Record<FeaturedBackgroundItem['provider'], string> = {
  cleveland: 'Cleveland Museum of Art',
  met: 'The Met',
  nasa: 'NASA',
  wikimedia: 'Wikimedia'
}
const FEATURED_BACKGROUND_PROVIDER_EMPTY_TEXT: Record<FeaturedBackgroundItem['provider'], string> = {
  cleveland: '刷新图库后会显示 Cleveland Museum of Art 图片',
  met: '刷新图库后会显示 The Met 图片',
  nasa: '刷新图库后会显示 NASA 图片',
  wikimedia: '刷新图库后会显示 Wikimedia 图片'
}
const QUICK_ACCESS_ITEM_LIMIT = 6
const ACTIVITY_RECORD_LIMIT = 160
const DEFAULT_GENERAL_SETTINGS = {
  hideSettingsTrigger: false,
  showQuickAccess: true,
  showSourceNavigation: true,
  openBookmarksInNewTab: false
}

interface NewTabFolderSection {
  id: string
  sourceId: string
  title: string
  path: string
  node: chrome.bookmarks.BookmarkTreeNode
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  directBookmarkCount: number
  totalBookmarkCount: number
}

interface NewTabActivityRecord {
  bookmarkId: string
  title: string
  url: string
  openCount: number
  firstOpenedAt: number
  lastOpenedAt: number
}

interface NewTabActivityState {
  pinnedIds: string[]
  records: Record<string, NewTabActivityRecord>
}

type NewTabActivityRepositoryModule = typeof import('../shared/repositories/activity-repository.js')

type MenuActionIcon = BookmarkMenuActionIcon
type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'

interface LastDeletedBookmarkState {
  bookmark: chrome.bookmarks.BookmarkTreeNode
  recycleId: string
  deletedAt: number
  customIcon?: string
}

interface BackgroundImageNaturalSize {
  width: number
  height: number
}

type BackgroundDisplayCss = Pick<FeaturedBackgroundDisplayCss, 'backgroundSize' | 'backgroundPosition'>

const state = {
  loading: true,
  creatingFolder: false,
  error: '',
  rootNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderData: null as ExtractedBookmarkData | null,
  bookmarkCatalog: null as BookmarkCatalogSnapshot | null,
  bookmarkTagIndex: null as BookmarkTagIndex | null,
  searchSnapshotIndex: null as ContentSnapshotIndex | null,
  folderNodeMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  folderNode: null as chrome.bookmarks.BookmarkTreeNode | null,
  folderSections: [] as NewTabFolderSection[],
  bookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  bookmarkMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  allBookmarks: [] as chrome.bookmarks.BookmarkTreeNode[],
  allBookmarkMap: new Map<string, chrome.bookmarks.BookmarkTreeNode>(),
  searchIndex: [] as NewTabSearchIndexEntry[],
  preparedSearchIndex: prepareNewTabSearchIndex([]) as NewTabPreparedSearchIndex,
  searchIndexReady: false,
  searchIndexReadyPromise: Promise.resolve() as Promise<void>,
  naturalSearchPending: false,
  naturalSearchError: '',
  naturalSearchPlan: null as NaturalSearchPlan | null,
  naturalSearchPlanCache: new Map<string, NaturalSearchPlan>(),
  naturalSearchAbortController: null as AbortController | null,
  activeMenuBookmarkId: '',
  menuX: 0,
  menuY: 0,
  editTitle: '',
  editUrl: '',
  menuBusy: false,
  menuError: '',
  menuStatus: '',
  editIconMode: 'website',
  pendingCustomIconDataUrl: '',
  pendingDeleteBookmarkId: '',
  lastDeletedBookmark: null as LastDeletedBookmarkState | null,
  deleteToastStatus: '',
  deleteToastBusy: false,
  addMenuOpen: false,
  addMenuExpanded: false,
  addFolderId: '',
  addMenuX: 0,
  addMenuY: 0,
  addTitle: '',
  addUrl: '',
  addMenuBusy: false,
  addMenuError: '',
  customIcons: {} as Record<string, string>,
  backgroundUrlCacheBusy: false,
  backgroundUrlCacheStatus: '',
  backgroundUrlCachePendingUrls: new Set<string>(),
  backgroundStatus: '',
  backgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  featuredBackgroundGallery: [] as FeaturedBackgroundItem[],
  featuredBackgroundFavoriteIds: [] as string[],
  featuredBackgroundGalleryHydrated: false,
  featuredBackgroundPreferences: { ...DEFAULT_FEATURED_BACKGROUND_PREFERENCES } as FeaturedBackgroundPreferences,
  featuredBackgroundRefreshing: false,
  featuredBackgroundStatus: '',
  featuredBackgroundStatusTone: 'info' as 'info' | 'success' | 'warning' | 'error',
  draggingBookmarkId: '',
  dragPointerId: 0,
  dragLongPressTimer: 0,
  dragClientX: 0,
  dragClientY: 0,
  dragStartX: 0,
  dragStartY: 0,
  dragPointerType: '',
  dragOffsetX: 0,
  dragOffsetY: 0,
  draggingBookmarkFolderId: '',
  dragOriginalOrderIds: [] as string[],
  dragPendingInsertIndex: -1,
  dragSuppressClick: false,
  speedDialDraggingBookmarkId: '',
  speedDialDragPointerId: 0,
  speedDialDragLongPressTimer: 0,
  speedDialDragClientX: 0,
  speedDialDragClientY: 0,
  speedDialDragStartX: 0,
  speedDialDragStartY: 0,
  speedDialDragPointerType: '',
  speedDialDragOffsetX: 0,
  speedDialDragOffsetY: 0,
  speedDialDragOriginalOrderIds: [] as string[],
  speedDialDragPendingInsertIndex: -1,
  speedDialDragSuppressClick: false,
  reorderingSpeedDial: false,
  speedDialReorderError: '',
  draggingFolderId: '',
  folderDragPointerId: 0,
  folderDragLongPressTimer: 0,
  folderDragClientX: 0,
  folderDragClientY: 0,
  folderDragStartX: 0,
  folderDragStartY: 0,
  folderDragPointerType: '',
  folderDragOffsetX: 0,
  folderDragOffsetY: 0,
  folderDragOriginalOrderIds: [] as string[],
  folderDragOriginalSections: [] as NewTabFolderSection[],
  folderDragSuppressClick: false,
  reorderingBookmarks: false,
  selfBookmarkMoveIds: new Set<string>(),
  selfBookmarkMoveSuppressUntil: 0,
  bookmarkReorderError: '',
  folderReorderStatus: '',
  folderReorderStatusTone: 'success' as 'success' | 'error',
  backgroundSettings: { ...DEFAULT_BACKGROUND_SETTINGS },
  searchSettings: { ...DEFAULT_SEARCH_SETTINGS },
  iconSettings: { ...DEFAULT_ICON_SETTINGS },
  generalSettings: { ...DEFAULT_GENERAL_SETTINGS },
  folderSettings: { ...DEFAULT_FOLDER_SETTINGS } as NewTabFolderSettings,
  moduleSettings: { ...DEFAULT_NEW_TAB_MODULE_SETTINGS } as NewTabModuleSettings,
  workspaceSettings: normalizeNewTabWorkspaceSettings(null) as NewTabWorkspaceSettings,
  utilitySettingsHydrated: false,
  folderCandidateCache: {
    cacheKey: '',
    candidates: []
  } as FolderCandidateCacheState,
  activity: {
    pinnedIds: [],
    records: {}
  } as NewTabActivityState,
  folderCandidatesExpanded: false,
  folderCandidateQuery: '',
  folderCandidateActiveId: '',
  bookmarkNavigationPath: [] as string[],
  timeSettings: { ...DEFAULT_TIME_SETTINGS } as NewTabTimeSettings,
  settingsSaveState: 'idle' as SettingsSaveState,
  settingsSaveMessage: '',
  activeSettingsGroup: 'source' as SettingsDrawerSection,
  searchOffsetBounds: { ...SEARCH_OFFSET_BOUNDS_FALLBACK } as AdaptiveSearchOffsetBounds,
  searchWidthBounds: { ...SEARCH_WIDTH_BOUNDS_FALLBACK },
  faviconRefreshTokens: new Map<string, number>()
}

let onboardingCompleted = false

let clockTimer = 0
let featuredBackgroundRefreshTimer = 0
let featuredBackgroundPreferencesSaveTimer = 0
let featuredBackgroundPreviewTimer = 0
let backgroundApplyToken = 0
let activeBackgroundObjectUrl = ''
let lastAppliedBackgroundMediaSignature = ''
let bookmarkDragGhostFrame = 0
let bookmarkDropCommitFrame = 0
let speedDialDragGhostFrame = 0
let folderDragGhostFrame = 0
let folderDragSectionRectSnapshot: FolderDragSectionRectSnapshot | null = null
let resizeLayoutFrame = 0
let verticalCenterCollisionFrame = 0
let autoSearchLayoutRevealFrame = 0
let lastMeasuredSearchSlot: HTMLElement | null = null
let verticalCenterContentSettleFrame = 0
let settledVerticalCenterContent: HTMLElement | null = null
let deferredRenderFrame = 0
let autoSearchLayoutStableFrames = 0
let autoSearchLayoutStableKey = ''
let featuredBackgroundPreviewCard: HTMLElement | null = null
const featuredBackgroundGalleryObjectUrlCache = createBackgroundObjectUrlCache()
const featuredBackgroundGalleryPreviewObjectUrlCache = createBackgroundObjectUrlCache()
let featuredBackgroundGalleryPreviewObjectUrlWarmTask: Promise<void> | null = null
let featuredBackgroundGalleryPreviewObjectUrlWarmSignature = ''
let featuredBackgroundGalleryPreviewWarmTimer = 0
let lastIconPreviewKey = ''
let deferredRenderClockUpdate = false
let searchSettingsSaveTimer = 0
let searchSettingsSettleTimer = 0
let iconSettingsSaveTimer = 0
let timeSettingsSaveTimer = 0
let settingsSaveStatusTimer = 0
let folderReorderStatusTimer = 0
let bookmarkChangeRefreshTimer = 0
let bookmarkChangeRefreshInFlight = false
let bookmarkChangeRefreshQueued = false
let backgroundStartupCacheTimer = 0
let backgroundStartupCacheRequestId = 0
let backgroundUrlCacheTaskByUrl = new Map<string, BackgroundUrlCacheTask>()
let activeBackgroundImageNaturalSize: BackgroundImageNaturalSize | null = null
let activeBackgroundImageNaturalSizeSignature = ''
const backgroundImageNaturalSizeByUrl = new Map<string, BackgroundImageNaturalSize>()
let preloadedBackgroundSettings: typeof DEFAULT_BACKGROUND_SETTINGS | null = null
let backgroundSettingsHydrated = false
let backgroundSettingsMutationVersion = 0
let backgroundUiAppliedFromPreload = false
let featuredBackgroundOptionsHydratedDateSeed = ''
let bookmarkDragSlotRects = new Map<string, DOMRect>()
let bookmarkDragSlotOrderIds: string[] = []
let speedDialDragSlotRects = new Map<string, DOMRect>()
let speedDialDragSlotOrderIds: string[] = []
let newTabDomContentLoadedRecorded = false
let newTabSkeletonRenderRecorded = false
let newTabFirstRenderRecorded = false
let newTabBackgroundReadyRecorded = false
let newTabRefreshVersion = 0
let searchIndexBuildVersion = 0
let searchIndexRebuildScheduled = false
let lastBuiltSearchIndexCatalogVersion = ''
let resolveSearchIndexReady: () => void = () => {}
let searchIndexReadyPromise: Promise<void> = createSearchIndexReadyPromise()
let lastRenderedContentKey = ''
let unregisterNewtabContentShellActions: () => void = () => {}
let unregisterNewtabContentLayoutNodes: () => void = () => {}
let unregisterNewtabKeyboardActions: () => void = () => {}
let unregisterNewtabLifecycleActions: () => void = () => {}
let unregisterNewtabSettingsDrawerNodes: () => void = () => {}
let unregisterNewtabWindowActions: () => void = () => {}
let unregisterNewtabBookmarkEventActions: () => void = () => {}

function refreshBookmarkCatalog(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null = state.rootNode
): BookmarkCatalogSnapshot {
  const snapshot = buildBookmarkCatalogSnapshot({
    rootNode,
    tagIndex: state.bookmarkTagIndex,
    snapshotState: {
      settings: null,
      index: state.searchSnapshotIndex
    }
  })
  state.bookmarkCatalog = snapshot
  state.folderData = snapshot.extracted
  return snapshot
}

function getBookmarkCatalog(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null = state.rootNode
): BookmarkCatalogSnapshot {
  if (state.bookmarkCatalog && state.rootNode === rootNode) {
    return state.bookmarkCatalog
  }
  return refreshBookmarkCatalog(rootNode)
}
let lastRenderedShellKey = ''
state.searchIndexReadyPromise = searchIndexReadyPromise

interface BackgroundUrlCacheTask {
  startupBlob: Promise<Blob>
  durableBlob: Promise<Blob>
}

let newTabControllerStarted = false
let newTabControllerGeneration = 0
let newTabStorageEventsBound = false
let newTabNaturalSearchSettingsGeneration = 0
let refreshNewTabSearchSuggestionsAfterAiSettingsChange: (() => void) | null = null

export function startNewTabController(): void {
  if (newTabControllerStarted) {
    return
  }
  newTabControllerStarted = true
  const generation = ++newTabControllerGeneration

  recordNewTabDomContentLoaded()
  bindEvents()
  bindNewTabStorageEvents()
  hydrateFeaturedBackgroundOptions()
  void refreshNewTab().finally(() => {
    if (newTabControllerStarted && generation === newTabControllerGeneration) {
      bindBookmarkEvents()
    }
  })
}

function bindNewTabStorageEvents(): void {
  if (newTabStorageEventsBound || !chrome.storage?.onChanged) {
    return
  }
  chrome.storage.onChanged.addListener(handleNewTabStorageChanged)
  newTabStorageEventsBound = true
}

function handleNewTabStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== 'local' || !changes[STORAGE_KEYS.aiProviderSettings]) {
    return
  }
  newTabNaturalSearchSettingsGeneration += 1
  abortNewTabNaturalSearchRequest()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
  state.naturalSearchPlan = null
  state.naturalSearchError = ''
  refreshNewTabSearchSuggestionsAfterAiSettingsChange?.()
}

function createSearchIndexReadyPromise(): Promise<void> {
  return new Promise<void>((resolve) => {
    resolveSearchIndexReady = resolve
  })
}

function resetSearchIndexReadyState(): void {
  searchIndexBuildVersion += 1
  searchIndexRebuildScheduled = false
  resolveSearchIndexReady()
  state.searchIndexReady = false
  searchIndexReadyPromise = createSearchIndexReadyPromise()
  state.searchIndexReadyPromise = searchIndexReadyPromise
}

function markSearchIndexDirty({ schedule = true } = {}): void {
  state.bookmarkCatalog = null
  resetSearchIndexReadyState()
  if (schedule) {
    scheduleNewTabSearchIndexRebuild()
  }
}

function scheduleNewTabSearchIndexRebuild(): void {
  if (state.searchIndexReady) {
    return
  }
  if (searchIndexRebuildScheduled) {
    return
  }

  searchIndexRebuildScheduled = true
  const version = searchIndexBuildVersion
  runIdle(() => {
    searchIndexRebuildScheduled = false
    if (version !== searchIndexBuildVersion) {
      return
    }

    rebuildNewTabSearchIndex()
  })
}

function recordNewTabDomContentLoaded(): void {
  if (newTabDomContentLoadedRecorded) {
    return
  }

  newTabDomContentLoadedRecorded = true
  if (!performance.getEntriesByName('newtab.domContentLoaded', 'mark').length) {
    perfMark('newtab.domContentLoaded')
  }
}

function recordNewTabSkeletonRendered(): void {
  if (newTabSkeletonRenderRecorded) {
    return
  }

  newTabSkeletonRenderRecorded = true
  perfMark('newtab.skeletonRendered')
  perfMeasure('newtab.skeletonMs', 'newtab.domContentLoaded', 'newtab.skeletonRendered')
}

function recordNewTabFirstBookmarksRendered(): void {
  if (newTabFirstRenderRecorded) {
    return
  }

  newTabFirstRenderRecorded = true
  perfMark('newtab.firstBookmarksRendered')
  perfMeasure('newtab.firstBookmarksMs', 'newtab.domContentLoaded', 'newtab.firstBookmarksRendered')
  perfMeasure('newtab.totalInteractive', 'newtab.domContentLoaded', 'newtab.firstBookmarksRendered')
}

function recordNewTabBackgroundReady(): void {
  if (newTabBackgroundReadyRecorded) {
    return
  }

  newTabBackgroundReadyRecorded = true
  perfMark('newtab.backgroundReady')
  perfMeasure('newtab.backgroundReadyMs', 'newtab.domContentLoaded', 'newtab.backgroundReady')
}

function bindEvents(): void {
  registerNewtabSettingsDrawerActions({
    onActiveGroupChange: (group) => {
      setActiveSettingsGroup(group)
    },
    onFeaturedPickerClick: () => {
      void openFeaturedBackgroundPicker()
    },
    onOpenChange: (open) => {
      if (!open && isSettingsDrawerOpen()) {
        closeSettingsDrawer()
      }
    },
    onReady: initializeSettingsDrawer,
    onToggleRequest: () => {
      openSettingsDrawer()
    }
  })
  registerNewtabFeaturedBackgroundModalActions({
    onCloseRequest: handleFeaturedBackgroundModalCloseRequest,
    onGridScroll: () => {
      clearFeaturedBackgroundHoverPreview()
    },
    onReady: initializeFeaturedBackgroundModal,
    onRefreshClick: () => {
      void refreshFeaturedBackgroundGallery()
    }
  })
  registerNewtabDeleteToastActions({
    onOpenRecycle: openRecycleBin,
    onUndo: () => {
      void undoLastDeletedBookmark()
    }
  })
  registerNewtabModuleSettingsActions({
    onToggle: handleModuleSettingToggle
  })
  registerNewtabFolderSourceActions({
    onCandidateFocus: handleFolderCandidateFocus,
    onCandidateKeyDown: handleFolderCandidateListKeydown,
    onCandidateSearchKeyDown: handleFolderCandidateSearchKeydown,
    onCandidateSelect: handleFolderCandidateSelect,
    onCandidateQueryChange: handleFolderCandidateSearch,
    onFolderHideNamesToggle: handleFolderHideNamesToggle,
    onBrowseModeChange: handleBookmarkBrowseModeChange,
    onGeneralToggle: handleGeneralSettingToggle,
    onRemoveSelected: handleSelectedFolderRemove,
    onToggleCandidates: toggleFolderCandidates
  })
  registerNewtabIconSettingsActions({
    onFieldChange: handleIconSettingFieldChange,
    onPresetApply: applyIconPreset,
    onResetDefaults: resetIconSettingsToDefaults,
    onShowTitlesToggle: handleIconShowTitlesToggle,
    onVerticalCenterToggle: handleIconVerticalCenterToggle
  })
  registerNewtabTimeSettingsActions({
    onFieldChange: handleTimeSettingFieldChange,
    onToggle: handleTimeSettingToggle
  })
  registerNewtabSearchSettingsActions({
    onFieldChange: handleSearchSettingFieldChange,
    onToggle: handleSearchSettingToggle
  })
  registerNewtabBackgroundSettingsActions({
    onFileSelect: (mediaType, file) => {
      void handleBackgroundFileChange(mediaType, file)
    },
    onFieldChange: handleBackgroundSettingFieldChange,
    onFilterHoverToggle: handleBackgroundFilterHoverToggle,
    onMaskToggle: handleBackgroundMaskToggle,
    onUrlCommit: () => {
      void handleBackgroundUrlCommit()
    }
  })
  unregisterNewtabContentShellActions()
  unregisterNewtabContentShellActions = registerNewtabContentShellActions({
    onContextMenu: handleNewtabShellContextMenu,
    onPointerDownCapture: handleNewtabShellPointerDownCapture
  })
  unregisterNewtabContentLayoutNodes()
  unregisterNewtabContentLayoutNodes = subscribeNewtabContentLayoutNodes(handleNewtabContentLayoutNodesChange)
  unregisterNewtabKeyboardActions()
  unregisterNewtabKeyboardActions = registerNewtabKeyboardActions({
    onDocumentKeyDown: handleDocumentKeydown
  })
  unregisterNewtabLifecycleActions()
  unregisterNewtabLifecycleActions = registerNewtabLifecycleActions({
    onPageHide: cleanupNewTabController,
    onVisibilityChange: handleNewTabVisibilityChange
  })
  unregisterNewtabWindowActions()
  unregisterNewtabWindowActions = registerNewtabWindowActions({
    onPointerCancel: handleNewtabWindowPointerCancel,
    onPointerMove: handleNewTabPointerMove,
    onPointerUp: handleNewtabWindowPointerUp,
    onResize: handleNewtabWindowResize
  })
  unregisterNewtabSettingsDrawerNodes()
  unregisterNewtabSettingsDrawerNodes = subscribeNewtabSettingsDrawerNodes(handleSettingsDrawerNodesChange)
  initializeSettingsDrawer()
  initializeFeaturedBackgroundModal()

  window.clearTimeout(clockTimer)
  scheduleClockTick()
}

function bindBookmarkEvents(): void {
  unregisterNewtabBookmarkEventActions()
  unregisterNewtabBookmarkEventActions = registerNewtabBookmarkEventActions({
    onChanged: handleBookmarkChanged,
    onCreated: handleBookmarkCreated,
    onMoved: handleBookmarkMoved,
    onRemoved: handleBookmarkRemoved
  })
}

function handleNewtabShellContextMenu(event: ReactMouseEvent<HTMLDivElement>): void {
  if (
    state.draggingBookmarkId ||
    state.dragSuppressClick ||
    state.speedDialDraggingBookmarkId ||
    state.speedDialDragSuppressClick ||
    state.draggingFolderId ||
    state.folderDragSuppressClick
  ) {
    event.preventDefault()
    return
  }

  event.preventDefault()
  closeBookmarkMenu({ animate: false })
  openAddBookmarkMenu(event.clientX, event.clientY, getAddBookmarkFolderIdFromContextMenuTarget(event.target))
}

function getAddBookmarkFolderIdFromContextMenuTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) {
    return ''
  }

  const folderElement = target.closest<HTMLElement>(
    '[data-add-bookmark-folder-id],[data-bookmark-grid-folder-id],[data-folder-section-id]'
  )
  if (!folderElement) {
    return ''
  }

  const folderId = String(
    folderElement.dataset.addBookmarkFolderId ||
    folderElement.dataset.bookmarkGridFolderId ||
    folderElement.dataset.folderSectionId ||
    ''
  ).trim()
  return folderId && state.folderNodeMap.has(folderId) ? folderId : ''
}

function handleNewtabShellPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>): void {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (state.activeMenuBookmarkId || state.addMenuOpen) {
    if (isBookmarkMenuInteractionTarget(target)) {
      return
    }

    closeBookmarkMenu()
    closeAddBookmarkMenu()
  }

  if (shouldToggleSearchFocusFromPointerDown(event, target)) {
    const input = getNewtabSearchWidgetNodes().input
    const action = getNewtabBlankPointerAction(Boolean(input && document.activeElement === input))
    window.setTimeout(() => {
      if (action === 'blur') {
        input?.blur()
        return
      }
      focusNewtabSearchInput(input)
    }, 0)
  }
}

function handleNewtabWindowResize(): void {
  closeBookmarkMenu()
  closeAddBookmarkMenu()
  cancelSpeedDialDrag()
  cancelBookmarkDrag()
  cancelFolderDrag()
  if (!resizeLayoutFrame) {
    resizeLayoutFrame = window.requestAnimationFrame(() => {
      resizeLayoutFrame = 0
      applyIconSettingsLive()
      updateClockText()
    })
  }
}

function handleNewtabWindowPointerUp(event: PointerEvent): void {
  void finishSpeedDialDrag(event)
  void finishBookmarkDrag(event)
  void finishFolderDrag(event)
}

function handleNewtabWindowPointerCancel(): void {
  cancelSpeedDialDrag({ keepSuppressClick: true })
  cancelBookmarkDrag({ keepSuppressClick: true })
  cancelFolderDrag({ keepSuppressClick: true })
}

function handleBookmarkContextMenu(
  bookmarkId: string,
  event: ReactMouseEvent<HTMLAnchorElement>
): void {
  event.preventDefault()
  event.stopPropagation()
  if (
    state.draggingBookmarkId ||
    state.dragSuppressClick ||
    state.speedDialDraggingBookmarkId ||
    state.speedDialDragSuppressClick ||
    state.draggingFolderId ||
    state.folderDragSuppressClick
  ) {
    return
  }

  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId || !getBookmarkById(normalizedBookmarkId)?.url) {
    return
  }

  closeAddBookmarkMenu({ animate: false })
  openBookmarkMenu(normalizedBookmarkId, event.clientX, event.clientY)
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (isFeaturedBackgroundPickerOpen()) {
      event.preventDefault()
      closeFeaturedBackgroundPicker()
      return
    }
    if (isSettingsDrawerOpen()) {
      event.preventDefault()
      closeSettingsDrawer()
    }
    closeBookmarkMenu()
    closeAddBookmarkMenu()
    cancelFolderDrag()
    return
  }

  const focusIntent = getDocumentSearchFocusIntent(event)
  if (!focusIntent) {
    return
  }

  const input = getNewtabSearchWidgetNodes().input
  if (!input) {
    return
  }

  applyNewtabSearchFocusIntent(input, focusIntent, event)
}

function handleNewtabContentLayoutNodesChange(): void {
  runBatchedAdaptiveLayoutUpdate()
}

function handleSearchWidgetNodesChange(nodes: NewtabSearchWidgetNodes): void {
  if (!nodes.slot) {
    lastMeasuredSearchSlot = null
    return
  }
  // The search widget re-publishes its nodes on every render (focus, typing,
  // suggestion-panel updates). Measuring each time made the auto-centered slot
  // visibly wander; only a genuinely new slot element warrants a re-measure.
  if (nodes.slot === lastMeasuredSearchSlot) {
    return
  }
  lastMeasuredSearchSlot = nodes.slot

  resetAutoSearchLayoutSettle()
  runBatchedAdaptiveLayoutUpdate()
}

function handleSettingsDrawerNodesChange(): void {
  initializeSettingsDrawer()
}

function getDocumentSearchFocusIntent(event: KeyboardEvent): NewtabSearchFocusIntent | null {
  if (!canUseNewtabSearchFocus({
    draggingBookmark: Boolean(state.draggingBookmarkId),
    draggingFolder: Boolean(state.draggingFolderId),
    draggingSpeedDial: Boolean(state.speedDialDraggingBookmarkId),
    editableTarget: isEditableEventTarget(event.target),
    enabled: state.searchSettings.enabled,
    featuredPickerOpen: isFeaturedBackgroundPickerOpen(),
    menuOpen: Boolean(
      state.activeMenuBookmarkId ||
      state.addMenuOpen ||
      getNewtabSearchWidgetView()?.engineMenu.open
    ),
    settingsOpen: isSettingsDrawerOpen()
  })) {
    return null
  }

  return getNewtabSearchFocusIntent(event)
}

function applyNewtabSearchFocusIntent(
  input: HTMLInputElement,
  intent: NewtabSearchFocusIntent,
  event: KeyboardEvent
): void {
  focusNewtabSearchInput(input)

  if (intent.type === 'focus') {
    return
  }

  event.preventDefault()

  if (intent.type === 'select') {
    input.select()
    return
  }

  const currentValue = input.value
  const nextValue = getNextNewtabSearchValue(currentValue, intent)

  if (nextValue === currentValue) {
    return
  }

  input.value = nextValue
  input.setSelectionRange(nextValue.length, nextValue.length)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function focusNewtabSearchInput(input = getNewtabSearchWidgetNodes().input): boolean {
  if (!input || !state.searchSettings.enabled) {
    return false
  }

  input.focus({ preventScroll: true })
  return document.activeElement === input
}

function shouldToggleSearchFocusFromPointerDown(
  event: ReactPointerEvent<HTMLDivElement>,
  target: Element
): boolean {
  if (
    event.button !== 0 ||
    !state.searchSettings.enabled ||
    state.draggingBookmarkId ||
    state.draggingFolderId ||
    state.speedDialDraggingBookmarkId ||
    isFeaturedBackgroundPickerOpen() ||
    isSettingsDrawerOpen()
  ) {
    return false
  }

  return !target.closest([
    'a',
    'button',
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="combobox"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[data-newtab-bookmark-menu-surface]'
  ].join(','))
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.getAttribute('role') === 'combobox' ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
}

function bindGeneralSettingsEvents(): void {
}

function bindFolderSettingsEvents(): void {
}

function handleGeneralSettingToggle(key: NewtabGeneralSettingToggleKey, enabled: boolean): void {
  const previousSettings = state.generalSettings
  state.generalSettings = normalizeGeneralSettings({
    ...state.generalSettings,
    [key]: enabled
  })
  void saveGeneralSettings().catch((error) => {
    console.warn('新标签页通用设置保存失败。', error)
  })
  syncGeneralSettingsControls()
  applyGeneralSettings()
  if (
    previousSettings.showQuickAccess !== state.generalSettings.showQuickAccess ||
    previousSettings.showSourceNavigation !== state.generalSettings.showSourceNavigation
  ) {
    scheduleRender({ updateClock: true })
  }
}

function handleFolderHideNamesToggle(enabled: boolean): void {
  const previousSettings = state.folderSettings
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    hideFolderNames: enabled
  })
  void saveFolderSettings().catch((error) => {
    console.warn('新标签页文件夹设置保存失败。', error)
  })
  syncFolderSettingsControls()
  applyFolderSettings()
  if (previousSettings.hideFolderNames !== state.folderSettings.hideFolderNames) {
    if (!renderBookmarkSections()) {
      render()
    }
    scheduleAdaptiveNewTabLayoutUpdate()
  }
  updateClockText()
}

function handleBookmarkBrowseModeChange(mode: NewTabBookmarkBrowseMode): void {
  const previousMode = state.folderSettings.browseMode
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    browseMode: mode
  })
  void saveFolderSettings().catch((error) => {
    console.warn('新标签页文件夹设置保存失败。', error)
  })
  syncFolderSettingsControls()
  applyFolderSettings()
  if (previousMode !== state.folderSettings.browseMode) {
    // 切换浏览模式会改变整个视图结构（展开分组 ↔ 导航扁平网格），需整树重渲染。
    // 同步清空 preboot 快照：否则切换后立即刷新会先回放旧模式的快照再被替换（=形变）。
    clearNewtabBookmarkPrebootSnapshot()
    resetBookmarkNavigation()
    if (!renderBookmarkSections()) {
      render()
    }
    scheduleAdaptiveNewTabLayoutUpdate()
  }
  updateClockText()
}

// 导航模式的当前浏览层级路径栈（folderId 序列，空 = 根来源层）。
// 展开模式不使用它；切换模式或返回根时清空。阶段 4 会充实进入/返回逻辑。
function resetBookmarkNavigation(): void {
  if (state.bookmarkNavigationPath.length) {
    state.bookmarkNavigationPath = []
  }
}

function toggleFolderCandidates(): void {
  state.folderCandidatesExpanded = !state.folderCandidatesExpanded
  syncFolderSettingsControls()
  if (state.folderCandidatesExpanded) {
    requestFolderCandidateSearchFocus()
  }
}

function handleFolderCandidateSearch(query: string): void {
  state.folderCandidateQuery = query
  state.folderCandidateActiveId = ''
  syncFolderSettingsControls()
}

function handleFolderCandidateSearchKeydown(key: string): boolean {
  if (key !== 'ArrowDown' && key !== 'ArrowUp') {
    return false
  }

  const candidates = getFilteredFolderCandidates()
  const targetId = getFolderCandidateFocusTargetId(candidates, key === 'ArrowDown' ? 'first' : 'last')
  if (!targetId) {
    return false
  }

  focusFolderCandidateOptionById(targetId)
  return true
}

function handleFolderCandidateSelect(folderId: string): void {
  if (!folderId) {
    return
  }

  state.folderCandidateActiveId = folderId
  void toggleSelectedFolder(folderId, {
    preserveCandidateScroll: true,
    restoreCandidateFocus: true,
    focusCandidateId: folderId
  })
}

function handleFolderCandidateListKeydown(key: string, folderId: string): boolean {
  if (
    key !== 'ArrowDown' &&
    key !== 'ArrowUp' &&
    key !== 'Home' &&
    key !== 'End' &&
    key !== 'Escape'
  ) {
    return false
  }

  if (key === 'Escape') {
    requestFolderCandidateSearchFocus()
    return true
  }

  const candidates = getFilteredFolderCandidates()
  const targetId = getFolderCandidateFocusTargetId(
    candidates,
    key === 'Home'
      ? 'first'
      : key === 'End'
        ? 'last'
        : key === 'ArrowDown'
          ? 1
          : -1,
    folderId || state.folderCandidateActiveId
  )
  if (targetId) {
    focusFolderCandidateOptionById(targetId)
  }
  return true
}

function focusFolderCandidateOptionById(folderId: string): boolean {
  const id = String(folderId || '').trim()
  if (!id || !getFilteredFolderCandidates().some((candidate) => candidate.id === id)) {
    return false
  }

  state.folderCandidateActiveId = id
  syncFolderSettingsControls()
  dispatchNewtabFolderCandidateFocusRequest({
    folderId: id,
    preventScroll: true,
    target: 'candidate'
  })
  return true
}

function resolveFolderCandidateActiveId(candidates: NewTabFolderCandidate[]): string {
  if (!candidates.length) {
    state.folderCandidateActiveId = ''
    return ''
  }

  const activeId = candidates.some((folder) => folder.id === state.folderCandidateActiveId)
    ? state.folderCandidateActiveId
    : candidates[0]?.id || ''
  state.folderCandidateActiveId = activeId
  return activeId
}

function getFolderCandidateFocusTargetId(
  candidates: NewTabFolderCandidate[],
  direction: 1 | -1 | 'first' | 'last',
  currentFolderId = state.folderCandidateActiveId
): string {
  if (!candidates.length) {
    return ''
  }

  const currentIndex = candidates.findIndex((candidate) => candidate.id === currentFolderId)
  let nextIndex = currentIndex

  if (direction === 'first') {
    nextIndex = 0
  } else if (direction === 'last') {
    nextIndex = candidates.length - 1
  } else if (currentIndex >= 0) {
    nextIndex = (currentIndex + direction + candidates.length) % candidates.length
  } else if (nextIndex < 0) {
    nextIndex = direction > 0 ? 0 : candidates.length - 1
  }

  return candidates[Math.max(0, Math.min(candidates.length - 1, nextIndex))]?.id || ''
}

function handleFolderCandidateFocus(folderId: string): void {
  if (!folderId) {
    return
  }

  state.folderCandidateActiveId = folderId
  syncFolderSettingsControls()
}

function requestFolderCandidateSearchFocus(): void {
  dispatchNewtabFolderCandidateFocusRequest({
    folderId: '',
    preventScroll: true,
    target: 'search'
  })
}

function handleSelectedFolderRemove(folderId: string): void {
  if (!folderId) {
    return
  }

  void removeSelectedFolder(folderId)
}

async function toggleSelectedFolder(
  folderId: string,
  {
    preserveCandidateScroll = false,
    restoreCandidateFocus = false,
    focusCandidateId = ''
  } = {}
): Promise<void> {
  const currentIds = state.folderSettings.selectedFolderIds
  const nextIds = currentIds.includes(folderId)
    ? currentIds.filter((id) => id !== folderId)
    : [...currentIds, folderId]
  await updateSelectedFolders(nextIds, {
    preserveCandidateScroll,
    restoreCandidateFocus,
    focusCandidateId
  })
}

async function removeSelectedFolder(folderId: string): Promise<void> {
  await updateSelectedFolders(
    state.folderSettings.selectedFolderIds.filter((id) => id !== folderId)
  )
}

async function updateSelectedFolders(
  folderIds: string[],
  {
    preserveCandidateScroll = false,
    restoreCandidateFocus = false,
    focusCandidateId = ''
  } = {}
): Promise<void> {
  void preserveCandidateScroll
  const previousSettings = state.folderSettings
  const previousSections = [...state.folderSections]

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: folderIds
  })
  state.folderSections = buildNewTabFolderSections(state.rootNode, state.folderSettings)
  refreshDerivedBookmarkState()
  markSearchIndexDirty()

  try {
    await saveFolderSettings()
  } catch (error) {
    state.folderSettings = previousSettings
    state.folderSections = previousSections
    refreshDerivedBookmarkState()
    markSearchIndexDirty()
    render()
    syncFolderSettingsControls()
    applyFolderSettings()
    updateClockText()
    setSettingsSaveStatus('error', '来源保存失败，已恢复到上次已保存状态')
    console.warn('新标签页来源设置保存失败，已回滚。', error)
    return
  }

  render()
  syncFolderSettingsControls()
  applyFolderSettings()
  updateClockText()

  if (preserveCandidateScroll || restoreCandidateFocus) {
    if (restoreCandidateFocus) {
      focusFolderCandidateOptionById(focusCandidateId || state.folderCandidateActiveId)
    }
  }
}

function handleIconVerticalCenterToggle(enabled: boolean): void {
  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    verticalCenter: enabled,
    preset: ''
  }))
}

function handleIconShowTitlesToggle(enabled: boolean): void {
  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    showTitles: enabled,
    preset: ''
  }))
}

function handleIconSettingFieldChange(key: NewtabIconSettingsFieldKey, value: number | string): void {
  commitIconSettings(normalizeIconSettings({
    ...state.iconSettings,
    [key]: value,
    preset: ''
  }))
}

function handleSearchSettingToggle(key: NewtabSearchSettingsToggleKey, enabled: boolean): void {
  commitSearchSettings(normalizeSearchSettings({
    ...state.searchSettings,
    [key]: enabled
  }), { render: true })
}

function handleSearchSettingFieldChange(
  key: NewtabSearchSettingsFieldKey,
  value: number | string | string[]
): void {
  const nextSettings = normalizeSearchSettings({
    ...state.searchSettings,
    [key]: value
  })
  const isLiveField = key === 'background' ||
    key === 'height' ||
    key === 'offsetY' ||
    key === 'width'

  commitSearchSettings(nextSettings, isLiveField ? { live: true } : { render: true })
  if (isLiveField) {
    scheduleSearchSettingsSettle()
  }
}

function commitSearchSettings(
  nextSettings: typeof DEFAULT_SEARCH_SETTINGS,
  options: { live?: boolean; render?: boolean; syncControls?: boolean } = {}
): void {
  state.searchSettings = nextSettings
  scheduleSearchSettingsSave()
  if (options.live) {
    applySearchSettingsLive()
  }
  if (options.render) {
    scheduleRender({ updateClock: true })
  }
  if (options.syncControls !== false) {
    syncSearchSettingsControls()
  }
}

function getRevealedAutoSearchShell(): SearchWidgetShellState | null {
  const shell = getNewtabSearchWidgetView()?.shell
  return shell?.autoVerticalCenter && shell.layoutReady ? shell : null
}

function applySearchSettingsLive(): void {
  const settings = state.searchSettings
  const widthBounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const offsetBounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  const width = clampNumber(settings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)
  const cachedAutoOffsetY = settings.autoVerticalCenter
    ? readCachedAutoSearchOffsetYValue()
    : null
  // A visible auto-centered search keeps its current offset and slides to the next
  // measurement instead of blinking back into the hidden measurement gate.
  const revealedAutoOffsetY = settings.autoVerticalCenter
    ? getRevealedAutoSearchShell()?.offsetY ?? null
    : null
  const offsetY = settings.autoVerticalCenter
    ? revealedAutoOffsetY ?? cachedAutoOffsetY ?? DEFAULT_SEARCH_SETTINGS.offsetY
    : clampNumber(settings.offsetY, offsetBounds.min, offsetBounds.max, DEFAULT_SEARCH_SETTINGS.offsetY)
  const layoutReady = !settings.autoVerticalCenter ||
    revealedAutoOffsetY !== null ||
    cachedAutoOffsetY !== null

  if (settings.autoVerticalCenter) {
    setAutoSearchLayoutPending(!layoutReady)
    resetAutoSearchLayoutSettle()
    scheduleAdaptiveNewTabLayoutUpdate()
  } else {
    setAutoSearchLayoutPending(false)
  }
  patchSearchWidgetShellState({
    autoVerticalCenter: settings.autoVerticalCenter,
    backgroundAlpha: String(settings.background / 100),
    height: settings.height,
    layoutReady,
    offsetY,
    width
  })
}

function scheduleSearchSettingsSettle(): void {
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = window.setTimeout(() => {
    searchSettingsSettleTimer = 0
    scheduleAdaptiveNewTabLayoutUpdate()
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function handleBackgroundMaskToggle(enabled: boolean): void {
  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    maskEnabled: enabled
  })
  commitBackgroundSettings(previousSettings, nextSettings)
}

function handleBackgroundSettingFieldChange(
  key: NewtabBackgroundSettingsFieldKey,
  value: number | string
): void {
  if (key === 'displaySize' || key === 'positionX' || key === 'positionY') {
    state.featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences({
      ...state.featuredBackgroundPreferences,
      [key]: value
    })
    applyFeaturedBackgroundDisplayPreferences()
    syncBackgroundSettingsControls()
    scheduleFeaturedBackgroundPreferencesSave()
    return
  }

  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    [key]: value
  })
  commitBackgroundSettings(previousSettings, nextSettings)
}

function commitBackgroundSettings(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): void {
  const shouldClearUrlCache = shouldClearBackgroundUrlCache(previousSettings, nextSettings)
  backgroundSettingsHydrated = true
  state.backgroundSettings = nextSettings
  updateBackgroundStartupCacheStatus(nextSettings)
  backgroundSettingsMutationVersion += 1
  preloadedBackgroundSettings = nextSettings
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(nextSettings))
  syncInstantWallpaperTargetForSettings(nextSettings)
  void saveBackgroundSettings().catch((error) => {
    console.warn('新标签页背景设置保存失败。', error)
  })
  syncBackgroundSettingsControls()
  scheduleFeaturedBackgroundDailyRefresh()
  scheduleCurrentBackgroundStartupCache(nextSettings)
  void applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache)
}

async function handleBackgroundUrlCommit(): Promise<void> {
  if (state.backgroundSettings.type !== 'urls') {
    return
  }

  const imageUrl = getRemoteBackgroundImageUrl(state.backgroundSettings)
  if (!imageUrl) {
    return
  }

  const permissionGranted = await ensureBackgroundImageFetchPermission(imageUrl, { request: true })
  if (!permissionGranted) {
    setBackgroundStatus('未授权该图片域名，首屏缓存可能无法准备。', 'warning')
    syncBackgroundSettingsControls()
    return
  }
  await ensureCurrentBackgroundStartupCache(state.backgroundSettings)
}

async function applyBackgroundSettingsAfterCacheUpdate(shouldClearUrlCache: boolean): Promise<void> {
  if (shouldClearUrlCache) {
    await clearBackgroundUrlCache()
  }
  await applyBackgroundSettings()
}

async function handleBackgroundFileChange(
  mediaType: 'image' | 'video',
  file: File
): Promise<void> {
  const expectedPrefix = mediaType === 'image' ? 'image/' : 'video/'
  if (!file.type.startsWith(expectedPrefix)) {
    setBackgroundStatus(
      mediaType === 'image'
        ? '文件类型不匹配：请选择图片文件（JPG、PNG、WebP 或 GIF）。'
        : '文件类型不匹配：请选择视频文件（MP4、WebM 或 MOV）。',
      'warning'
    )
    syncBackgroundSettingsControls()
    return
  }

  try {
    const previousSettings = state.backgroundSettings
    setBackgroundStatus('正在保存背景文件...', 'info')
    syncBackgroundSettingsControls()
    await saveBackgroundMedia(mediaType, file)
    state.backgroundSettings = normalizeBackgroundSettings({
      ...state.backgroundSettings,
      type: mediaType,
      imageName: mediaType === 'image' ? file.name : state.backgroundSettings.imageName,
      videoName: mediaType === 'video' ? file.name : state.backgroundSettings.videoName
    })
    backgroundSettingsHydrated = true
    backgroundSettingsMutationVersion += 1
    preloadedBackgroundSettings = state.backgroundSettings
    await saveBackgroundSettings()
    await ensureCurrentBackgroundStartupCache(state.backgroundSettings)
    if (shouldClearBackgroundUrlCache(previousSettings, state.backgroundSettings)) {
      await clearBackgroundUrlCache()
    }
    syncBackgroundSettingsControls()
    scheduleFeaturedBackgroundDailyRefresh()
    await applyBackgroundSettings()
    setBackgroundStatus(
      mediaType === 'image' ? '背景图片已保存。' : '背景视频已保存。',
      'success'
    )
    syncBackgroundSettingsControls()
  } catch (error) {
    setBackgroundStatus(getBackgroundMediaSaveErrorMessage(error), 'error')
    syncBackgroundSettingsControls()
  }
}

function handleTimeSettingToggle(key: NewtabTimeSettingsToggleKey, enabled: boolean): void {
  commitTimeSettings(normalizeTimeSettingsLocal({
    ...state.timeSettings,
    [key]: enabled
  }))
}

function handleTimeSettingFieldChange(key: NewtabTimeSettingsFieldKey, value: number | string): void {
  commitTimeSettings(normalizeTimeSettingsLocal({
    ...state.timeSettings,
    [key]: value
  }))
}

function commitTimeSettings(nextSettings: NewTabTimeSettings): void {
  state.timeSettings = nextSettings
  scheduleTimeSettingsSave()
  scheduleRender({ updateClock: true })
  syncTimeSettingsControls()
  scheduleClockTick()
}

let settingsDrawerReady = false
let settingsDrawerReadyPromise: Promise<void> | null = null
let resolveSettingsDrawerReady: (() => void) | null = null

function ensureSettingsDrawerReady(): Promise<void> {
  if (settingsDrawerReady) return Promise.resolve()
  if (!settingsDrawerReadyPromise) {
    settingsDrawerReadyPromise = new Promise<void>((resolve) => {
      resolveSettingsDrawerReady = resolve
    })
  }
  return settingsDrawerReadyPromise
}

function initializeSettingsDrawer(): void {
  if (settingsDrawerReady) return
  const { drawer } = getNewtabSettingsDrawerNodes()
  if (!drawer) {
    return
  }

  bindGeneralSettingsEvents()
  bindFolderSettingsEvents()
  settingsDrawerReady = true
  resolveSettingsDrawerReady?.()
  hydrateFeaturedBackgroundOptions()
  syncBackgroundSettingsControls()
  syncSearchSettingsControls()
  syncGeneralSettingsControls()
  syncFolderSettingsControls()
  syncIconSettingsControls()
  syncTimeSettingsControls()
}

function openSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  if (settingsDrawerReady) {
    runOpenSettingsDrawer(options)
    return
  }
  void ensureSettingsDrawerReady().then(() => {
    runOpenSettingsDrawer(options)
  })
}

function runOpenSettingsDrawer(options?: { focusFirstControl?: boolean; section?: SettingsDrawerSection }): void {
  measureNow('newtab.openSettingsDrawer', () => {
    dispatchNewtabSettingsDrawerOpen(true)
    const focusFirstControl = options?.focusFirstControl !== false
    setActiveSettingsGroup(options?.section || state.activeSettingsGroup || 'source', { scrollToTop: false })
    syncSettingsSaveStatus()
    scheduleAdaptiveNewTabLayoutUpdate()
    if (focusFirstControl) {
      window.requestAnimationFrame(() => {
        dispatchNewtabSettingsDrawerFocusFirstControl()
      })
    }
    if (options?.section) {
      window.requestAnimationFrame(() => {
        dispatchNewtabSettingsDrawerFocusSection(options.section)
      })
    }
  })
}

function openFolderSourceSettings(): void {
  state.folderCandidatesExpanded = true
  state.folderCandidateQuery = ''
  syncFolderSettingsControls()
  openSettingsDrawer({ focusFirstControl: false, section: 'source' })
}

function setActiveSettingsGroup(
  section: SettingsDrawerSection,
  { scrollToTop = true }: { scrollToTop?: boolean } = {}
): void {
  measureNow('newtab.setActiveSettingsGroup', () => {
    const nextSection = normalizeSettingsDrawerSection(section)
    state.activeSettingsGroup = nextSection
    dispatchNewtabSettingsDrawerActiveGroup(nextSection)

    if (scrollToTop) {
      dispatchNewtabSettingsDrawerScrollTop('auto')
    }
  })
}

function closeSettingsDrawer(): void {
  if (!isSettingsDrawerOpen()) {
    return
  }

  dispatchNewtabSettingsDrawerOpen(false)
}

function isSettingsDrawerOpen(): boolean {
  return getNewtabSettingsDrawerView().open
}

function openBookmarkMenu(bookmarkId: string, clientX: number, clientY: number): void {
  const bookmark = getBookmarkById(bookmarkId)
  if (!bookmark?.url) {
    return
  }

  state.activeMenuBookmarkId = bookmarkId
  state.menuX = clientX
  state.menuY = clientY
  state.editTitle = String(bookmark.title || '').trim() || String(bookmark.url || '')
  state.editUrl = String(bookmark.url || '').trim()
  state.editIconMode = state.customIcons[bookmarkId] ? 'custom' : 'website'
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu()
}

function openAddBookmarkMenu(clientX: number, clientY: number, folderId = ''): void {
  closeBookmarkMenu({ animate: false })
  state.addMenuOpen = true
  state.addMenuExpanded = false
  state.addFolderId = folderId
  state.addMenuX = clientX
  state.addMenuY = clientY
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function openAddBookmarkMenuForElement(anchor: HTMLElement, folderId: string): void {
  const rect = anchor.getBoundingClientRect()
  closeBookmarkMenu({ animate: false })
  state.addMenuOpen = true
  state.addMenuExpanded = true
  state.addFolderId = folderId
  state.addMenuX = rect.right
  state.addMenuY = rect.bottom + 8
  state.addTitle = ''
  state.addUrl = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

function closeBookmarkMenu({ animate = true } = {}): void {
  state.activeMenuBookmarkId = ''
  state.menuBusy = false
  state.menuError = ''
  state.menuStatus = ''
  state.pendingCustomIconDataUrl = ''
  state.pendingDeleteBookmarkId = ''
  if (animate) {
    dispatchNewtabBookmarkEditMenuClosing()
  } else {
    dispatchNewtabBookmarkEditMenuView(null)
  }
}

function finalizeBookmarkMenuClose(): void {
  if (!state.activeMenuBookmarkId) {
    dispatchNewtabBookmarkEditMenuView(null)
  }
}

function closeAddBookmarkMenu({ animate = true } = {}): void {
  state.addMenuOpen = false
  state.addMenuExpanded = false
  state.addFolderId = ''
  state.addMenuBusy = false
  state.addMenuError = ''
  if (animate) {
    dispatchNewtabBookmarkAddMenuClosing()
  } else {
    dispatchNewtabBookmarkAddMenuView(null)
  }
}

function finalizeAddBookmarkMenuClose(): void {
  if (!state.addMenuOpen) {
    dispatchNewtabBookmarkAddMenuView(null)
  }
}

function startSpeedDialDragFromReact(
  bookmarkId: string,
  card: HTMLElement,
  event: DragStartPointerEvent
): void {
  finishPendingBookmarkDropVisualCommit()
  if (
    state.draggingBookmarkId ||
    state.dragLongPressTimer ||
    state.draggingFolderId ||
    state.folderDragLongPressTimer
  ) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId || !getBookmarkById(normalizedBookmarkId)) {
    return
  }

  cancelSpeedDialDrag({ keepSuppressClick: true })
  state.speedDialDragPointerId = event.pointerId
  state.speedDialDragPointerType = event.pointerType
  state.speedDialDraggingBookmarkId = normalizedBookmarkId
  state.speedDialDragStartX = event.clientX
  state.speedDialDragStartY = event.clientY
  state.speedDialDragClientX = event.clientX
  state.speedDialDragClientY = event.clientY
  const rect = card.getBoundingClientRect()
  state.speedDialDragOffsetX = event.clientX - rect.left
  state.speedDialDragOffsetY = event.clientY - rect.top
  if (event.pointerType !== 'mouse') {
    dispatchNewtabDragUiView({ speedDialPendingId: normalizedBookmarkId })
    state.speedDialDragLongPressTimer = window.setTimeout(() => {
      beginSpeedDialDrag()
    }, BOOKMARK_DRAG_LONG_PRESS_MS)
  }
}

function handleSpeedDialDragPointerDown(
  bookmarkId: string,
  card: HTMLElement,
  event: ReactPointerEvent<HTMLElement>
): void {
  startSpeedDialDragFromReact(bookmarkId, card, event.nativeEvent)
}

function beginSpeedDialDrag(): void {
  if (!state.speedDialDraggingBookmarkId || !getBookmarkById(state.speedDialDraggingBookmarkId)) {
    cancelSpeedDialDrag()
    return
  }

  const originalOrderIds = getActiveWorkspacePinnedIds()
    .filter((bookmarkId) => Boolean(getBookmarkById(bookmarkId)?.url))
  if (originalOrderIds.length < 2 || !originalOrderIds.includes(state.speedDialDraggingBookmarkId)) {
    cancelSpeedDialDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  state.speedDialDragLongPressTimer = 0
  state.speedDialDragOriginalOrderIds = originalOrderIds
  state.speedDialDragSuppressClick = true
  const sourceCard = getActiveSpeedDialDragCard()
  if (sourceCard) {
    try {
      sourceCard.setPointerCapture(state.speedDialDragPointerId)
    } catch {
      // The pointer may already be released when a synthetic test begins drag.
    }
  }
  dispatchNewtabDragUiView({ speedDialDragging: true, speedDialPendingId: '' })
  createSpeedDialDragGhost(sourceCard)
  captureSpeedDialDragLayout()
  patchSpeedDialDraggingState(state.speedDialDraggingBookmarkId, true)
  dispatchNewtabDragUiView({ previewInitializing: true })
  syncSpeedDialDragVisualPreview()
  window.requestAnimationFrame(() => {
    dispatchNewtabDragUiView({ previewInitializing: false })
  })
}

function handleNewTabPointerMove(event: PointerEvent): void {
  handleSpeedDialPointerMove(event)
  handleBookmarkPointerMove(event)
  handleFolderPointerMove(event)
}

function handleSpeedDialPointerMove(event: PointerEvent): void {
  if (!state.speedDialDraggingBookmarkId || event.pointerId !== state.speedDialDragPointerId) {
    return
  }

  state.speedDialDragClientX = event.clientX
  state.speedDialDragClientY = event.clientY

  if (!state.speedDialDragOriginalOrderIds.length) {
    const distance = Math.hypot(
      event.clientX - state.speedDialDragStartX,
      event.clientY - state.speedDialDragStartY
    )
    if (state.speedDialDragPointerType === 'mouse') {
      if (distance < POINTER_DRAG_START_THRESHOLD_PX) {
        return
      }
      beginSpeedDialDrag()
    } else {
      if (distance >= TOUCH_DRAG_CANCEL_THRESHOLD_PX) {
        cancelSpeedDialDrag()
      }
      return
    }
  }

  if (!state.speedDialDragOriginalOrderIds.length) {
    return
  }

  event.preventDefault()
  updateSpeedDialDragGhost()
  const insertIndex = getSpeedDialInsertIndex(event.clientX, event.clientY)
  setSpeedDialDragPendingInsertIndex(insertIndex)
}

async function finishSpeedDialDrag(event: PointerEvent): Promise<void> {
  if (!state.speedDialDraggingBookmarkId || event.pointerId !== state.speedDialDragPointerId) {
    return
  }

  window.clearTimeout(state.speedDialDragLongPressTimer)
  state.speedDialDragLongPressTimer = 0

  const wasDragging = Boolean(state.speedDialDragOriginalOrderIds.length)
  const originalOrderIds = [...state.speedDialDragOriginalOrderIds]
  const pendingInsertIndex = state.speedDialDragPendingInsertIndex >= 0
    ? state.speedDialDragPendingInsertIndex
    : getSpeedDialInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? applyDraggedSpeedDialInsertInState(pendingInsertIndex)
    : getActiveWorkspacePinnedIds()
  if (wasDragging) {
    await settleSpeedDialDragGhost(finalOrderIds)
  }
  clearSpeedDialDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  await persistSpeedDialOrder(originalOrderIds, finalOrderIds)
}

function cancelSpeedDialDrag({ keepSuppressClick = false } = {}): void {
  if (!state.speedDialDraggingBookmarkId && !state.speedDialDragLongPressTimer) {
    return
  }

  window.clearTimeout(state.speedDialDragLongPressTimer)
  clearSpeedDialDragState({ keepSuppressClick })
  render()
  updateClockText()
}

function clearSpeedDialDragState({ keepSuppressClick = false } = {}): void {
  patchSpeedDialDraggingState(state.speedDialDraggingBookmarkId, false)
  state.speedDialDraggingBookmarkId = ''
  state.speedDialDragPointerId = 0
  state.speedDialDragLongPressTimer = 0
  state.speedDialDragClientX = 0
  state.speedDialDragClientY = 0
  state.speedDialDragStartX = 0
  state.speedDialDragStartY = 0
  state.speedDialDragPointerType = ''
  state.speedDialDragOffsetX = 0
  state.speedDialDragOffsetY = 0
  state.speedDialDragOriginalOrderIds = []
  state.speedDialDragPendingInsertIndex = -1
  removeSpeedDialDragGhost()
  clearSpeedDialDragVisualPreview()
  dispatchNewtabDragUiView({
    previewInitializing: false,
    speedDialPendingId: '',
    speedDialDragging: false
  })

  if (keepSuppressClick) {
    state.speedDialDragSuppressClick = true
    window.setTimeout(() => {
      state.speedDialDragSuppressClick = false
    }, 250)
  } else {
    state.speedDialDragSuppressClick = false
  }
}

function patchSpeedDialDraggingState(bookmarkId: string, dragging: boolean): void {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return
  }

  patchNewtabSpeedDialView((view) => {
    if (view.content.type !== 'items') {
      return view
    }

    let changed = false
    const items = view.content.items.map((item) => {
      if (String(item.id) !== normalizedBookmarkId || item.dragging === dragging) {
        return item
      }
      changed = true
      return {
        ...item,
        dragging
      }
    })
    if (!changed) {
      return view
    }
    return {
      ...view,
      content: {
        ...view.content,
        items
      }
    }
  })
}

function createSpeedDialDragGhost(sourceCard = getActiveSpeedDialDragCard()): void {
  removeSpeedDialDragGhost()

  if (!sourceCard || !state.speedDialDraggingBookmarkId) {
    return
  }

  const bookmark = getBookmarkById(state.speedDialDraggingBookmarkId)
  if (!bookmark?.url) {
    return
  }
  const item = getSpeedDialDragItemModel(state.speedDialDraggingBookmarkId, bookmark)
  if (!item) {
    return
  }
  const rect = sourceCard.getBoundingClientRect()

  dispatchSpeedDialDragGhostView({
    customIcon: item.customIcon,
    detail: item.detail,
    fallbackLabel: item.fallbackLabel,
    favicon: item.favicon,
    height: rect.height,
    style: item.style,
    title: item.title,
    transform: 'translate3d(0, 0, 0)',
    visible: false,
    width: rect.width
  })
  updateSpeedDialDragGhost({ immediate: true })
  patchSpeedDialDragGhostView((view) => ({
    ...view,
    visible: true
  }))
}

function getSpeedDialDragItemModel(
  bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): SpeedDialCardViewModel | null {
  const items = getNewtabSpeedDialView()?.content
  if (items?.type === 'items') {
    const item = items.items.find((item) => String(item.id) === String(bookmarkId))
    if (item) {
      return item
    }
  }

  return createSpeedDialCardViewModel({
    detail: getBookmarkDisplayTitle(bookmark),
    domain: '',
    fallbackLabel: getFallbackLabel(getBookmarkDisplayTitle(bookmark)),
    id: bookmarkId,
    pinnedOrder: 0,
    title: getBookmarkDisplayTitle(bookmark),
    url: String(bookmark.url || '')
  }, bookmark)
}

function getActiveSpeedDialDragCard(): HTMLElement | null {
  if (!state.speedDialDraggingBookmarkId) {
    return null
  }

  return getNewtabSpeedDialNodes().cards.get(state.speedDialDraggingBookmarkId) || null
}

function updateSpeedDialDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateSpeedDialDragGhostPosition()
    return
  }

  if (speedDialDragGhostFrame) {
    return
  }

  speedDialDragGhostFrame = window.requestAnimationFrame(() => {
    speedDialDragGhostFrame = 0
    updateSpeedDialDragGhostPosition()
  })
}

function updateSpeedDialDragGhostPosition(): void {
  const left = state.speedDialDragClientX - state.speedDialDragOffsetX
  const top = state.speedDialDragClientY - state.speedDialDragOffsetY
  patchSpeedDialDragGhostView((view) => ({
    ...view,
    transform: `translate3d(${left}px, ${top}px, 0)`
  }))
}

function removeSpeedDialDragGhost(): void {
  window.cancelAnimationFrame(speedDialDragGhostFrame)
  speedDialDragGhostFrame = 0
  dispatchSpeedDialDragGhostView(null)
}

function setSpeedDialDragPendingInsertIndex(insertIndex: number): void {
  const nextInsertIndex = hasSpeedDialInsertChange(insertIndex) ? insertIndex : -1
  if (state.speedDialDragPendingInsertIndex === nextInsertIndex) {
    return
  }

  state.speedDialDragPendingInsertIndex = nextInsertIndex
  syncSpeedDialDragVisualPreview()
}

function getSpeedDialInsertIndex(clientX: number, clientY: number): number {
  const slots = getSpeedDialDragLayoutSlots()
  if (!slots.length) {
    return -1
  }

  return resolveBookmarkDragInsertIndex(
    slots,
    state.speedDialDraggingBookmarkId,
    { x: clientX, y: clientY }
  )
}

function hasSpeedDialInsertChange(insertIndex: number): boolean {
  if (insertIndex < 0 || !state.speedDialDraggingBookmarkId) {
    return false
  }

  const currentOrderIds = getActiveWorkspacePinnedIds()
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.speedDialDraggingBookmarkId,
    insertIndex
  )
  return !areStringArraysEqual(currentOrderIds, finalOrderIds)
}

function getPreviewSpeedDialOrderIds(): string[] {
  const currentOrderIds = getActiveWorkspacePinnedIds()
  if (state.speedDialDragPendingInsertIndex < 0 || !state.speedDialDraggingBookmarkId) {
    return currentOrderIds
  }

  return buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.speedDialDraggingBookmarkId,
    state.speedDialDragPendingInsertIndex
  )
}

function captureSpeedDialDragLayout(): void {
  speedDialDragSlotRects = new Map()
  speedDialDragSlotOrderIds = []

  for (const { bookmarkId, card } of getSpeedDialCardEntries()) {
    speedDialDragSlotOrderIds.push(bookmarkId)
    speedDialDragSlotRects.set(bookmarkId, card.getBoundingClientRect())
  }
}

function getSpeedDialGrid(): HTMLElement | null {
  return getNewtabSpeedDialNodes().grid
}

function getSpeedDialCardEntries(): Array<{ bookmarkId: string; card: HTMLElement }> {
  const nodes = getNewtabSpeedDialNodes()
  const content = getNewtabSpeedDialView()?.content
  const orderedIds = content?.type === 'items'
    ? content.items.map((item) => String(item.id))
    : getActiveWorkspacePinnedIds()

  return orderedIds
    .map((bookmarkId) => {
      const card = nodes.cards.get(bookmarkId)
      return card ? { bookmarkId, card } : null
    })
    .filter((entry): entry is { bookmarkId: string; card: HTMLElement } => Boolean(entry))
}

function getSpeedDialDragLayoutSlots(): BookmarkDragSlotRectLike[] {
  if (speedDialDragSlotOrderIds.length && speedDialDragSlotRects.size) {
    return speedDialDragSlotOrderIds
      .map((bookmarkId) => {
        const rect = speedDialDragSlotRects.get(bookmarkId)
        return rect ? {
          id: bookmarkId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        } : null
      })
      .filter((slot): slot is BookmarkDragSlotRectLike => Boolean(slot))
  }

  return getSpeedDialCardEntries()
    .map(({ bookmarkId, card }) => {
      const rect = card.getBoundingClientRect()
      return {
        id: bookmarkId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
}

function syncSpeedDialDragVisualPreview(): void {
  const grid = getSpeedDialGrid()
  if (!grid || !speedDialDragSlotOrderIds.length) {
    return
  }

  const targetSlotByBookmarkId = new Map<string, DOMRect>()
  const targetOrderIds = getPreviewSpeedDialOrderIds().filter((bookmarkId) => speedDialDragSlotRects.has(bookmarkId))
  if (targetOrderIds.length !== speedDialDragSlotOrderIds.length) {
    return
  }

  for (let index = 0; index < targetOrderIds.length; index += 1) {
    const slotBookmarkId = speedDialDragSlotOrderIds[index]
    const targetRect = speedDialDragSlotRects.get(slotBookmarkId)
    if (!targetRect) {
      return
    }
    targetSlotByBookmarkId.set(targetOrderIds[index], targetRect)
  }

  const previewStyleByBookmarkId = new Map<string, CSSProperties | undefined>()
  for (const bookmarkId of targetOrderIds) {
    const originalRect = speedDialDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedCard = bookmarkId === state.speedDialDraggingBookmarkId
    previewStyleByBookmarkId.set(
      bookmarkId,
      createDragPreviewStylePatch(deltaX, deltaY, isDraggedCard)
    )
  }

  patchNewtabSpeedDialView((view) => {
    if (view.content.type !== 'items') {
      return view
    }

    let changed = false
    const items = view.content.items.map((item) => {
      const previewStyle = previewStyleByBookmarkId.get(String(item.id))
      if (!previewStyleByBookmarkId.has(String(item.id))) {
        return item
      }
      changed = true
      return {
        ...item,
        style: mergeDragPreviewStyle(item.style, previewStyle)
      }
    })

    return changed
      ? {
          ...view,
          content: {
            ...view.content,
            items
          }
        }
      : view
  })
}

function clearSpeedDialDragVisualPreview(): void {
  patchNewtabSpeedDialView((view) => {
    if (view.content.type !== 'items') {
      return view
    }

    let changed = false
    const items = view.content.items.map((item) => {
      const style = clearDragPreviewStyle(item.style)
      if (style === item.style) {
        return item
      }
      changed = true
      return {
        ...item,
        style
      }
    })

    return changed
      ? {
          ...view,
          content: {
            ...view.content,
            items
          }
        }
      : view
  })
  speedDialDragSlotRects = new Map()
  speedDialDragSlotOrderIds = []
}

function applyDraggedSpeedDialInsertInState(insertIndex: number): string[] {
  const currentOrderIds = getActiveWorkspacePinnedIds()
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.speedDialDraggingBookmarkId,
    insertIndex
  )
  if (areStringArraysEqual(currentOrderIds, finalOrderIds)) {
    return currentOrderIds
  }

  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  state.workspaceSettings = updateNewTabWorkspace(
    state.workspaceSettings,
    activeWorkspace.id,
    { pinnedIds: finalOrderIds },
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )
  return getActiveWorkspacePinnedIds()
}

async function persistSpeedDialOrder(
  originalBookmarkIds: string[],
  finalBookmarkIds: string[]
): Promise<void> {
  if (areStringArraysEqual(originalBookmarkIds, finalBookmarkIds)) {
    return
  }

  state.reorderingSpeedDial = true
  state.speedDialReorderError = ''
  syncSpeedDialReorderBusyState()
  try {
    await saveNewTabWorkspaceSettings()
  } catch (error) {
    const message = error instanceof Error ? error.message : '固定入口排序保存失败，请刷新后重试。'
    const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
    state.workspaceSettings = updateNewTabWorkspace(
      state.workspaceSettings,
      activeWorkspace.id,
      { pinnedIds: originalBookmarkIds },
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
    state.speedDialReorderError = message
    render()
    updateClockText()
  } finally {
    state.reorderingSpeedDial = false
    syncSpeedDialReorderBusyState()
  }
}

function syncSpeedDialReorderBusyState(): void {
  const current = getNewtabSpeedDialView()
  if (!current) {
    return
  }

  const content = current.content.type === 'items'
    ? {
        ...current.content,
        busy: state.reorderingSpeedDial
      }
    : current.content

  dispatchNewtabSpeedDialView({
    ...current,
    ariaBusy: state.reorderingSpeedDial,
    content,
    meta: state.speedDialReorderError || current.meta,
    metaTone: state.speedDialReorderError ? 'error' : current.metaTone
  })
}

async function settleSpeedDialDragGhost(finalOrderIds: string[]): Promise<void> {
  const finalIndex = finalOrderIds.indexOf(state.speedDialDraggingBookmarkId)
  const slotId = speedDialDragSlotOrderIds[finalIndex]
  const targetRect = slotId ? speedDialDragSlotRects.get(slotId) : null
  if (!targetRect) {
    return
  }
  await settleNewtabDragGhost('.speed-dial-drag-ghost', targetRect.left, targetRect.top)
}

function handleSpeedDialReorderKeyDown(
  bookmarkId: string,
  event: ReactKeyboardEvent<HTMLElement>
): void {
  const direction = getKeyboardReorderDirection(event, 'horizontal')
  if (!direction) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (state.reorderingSpeedDial) {
    return
  }
  void reorderSpeedDialByKeyboard(bookmarkId, direction)
}

async function reorderSpeedDialByKeyboard(bookmarkId: string, direction: -1 | 1): Promise<void> {
  const originalIds = getActiveWorkspacePinnedIds()
  const currentIndex = originalIds.indexOf(bookmarkId)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= originalIds.length) {
    setFolderReorderStatus(direction < 0 ? '固定入口已在最前面。' : '固定入口已在最后面。', 'success')
    return
  }

  const finalIds = swapArrayItems(originalIds, currentIndex, nextIndex)
  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  state.workspaceSettings = updateNewTabWorkspace(
    state.workspaceSettings,
    activeWorkspace.id,
    { pinnedIds: finalIds },
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )
  render()
  updateClockText()
  focusSpeedDialCard(bookmarkId)
  await persistSpeedDialOrder(originalIds, finalIds)
  if (!state.speedDialReorderError) {
    setFolderReorderStatus(`固定入口已移动到第 ${nextIndex + 1} 位。`, 'success')
    focusSpeedDialCard(bookmarkId)
  }
}

function startBookmarkDragFromReact(
  bookmarkId: string,
  folderId: string,
  tile: HTMLElement,
  event: DragStartPointerEvent
): void {
  finishPendingBookmarkDropVisualCommit()
  if (
    state.speedDialDraggingBookmarkId ||
    state.speedDialDragLongPressTimer ||
    state.draggingFolderId ||
    state.folderDragLongPressTimer
  ) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!getBookmarkById(normalizedBookmarkId)) {
    return
  }
  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId) {
    return
  }

  cancelBookmarkDrag({ keepSuppressClick: true })
  state.dragPointerId = event.pointerId
  state.dragPointerType = event.pointerType
  state.draggingBookmarkId = normalizedBookmarkId
  state.draggingBookmarkFolderId = normalizedFolderId
  state.dragStartX = event.clientX
  state.dragStartY = event.clientY
  state.dragClientX = event.clientX
  state.dragClientY = event.clientY
  const rect = tile.getBoundingClientRect()
  state.dragOffsetX = event.clientX - rect.left
  state.dragOffsetY = event.clientY - rect.top
  if (event.pointerType !== 'mouse') {
    dispatchNewtabDragUiView({ bookmarkPendingId: normalizedBookmarkId })
    state.dragLongPressTimer = window.setTimeout(() => {
      beginBookmarkDrag()
    }, BOOKMARK_DRAG_LONG_PRESS_MS)
  }
}

function handleBookmarkDragPointerDown(
  bookmarkId: string,
  folderId: string,
  tile: HTMLElement,
  event: ReactPointerEvent<HTMLElement>
): void {
  startBookmarkDragFromReact(bookmarkId, folderId, tile, event.nativeEvent)
}

function beginBookmarkDrag(): void {
  if (!state.draggingBookmarkId || !getBookmarkById(state.draggingBookmarkId)) {
    cancelBookmarkDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  state.dragLongPressTimer = 0
  state.dragOriginalOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  state.dragSuppressClick = true
  const sourceTile = getActiveDragTile()
  if (sourceTile) {
    try {
      sourceTile.setPointerCapture(state.dragPointerId)
    } catch {
      // The pointer may already be released when a synthetic test begins drag.
    }
  }
  dispatchNewtabDragUiView({ bookmarkDragging: true, bookmarkPendingId: '' })
  createBookmarkDragGhost(sourceTile)
  captureBookmarkDragLayout()
  patchBookmarkTileDraggingState(state.draggingBookmarkId, true)
  dispatchNewtabDragUiView({ previewInitializing: true })
  syncBookmarkDragVisualPreview()
  window.requestAnimationFrame(() => {
    dispatchNewtabDragUiView({ previewInitializing: false })
  })
}

function handleBookmarkPointerMove(event: PointerEvent): void {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  state.dragClientX = event.clientX
  state.dragClientY = event.clientY

  if (!state.dragOriginalOrderIds.length) {
    const distance = Math.hypot(
      event.clientX - state.dragStartX,
      event.clientY - state.dragStartY
    )
    if (state.dragPointerType === 'mouse') {
      if (distance < POINTER_DRAG_START_THRESHOLD_PX) {
        return
      }
      beginBookmarkDrag()
    } else {
      if (distance >= TOUCH_DRAG_CANCEL_THRESHOLD_PX) {
        cancelBookmarkDrag()
      }
      return
    }
  }

  if (!state.dragOriginalOrderIds.length) {
    return
  }

  event.preventDefault()
  updateBookmarkDragGhost()
  const insertIndex = getBookmarkInsertIndex(event.clientX, event.clientY)
  setBookmarkDragPendingInsertIndex(insertIndex)
}

async function finishBookmarkDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingBookmarkId || event.pointerId !== state.dragPointerId) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  state.dragLongPressTimer = 0

  const wasDragging = Boolean(state.dragOriginalOrderIds.length)
  const folderId = state.draggingBookmarkFolderId
  const originalOrderIds = [...state.dragOriginalOrderIds]
  const pendingInsertIndex = state.dragPendingInsertIndex >= 0
    ? state.dragPendingInsertIndex
    : getBookmarkInsertIndex(event.clientX, event.clientY)
  const finalOrderIds = wasDragging && pendingInsertIndex >= 0
    ? applyDraggedBookmarkInsertInState(pendingInsertIndex)
    : getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  if (wasDragging) {
    await settleBookmarkDragGhost(finalOrderIds)
  }
  clearBookmarkDragState({
    deferVisualReset: wasDragging,
    keepSuppressClick: wasDragging
  })

  if (!wasDragging) {
    return
  }

  // Keep the preview transforms in the previous view until the reordered view is
  // committed. Clearing them in a separate store update lets the live cards
  // transition back to their old slots, or replays the old offset from their new
  // DOM slots. The transition-free commit makes the layout/order swap atomic.
  render()
  updateClockText()
  finishBookmarkDropVisualCommit()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  markSearchIndexDirty()
  await persistBookmarkOrder(folderId, originalOrderIds, finalOrderIds)
}

function cancelBookmarkDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingBookmarkId && !state.dragLongPressTimer) {
    return
  }

  window.clearTimeout(state.dragLongPressTimer)
  clearBookmarkDragState({ keepSuppressClick })
  render()
  updateClockText()
}

function clearBookmarkDragState({
  deferVisualReset = false,
  keepSuppressClick = false
} = {}): void {
  if (deferVisualReset) {
    dispatchNewtabDragUiView({
      bookmarkPendingId: '',
      bookmarkDragging: true,
      previewInitializing: true
    })
  } else {
    patchBookmarkTileDraggingState(state.draggingBookmarkId, false)
  }
  state.draggingBookmarkId = ''
  state.dragPointerId = 0
  state.dragLongPressTimer = 0
  state.dragClientX = 0
  state.dragClientY = 0
  state.dragStartX = 0
  state.dragStartY = 0
  state.dragPointerType = ''
  state.dragOffsetX = 0
  state.dragOffsetY = 0
  state.draggingBookmarkFolderId = ''
  state.dragOriginalOrderIds = []
  state.dragPendingInsertIndex = -1
  if (deferVisualReset) {
    bookmarkDragSlotRects = new Map()
    bookmarkDragSlotOrderIds = []
  } else {
    removeBookmarkDragGhost()
    clearBookmarkDragVisualPreview()
    dispatchNewtabDragUiView({
      bookmarkPendingId: '',
      bookmarkDragging: false,
      previewInitializing: false
    })
  }

  if (keepSuppressClick) {
    state.dragSuppressClick = true
    window.setTimeout(() => {
      state.dragSuppressClick = false
    }, 250)
  } else {
    state.dragSuppressClick = false
  }
}

function finishBookmarkDropVisualCommit(): void {
  removeBookmarkDragGhost()
  window.cancelAnimationFrame(bookmarkDropCommitFrame)
  bookmarkDropCommitFrame = window.requestAnimationFrame(() => {
    bookmarkDropCommitFrame = 0
    dispatchNewtabDragUiView({
      bookmarkPendingId: '',
      bookmarkDragging: false,
      previewInitializing: false
    })
  })
}

function finishPendingBookmarkDropVisualCommit(): void {
  if (!bookmarkDropCommitFrame) {
    return
  }
  window.cancelAnimationFrame(bookmarkDropCommitFrame)
  bookmarkDropCommitFrame = 0
  dispatchNewtabDragUiView({
    bookmarkPendingId: '',
    bookmarkDragging: false,
    previewInitializing: false
  })
}

function patchBookmarkTileDraggingState(bookmarkId: string, dragging: boolean): void {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return
  }

  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (!section.grid) {
        return section
      }

      const items = section.grid.items.map((item) => {
        if (String(item.id) !== normalizedBookmarkId || item.dragging === dragging) {
          return item
        }
        changed = true
        return {
          ...item,
          dragging
        }
      })
      if (items === section.grid.items) {
        return section
      }
      return {
        ...section,
        grid: {
          ...section.grid,
          items
        }
      }
    })

    return changed
      ? {
          ...view,
          sections
        }
      : view
  })
}

function createBookmarkDragGhost(sourceTile = getActiveDragTile()): void {
  removeBookmarkDragGhost()

  if (!sourceTile || !state.draggingBookmarkId) {
    return
  }

  const bookmark = getBookmarkById(state.draggingBookmarkId)
  if (!bookmark?.url) {
    return
  }
  const item = getBookmarkDragTileModel(
    state.draggingBookmarkId,
    state.draggingBookmarkFolderId,
    bookmark
  )
  if (!item) {
    return
  }
  const rect = sourceTile.getBoundingClientRect()

  dispatchBookmarkDragGhostView({
    customIcon: item.customIcon,
    fallbackLabel: item.fallbackLabel,
    favicon: item.favicon,
    height: rect.height,
    showTitles: state.iconSettings.showTitles,
    style: getBookmarkDragGhostStyle(item.style),
    title: item.title,
    transform: 'translate3d(0, 0, 0)',
    visible: false,
    width: rect.width
  })
  updateBookmarkDragGhost({ immediate: true })
  patchBookmarkDragGhostView((view) => ({
    ...view,
    visible: true
  }))
}

function getBookmarkDragTileModel(
  bookmarkId: string,
  folderId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): BookmarkTileViewModel | null {
  const content = getNewtabBookmarkContentView()
  const item = content?.sections
    .flatMap((section) => section.grid?.items || [])
    .find((item) => String(item.id) === String(bookmarkId))
  if (item) {
    return item
  }

  return createBookmarkTileViewModel(bookmark, folderId)
}

function getBookmarkDragGhostStyle(itemStyle: CSSProperties | undefined): CSSProperties | undefined {
  const style = { ...(itemStyle || {}) } as CSSProperties
  ;(style as Record<string, string>)['--icon-shell-size'] = `${state.iconSettings.iconShellSize}px`
  ;(style as Record<string, string>)['--icon-title-lines'] = String(state.iconSettings.titleLines)

  return Object.keys(style).length ? style : undefined
}

function getActiveDragTile(): HTMLElement | null {
  if (!state.draggingBookmarkId) {
    return null
  }

  return getNewtabBookmarkContentNodes().tiles.get(state.draggingBookmarkId) || null
}

function updateBookmarkDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateBookmarkDragGhostPosition()
    return
  }

  if (bookmarkDragGhostFrame) {
    return
  }

  bookmarkDragGhostFrame = window.requestAnimationFrame(() => {
    bookmarkDragGhostFrame = 0
    updateBookmarkDragGhostPosition()
  })
}

function updateBookmarkDragGhostPosition(): void {
  const left = state.dragClientX - state.dragOffsetX
  const top = state.dragClientY - state.dragOffsetY
  patchBookmarkDragGhostView((view) => ({
    ...view,
    transform: `translate3d(${left}px, ${top}px, 0)`
  }))
}

function removeBookmarkDragGhost(): void {
  window.cancelAnimationFrame(bookmarkDragGhostFrame)
  bookmarkDragGhostFrame = 0
  dispatchBookmarkDragGhostView(null)
}

function setBookmarkDragPendingInsertIndex(insertIndex: number): void {
  const nextInsertIndex = hasBookmarkInsertChange(insertIndex) ? insertIndex : -1
  if (state.dragPendingInsertIndex === nextInsertIndex) {
    return
  }

  state.dragPendingInsertIndex = nextInsertIndex
  syncBookmarkDragVisualPreview()
}

function getActiveBookmarkFolderSection(): NewTabFolderSection | null {
  if (!state.draggingBookmarkFolderId) {
    return null
  }

  return state.folderSections.find((section) => section.id === state.draggingBookmarkFolderId) || null
}

function getActiveBookmarkFolderBookmarks(): chrome.bookmarks.BookmarkTreeNode[] {
  return getActiveBookmarkFolderSection()?.bookmarks || []
}

function setActiveBookmarkFolderBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): void {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return
  }

  section.bookmarks = bookmarks
  refreshDerivedBookmarkState()
}

function getBookmarkInsertIndex(clientX: number, clientY: number): number {
  const folderId = state.draggingBookmarkFolderId
  if (!folderId) {
    return -1
  }

  const slots = getBookmarkDragLayoutSlots()
  if (!slots.length) {
    return -1
  }

  return resolveBookmarkDragInsertIndex(
    slots,
    state.draggingBookmarkId,
    getBookmarkDragTargetPoint(clientX, clientY)
  )
}

function hasBookmarkInsertChange(insertIndex: number): boolean {
  if (insertIndex < 0 || !state.draggingBookmarkId) {
    return false
  }

  const currentOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    insertIndex
  )
  return !areStringArraysEqual(currentOrderIds, finalOrderIds)
}

function getPreviewBookmarkOrderIds(): string[] {
  const currentOrderIds = getActiveBookmarkFolderBookmarks().map((bookmark) => String(bookmark.id))
  if (state.dragPendingInsertIndex < 0 || !state.draggingBookmarkId) {
    return currentOrderIds
  }

  return buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    state.dragPendingInsertIndex
  )
}

function captureBookmarkDragLayout(): void {
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []

  for (const { bookmarkId, tile } of getBookmarkTileEntries()) {
    bookmarkDragSlotOrderIds.push(bookmarkId)
    bookmarkDragSlotRects.set(bookmarkId, tile.getBoundingClientRect())
  }
}

function getActiveBookmarkGrid(): HTMLElement | null {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return null
  }

  return getNewtabBookmarkContentNodes().grids.get(section.id) || null
}

function getBookmarkTileEntries(): Array<{ bookmarkId: string; tile: HTMLElement }> {
  const section = getActiveBookmarkFolderSection()
  if (!section) {
    return []
  }

  const nodes = getNewtabBookmarkContentNodes()
  const content = getNewtabBookmarkContentView()
  const activeViewSection = content?.sections.find((viewSection) => viewSection.folderId === section.id) || null
  const orderedIds = activeViewSection?.grid
    ? activeViewSection.grid.items.map((item) => String(item.id))
    : section.bookmarks.map((bookmark) => String(bookmark.id || ''))

  return orderedIds
    .map((bookmarkId) => {
      const tile = nodes.tiles.get(bookmarkId)
      return tile ? { bookmarkId, tile } : null
    })
    .filter((entry): entry is { bookmarkId: string; tile: HTMLElement } => Boolean(entry))
}

function getBookmarkDragLayoutSlots(): BookmarkDragSlotRectLike[] {
  if (bookmarkDragSlotOrderIds.length && bookmarkDragSlotRects.size) {
    return bookmarkDragSlotOrderIds
      .map((bookmarkId) => {
        const rect = bookmarkDragSlotRects.get(bookmarkId)
        return rect ? {
          id: bookmarkId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        } : null
      })
      .filter((slot): slot is BookmarkDragSlotRectLike => Boolean(slot))
  }

  return getBookmarkTileEntries()
    .map(({ bookmarkId, tile }) => {
      const rect = tile.getBoundingClientRect()
      return {
        id: bookmarkId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }
    })
}

function getBookmarkDragTargetPoint(
  clientX: number,
  clientY: number
): { x: number; y: number } {
  // The pointer is kept at the favicon center, so it matches the point users steer visually.
  return { x: clientX, y: clientY }
}

function syncBookmarkDragVisualPreview(): void {
  const grid = getActiveBookmarkGrid()
  if (!grid || !bookmarkDragSlotOrderIds.length) {
    return
  }

  const targetSlotByBookmarkId = new Map<string, DOMRect>()
  const targetOrderIds = getPreviewBookmarkOrderIds()
  if (targetOrderIds.length !== bookmarkDragSlotOrderIds.length) {
    return
  }

  for (let index = 0; index < targetOrderIds.length; index += 1) {
    const slotBookmarkId = bookmarkDragSlotOrderIds[index]
    const targetRect = bookmarkDragSlotRects.get(slotBookmarkId)
    if (!targetRect) {
      return
    }
    targetSlotByBookmarkId.set(targetOrderIds[index], targetRect)
  }

  const previewStyleByBookmarkId = new Map<string, CSSProperties | undefined>()
  for (const bookmarkId of targetOrderIds) {
    const originalRect = bookmarkDragSlotRects.get(bookmarkId)
    const targetRect = targetSlotByBookmarkId.get(bookmarkId)
    if (!originalRect || !targetRect) {
      continue
    }

    const deltaX = targetRect.left - originalRect.left
    const deltaY = targetRect.top - originalRect.top
    const isDraggedTile = bookmarkId === state.draggingBookmarkId
    previewStyleByBookmarkId.set(
      bookmarkId,
      createDragPreviewStylePatch(deltaX, deltaY, isDraggedTile)
    )
  }

  patchBookmarkTilePreviewStyles(previewStyleByBookmarkId)
}

function createDragPreviewStylePatch(
  deltaX: number,
  deltaY: number,
  isDraggedTile: boolean
): CSSProperties | undefined {
  const transform = buildBookmarkPreviewTransform(deltaX, deltaY, isDraggedTile)
  if (!transform && !isDraggedTile) {
    return undefined
  }

  return {
    transform,
    zIndex: isDraggedTile ? 1 : undefined
  }
}

function buildBookmarkPreviewTransform(deltaX: number, deltaY: number, isDraggedTile: boolean): string {
  const hasOffset = Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5
  if (!hasOffset) {
    return isDraggedTile ? 'scale(0.92)' : ''
  }

  const translate = `translate3d(${deltaX}px, ${deltaY}px, 0)`
  return isDraggedTile ? `${translate} scale(0.92)` : translate
}

function clearBookmarkDragVisualPreview(): void {
  patchBookmarkTilePreviewStyles(new Map())
  bookmarkDragSlotRects = new Map()
  bookmarkDragSlotOrderIds = []
}

function patchBookmarkTilePreviewStyles(previewStyleByBookmarkId: Map<string, CSSProperties | undefined>): void {
  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (!section.grid) {
        return section
      }

      let sectionChanged = false
      const items = section.grid.items.map((item) => {
        const itemId = String(item.id)
        const style = previewStyleByBookmarkId.has(itemId)
          ? mergeDragPreviewStyle(item.style, previewStyleByBookmarkId.get(itemId))
          : clearDragPreviewStyle(item.style)
        if (style === item.style) {
          return item
        }
        sectionChanged = true
        return {
          ...item,
          style
        }
      })

      if (sectionChanged) {
        changed = true
      }
      return sectionChanged
        ? {
            ...section,
            grid: {
              ...section.grid,
              items
            }
          }
        : section
    })

    return changed
      ? {
          ...view,
          sections
        }
      : view
  })
}

function mergeDragPreviewStyle(
  baseStyle: CSSProperties | undefined,
  previewStyle: CSSProperties | undefined
): CSSProperties | undefined {
  const next = clearDragPreviewStyle(baseStyle)
  const merged = { ...(next || {}) } as CSSProperties
  if (previewStyle?.transform) {
    merged.transform = previewStyle.transform
  }
  if (previewStyle?.zIndex !== undefined) {
    merged.zIndex = previewStyle.zIndex
  }
  return Object.keys(merged).length ? merged : undefined
}

function clearDragPreviewStyle(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style || (!('transform' in style) && !('zIndex' in style))) {
    return style
  }

  const next = { ...style } as CSSProperties
  delete next.transform
  delete next.zIndex
  return Object.keys(next).length ? next : undefined
}

function applyDraggedBookmarkInsertInState(insertIndex: number): string[] {
  const currentBookmarks = getActiveBookmarkFolderBookmarks()
  const currentOrderIds = currentBookmarks.map((bookmark) => String(bookmark.id))
  const finalOrderIds = buildBookmarkOrderAfterInsert(
    currentOrderIds,
    state.draggingBookmarkId,
    insertIndex
  )
  if (areStringArraysEqual(currentOrderIds, finalOrderIds)) {
    return currentOrderIds
  }

  const bookmarkById = new Map(currentBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  const nextBookmarks: chrome.bookmarks.BookmarkTreeNode[] = []
  for (const bookmarkId of finalOrderIds) {
    const bookmark = bookmarkById.get(bookmarkId)
    if (!bookmark) {
      return currentOrderIds
    }
    nextBookmarks.push(bookmark)
  }

  setActiveBookmarkFolderBookmarks(nextBookmarks)
  return finalOrderIds
}

async function persistBookmarkOrder(
  folderId: string,
  originalBookmarkIds: string[],
  finalBookmarkIds: string[]
): Promise<void> {
  if (!folderId) {
    return
  }

  const operations = buildMinimalBookmarkMoveOperations(
    originalBookmarkIds,
    finalBookmarkIds,
    folderId
  )
  if (!operations.length) {
    return
  }

  state.reorderingBookmarks = true
  state.selfBookmarkMoveIds = new Set(operations.map((operation) => operation.id))
  state.selfBookmarkMoveSuppressUntil = Date.now() + 1500
  state.bookmarkReorderError = ''
  syncBookmarkReorderBusyState()
  try {
    await moveBookmarkOperationsSequentially(operations)

    if (!syncPersistedBookmarkOrderInState(folderId, operations, finalBookmarkIds)) {
      await refreshNewTab({ showLoading: false })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '书签排序保存失败，请刷新后重试。'
    await refreshNewTab({ showLoading: false })
    state.bookmarkReorderError = message
    render()
    updateClockText()
  } finally {
    state.reorderingBookmarks = false
    syncBookmarkReorderBusyState()
  }
}

function moveBookmarkOperationsSequentially(operations: BookmarkMoveOperation[]): Promise<void> {
  return operations.reduce<Promise<void>>((chain, operation) => {
    return chain.then(async () => {
      await moveBookmarkLazy(operation.id, operation.parentId, operation.index)
    })
  }, Promise.resolve())
}

function syncPersistedBookmarkOrderInState(
  folderId: string,
  operations: BookmarkMoveOperation[],
  finalBookmarkIds: string[]
): boolean {
  const folderNode = state.folderNodeMap.get(folderId) || null
  const nextChildren = applyBookmarkMoveOperationsToChildren(folderNode?.children, operations)
  if (!folderNode || !nextChildren) {
    return false
  }

  const nextBookmarkIds = nextChildren.flatMap((combineValue, combineIndex, combineArray) => { if (!((child) => Boolean(child.url))(combineValue)) return []; const combinedResult = ((child) => String(child.id))(combineValue); return [combinedResult] })
  if (!areStringArraysEqual(nextBookmarkIds, finalBookmarkIds)) {
    return false
  }

  folderNode.children = nextChildren
  state.bookmarkCatalog = null
  state.folderData = refreshBookmarkCatalog(state.rootNode).extracted
  state.folderNodeMap = buildFolderNodeMap(state.rootNode)
  state.folderSections = buildNewTabFolderSections(
    state.rootNode,
    state.folderSettings,
    state.folderData,
    state.folderNodeMap
  )
  refreshDerivedBookmarkState()
  markSearchIndexDirty()
  render()
  updateClockText()
  return true
}

function syncBookmarkReorderBusyState(): void {
  patchNewtabBookmarkContentView((view) => {
    const sections = view.sections.map((section) => ({
      ...section,
      grid: section.grid ? {
        ...section.grid,
        busy: state.reorderingBookmarks
      } : null
    }))
    return {
      ...view,
      content: {
        ...view.content,
        reordering: state.reorderingBookmarks
      },
      sections
    }
  })
}

async function settleBookmarkDragGhost(finalOrderIds: string[]): Promise<void> {
  const finalIndex = finalOrderIds.indexOf(state.draggingBookmarkId)
  const slotId = bookmarkDragSlotOrderIds[finalIndex]
  const targetRect = slotId ? bookmarkDragSlotRects.get(slotId) : null
  if (!targetRect) {
    return
  }
  await settleNewtabDragGhost('.bookmark-drag-ghost', targetRect.left, targetRect.top)
}

function handleBookmarkReorderKeyDown(
  bookmarkId: string,
  folderId: string,
  event: ReactKeyboardEvent<HTMLElement>
): void {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  const direction = getKeyboardReorderDirection(event, 'horizontal')
  if (!direction) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (state.reorderingBookmarks) {
    return
  }

  if (event.shiftKey) {
    void moveBookmarkToAdjacentFolderByKeyboard(bookmarkId, folderId, direction)
    return
  }
  void reorderBookmarkByKeyboard(bookmarkId, folderId, direction)
}

async function reorderBookmarkByKeyboard(
  bookmarkId: string,
  folderId: string,
  direction: -1 | 1
): Promise<void> {
  const section = state.folderSections.find((item) => item.id === folderId)
  if (!section) {
    return
  }
  const currentIndex = section.bookmarks.findIndex((bookmark) => String(bookmark.id) === bookmarkId)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= section.bookmarks.length) {
    setFolderReorderStatus(direction < 0 ? '书签已在当前文件夹最前面。' : '书签已在当前文件夹最后面。', 'success')
    return
  }

  const originalIds = section.bookmarks.map((bookmark) => String(bookmark.id))
  section.bookmarks = swapArrayItems(section.bookmarks, currentIndex, nextIndex)
  const finalIds = section.bookmarks.map((bookmark) => String(bookmark.id))
  refreshDerivedBookmarkState()
  render()
  updateClockText()
  focusBookmarkTile(bookmarkId)
  await persistBookmarkOrder(folderId, originalIds, finalIds)
  if (!state.bookmarkReorderError) {
    setFolderReorderStatus(`书签已移动到「${section.title || '未命名文件夹'}」第 ${nextIndex + 1} 位。`, 'success')
    focusBookmarkTile(bookmarkId)
  }
}

async function moveBookmarkToAdjacentFolderByKeyboard(
  bookmarkId: string,
  folderId: string,
  direction: -1 | 1
): Promise<void> {
  const currentFolderIndex = state.folderSections.findIndex((section) => section.id === folderId)
  const targetSection = state.folderSections[currentFolderIndex + direction]
  if (currentFolderIndex < 0 || !targetSection) {
    setFolderReorderStatus(direction < 0 ? '没有更前面的来源文件夹。' : '没有更后面的来源文件夹。', 'success')
    return
  }

  state.reorderingBookmarks = true
  syncBookmarkReorderBusyState()
  try {
    await moveBookmarkLazy(bookmarkId, targetSection.id, targetSection.bookmarks.length)
    markSearchIndexDirty()
    await refreshNewTab({ showLoading: false })
    setFolderReorderStatus(`书签已移动到「${targetSection.title || '未命名文件夹'}」。`, 'success')
    focusBookmarkTile(bookmarkId)
  } catch (error) {
    const message = error instanceof Error ? error.message : '移动失败，请稍后重试。'
    setFolderReorderStatus(`书签移动失败。${message}`, 'error')
  } finally {
    state.reorderingBookmarks = false
    syncBookmarkReorderBusyState()
  }
}

function handleFolderReorderKeyDown(
  folderId: string,
  event: ReactKeyboardEvent<HTMLElement>
): void {
  const direction = getKeyboardReorderDirection(event, 'vertical')
  if (!direction) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  void reorderFolderByKeyboard(folderId, direction)
}

async function reorderFolderByKeyboard(folderId: string, direction: -1 | 1): Promise<void> {
  const currentIndex = state.folderSections.findIndex((section) => section.id === folderId)
  const nextIndex = currentIndex + direction
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.folderSections.length) {
    setFolderReorderStatus(direction < 0 ? '文件夹已在最前面。' : '文件夹已在最后面。', 'success')
    return
  }

  const originalSections = [...state.folderSections]
  const originalIds = originalSections.map((section) => section.id)
  state.folderSections = swapArrayItems(state.folderSections, currentIndex, nextIndex)
  const finalIds = state.folderSections.map((section) => section.id)
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: finalIds
  })
  refreshDerivedBookmarkState()
  render()
  updateClockText()
  focusFolderHeader(folderId)

  try {
    await saveFolderSettings()
    syncFolderSettingsControls()
    setFolderReorderStatus(`文件夹已移动到第 ${nextIndex + 1} 位。`, 'success')
    focusFolderHeader(folderId)
  } catch (error) {
    state.folderSections = originalSections
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: originalIds
    })
    refreshDerivedBookmarkState()
    render()
    updateClockText()
    const message = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    setFolderReorderStatus(`文件夹顺序保存失败，已恢复。${message}`, 'error')
    focusFolderHeader(folderId)
  }
}

function getKeyboardReorderDirection(
  event: ReactKeyboardEvent<HTMLElement>,
  orientation: 'horizontal' | 'vertical'
): -1 | 0 | 1 {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return 0
  }
  if (orientation === 'horizontal') {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return 1
    return 0
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') return -1
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') return 1
  return 0
}

function swapArrayItems<T>(items: readonly T[], leftIndex: number, rightIndex: number): T[] {
  const next = [...items]
  ;[next[leftIndex], next[rightIndex]] = [next[rightIndex], next[leftIndex]]
  return next
}

function focusBookmarkTile(bookmarkId: string): void {
  window.requestAnimationFrame(() => {
    getNewtabBookmarkContentNodes().tiles.get(bookmarkId)?.focus({ preventScroll: true })
  })
}

function focusSpeedDialCard(bookmarkId: string): void {
  window.requestAnimationFrame(() => {
    getNewtabSpeedDialNodes().cards.get(bookmarkId)?.focus({ preventScroll: true })
  })
}

function focusFolderHeader(folderId: string): void {
  window.requestAnimationFrame(() => {
    getNewtabBookmarkContentNodes().folderHeaders.get(folderId)?.focus({ preventScroll: true })
  })
}

function startFolderDragFromReact(
  folderId: string,
  header: HTMLElement,
  event: DragStartPointerEvent
): void {
  finishPendingBookmarkDropVisualCommit()
  if (state.draggingBookmarkId || state.dragLongPressTimer) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId || !state.folderSections.some((section) => section.id === normalizedFolderId)) {
    return
  }

  cancelFolderDrag({ keepSuppressClick: true })
  state.folderDragPointerId = event.pointerId
  state.folderDragPointerType = event.pointerType
  state.draggingFolderId = normalizedFolderId
  state.folderDragStartX = event.clientX
  state.folderDragStartY = event.clientY
  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY
  const rect = header.getBoundingClientRect()
  state.folderDragOffsetX = event.clientX - rect.left
  state.folderDragOffsetY = event.clientY - rect.top
  if (event.pointerType !== 'mouse') {
    dispatchNewtabDragUiView({ folderPendingId: normalizedFolderId })
    state.folderDragLongPressTimer = window.setTimeout(() => {
      beginFolderDrag()
    }, FOLDER_DRAG_LONG_PRESS_MS)
  }
}

function handleFolderDragPointerDown(
  folderId: string,
  header: HTMLElement,
  event: ReactPointerEvent<HTMLElement>
): void {
  startFolderDragFromReact(folderId, header, event.nativeEvent)
}

function handleFolderHeaderClick(event: ReactMouseEvent<HTMLButtonElement>): void {
  if (!shouldSuppressNewtabActionClick()) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
}

function beginFolderDrag(): void {
  if (!state.draggingFolderId || !state.folderSections.some((section) => section.id === state.draggingFolderId)) {
    cancelFolderDrag()
    return
  }

  closeBookmarkMenu()
  closeAddBookmarkMenu()
  clearFolderReorderStatus()
  state.folderDragLongPressTimer = 0
  state.folderDragOriginalOrderIds = state.folderSections.map((section) => section.id)
  state.folderDragOriginalSections = [...state.folderSections]
  folderDragSectionRectSnapshot = getFolderSectionRects()
  state.folderDragSuppressClick = true
  const sourceHeader = getActiveFolderDragHeader()
  if (sourceHeader) {
    try {
      sourceHeader.setPointerCapture(state.folderDragPointerId)
    } catch {
      // The pointer may already be released when a synthetic test begins drag.
    }
  }
  dispatchNewtabDragUiView({ folderOrderDragging: true, folderPendingId: '' })
  createFolderDragGhost(sourceHeader)
  patchFolderDraggingState(state.draggingFolderId, true)
}

function handleFolderPointerMove(event: PointerEvent): void {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  state.folderDragClientX = event.clientX
  state.folderDragClientY = event.clientY

  if (!state.folderDragOriginalOrderIds.length) {
    const distance = Math.hypot(
      event.clientX - state.folderDragStartX,
      event.clientY - state.folderDragStartY
    )
    if (state.folderDragPointerType === 'mouse') {
      if (distance < POINTER_DRAG_START_THRESHOLD_PX) {
        return
      }
      beginFolderDrag()
    } else {
      if (distance >= TOUCH_DRAG_CANCEL_THRESHOLD_PX) {
        cancelFolderDrag()
      }
      return
    }
  }

  if (!state.folderDragOriginalOrderIds.length) {
    return
  }

  event.preventDefault()
  updateFolderDragGhost()
  const insertIndex = getFolderInsertIndex(event.clientY)
  if (insertIndex < 0) {
    return
  }

  if (moveDraggedFolderInState(insertIndex)) {
    renderWithFolderFlip()
    updateFolderDragGhost({ immediate: true })
  }
}

async function finishFolderDrag(event: PointerEvent): Promise<void> {
  if (!state.draggingFolderId || event.pointerId !== state.folderDragPointerId) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  state.folderDragLongPressTimer = 0

  const wasDragging = Boolean(state.folderDragOriginalOrderIds.length)
  const finalOrderIds = state.folderSections.map((section) => section.id)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  const targetHeaderRect = getActiveFolderDragHeader()?.getBoundingClientRect() || null
  if (wasDragging && targetHeaderRect) {
    await settleNewtabDragGhost('.folder-drag-ghost', targetHeaderRect.left, targetHeaderRect.top)
  }
  clearFolderDragState({ keepSuppressClick: wasDragging })

  if (!wasDragging) {
    return
  }

  render()
  updateClockText()

  if (areStringArraysEqual(originalOrderIds, finalOrderIds)) {
    return
  }

  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: finalOrderIds
  })
  markSearchIndexDirty()
  try {
    await saveFolderSettings()
    syncFolderSettingsControls()
    setFolderReorderStatus('文件夹顺序已保存。', 'success')
  } catch (error) {
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: originalOrderIds
    })
    restoreFolderDragOrder(originalOrderIds, originalSections)
    markSearchIndexDirty()
    syncFolderSettingsControls()
    const message = error instanceof Error ? error.message : '请稍后重试。'
    setFolderReorderStatus(`文件夹顺序保存失败，已恢复到拖拽前顺序。${message}`, 'error')
  }
}

function cancelFolderDrag({ keepSuppressClick = false } = {}): void {
  if (!state.draggingFolderId && !state.folderDragLongPressTimer) {
    return
  }

  window.clearTimeout(state.folderDragLongPressTimer)
  const originalOrderIds = [...state.folderDragOriginalOrderIds]
  const originalSections = [...state.folderDragOriginalSections]
  clearFolderDragState({ keepSuppressClick })
  restoreFolderDragOrder(originalOrderIds, originalSections)
  render()
  updateClockText()
}

function clearFolderDragState({ keepSuppressClick = false } = {}): void {
  patchFolderDraggingState(state.draggingFolderId, false)
  state.draggingFolderId = ''
  state.folderDragPointerId = 0
  state.folderDragLongPressTimer = 0
  state.folderDragClientX = 0
  state.folderDragClientY = 0
  state.folderDragStartX = 0
  state.folderDragStartY = 0
  state.folderDragPointerType = ''
  state.folderDragOffsetX = 0
  state.folderDragOffsetY = 0
  state.folderDragOriginalOrderIds = []
  state.folderDragOriginalSections = []
  folderDragSectionRectSnapshot = null
  removeFolderDragGhost()
  dispatchNewtabDragUiView({ folderOrderDragging: false, folderPendingId: '' })

  if (keepSuppressClick) {
    state.folderDragSuppressClick = true
    window.setTimeout(() => {
      state.folderDragSuppressClick = false
    }, 250)
  } else {
    state.folderDragSuppressClick = false
  }
}

function patchFolderDraggingState(folderId: string, dragging: boolean): void {
  const normalizedFolderId = String(folderId || '').trim()
  if (!normalizedFolderId) {
    return
  }

  patchNewtabBookmarkContentView((view) => {
    let changed = false
    const sections = view.sections.map((section) => {
      if (section.folderId !== normalizedFolderId || section.dragging === dragging) {
        return section
      }
      changed = true
      return {
        ...section,
        dragging
      }
    })

    return changed
      ? {
          ...view,
          sections
        }
      : view
  })
}

function createFolderDragGhost(sourceHeader = getActiveFolderDragHeader()): void {
  removeFolderDragGhost()

  if (!sourceHeader || !state.draggingFolderId) {
    return
  }

  const section = state.folderSections.find((section) => section.id === state.draggingFolderId)
  if (!section) {
    return
  }

  // Ghost 用导航模式的文件夹卡片形态（玻璃卡片），尺寸取一张 live 书签卡片的
  // 实际 rect（拖拽手感与书签卡片一致）；没有可参照的卡片时退回标题尺寸。
  const referenceTile = getNewtabBookmarkContentNodes().tiles.values().next().value as HTMLElement | undefined
  const referenceRect = referenceTile?.getBoundingClientRect()
  const headerRect = sourceHeader.getBoundingClientRect()
  const width = referenceRect && referenceRect.width > 0 ? referenceRect.width : Math.max(headerRect.width, 168)
  const height = referenceRect && referenceRect.height > 0 ? referenceRect.height : Math.max(headerRect.height, 48)
  dispatchFolderDragGhostView({
    bookmarkCount: section.bookmarks.length,
    height,
    style: getBookmarkDragGhostStyle(undefined),
    title: section.title,
    transform: 'translate3d(0, 0, 0)',
    width
  })
  updateFolderDragGhost({ immediate: true })
}

function getActiveFolderDragHeader(): HTMLElement | null {
  if (!state.draggingFolderId) {
    return null
  }

  return getNewtabBookmarkContentNodes().folderHeaders.get(state.draggingFolderId) || null
}

function updateFolderDragGhost({ immediate = false } = {}): void {
  if (immediate) {
    updateFolderDragGhostPosition()
    return
  }

  if (folderDragGhostFrame) {
    return
  }

  folderDragGhostFrame = window.requestAnimationFrame(() => {
    folderDragGhostFrame = 0
    updateFolderDragGhostPosition()
  })
}

function updateFolderDragGhostPosition(): void {
  const left = state.folderDragClientX - state.folderDragOffsetX
  const top = state.folderDragClientY - state.folderDragOffsetY
  patchFolderDragGhostView((view) => ({
    ...view,
    transform: `translate3d(${left}px, ${top}px, 0)`
  }))
}

function removeFolderDragGhost(): void {
  window.cancelAnimationFrame(folderDragGhostFrame)
  folderDragGhostFrame = 0
  dispatchFolderDragGhostView(null)
}

async function settleNewtabDragGhost(
  selector: string,
  left: number,
  top: number
): Promise<void> {
  if (prefersReducedMotion()) {
    return
  }
  const ghost = document.querySelector<HTMLElement>(selector)
  if (!ghost) {
    return
  }
  const currentTransform = getComputedStyle(ghost).transform
  const animation = ghost.animate(
    [
      { transform: currentTransform === 'none' ? ghost.style.transform : currentTransform },
      { transform: `translate3d(${left}px, ${top}px, 0) scale(1)` }
    ],
    {
      duration: getMotionDurationMs('--drag-settle-dur', 160),
      easing: getMotionEasing('--ease-smooth-out', 'cubic-bezier(0.22, 1, 0.36, 1)'),
      fill: 'forwards'
    }
  )
  try {
    await animation.finished
  } catch {
    // Cancellation means a new gesture retargeted the same preview.
  }
}

function getFolderSectionRects(): FolderDragSectionRectSnapshot {
  const nodes = getNewtabBookmarkContentNodes()
  return createFolderDragSectionRectSnapshot(
    state.folderSections
      .map((section) => {
        const element = nodes.folderSections.get(section.id)
        if (!element) {
          return null
        }
        const rect = element.getBoundingClientRect()
        return {
          id: section.id,
          top: rect.top,
          height: rect.height
        }
      })
      .filter((section): section is { id: string; top: number; height: number } => Boolean(section))
  )
}

function renderWithFolderFlip(): void {
  const previousRects = folderDragSectionRectSnapshot || getFolderSectionRects()
  render()
  updateClockText()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  const currentSnapshot = projectFolderDragSectionRectSnapshot(previousRects, state.folderSections.map((section) => section.id))
  for (const delta of getFolderFlipDeltasFromSnapshots(
    previousRects,
    currentSnapshot,
    state.draggingFolderId
  )) {
    const section = getNewtabBookmarkContentNodes().folderSections.get(delta.folderId) || null
    section?.animate(
      [
        { transform: `translate3d(0, ${delta.deltaY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ],
      {
        // 与书签卡片让位（BOOKMARK_TILE_DRAG_RESTING_MOTION_CLASS）共用
        // drag settle 时长和 easing，避免不同拖拽模式在落位时变速。
        duration: getMotionDurationMs('--drag-settle-dur', 160),
        easing: getMotionEasing('--ease-smooth-out', 'cubic-bezier(0.22, 1, 0.36, 1)')
      }
    )
  }
  folderDragSectionRectSnapshot = currentSnapshot
}

function getFolderInsertIndex(clientY: number): number {
  const snapshot = folderDragSectionRectSnapshot || getFolderSectionRects()
  return getFolderInsertIndexFromSnapshot(clientY, snapshot)
}

function moveDraggedFolderInState(insertIndex: number): boolean {
  const currentIndex = state.folderSections.findIndex(
    (section) => section.id === state.draggingFolderId
  )
  if (currentIndex < 0) {
    return false
  }

  const nextSections = [...state.folderSections]
  const [draggedSection] = nextSections.splice(currentIndex, 1)
  const normalizedIndex = Math.max(
    0,
    Math.min(
      currentIndex < insertIndex ? insertIndex - 1 : insertIndex,
      nextSections.length
    )
  )

  if (currentIndex === normalizedIndex) {
    return false
  }

  nextSections.splice(normalizedIndex, 0, draggedSection)
  state.folderSections = nextSections
  refreshDerivedBookmarkState()
  return true
}

function restoreFolderDragOrder(
  originalOrderIds: string[],
  originalSections: NewTabFolderSection[]
): boolean {
  if (!originalOrderIds.length || originalSections.length !== originalOrderIds.length) {
    return false
  }

  const sectionById = new Map(originalSections.map((section) => [section.id, section]))
  const restoredSections: NewTabFolderSection[] = []
  for (const folderId of originalOrderIds) {
    const section = sectionById.get(folderId)
    if (!section) {
      return false
    }
    restoredSections.push(section)
  }

  state.folderSections = restoredSections
  refreshDerivedBookmarkState()
  return true
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isFolderRelevantToNewTab(folderId: string | null | undefined): boolean {
  const id = String(folderId || '').trim()
  if (!id) {
    return true
  }
  const selectedIds = state.folderSettings?.selectedFolderIds
  if (!selectedIds || !selectedIds.length) {
    return true
  }
  if (!state.folderNodeMap || state.folderNodeMap.size === 0) {
    return true
  }
  const selectedSet = new Set(selectedIds.map((value) => String(value)))
  let current = state.folderNodeMap.get(id) || null
  let guard = 0
  while (current && guard < 256) {
    if (selectedSet.has(String(current.id))) {
      return true
    }
    const parentId = current.parentId ? String(current.parentId) : ''
    if (!parentId) {
      break
    }
    current = state.folderNodeMap.get(parentId) || null
    guard += 1
  }
  return false
}

function handleBookmarkCreated(
  _bookmarkId: string,
  bookmark: chrome.bookmarks.BookmarkTreeNode
): void {
  if (state.reorderingBookmarks) {
    return
  }

  const parentId = bookmark && bookmark.parentId ? String(bookmark.parentId) : ''
  const createdBookmark = Boolean(bookmark?.url)
  const parentRelevant = !parentId || isFolderRelevantToNewTab(parentId)
  if (!parentRelevant) {
    return
  }

  const insertedLocally = createdBookmark ? insertBookmarkInPlace(bookmark) : false
  const result = getBookmarkCreationIncrementalResult({
    createdBookmark,
    parentRelevant,
    insertedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function handleBookmarkChanged(bookmarkId: string, changeInfo: BookmarkChangeInfo): void {
  if (state.reorderingBookmarks) {
    return
  }

  const id = String(bookmarkId || '').trim()
  if (!id) {
    scheduleBookmarkChangeRefresh()
    return
  }

  if (!patchBookmarkInPlace(id, changeInfo)) {
    scheduleBookmarkChangeRefresh()
  }
}

function insertBookmarkInPlace(bookmark: chrome.bookmarks.BookmarkTreeNode): boolean {
  const bookmarkId = String(bookmark?.id || '').trim()
  const parentId = String(bookmark?.parentId || '').trim()
  if (!bookmarkId || !bookmark?.url || !parentId) {
    return false
  }

  const targetSection = state.folderSections.find((section) => section.id === parentId)
  const parentNode = state.folderNodeMap.get(parentId) || targetSection?.node || null
  if (!targetSection || !parentNode) {
    return false
  }

  const existingChildren = Array.isArray(parentNode.children) ? parentNode.children : []
  const alreadyInTree = existingChildren.some((child) => String(child.id) === bookmarkId)
  const alreadyInSection = targetSection.bookmarks.some((item) => String(item.id) === bookmarkId)
  if (alreadyInSection) {
    return true
  }

  if (!alreadyInTree) {
    const nextChildren = [...existingChildren]
    const insertIndex = typeof bookmark.index === 'number'
      ? Math.max(0, Math.min(bookmark.index, nextChildren.length))
      : nextChildren.length
    nextChildren.splice(insertIndex, 0, bookmark)
    parentNode.children = nextChildren
  }

  state.folderSections = state.folderSections.map((section) => {
    if (section.id !== parentId) {
      return section
    }

    const nextBookmarks = section.bookmarks.some((item) => String(item.id) === bookmarkId)
      ? section.bookmarks
      : insertBookmarkByIndex(section.bookmarks, bookmark)
    return {
      ...section,
      bookmarks: nextBookmarks,
      directBookmarkCount: nextBookmarks.length,
      totalBookmarkCount: Math.max(
        alreadyInTree ? section.totalBookmarkCount : section.totalBookmarkCount + 1,
        nextBookmarks.length
      )
    }
  })
  state.bookmarks = getAllSectionBookmarks()
  state.bookmarkMap = new Map(state.bookmarks.map((item) => [String(item.id), item]))
  state.allBookmarks = buildAllBookmarks(state.rootNode)
  state.allBookmarkMap = new Map(state.allBookmarks.map((item) => [String(item.id), item]))
  markSearchIndexDirty({ schedule: true })
  renderBookmarkSections()
  return true
}

function insertBookmarkByIndex(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  bookmark: chrome.bookmarks.BookmarkTreeNode
): chrome.bookmarks.BookmarkTreeNode[] {
  const nextBookmarks = bookmarks.filter((item) => String(item.id) !== String(bookmark.id))
  const insertIndex = typeof bookmark.index === 'number'
    ? Math.max(0, Math.min(bookmark.index, nextBookmarks.length))
    : nextBookmarks.length
  nextBookmarks.splice(insertIndex, 0, bookmark)
  return nextBookmarks
}

function patchBookmarkInPlace(
  bookmarkId: string,
  changeInfo: BookmarkChangeInfo
): boolean {
  const node = state.allBookmarkMap.get(bookmarkId) || state.bookmarkMap.get(bookmarkId)
  if (!node || !node.url) {
    return false
  }

  if (changeInfo.title !== undefined) {
    node.title = changeInfo.title
  }
  if (changeInfo.url !== undefined) {
    node.url = changeInfo.url
  }

  const updatedBookmarkContent = state.bookmarkMap.has(bookmarkId)
  if (updatedBookmarkContent) {
    renderBookmarkSections()
  }

  const speedDialView = getNewtabSpeedDialView()
  const updatedSpeedDial = speedDialView?.content.type === 'items' &&
    speedDialView.content.items.some((item) => String(item.id) === bookmarkId)
  if (updatedSpeedDial) {
    refreshSpeedDialPanel()
  }

  return updatedBookmarkContent || updatedSpeedDial
}

function handleBookmarkRemoved(bookmarkId: string, removeInfo: BookmarkRemoveInfo): void {
  if (state.reorderingBookmarks) {
    return
  }

  const removedBookmark = Boolean(removeInfo.node?.url)
  if (!removedBookmark) {
    scheduleBookmarkChangeRefresh()
    return
  }

  const removedLocally = removeBookmarkFromLocalState(String(bookmarkId || ''))
  const result = getBookmarkRemovalIncrementalResult({
    removedBookmark,
    removedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function removeBookmarkFromLocalState(bookmarkId: string): boolean {
  if (!bookmarkId) {
    return false
  }

  const removedAny = forgetBookmarkFromLocalMaps(bookmarkId)
  if (removedAny) {
    markSearchIndexDirty({ schedule: true })
    renderBookmarkSections()
    refreshSpeedDialPanel()
  }
  return removedAny
}

function forgetBookmarkFromLocalMaps(bookmarkId: string): boolean {
  const removedVisible = state.bookmarkMap.delete(bookmarkId)
  const removedAny = state.allBookmarkMap.delete(bookmarkId) || removedVisible
  if (removedAny) {
    state.bookmarks = state.bookmarks.filter((bookmark) => String(bookmark.id) !== bookmarkId)
    state.allBookmarks = state.allBookmarks.filter((bookmark) => String(bookmark.id) !== bookmarkId)
    state.folderSections = state.folderSections.map((section) => {
      if (!section.bookmarks.some((bookmark) => String(bookmark.id) === bookmarkId)) {
        return section
      }
      const nodeChildren = Array.isArray(section.node.children)
        ? section.node.children.filter((child) => String(child.id) !== bookmarkId)
        : section.node.children
      if (Array.isArray(section.node.children)) {
        section.node.children = nodeChildren
      }
      return {
        ...section,
        bookmarks: section.bookmarks.filter((bookmark) => String(bookmark.id) !== bookmarkId),
        directBookmarkCount: Math.max(0, section.directBookmarkCount - 1),
        totalBookmarkCount: Math.max(0, section.totalBookmarkCount - 1)
      }
    })
    state.faviconRefreshTokens.delete(bookmarkId)
  }
  return removedAny
}

function handleBookmarkMoved(
  bookmarkId: string,
  moveInfo?: BookmarkMoveInfo
): void {
  if (isSelfBookmarkMoveEvent(bookmarkId)) {
    return
  }

  const newParentRelevant = moveInfo
    ? isFolderRelevantToNewTab(moveInfo.parentId)
    : true
  const oldParentRelevant = moveInfo
    ? isFolderRelevantToNewTab(moveInfo.oldParentId)
    : true
  if (moveInfo && !newParentRelevant && !oldParentRelevant) {
    return
  }

  const movedLocally = moveInfo
    ? moveBookmarkInPlace(String(bookmarkId || ''), moveInfo, {
        oldParentRelevant,
        newParentRelevant
      })
    : false
  const result = getBookmarkMoveIncrementalResult({
    movedBookmark: Boolean(getBookmarkById(bookmarkId)?.url),
    oldParentRelevant,
    newParentRelevant,
    movedLocally
  })
  if (result.shouldRefresh) {
    scheduleBookmarkChangeRefresh()
  }
}

function moveBookmarkInPlace(
  bookmarkId: string,
  moveInfo: BookmarkMoveInfo,
  relevance: {
    oldParentRelevant: boolean
    newParentRelevant: boolean
  }
): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  const oldParentId = String(moveInfo.oldParentId || '').trim()
  const newParentId = String(moveInfo.parentId || '').trim()
  if (!normalizedBookmarkId || !oldParentId || !newParentId) {
    return false
  }

  const movedNode = state.allBookmarkMap.get(normalizedBookmarkId) || state.bookmarkMap.get(normalizedBookmarkId) || null
  if (!movedNode?.url) {
    return false
  }

  const oldParentNode = state.folderNodeMap.get(oldParentId) || null
  const newParentNode = state.folderNodeMap.get(newParentId) || null
  if (!oldParentNode || !newParentNode) {
    return false
  }

  const oldSection = state.folderSections.find((section) => section.id === oldParentId) || null
  const newSection = state.folderSections.find((section) => section.id === newParentId) || null
  if (
    (relevance.oldParentRelevant && !oldSection) ||
    (relevance.newParentRelevant && !newSection)
  ) {
    return false
  }
  if (
    oldSection &&
    !oldSection.bookmarks.some((bookmark) => String(bookmark.id) === normalizedBookmarkId)
  ) {
    return false
  }
  if (
    newSection &&
    newSection !== oldSection &&
    newSection.bookmarks.some((bookmark) => String(bookmark.id) === normalizedBookmarkId)
  ) {
    return false
  }

  if (!removeBookmarkFromParentNode(oldParentNode, normalizedBookmarkId)) {
    return false
  }

  const nextBookmark: chrome.bookmarks.BookmarkTreeNode = {
    ...movedNode,
    parentId: newParentId
  }
  if (typeof moveInfo.index === 'number') {
    nextBookmark.index = moveInfo.index
  }

  insertBookmarkIntoParentNode(newParentNode, nextBookmark, moveInfo.index)

  let sectionChanged = false
  state.folderSections = state.folderSections.map((section) => {
    if (section.id !== oldParentId && section.id !== newParentId) {
      return section
    }

    let nextBookmarks = section.bookmarks
    if (section.id === oldParentId) {
      nextBookmarks = nextBookmarks.filter((bookmark) => String(bookmark.id) !== normalizedBookmarkId)
    }
    if (section.id === newParentId) {
      nextBookmarks = insertBookmarkByIndex(nextBookmarks, nextBookmark)
    }

    if (nextBookmarks === section.bookmarks) {
      return section
    }

    sectionChanged = true
    const counts = getFolderBookmarkCounts(section.node)
    return {
      ...section,
      bookmarks: nextBookmarks,
      directBookmarkCount: counts.directBookmarkCount,
      totalBookmarkCount: counts.totalBookmarkCount
    }
  })

  movedNode.parentId = newParentId
  if (typeof moveInfo.index === 'number') {
    movedNode.index = moveInfo.index
  }
  const nextBookmarks = getAllSectionBookmarks()
  state.bookmarks = nextBookmarks
  state.bookmarkMap = new Map(nextBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarkCatalog = null
  markSearchIndexDirty({ schedule: true })
  renderBookmarkSections()
  return sectionChanged
}

function removeBookmarkFromParentNode(
  parentNode: chrome.bookmarks.BookmarkTreeNode,
  bookmarkId: string
): boolean {
  if (!Array.isArray(parentNode.children)) {
    return false
  }

  const nextChildren = parentNode.children.filter((child) => String(child.id) !== bookmarkId)
  if (nextChildren.length === parentNode.children.length) {
    return false
  }

  parentNode.children = reindexBookmarkChildren(nextChildren)
  return true
}

function insertBookmarkIntoParentNode(
  parentNode: chrome.bookmarks.BookmarkTreeNode,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  rawIndex: number | undefined
): void {
  const nextChildren = Array.isArray(parentNode.children)
    ? parentNode.children.filter((child) => String(child.id) !== String(bookmark.id))
    : []
  const insertIndex = normalizeBookmarkInsertIndex(rawIndex, nextChildren.length)
  nextChildren.splice(insertIndex, 0, bookmark)
  parentNode.children = reindexBookmarkChildren(nextChildren)
}

function reindexBookmarkChildren(
  children: chrome.bookmarks.BookmarkTreeNode[]
): chrome.bookmarks.BookmarkTreeNode[] {
  return children.map((child, index) => {
    child.index = index
    return child
  })
}

function normalizeBookmarkInsertIndex(rawIndex: number | undefined, length: number): number {
  if (!Number.isFinite(rawIndex)) {
    return length
  }
  return Math.max(0, Math.min(Math.trunc(Number(rawIndex)), length))
}

function scheduleBookmarkChangeRefresh(): void {
  bookmarkChangeRefreshQueued = true
  if (bookmarkChangeRefreshTimer || bookmarkChangeRefreshInFlight) {
    return
  }

  bookmarkChangeRefreshTimer = window.setTimeout(() => {
    bookmarkChangeRefreshTimer = 0
    void flushBookmarkChangeRefresh()
  }, BOOKMARK_CHANGE_REFRESH_DEBOUNCE_MS)
}

async function flushBookmarkChangeRefresh(): Promise<void> {
  if (bookmarkChangeRefreshInFlight || !bookmarkChangeRefreshQueued) {
    return
  }

  bookmarkChangeRefreshQueued = false
  bookmarkChangeRefreshInFlight = true
  try {
    await refreshNewTab({ showLoading: false })
  } finally {
    bookmarkChangeRefreshInFlight = false
    if (bookmarkChangeRefreshQueued) {
      scheduleBookmarkChangeRefresh()
    }
  }
}

function isSelfBookmarkMoveEvent(bookmarkId: string): boolean {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (
    normalizedBookmarkId &&
    state.selfBookmarkMoveIds.has(normalizedBookmarkId) &&
    Date.now() <= state.selfBookmarkMoveSuppressUntil
  ) {
    state.selfBookmarkMoveIds.delete(normalizedBookmarkId)
    return true
  }

  if (Date.now() > state.selfBookmarkMoveSuppressUntil) {
    state.selfBookmarkMoveIds.clear()
  }

  return state.reorderingBookmarks
}

function isActiveMenuBookmarkPinned(): boolean {
  const bookmark = getActiveMenuBookmark()
  return Boolean(bookmark && isBookmarkPinnedInSpeedDial(getActiveWorkspacePinnedIds(), String(bookmark.id)))
}

async function toggleActiveMenuBookmarkPin(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id)
  const workspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const pinned = isBookmarkPinnedInSpeedDial(workspace.pinnedIds, bookmarkId)
  state.workspaceSettings = toggleNewTabWorkspacePin(
    state.workspaceSettings,
    workspace.id,
    bookmarkId,
    { validBookmarkIds: state.allBookmarkMap.keys() }
  )

  try {
    state.pendingDeleteBookmarkId = ''
    await saveNewTabWorkspaceSettings()
    const copy = getSpeedDialPinActionCopyLocal(pinned)
    state.menuError = ''
    state.menuStatus = copy.status
    scheduleRender({ updateClock: true })
    updateClockText()
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  } catch (error) {
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '固定状态保存失败，请稍后重试。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'toggle-pin' })
  }
}

async function saveBookmarkMenuChanges(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  try {
    const previousUrl = String(bookmark.url || '').trim()
    const title = state.editTitle.trim() || state.editUrl.trim()
    const url = normalizeBookmarkInputUrl(state.editUrl)
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu()

    await updateBookmarkLazy(bookmark.id, { title, url })
    await persistCustomIconChoice(bookmark.id)
    if (previousUrl !== url) {
      state.faviconRefreshTokens.set(bookmark.id, Date.now())
    }
    closeBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '保存失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

async function copyActiveMenuBookmarkUrl(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark?.url) {
    closeBookmarkMenu()
    return
  }

  try {
    state.pendingDeleteBookmarkId = ''
    await writeClipboardText(bookmark.url)
    state.menuError = ''
    state.menuStatus = '链接已复制'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  } catch (error) {
    state.menuStatus = ''
    state.menuError = error instanceof Error ? `复制失败：${error.message}` : '复制失败，请手动复制链接。'
    renderBookmarkMenu({ focusFirst: false, focusAction: 'copy-url' })
  }
}

async function deleteActiveMenuBookmark(): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  const bookmarkId = String(bookmark.id || '')
  if (state.pendingDeleteBookmarkId !== bookmarkId) {
    state.pendingDeleteBookmarkId = bookmarkId
    state.menuError = ''
    state.menuStatus = getDeleteBookmarkConfirmationText(bookmark)
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })
    return
  }

  try {
    state.menuBusy = true
    state.menuError = ''
    state.menuStatus = `正在删除 1 个书签：「${getBookmarkDisplayTitle(bookmark)}」...`
    renderBookmarkMenu({ focusFirst: false, focusAction: 'delete-bookmark' })

    const recycleId = `recycle-${bookmark.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const deleted = await deleteBookmarkToRecycleLazy(bookmark.id, {
      recycleId,
      bookmarkId: String(bookmark.id),
      title: bookmark.title || '未命名书签',
      url: bookmark.url,
      parentId: String(bookmark.parentId || ''),
      index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : 0,
      path: getBookmarkFolderPath(bookmark) || DEFAULT_NEW_TAB_FOLDER_TITLE,
      source: '新标签页删除',
      deletedAt: Date.now()
    }, {
      expectedUrl: bookmark.url
    })
    if (!deleted) {
      throw new Error('书签地址已变化，已取消删除。')
    }
    const deletedCustomIcon = state.customIcons[bookmark.id]
    if (deletedCustomIcon) {
      const nextIcons = { ...state.customIcons }
      delete nextIcons[bookmark.id]
      await Promise.all([
        saveCustomIcons(nextIcons).catch((error) => {
          console.warn('新标签页自定义图标清理失败。', error)
        }),
        removeBookmarkFromActivity(bookmark.id).catch((error) => {
          console.warn('新标签页打开记录清理失败。', error)
        }),
        removeBookmarkFromWorkspacePins(bookmark.id).catch((error) => {
          console.warn('新标签页 workspace 固定入口清理失败。', error)
        })
      ])
    } else {
      await Promise.all([
        removeBookmarkFromActivity(bookmark.id).catch((error) => {
          console.warn('新标签页打开记录清理失败。', error)
        }),
        removeBookmarkFromWorkspacePins(bookmark.id).catch((error) => {
          console.warn('新标签页 workspace 固定入口清理失败。', error)
        })
      ])
    }

    state.pendingDeleteBookmarkId = ''
    state.lastDeletedBookmark = {
      bookmark,
      recycleId,
      deletedAt: Date.now(),
      customIcon: deletedCustomIcon
    }
    state.deleteToastStatus = ''
    closeBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    state.pendingDeleteBookmarkId = ''
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError = error instanceof Error ? error.message : '删除失败，请稍后重试。'
    renderBookmarkMenu()
  }
}

function getDeleteBookmarkConfirmationText(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  return '再次点击确认删除，可在回收站恢复。'
}

async function undoLastDeletedBookmark(): Promise<void> {
  const deleted = state.lastDeletedBookmark
  if (!deleted || state.deleteToastBusy) {
    return
  }

  state.deleteToastBusy = true
  state.deleteToastStatus = '正在恢复...'
  renderDeleteToast()

  try {
    const bookmark = deleted.bookmark
    const parentId = await getRestorableParentId(bookmark.parentId)
    const createdBookmark = await restoreBookmarkFromRecycleEntryLazy(
      deleted.recycleId,
      () => createBookmarkLazy({
        parentId,
        index: Number.isFinite(Number(bookmark.index)) ? Number(bookmark.index) : undefined,
        title: bookmark.title || '未命名书签',
        url: bookmark.url
      })
    )
    if (deleted.customIcon) {
      await saveCustomIcons({
        ...state.customIcons,
        [String(createdBookmark.id)]: deleted.customIcon
      }).catch((error) => {
        console.warn('新标签页撤销删除时恢复自定义图标失败。', error)
      })
    }

    state.lastDeletedBookmark = null
    state.deleteToastBusy = false
    state.deleteToastStatus = ''
    await refreshNewTab({ showLoading: false })
    renderDeleteToast()
  } catch (error) {
    state.deleteToastBusy = false
    state.deleteToastStatus = error instanceof Error ? error.message : '恢复失败，请打开回收站处理。'
    renderDeleteToast()
  }
}

async function getRestorableParentId(parentId: string | undefined): Promise<string> {
  try {
    const rootNode = (await getBookmarkTree())[0] || null
    const bookmarksBar = findBookmarksBar(rootNode)
    return resolveRestorableBookmarkParentId(parentId, rootNode, bookmarksBar?.id || BOOKMARKS_BAR_ID)
  } catch {
    return BOOKMARKS_BAR_ID
  }
}

function openRecycleBin(): void {
  const url = chrome.runtime.getURL('src/options/options.html#recycle')
  void chrome.tabs?.create?.({ url })
  state.lastDeletedBookmark = null
  state.deleteToastStatus = ''
  renderDeleteToast()
}

function openOptionsHash(hash: string): void {
  const normalizedHash = String(hash || '').startsWith('#') ? String(hash) : `#${String(hash || '').trim()}`
  const url = chrome.runtime.getURL(`src/options/options.html${normalizedHash}`)
  void chrome.tabs?.create?.({ url })
}

function openAiProviderSettings(): void {
  openOptionsHash('#general:ai-provider')
}

function getBookmarkDisplayTitle(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  return String(bookmark.title || '').trim() || String(bookmark.url || '').trim() || '未命名书签'
}

function getBookmarkActionLabelContext(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const title = getBookmarkDisplayTitle(bookmark)
  return title.length > 48 ? `${title.slice(0, 47).trim()}…` : title
}

function refreshActiveMenuIcon(): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  state.pendingDeleteBookmarkId = ''
  state.faviconRefreshTokens.set(bookmark.id, Date.now())
  if (!renderBookmarkSections()) {
    render()
  }
  scheduleAdaptiveNewTabLayoutUpdate()
  updateClockText()
  renderBookmarkMenu({ focusFirst: false, focusAction: 'refresh-icon' })
}

function expandAddBookmarkMenu(): void {
  state.addMenuExpanded = true
  state.addMenuError = ''
  renderAddBookmarkMenu()
}

async function saveAddedBookmark(): Promise<void> {
  try {
    const url = normalizeBookmarkInputUrl(state.addUrl)
    const title = state.addTitle.trim() || url
    state.addMenuBusy = true
    state.addMenuError = ''
    renderAddBookmarkMenu({ focusFirst: false })

    const folderId = state.addFolderId || await ensureNewTabFolder()
    await createBookmarkLazy({
      parentId: folderId,
      title,
      url
    })
    closeAddBookmarkMenu()
    await refreshNewTab({ showLoading: false })
  } catch (error) {
    state.addMenuBusy = false
    state.addMenuError =
      error instanceof Error ? error.message : '添加失败，请稍后重试。'
    renderAddBookmarkMenu({ focusFirst: false })
  }
}

interface RefreshNewTabOptions {
  showLoading?: boolean
}

async function refreshNewTab({ showLoading = true }: RefreshNewTabOptions = {}): Promise<void> {
  const refreshVersion = ++newTabRefreshVersion
  const backgroundMutationVersionAtStart = backgroundSettingsMutationVersion
  state.error = ''
  state.utilitySettingsHydrated = false
  state.bookmarkReorderError = ''
  clearFolderReorderStatus()
  resetAutoSearchLayoutSettle()
  resetSearchIndexReadyState()
  if (showLoading) {
    state.loading = true
    render()
  }

  try {
    const { tree, stored } = await consumeNewtabStartupData()
    preloadBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])
    perfMark('newtab.storageLoaded')
    const rootNode = tree[0] || null
    state.rootNode = rootNode
    state.bookmarkCatalog = null
    state.bookmarkTagIndex = null
    state.searchSnapshotIndex = null
    const folderData = refreshBookmarkCatalog(rootNode).extracted
    const folderNodeMap = buildFolderNodeMap(rootNode)
    const folderSettings = normalizeFolderSettingsWithDefault(
      stored[STORAGE_KEYS.newTabFolderSettings],
      rootNode
    )
    const folderSections = buildNewTabFolderSections(rootNode, folderSettings, folderData, folderNodeMap)
    perfMark('newtab.sectionsBuilt')
    perfMeasure('newtab.sectionsBuildMs', 'newtab.storageLoaded', 'newtab.sectionsBuilt')

    state.folderData = folderData
    state.folderNodeMap = folderNodeMap
    state.folderSettings = folderSettings
    state.folderSections = folderSections
    refreshDerivedBookmarkState()
    state.customIcons = normalizeCustomIcons(stored[STORAGE_KEYS.newTabCustomIcons])
    const featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences(
      stored[STORAGE_KEYS.newTabFeaturedBackgroundPreferences]
    )
    state.featuredBackgroundGallery = normalizeFeaturedBackgroundGallery(stored[STORAGE_KEYS.newTabFeaturedBackgroundGallery])
    state.featuredBackgroundFavoriteIds = normalizeFeaturedBackgroundFavoriteIds(stored[STORAGE_KEYS.newTabFeaturedBackgroundFavorites])
    state.featuredBackgroundGalleryHydrated = true
    state.featuredBackgroundPreferences = featuredBackgroundPreferences
    state.activity = normalizeNewTabActivity(null, state.allBookmarks)
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(stored[STORAGE_KEYS.newTabWorkspaceSettings], {
      validBookmarkIds: state.allBookmarkMap.keys()
    })
    state.moduleSettings = normalizeNewTabModuleSettings(stored[STORAGE_KEYS.newTabModuleSettings])
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      state.backgroundSettings = preloadedBackgroundSettings || state.backgroundSettings
    }
    migrateStoredFeaturedBackgroundId()
    state.searchSettings = normalizeSearchSettings(stored[STORAGE_KEYS.newTabSearchSettings])
    setAutoSearchLayoutPending(
      state.searchSettings.autoVerticalCenter && readCachedAutoSearchOffsetYValue() === null
    )
    state.iconSettings = normalizeIconSettings(stored[STORAGE_KEYS.newTabIconSettings])
    state.generalSettings = normalizeGeneralSettings(stored[STORAGE_KEYS.newTabGeneralSettings])
    state.timeSettings = normalizeTimeSettingsLocal(stored[STORAGE_KEYS.newTabTimeSettings])
    state.utilitySettingsHydrated = true
    onboardingCompleted = normalizeNewTabOnboardingCompleted(stored[STORAGE_KEYS.onboardingState])
  } catch (error) {
    state.error = error instanceof Error ? error.message : '新标签页加载失败，请刷新后重试。'
    resolveSearchIndexReady()
  } finally {
    state.loading = false
    render()
    renderDeleteToast()
    const backgroundUiAlreadyApplied = backgroundUiAppliedFromPreload
    backgroundUiAppliedFromPreload = false
    const shouldSyncBackgroundUi = backgroundSettingsHydrated && !backgroundUiAlreadyApplied
    if (shouldSyncBackgroundUi) {
      scheduleFeaturedBackgroundDailyRefresh()
      void applyBackgroundSettings()
    }
    applyGeneralSettings()
    applyFolderSettings()
    if (shouldSyncBackgroundUi) {
      syncBackgroundSettingsControls()
      syncFeaturedBackgroundDisplayPreferenceControls()
    }
    syncSearchSettingsControls()
    syncIconSettingsControls()
    syncGeneralSettingsControls()
    syncFolderSettingsControls()
    syncNewTabModernSettingsControls()
    syncTimeSettingsControls()
    updateClockText()
    scheduleClockTick()
    runIdle(() => {
      void hydrateNewTabSearchAndTags(refreshVersion)
    })
    runIdle(() => {
      void refreshNewTabNaturalSearchAiConfiguredState().then(() => {
        if (!state.searchSettings.naturalSearchAiConfigured && state.searchSettings.naturalSearchEnabled) {
          state.searchSettings = normalizeSearchSettings({
            ...state.searchSettings,
            naturalSearchEnabled: false
          })
          void saveSearchSettings().catch((saveError) => {
            console.warn('新标签页 AI 语义搜索状态保存失败。', saveError)
          })
          syncSearchSettingsControls()
        }
      })
    }, { timeout: 800 })
  }
}

async function hydrateNewTabSearchAndTags(refreshVersion = newTabRefreshVersion): Promise<void> {
  try {
    if (refreshVersion !== newTabRefreshVersion) {
      return
    }
    const [tagIndex, snapshotIndex, activity] = await Promise.all([
      loadNewTabBookmarkTagIndexLazy(),
      loadNewTabContentSnapshotIndexLazy(),
      loadNewTabActivityLazy()
    ])

    state.bookmarkTagIndex = normalizeNewTabBookmarkTagIndex(tagIndex)
    state.searchSnapshotIndex = normalizeNewTabContentSnapshotIndex(snapshotIndex)
    state.activity = activity
    state.workspaceSettings = normalizeNewTabWorkspaceSettings(state.workspaceSettings, {
      validBookmarkIds: state.allBookmarkMap.keys(),
      legacyPinnedIds: state.activity.pinnedIds
    })
    scheduleNewTabSearchIndexRebuild()
    render()
  } catch (error) {
    console.warn('新标签页 idle 数据加载失败。', error)
    scheduleNewTabSearchIndexRebuild()
    resolveSearchIndexReady()
  }
}

async function loadNewTabBookmarkTagIndexLazy(): Promise<BookmarkTagIndex | null> {
  try {
    const { loadBookmarkTagIndex } = await import('../shared/bookmark-tags.js')
    return await loadBookmarkTagIndex()
  } catch {
    return null
  }
}

async function loadNewTabContentSnapshotIndexLazy(): Promise<ContentSnapshotIndex | null> {
  try {
    const { loadContentSnapshotIndex } = await import('../shared/content-snapshots.js')
    return await loadContentSnapshotIndex()
  } catch {
    return null
  }
}

async function loadNewTabActivityLazy(): Promise<NewTabActivityState> {
  try {
    const activityRepository = await loadNewTabActivityRepositoryLazy()
    return activityRepository.loadNewTabActivityFromRepository(normalizeNewTabActivityForCurrentBookmarks)
  } catch {
    const stored = await getLocalStorage([STORAGE_KEYS.newTabActivity]).catch(() => ({}))
    return normalizeNewTabActivity(stored[STORAGE_KEYS.newTabActivity], state.allBookmarks)
  }
}

function preloadBackgroundSettings(rawSettings: unknown): typeof DEFAULT_BACKGROUND_SETTINGS | null {
  const backgroundMutationVersionAtStart = backgroundSettingsMutationVersion
  try {
    const nextSettings = normalizeBackgroundSettings(rawSettings)
    backgroundSettingsHydrated = true
    if (backgroundMutationVersionAtStart === backgroundSettingsMutationVersion) {
      state.backgroundSettings = nextSettings
      preloadedBackgroundSettings = nextSettings
      setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(state.backgroundSettings))
      syncInstantWallpaperTargetForSettings(nextSettings)
      scheduleCurrentBackgroundStartupCache(nextSettings, { delay: 0 })
      syncBackgroundSettingsControls()
      syncFeaturedBackgroundDisplayPreferenceControls()
      scheduleFeaturedBackgroundDailyRefresh()
      void applyBackgroundSettings()
      backgroundUiAppliedFromPreload = true
    } else {
      syncBackgroundSettingsControls()
    }
    return nextSettings
  } catch (error) {
    syncBackgroundSettingsControls()
    console.warn('新标签页背景预加载失败。', error)
    markWallpaperReady()
    recordNewTabBackgroundReady()
    return preloadedBackgroundSettings
  }
}

async function createNewTabFolder(): Promise<void> {
  if (state.creatingFolder) {
    return
  }

  state.creatingFolder = true
  state.error = ''
  render()

  try {
    const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
    const bookmarksBar = findBookmarksBar(rootNode)
    const createdFolder = await createBookmarkLazy({
      parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
      title: DEFAULT_NEW_TAB_FOLDER_TITLE
    })
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: [...state.folderSettings.selectedFolderIds, String(createdFolder.id)]
    })
    await saveFolderSettings()
    await refreshNewTab()
  } catch (error) {
    state.error = error instanceof Error ? error.message : '书签来源文件夹创建失败，请稍后重试。'
    render()
  } finally {
    state.creatingFolder = false
    render()
  }
}

async function ensureNewTabFolder(): Promise<string> {
  const primarySection = state.folderSections[0]
  if (primarySection?.id) {
    return primarySection.id
  }

  const rootNode = state.rootNode || (await getBookmarkTree())[0] || null
  const existingFolder = findNewTabFolder(rootNode)
  if (existingFolder?.id) {
    state.folderSettings = normalizeFolderSettings({
      ...state.folderSettings,
      selectedFolderIds: [String(existingFolder.id)]
    })
    state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
    refreshDerivedBookmarkState()
    markSearchIndexDirty()
    await saveFolderSettings()
    return String(existingFolder.id)
  }

  const bookmarksBar = findBookmarksBar(rootNode)
  const createdFolder = await createBookmarkLazy({
    parentId: bookmarksBar?.id || BOOKMARKS_BAR_ID,
    title: DEFAULT_NEW_TAB_FOLDER_TITLE
  })
  state.folderSettings = normalizeFolderSettings({
    ...state.folderSettings,
    selectedFolderIds: [String(createdFolder.id)]
  })
  state.folderSections = buildNewTabFolderSections(rootNode, state.folderSettings)
  refreshDerivedBookmarkState()
  markSearchIndexDirty()
  await saveFolderSettings()
  return String(createdFolder.id)
}

function render(): void {
  const contentState = resolveNewTabContentState({
    loading: state.loading,
    error: state.error,
    selectedFolderCount: state.folderSettings.selectedFolderIds.length,
    visibleFolderCount: state.folderSections.length
  })
  const contentKey = getContentStateSignature(contentState)
  const shellKey = getNewTabShellSignature()

  if (
    contentState.type === 'bookmarks' &&
    lastRenderedContentKey === 'bookmarks' &&
    lastRenderedShellKey === shellKey &&
    renderBookmarkSections()
  ) {
    scheduleAdaptiveNewTabLayoutUpdate()
    recordNewTabFirstBookmarksRendered()
    return
  }

  cancelScheduledAdaptiveNewTabLayoutUpdate()
  if (contentState.type !== 'bookmarks') {
    dispatchNewtabBookmarkContentView(null)
  }
  dispatchNewtabContentView(createContentStateView(contentState))
  lastRenderedContentKey = contentKey
  lastRenderedShellKey = shellKey
  scheduleAdaptiveNewTabLayoutUpdate()
  recordContentStateRender(contentState)
}

function createContentStateView(contentState: NewTabContentState): NewTabContentView {
  if (contentState.type === 'loading') {
    return createNewTabLayout(createLoadingStateView())
  }

  if (contentState.type === 'error') {
    return createStateView(contentState.message, '重新加载', () => {
      void refreshNewTab()
    })
  }

  if (contentState.type === 'missing-folder') {
    return createNewTabLayout(createMissingFolderView({
      creatingFolder: state.creatingFolder,
      reason: contentState.reason,
      onCreateFolder: () => {
        void createNewTabFolder()
      },
      onOpenFolderSettings: openFolderSourceSettings
    }))
  }

  return createNewTabLayout(createBookmarkSections(state.folderSections))
}

function renderBookmarkSections(): boolean {
  if (!getNewtabBookmarkContentView()) {
    return false
  }

  createBookmarkSections(state.folderSections)
  return true
}

function recordContentStateRender(contentState: NewTabContentState): void {
  if (contentState.type === 'loading') {
    recordNewTabSkeletonRendered()
  } else if (contentState.type === 'bookmarks' || contentState.type === 'missing-folder') {
    recordNewTabFirstBookmarksRendered()
  }
}

function getContentStateSignature(contentState: NewTabContentState): string {
  if (contentState.type === 'error') {
    return `error:${contentState.message}`
  }
  if (contentState.type === 'missing-folder') {
    return `missing-folder:${contentState.reason}:${state.creatingFolder}`
  }
  return contentState.type
}

function getNewTabShellSignature(): string {
  return [
    onboardingCompleted,
    state.searchSettings.enabled,
    state.searchSettings.webSearchEnabled,
    state.searchSettings.openInNewTab,
    state.searchSettings.engine,
    state.searchSettings.enabledEngines.join(','),
    state.searchSettings.placeholder,
    state.searchSettings.naturalSearchEnabled,
    state.searchSettings.autoVerticalCenter,
    state.searchSettings.width,
    state.searchSettings.height,
    state.searchSettings.offsetY,
    state.searchSettings.background,
    state.timeSettings.enabled,
    state.timeSettings.displayMode,
    state.timeSettings.hour12,
    state.timeSettings.showSeconds,
    state.timeSettings.dateFormat,
    state.timeSettings.clockSize,
    state.timeSettings.density
  ].join('|')
}

function renderDeleteToast(): void {
  const deleted = state.lastDeletedBookmark
  if (!deleted) {
    dispatchNewtabDeleteToastView(null)
    return
  }
  const bookmarkLabel = getBookmarkActionLabelContext(deleted.bookmark)
  dispatchNewtabDeleteToastView({
    bookmarkLabel,
    busy: state.deleteToastBusy,
    detail: state.deleteToastStatus || getBookmarkDisplayTitle(deleted.bookmark)
  })
}

function scheduleRender({ updateClock = false } = {}): void {
  deferredRenderClockUpdate = deferredRenderClockUpdate || updateClock
  if (deferredRenderFrame) {
    return
  }

  deferredRenderFrame = window.requestAnimationFrame(() => {
    deferredRenderFrame = 0
    const shouldUpdateClock = deferredRenderClockUpdate
    deferredRenderClockUpdate = false
    render()
    if (shouldUpdateClock) {
      updateClockText()
    }
  })
}

function cancelScheduledAdaptiveNewTabLayoutUpdate(): void {
  if (!verticalCenterCollisionFrame) {
    return
  }

  window.cancelAnimationFrame(verticalCenterCollisionFrame)
  verticalCenterCollisionFrame = 0
}

function scheduleAdaptiveNewTabLayoutUpdate(): void {
  cancelScheduledAdaptiveNewTabLayoutUpdate()
  verticalCenterCollisionFrame = window.requestAnimationFrame(() => {
    verticalCenterCollisionFrame = 0
    runBatchedAdaptiveLayoutUpdate()
  })
}

function setAutoSearchLayoutPending(pending: boolean): void {
  if (typeof document === 'undefined') {
    return
  }

  if (!pending && autoSearchLayoutRevealFrame) {
    window.cancelAnimationFrame(autoSearchLayoutRevealFrame)
    autoSearchLayoutRevealFrame = 0
  }
  document.documentElement.toggleAttribute(AUTO_SEARCH_LAYOUT_PENDING_ATTRIBUTE, pending)
}

function scheduleAutoSearchLayoutReveal(): void {
  if (autoSearchLayoutRevealFrame) {
    window.cancelAnimationFrame(autoSearchLayoutRevealFrame)
  }

  autoSearchLayoutRevealFrame = window.requestAnimationFrame(() => {
    autoSearchLayoutRevealFrame = 0
    const view = getNewtabSearchWidgetView()
    const slot = getNewtabSearchWidgetNodes().slot
    if (!view?.shell.autoVerticalCenter) {
      setAutoSearchLayoutPending(false)
      return
    }
    if (!view.shell.layoutReady || !slot || slot.dataset.searchLayoutReady !== 'true') {
      scheduleAutoSearchLayoutReveal()
      return
    }

    const renderedOffsetY = slot.style.getPropertyValue('--search-offset-y')
    if (renderedOffsetY !== `${view.shell.offsetY}px`) {
      scheduleAutoSearchLayoutReveal()
      return
    }
    writeCachedAutoSearchOffsetY(view.shell.offsetY)
    setAutoSearchLayoutPending(false)
  })
}

function runBatchedAdaptiveLayoutUpdate(): void {
  const layoutNodes = getNewtabContentLayoutNodes()
  const contentView = getNewtabContentView()
  const page = layoutNodes.page
  const registeredSlot = getNewtabSearchWidgetNodes().slot
  const slot = registeredSlot && page?.contains(registeredSlot)
    ? registeredSlot
    : null
  if (!page || !slot) {
    resetAutoSearchLayoutSettle()
    state.searchOffsetBounds = { ...SEARCH_OFFSET_BOUNDS_FALLBACK }
    state.searchWidthBounds = { ...SEARCH_WIDTH_BOUNDS_FALLBACK }
    patchNewtabPageCollisionOffset(0)
    syncSearchWidthControl()
    syncSearchOffsetControl()
    return
  }

  const previousModule = slot.previousElementSibling instanceof HTMLElement
    ? slot.previousElementSibling
    : null
  const iconVerticalCenter = contentView?.type === 'page' && contentView.iconVerticalCenter === 'true'
  const primaryContent = iconVerticalCenter ? layoutNodes.primaryContent : null
  const collisionUtilityStack = iconVerticalCenter ? layoutNodes.utilityStack : null

  if (primaryContent && settledVerticalCenterContent !== primaryContent) {
    // Until one frame after this content block first paints, its
    // content-visibility sections report contain-intrinsic-size placeholder
    // heights (verified by probe), so the vertically centered anchor — and any
    // offset centered against it — measures wrong and would visibly snap later.
    // Keep the current (cache-trusted) position and re-run after first paint.
    if (!verticalCenterContentSettleFrame) {
      verticalCenterContentSettleFrame = window.requestAnimationFrame(() => {
        verticalCenterContentSettleFrame = window.requestAnimationFrame(() => {
          verticalCenterContentSettleFrame = 0
          settledVerticalCenterContent = primaryContent
          runBatchedAdaptiveLayoutUpdate()
        })
      })
    }
    return
  }

  const viewportWidth = getNewtabViewportWidth()
  const shellRect = layoutNodes.shell?.getBoundingClientRect()
  const slotRect = slot.getBoundingClientRect()
  const previousModuleRect = previousModule?.getBoundingClientRect()
  const nextModuleRect = iconVerticalCenter
    ? getSearchAutoVerticalCenterNextModule(slot, layoutNodes.primarySlot)?.getBoundingClientRect()
    : null
  const primaryContentRect = primaryContent?.getBoundingClientRect()
  const collisionUtilityRect = collisionUtilityStack?.getBoundingClientRect()
  const currentCollisionOffset = contentView?.type === 'page'
    ? contentView.primaryCollisionOffsetY
    : 0
  const currentOffsetY = getCurrentSearchOffsetY(slot)

  const viewportTop = shellRect?.top ?? 0
  const viewportBottom = shellRect?.bottom ?? getNewtabViewportHeight()
  const bounds = getAdaptiveSearchOffsetBounds({
    currentOffsetY,
    searchTop: slotRect.top,
    searchBottom: slotRect.bottom,
    viewportTop,
    viewportBottom,
    previousModuleBottom: previousModuleRect?.bottom,
    primaryContentTop: primaryContentRect?.top,
    minimumGap: NEWTAB_LAYOUT_SAFE_GAP,
    absoluteMin: SEARCH_OFFSET_ABSOLUTE_MIN,
    absoluteMax: SEARCH_OFFSET_ABSOLUTE_MAX
  })
  const widthBounds = getAdaptiveSearchWidthBounds({
    viewportWidth,
    containerWidth: slotRect.width
  })

  let collisionOffset = 0
  if (iconVerticalCenter) {
    if (collisionUtilityRect && primaryContentRect) {
      collisionOffset = getVerticalCenterCollisionOffset({
        utilityBottom: collisionUtilityRect.bottom,
        // The rect already includes the slot's current translateY. Remove that
        // rendered offset so repeated measurements solve against one stable
        // baseline instead of alternating between the shifted and base tops.
        contentTop: primaryContentRect.top - currentCollisionOffset
      })
    }
  }

  state.searchOffsetBounds = bounds
  state.searchWidthBounds = widthBounds
  const nextSearchWidth = clampNumber(state.searchSettings.width, widthBounds.min, widthBounds.max, DEFAULT_SEARCH_SETTINGS.width)
  let nextSearchOffsetY = getCurrentSearchOffsetY(slot)
  if (!state.searchSettings.autoVerticalCenter) {
    nextSearchOffsetY = clampNumber(
      state.searchSettings.offsetY,
      bounds.min,
      bounds.max,
      DEFAULT_SEARCH_SETTINGS.offsetY
    )
  } else {
    nextSearchOffsetY = getAutoCenteredSearchOffsetY({
      currentOffsetY,
      searchTop: slotRect.top,
      searchBottom: slotRect.bottom,
      viewportTop,
      viewportBottom,
      previousModuleBottom: previousModuleRect?.bottom,
      nextModuleTop: nextModuleRect?.top,
      minimumGap: NEWTAB_LAYOUT_SAFE_GAP,
      minOffsetY: bounds.min,
      maxOffsetY: bounds.max,
      fallbackOffsetY: currentOffsetY
    })
  }
  const nextSearchLayoutReady = getNextAutoSearchLayoutReadyState({
    autoVerticalCenter: state.searchSettings.autoVerticalCenter,
    offsetY: nextSearchOffsetY,
    width: nextSearchWidth
  })
  patchSearchWidgetShellState({
    autoVerticalCenter: state.searchSettings.autoVerticalCenter,
    layoutReady: nextSearchLayoutReady,
    offsetY: nextSearchOffsetY,
    width: nextSearchWidth
  })
  if (state.searchSettings.autoVerticalCenter && nextSearchLayoutReady) {
    scheduleAutoSearchLayoutReveal()
  } else if (!state.searchSettings.autoVerticalCenter) {
    setAutoSearchLayoutPending(false)
  }
  patchNewtabPageCollisionOffset(collisionOffset)
  syncSearchWidthControl()
  syncSearchOffsetControl()
}

function getNextAutoSearchLayoutReadyState({
  autoVerticalCenter,
  offsetY,
  width
}: {
  autoVerticalCenter: boolean
  offsetY: number
  width: number
}): boolean {
  if (!autoVerticalCenter) {
    resetAutoSearchLayoutSettle()
    return true
  }

  const view = getNewtabSearchWidgetView()
  if (view?.shell.layoutReady) {
    resetAutoSearchLayoutSettle()
    return true
  }

  const layoutKey = `${Math.round(offsetY)}:${Math.round(width)}`
  if (autoSearchLayoutStableKey !== layoutKey) {
    autoSearchLayoutStableKey = layoutKey
    autoSearchLayoutStableFrames = AUTO_SEARCH_LAYOUT_STABLE_FRAME_COUNT
  }

  if (autoSearchLayoutStableFrames > 0) {
    autoSearchLayoutStableFrames -= 1
    scheduleAdaptiveNewTabLayoutUpdate()
    return false
  }

  resetAutoSearchLayoutSettle()
  return true
}

function resetAutoSearchLayoutSettle(): void {
  autoSearchLayoutStableFrames = 0
  autoSearchLayoutStableKey = ''
}

function getCurrentSearchOffsetY(slot: HTMLElement): number {
  // The centering math needs the offset the measured rect actually reflects; the
  // shell state can run ahead of the DOM between a patch and its React commit.
  const renderedOffsetY = Number.parseFloat(slot.style.getPropertyValue('--search-offset-y'))
  if (Number.isFinite(renderedOffsetY)) {
    return renderedOffsetY
  }
  const registeredSlot = getNewtabSearchWidgetNodes().slot
  if (registeredSlot === slot) {
    const value = getNewtabSearchWidgetView()?.shell.offsetY
    if (Number.isFinite(value)) {
      return value
    }
  }
  return state.searchSettings.offsetY
}

function patchNewtabPageCollisionOffset(primaryCollisionOffsetY: number): void {
  patchNewtabContentView((view) => {
    if (view.type !== 'page' || view.primaryCollisionOffsetY === primaryCollisionOffsetY) {
      return view
    }
    return {
      ...view,
      primaryCollisionOffsetY
    }
  })
}

function getSearchAutoVerticalCenterNextModule(
  slot: HTMLElement,
  primarySlot: HTMLElement | null
): HTMLElement | null {
  const nextUtilityModule = slot.nextElementSibling instanceof HTMLElement
    ? slot.nextElementSibling
    : null
  if (nextUtilityModule) {
    return nextUtilityModule
  }

  const primaryModule = primarySlot?.firstElementChild
  return primaryModule instanceof HTMLElement ? primaryModule : null
}

function createNewTabLayout(primaryContent: NewTabPageModule): NewTabContentView {
  const modules: NewTabPageModule[] = []

  if (!state.utilitySettingsHydrated) {
    dispatchNewtabClockView(null)
    dispatchNewtabSearchWidgetView(null)
    modules.push(primaryContent)
    return createNewTabPage({ modules })
  }

  const onboarding = createNewTabOnboardingStrip()
  if (onboarding) {
    modules.push(onboarding)
  }

  const clock = createClockModule()
  if (clock) {
    modules.push(clock)
  } else {
    modules.push({
      id: 'clock-spacer',
      kind: 'clock-spacer',
      placement: 'utility'
    })
  }

  if (initializeSearchWidget()) {
    modules.push({
      id: 'search',
      kind: 'search',
      placement: 'utility'
    })
  }

  modules.push(primaryContent)

  return createNewTabPage({ modules })
}

function normalizeNewTabOnboardingCompleted(rawState: unknown): boolean {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return false
  }
  return (rawState as { completed?: unknown }).completed === true
}

function createNewTabOnboardingStrip(): NewTabPageModule | null {
  if (onboardingCompleted || state.loading || state.error) {
    return null
  }

  return {
    id: 'onboarding',
    kind: 'onboarding',
    onOpenFolderSettings: openFolderSourceSettings,
    onSkip: () => {
      void completeNewTabOnboarding()
    },
    placement: 'utility'
  }
}

async function completeNewTabOnboarding(): Promise<void> {
  onboardingCompleted = true
  await setLocalStorage({
    [STORAGE_KEYS.onboardingState]: {
      version: 1,
      completed: true,
      completedAt: Date.now()
    }
  }).catch((error) => {
    console.warn('新标签页引导状态保存失败。', error)
  })
  render()
}

function initializeSearchWidget(): boolean {
  const settings = state.searchSettings
  if (!settings.enabled) {
    refreshNewTabSearchSuggestionsAfterAiSettingsChange = null
    setAutoSearchLayoutPending(false)
    dispatchNewtabSearchWidgetView(null)
    return false
  }
  if (settings.autoVerticalCenter) {
    // Only hide behind the measurement gate when no trusted first-paint offset exists;
    // a shell that has already revealed keeps its position across full re-renders.
    setAutoSearchLayoutPending(
      getRevealedAutoSearchShell() === null && readCachedAutoSearchOffsetYValue() === null
    )
  }
  let engineMenuExpanded = false
  let searchEngineMenuState: SearchWidgetEngineMenuState = {
    hint: '',
    items: [],
    open: false
  }
  let searchComboboxExpanded = false
  let activeSearchDescendantId = ''
  let searchPanelVisible = false
  let searchSuggestionListVisible = true
  let searchSuggestions: NewTabSearchSuggestion[] = []
  let activeSuggestionIndex = -1
  let suggestionDebounceTimer = 0
  let suggestionRequestId = 0

  const getSearchNodes = (): NewtabSearchWidgetNodes => getNewtabSearchWidgetNodes()
  const getSearchInput = (): HTMLInputElement | null => getSearchNodes().input
  const getSearchSlot = (): HTMLElement | null => getSearchNodes().slot
  const getSearchEngineButton = (): HTMLButtonElement | null => getSearchNodes().engineButton

  const syncSearchWidgetButtons = () => {
    patchNewtabSearchWidgetView({
      buttons: {
        engine: getSearchEngineButtonState(),
        natural: getNaturalSearchButtonState()
      }
    })
  }
  const updateEngineButton = syncSearchWidgetButtons
  const updateNaturalButton = syncSearchWidgetButtons
  const syncSearchWidgetInteractions = () => {
    patchNewtabSearchWidgetView({
      interactions: {
        onClear: () => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          input.value = ''
          syncSearchInputActions(input)
          hideSuggestions()
          input.focus()
        },
        onEngineOpenChange: (open) => {
          if (state.searchSettings.webSearchEnabled === false) {
            closeEngineMenu()
            return
          }
          if (!open) {
            closeEngineMenu()
            return
          }
          renderEngineMenu()
        },
        onInputFocus: () => {
          scheduleSuggestionsRender({ immediate: true })
        },
        onInputInput: () => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          syncSearchInputActions(input)
          scheduleSuggestionsRender()
        },
        onInputKeyDown: (event) => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1)
            return
          }

          if (event.key === 'Enter' && activeSuggestionIndex >= 0 && !event.metaKey && !event.ctrlKey) {
            const suggestion = searchSuggestions[activeSuggestionIndex]
            if (suggestion) {
              event.preventDefault()
              input.value = suggestion.title
              syncSearchInputActions(input)
              hideSuggestions()
              openSearchSuggestion(suggestion)
            }
            return
          }

          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            closeEngineMenu()
            hideSuggestions()
            if (state.searchSettings.webSearchEnabled === false) {
              return
            }
            submitSearch(input.value, true)
            return
          }

          if (event.key !== 'Escape') {
            return
          }

          event.preventDefault()
          if (searchSuggestions.length || searchPanelVisible) {
            hideSuggestions()
            return
          }

          if (input.value) {
            input.value = ''
            syncSearchInputActions(input)
            return
          }

          input.blur()
        },
        onRootBlur: (event) => {
          const nextFocusTarget = event.relatedTarget instanceof Node
            ? event.relatedTarget
            : null
          window.setTimeout(() => {
            const slot = getSearchSlot()
            const engineMenu = getSearchNodes().engineMenu
            if (
              slot &&
              (!nextFocusTarget ||
                (!slot.contains(nextFocusTarget) && !engineMenu?.contains(nextFocusTarget)))
            ) {
              closeEngineMenu()
              hideSuggestions()
            }
          }, 0)
        },
        onSubmit: (event) => {
          const input = getSearchInput()
          event.preventDefault()
          closeEngineMenu()
          hideSuggestions()
          if (!input || state.searchSettings.webSearchEnabled === false) {
            return
          }
          submitSearch(input.value)
        },
        onToggleNatural: () => {
          const input = getSearchInput()
          if (!input) {
            return
          }
          void toggleNewTabNaturalSearch({
            input,
            updateNaturalButton,
            scheduleSuggestionsRender
          })
        }
      }
    })
  }

  const renderSearchEngineMenuState = () => {
    patchNewtabSearchWidgetView({ engineMenu: searchEngineMenuState })
  }
  const renderSearchComboboxState = () => {
    patchNewtabSearchWidgetView({
      combobox: {
        activeDescendantId: activeSearchDescendantId,
        expanded: searchComboboxExpanded
      }
    })
  }
  const openSearchCombobox = () => {
    searchComboboxExpanded = true
    renderSearchComboboxState()
  }
  const closeSearchCombobox = () => {
    searchComboboxExpanded = false
    activeSearchDescendantId = ''
    renderSearchComboboxState()
  }
  const setActiveSearchDescendant = (id: string) => {
    activeSearchDescendantId = id
    renderSearchComboboxState()
  }
  const syncSearchWidgetPanelState = () => {
    patchNewtabSearchWidgetView({
      panel: {
        panelVisible: searchPanelVisible,
        suggestionsVisible: searchSuggestionListVisible
      }
    })
  }
  const hideSearchPanel = () => {
    searchPanelVisible = false
    syncSearchWidgetPanelState()
  }
  const showSearchPanel = () => {
    searchPanelVisible = true
    syncSearchWidgetPanelState()
  }
  const setSearchSuggestionsListVisible = (visible: boolean) => {
    searchSuggestionListVisible = visible
    syncSearchWidgetPanelState()
  }

  const closeEngineMenu = ({ restoreFocus = false } = {}) => {
    searchEngineMenuState = {
      ...searchEngineMenuState,
      open: false
    }
    renderSearchEngineMenuState()
    engineMenuExpanded = false
    updateEngineButton()
    if (restoreFocus) {
      getSearchEngineButton()?.focus()
    }
  }

  const renderEngineMenu = () => {
    closeEngineMenu()
    const items: SearchEngineMenuItemViewModel[] = []
    for (const engineId of state.searchSettings.enabledEngines) {
      const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(engineId)
      if (!engine) {
        continue
      }

      items.push({
        active: engineId === state.searchSettings.engine,
        id: engineId,
        label: engine.name,
        onSelect: () => {
          const input = getSearchInput()
          state.searchSettings = normalizeSearchSettings({
            ...state.searchSettings,
            engine: engineId
          })
          scheduleSearchSettingsSave()
          updateEngineButton()
          closeEngineMenu()
          input?.focus()
          scheduleSuggestionsRender({ preserveActive: true, immediate: true })
        }
      })
    }

    searchEngineMenuState = {
      hint: `Cmd/Ctrl+Enter 打开前 ${SEARCH_MULTI_OPEN_LIMIT} 个启用引擎`,
      items,
      open: true
    }
    renderSearchEngineMenuState()
    engineMenuExpanded = true
    updateEngineButton()
  }

  const hideSuggestions = () => {
    window.clearTimeout(suggestionDebounceTimer)
    suggestionDebounceTimer = 0
    searchSuggestions = []
    activeSuggestionIndex = -1
    patchNewtabSearchWidgetView({
      chips: [],
      hint: { type: 'empty' },
      sectionLabel: '书签匹配',
      suggestions: []
    })
    setSearchSuggestionsListVisible(true)
    hideSearchPanel()
    closeSearchCombobox()
  }

  const renderSuggestions = (suggestionList: NewTabSearchSuggestion[], {
    preserveActive = false,
    query = getSearchInput()?.value || ''
  }: {
    preserveActive?: boolean
    query?: string
  } = {}) => {
    const input = getSearchInput()
    if (!input) {
      return
    }
    const trimmedQuery = String(query || '').trim()
    const previousActiveIndex = activeSuggestionIndex
    const advancedSearch = isNewTabAdvancedSearchQuery(trimmedQuery)
    const chips = createNewTabSearchChips(trimmedQuery)
    searchSuggestions = suggestionList
    if (!searchSuggestions.length) {
      activeSuggestionIndex = -1
      patchNewtabSearchWidgetView({
        chips,
        suggestions: []
      })
      setSearchSuggestionsListVisible(false)
      setActiveSearchDescendant('')
      if (!trimmedQuery) {
        hideSuggestions()
        return
      }

      if (state.searchSettings.webSearchEnabled === false) {
        patchNewtabSearchWidgetView({
          hint: {
            type: 'text',
            text: '未找到本地书签。网页搜索已关闭，可在设置中重新启用。'
          },
          sectionLabel: advancedSearch ? '语法搜索匹配' : '关键词书签匹配'
        })
        showSearchPanel()
        openSearchCombobox()
        return
      }

      patchNewtabSearchWidgetView({
        hint: createSearchWebFallbackState(trimmedQuery),
        sectionLabel: '网页搜索'
      })
      showSearchPanel()
      openSearchCombobox()
      return
    }

    setSearchSuggestionsListVisible(true)
    const sectionLabel = searchSuggestions.some(isCommandSuggestion)
      ? '书签与命令'
      : advancedSearch
        ? '语法搜索匹配'
        : '关键词书签匹配'
    activeSuggestionIndex = preserveActive && previousActiveIndex >= 0
      ? Math.min(previousActiveIndex, searchSuggestions.length - 1)
      : -1

    const onSelectSuggestion = (selectedSuggestion: NewTabSearchSuggestion) => {
      const currentInput = getSearchInput()
      if (!currentInput) {
        return
      }
      currentInput.value = selectedSuggestion.title
      syncSearchInputActions(currentInput)
      hideSuggestions()
      openSearchSuggestion(selectedSuggestion)
    }

    patchNewtabSearchWidgetView({
      chips,
      hint: {
        type: 'text',
        text: getSearchSuggestionHintText()
      },
      sectionLabel,
      suggestions: searchSuggestions.map((suggestion, index) =>
        createSearchSuggestionViewModel(
          suggestion,
          index,
          index === activeSuggestionIndex,
          onSelectSuggestion
        )
      )
    })
    showSearchPanel()
    openSearchCombobox()

    if (activeSuggestionIndex >= 0) {
      setActiveSearchDescendant(getSearchSuggestionElementId(activeSuggestionIndex))
    } else {
      setActiveSearchDescendant('')
    }
  }

  const scheduleSuggestionsRender = ({ preserveActive = false, immediate = false } = {}) => {
    const input = getSearchInput()
    if (!input) {
      return
    }
    const query = input.value
    const requestId = suggestionRequestId + 1
    suggestionRequestId = requestId
    window.clearTimeout(suggestionDebounceTimer)

    const renderCurrentSuggestions = () => {
      const currentInput = getSearchInput()
      if (!currentInput) {
        return
      }
      if (!state.searchIndexReady && query.trim()) {
        renderSearchIndexPreparingState(query)
        void state.searchIndexReadyPromise.then(() => {
          const latestInput = getSearchInput()
          if (requestId !== suggestionRequestId || latestInput?.value !== query) {
            return
          }

          scheduleSuggestionsRender({ preserveActive, immediate: true })
        })
        return
      }

      void getSearchBookmarkSuggestions(query).then((directSuggestions) => {
        if (requestId !== suggestionRequestId) {
          return
        }

        renderSuggestions(mergeNewTabCommandSuggestions(query, directSuggestions), { preserveActive, query })
        if (!shouldLoadNaturalSearchSuggestions(query, directSuggestions)) {
          return
        }

        void getNaturalSearchBookmarkSuggestions(query, { onPendingChange: updateNaturalButton }).then((naturalSuggestions) => {
          if (requestId !== suggestionRequestId) {
            return
          }

          updateNaturalButton()
          renderSuggestions(mergeNewTabCommandSuggestions(query, naturalSuggestions), { preserveActive: true, query })
        }).catch(() => {
          // Keep the popup-aligned suggestions visible if the optional natural-search chunk fails to load.
        }).finally(() => {
          if (requestId === suggestionRequestId) {
            updateNaturalButton()
          }
        })
      }).catch(() => {
        if (requestId !== suggestionRequestId) {
          return
        }

        renderSuggestions(mergeNewTabCommandSuggestions(query, []), { preserveActive, query })
      })
    }

    if (!query.trim() || immediate) {
      suggestionDebounceTimer = 0
      renderCurrentSuggestions()
      return
    }

    suggestionDebounceTimer = window.setTimeout(() => {
      suggestionDebounceTimer = 0
      if (requestId !== suggestionRequestId) {
        return
      }
      renderCurrentSuggestions()
    }, SEARCH_SUGGESTION_DEBOUNCE_MS)
  }

  const renderSearchIndexPreparingState = (query: string) => {
    const input = getSearchInput()
    const trimmedQuery = String(query || '').trim()
    if (!input) {
      return
    }
    if (!trimmedQuery) {
      hideSuggestions()
      return
    }

    searchSuggestions = []
    activeSuggestionIndex = -1
    patchNewtabSearchWidgetView({
      chips: createNewTabSearchChips(trimmedQuery),
      hint: {
        type: 'text',
        text: '正在准备索引…'
      },
      sectionLabel: '书签匹配',
      suggestions: []
    })
    setSearchSuggestionsListVisible(false)
    showSearchPanel()
    openSearchCombobox()
    setActiveSearchDescendant('')
  }

  refreshNewTabSearchSuggestionsAfterAiSettingsChange = () => {
    updateNaturalButton()
    scheduleSuggestionsRender({ preserveActive: true, immediate: true })
  }

  const moveActiveSuggestion = (direction: 1 | -1) => {
    if (!searchSuggestions.length) {
      scheduleSuggestionsRender({ preserveActive: true, immediate: true })
    }
    if (!searchSuggestions.length) {
      return
    }

    activeSuggestionIndex = activeSuggestionIndex < 0
      ? (direction > 0 ? 0 : searchSuggestions.length - 1)
      : (activeSuggestionIndex + direction + searchSuggestions.length) % searchSuggestions.length
    renderSuggestions(searchSuggestions, { preserveActive: true, query: getSearchInput()?.value || '' })
  }

  dispatchNewtabSearchWidgetView({
    action: {
      canSubmit: false,
      hasInputValue: false
    },
    buttons: {
      engine: getSearchEngineButtonState(),
      natural: getNaturalSearchButtonState()
    },
    chips: [],
    combobox: {
      activeDescendantId: activeSearchDescendantId,
      expanded: searchComboboxExpanded
    },
    engineMenu: searchEngineMenuState,
    hint: { type: 'empty' },
    interactions: createDefaultSearchWidgetInteractionState(),
    panel: {
      panelVisible: searchPanelVisible,
      suggestionsVisible: searchSuggestionListVisible
    },
    sectionLabel: '书签匹配',
    shell: createSearchWidgetShellState(settings),
    onNodesChange: handleSearchWidgetNodesChange,
    suggestions: []
  })
  syncSearchWidgetInteractions()
  renderSearchEngineMenuState()
  renderSearchComboboxState()
  syncSearchWidgetPanelState()
  return true

  function createSearchWebFallbackState(query: string): SearchHintState {
    const label = `未找到书签；按 Enter 仅在本页用 ${getSearchEngineDisplayName()} 搜索网页`
    return {
      type: 'webFallback',
      ariaLabel: label,
      label,
      title: `用 ${getSearchEngineDisplayName()} 搜索「${query}」`,
      onSelect: () => {
        closeEngineMenu()
        hideSuggestions()
        if (state.searchSettings.webSearchEnabled === false) {
          return
        }
        submitSearch(query)
      }
    }
  }

  function getSearchEngineDisplayName(): string {
    return SEARCH_ENGINE_CONFIG_BY_ID.get(state.searchSettings.engine)?.name || 'Google'
  }

  function getSearchEngineButtonState() {
    const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(state.searchSettings.engine)
    const label = engine?.shortName || '搜索'
    const disabled = state.searchSettings.webSearchEnabled === false
    return {
      ariaLabel: `选择搜索引擎，当前为 ${engine?.name || label}`,
      disabled,
      expanded: engineMenuExpanded,
      label,
      title: disabled
        ? '网页搜索已关闭。可在新标签页设置中重新启用。'
        : `当前引擎：${engine?.name || label}。Cmd/Ctrl+Enter 搜索前 ${SEARCH_MULTI_OPEN_LIMIT} 个启用引擎。`
    }
  }

  function getNaturalSearchButtonState() {
    const active = state.searchSettings.naturalSearchEnabled
    return {
      active,
      ariaLabel: active ? '关闭 AI 语义搜索' : '开启 AI 语义搜索',
      fallback: Boolean(state.naturalSearchError),
      label: !active
        ? '语义'
        : state.naturalSearchPending
          ? '思考中'
          : 'AI',
      pending: state.naturalSearchPending,
      title: active
        ? (state.naturalSearchError || 'AI 已改写查询；点击关闭语义搜索')
        : state.searchSettings.naturalSearchAiConfigured
          ? '开启 AI 语义搜索'
          : '需要先配置 AI 渠道'
    }
  }

  function getSearchSuggestionHintText(): string {
    const mode = state.searchSettings.naturalSearchEnabled
      ? 'AI 改写'
      : 'popup 匹配'
    const fallback = state.naturalSearchError ? `；${state.naturalSearchError}` : ''
    return `按 ↓ 选择书签，选中后 Enter 打开；Cmd/Ctrl+Enter 用 ${getSearchEngineDisplayName()} 搜索网页；${mode}${fallback}`
  }
}

function createNewTabSearchChips(query: string): SearchChipViewModel[] {
  return parseSearchQuery(query).chips.map((chip) => ({
    kind: chip.kind,
    label: chip.label
  }))
}

function isNewTabAdvancedSearchQuery(query: string): boolean {
  const value = String(query || '').trim()
  if (!value) {
    return false
  }

  if (parseSearchQuery(value).chips.length > 0) {
    return true
  }

  return /\b(?:site|domain|url|folder|path|type|kind):\s*\S/i.test(value) ||
    /(^|\s)-(?=\S)/.test(value) ||
    /(最近\s*\d+\s*(?:天|日|周|星期|礼拜|个月|月|年)|今天|今日|昨天|昨日|前天|本周|这周|上周|本月|这个月|上月|上个月|今年)/.test(value)
}

async function toggleNewTabNaturalSearch({
  input,
  updateNaturalButton,
  scheduleSuggestionsRender
}: {
  input: HTMLInputElement
  updateNaturalButton: () => void
  scheduleSuggestionsRender: (options?: { preserveActive?: boolean; immediate?: boolean }) => void
}): Promise<void> {
  const enabled = !state.searchSettings.naturalSearchEnabled

  if (enabled) {
    const naturalSearchAiConfigured = await refreshNewTabNaturalSearchAiConfiguredState()
    if (!naturalSearchAiConfigured) {
      state.searchSettings = normalizeSearchSettings({
        ...state.searchSettings,
        naturalSearchEnabled: false
      })
      abortNewTabNaturalSearchRequest()
      naturalSearchSuggestionCache.clear()
      state.naturalSearchPlan = null
      state.naturalSearchError = ''
      setSettingsSaveStatus('error', '请配置 AI 渠道。')
      openAiProviderSettings()
      updateNaturalButton()
      input.focus()
      scheduleSearchSettingsSave()
      return
    }
  }

  state.searchSettings = normalizeSearchSettings({
    ...state.searchSettings,
    naturalSearchEnabled: enabled
  })
  abortNewTabNaturalSearchRequest()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlan = null
  state.naturalSearchError = ''
  scheduleSearchSettingsSave()
  updateNaturalButton()
  input.focus()
  scheduleSuggestionsRender({ preserveActive: true, immediate: true })
}

function createSearchSuggestionViewModel(
  suggestion: NewTabSearchSuggestion,
  index: number,
  active: boolean,
  onSelect: (suggestion: NewTabSearchSuggestion) => void
): SearchSuggestionViewModel {
  const command = isCommandSuggestion(suggestion)
  const source = command ? suggestion.command.subtitle : suggestion.folderPath || suggestion.folderTitle
  const meta = source && suggestion.url
    ? `${source} · ${formatSearchSuggestionUrl(suggestion.url)}`
    : source || formatSearchSuggestionUrl(suggestion.url)

  return {
    active,
    ariaLabel: `${command ? '执行命令' : '打开书签'}：${suggestion.title}`,
    command,
    elementId: getSearchSuggestionElementId(index),
    id: getSearchSuggestionKey(suggestion, index),
    mark: command ? '>' : getFallbackLabel(suggestion.title),
    meta,
    onSelect: () => {
      onSelect(suggestion)
    },
    title: suggestion.title
  }
}

function getSearchSuggestionKey(suggestion: NewTabSearchSuggestion, index: number): string {
  const type = isCommandSuggestion(suggestion) ? 'command' : 'bookmark'
  return `${type}:${suggestion.id}:${index}`
}

function syncSearchInputActions(input: HTMLInputElement): void {
  patchNewtabSearchWidgetView({
    action: {
      canSubmit: Boolean(input.value.trim()),
      hasInputValue: Boolean(input.value)
    }
  })
}

function createSearchWidgetShellState(settings: typeof DEFAULT_SEARCH_SETTINGS): SearchWidgetShellState {
  const webSearchEnabled = settings.webSearchEnabled !== false
  // A shell that already revealed is the most trusted source for the current
  // position; otherwise a cached offset was measured in this exact viewport on a
  // settled layout. Either lets first paint skip the hidden measurement gate.
  const cachedAutoOffsetY = settings.autoVerticalCenter
    ? getRevealedAutoSearchShell()?.offsetY ?? readCachedAutoSearchOffsetYValue()
    : null
  const initialOffsetY = settings.autoVerticalCenter
    ? cachedAutoOffsetY ?? settings.offsetY
    : settings.offsetY

  return {
    ariaLabel: webSearchEnabled ? '搜索书签、网页或命令' : '搜索书签或命令',
    autoVerticalCenter: settings.autoVerticalCenter,
    backgroundAlpha: String(settings.background / 100),
    height: settings.height,
    inputAriaLabel: webSearchEnabled
      ? '输入关键词搜索书签，未选中书签时按 Enter 搜索网页'
      : '输入关键词搜索本地书签或命令',
    layoutReady: !settings.autoVerticalCenter || cachedAutoOffsetY !== null,
    offsetY: initialOffsetY,
    placeholder: getSearchPlaceholder(settings),
    width: settings.width
  }
}

function getAutoSearchOffsetCacheKey(): string {
  // Keyed by viewport: a centered offset is only valid for the layout it was measured in.
  return `${AUTO_SEARCH_OFFSET_CACHE_KEY}:${window.innerWidth}x${window.innerHeight}`
}

function readCachedAutoSearchOffsetYValue(): number | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.localStorage.getItem(getAutoSearchOffsetCacheKey())
    if (value === null) {
      return null
    }
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return null
    }
    return clampNumber(
      numericValue,
      SEARCH_OFFSET_ABSOLUTE_MIN,
      SEARCH_OFFSET_ABSOLUTE_MAX,
      DEFAULT_SEARCH_SETTINGS.offsetY
    )
  } catch {
    return null
  }
}

function writeCachedAutoSearchOffsetY(offsetY: number): void {
  if (typeof window === 'undefined' || !Number.isFinite(offsetY)) {
    return
  }

  try {
    window.localStorage.removeItem(AUTO_SEARCH_OFFSET_CACHE_KEY)
    window.localStorage.setItem(getAutoSearchOffsetCacheKey(), String(Math.round(offsetY)))
  } catch {
    // Ignore storage failures; this cache only improves first-paint positioning.
  }
}

function patchSearchWidgetShellState(patch: Partial<SearchWidgetShellState>): void {
  const view = getNewtabSearchWidgetView()
  if (!view) {
    return
  }

  const shell = {
    ...view.shell,
    ...patch
  }
  if (isSearchWidgetShellStateEqual(view.shell, shell)) {
    return
  }

  patchNewtabSearchWidgetView({
    shell
  })
}

function isSearchWidgetShellStateEqual(
  left: SearchWidgetShellState,
  right: SearchWidgetShellState
): boolean {
  return left.ariaLabel === right.ariaLabel &&
    left.autoVerticalCenter === right.autoVerticalCenter &&
    left.backgroundAlpha === right.backgroundAlpha &&
    left.height === right.height &&
    left.inputAriaLabel === right.inputAriaLabel &&
    left.layoutReady === right.layoutReady &&
    left.offsetY === right.offsetY &&
    left.placeholder === right.placeholder &&
    left.width === right.width
}

function mergeNewTabCommandSuggestions(
  query: string,
  bookmarkSuggestions: SearchBookmarkSuggestion[]
): NewTabSearchSuggestion[] {
  const commandSuggestions = getNewTabCommandSuggestions(query)
  if (!commandSuggestions.length) {
    return bookmarkSuggestions
  }

  return [
    ...commandSuggestions,
    ...bookmarkSuggestions
  ].slice(0, SEARCH_SUGGESTION_LIMIT + NEWTAB_COMMAND_SUGGESTION_LIMIT)
}

function getNewTabCommandSuggestions(query: string): NewTabSearchSuggestion[] {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery) {
    return []
  }

  return NEWTAB_COMMAND_SUGGESTIONS
    .map((command, order) => {
      const score = getNewTabCommandScore(normalizedQuery, command)
      if (score < 0) {
        return null
      }
      return {
        suggestionType: 'command' as const,
        id: `command:${command.id}`,
        title: command.title,
        url: '',
        folderTitle: '命令',
        folderPath: command.subtitle,
        score: NEWTAB_COMMAND_SCORE - score,
        order,
        command
      }
    })
    .filter((suggestion): suggestion is NewTabCommandSearchSuggestion => Boolean(suggestion))
    .sort((left, right) => left.score - right.score || left.order - right.order)
    .slice(0, NEWTAB_COMMAND_SUGGESTION_LIMIT)
}

function getNewTabCommandScore(normalizedQuery: string, command: NewTabCommandSuggestion): number {
  const haystack = normalizeNewTabSearchText([
    command.title,
    command.subtitle,
    ...command.keywords
  ].join(' '))
  if (!haystack) {
    return -1
  }
  if (haystack.includes(normalizedQuery)) {
    return normalizedQuery.length >= 4 ? 100 : 80
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (terms.length && terms.every((term) => haystack.includes(term))) {
    return 70
  }
  if (/^[:：/>]/.test(normalizedQuery)) {
    const commandQuery = normalizeNewTabSearchText(normalizedQuery.replace(/^[:：/>]+/, ''))
    return commandQuery && haystack.includes(commandQuery) ? 90 : -1
  }
  return -1
}

interface SearchSuggestionCacheEntry {
  promise: Promise<SearchBookmarkSuggestion[]>
  updatedAt: number
}

interface NaturalSearchSuggestionOptions {
  onPendingChange?: () => void
}

const searchSuggestionCache = new Map<string, SearchSuggestionCacheEntry>()
const naturalSearchSuggestionCache = new Map<string, SearchSuggestionCacheEntry>()
const NEWTAB_COMMAND_SUGGESTIONS: NewTabCommandSuggestion[] = [
  {
    id: 'open-settings',
    title: '打开设置',
    subtitle: '调整来源、布局、背景、搜索栏和 AI 设置',
    keywords: ['settings', '设置', '选项', 'options', '配置', '打开设置'],
    run: () => openSettingsDrawer()
  },
  {
    id: 'open-inbox',
    title: '打开 Inbox',
    subtitle: '查看待整理收藏和自动分析添加历史',
    keywords: ['inbox', '收件箱', '待整理', '未分类', '临时收藏', '稍后整理'],
    run: () => openOptionsHash('#bookmark-history')
  }
]

function abortNewTabNaturalSearchRequest(): void {
  state.naturalSearchAbortController?.abort()
  state.naturalSearchAbortController = null
  state.naturalSearchPending = false
}

function isNewTabNaturalSearchAbortError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (
      (error as { name?: unknown }).name === 'AbortError' ||
      (error as { kind?: unknown }).kind === 'abort'
    )
  )
}

function throwIfNewTabNaturalSearchRequestStale(
  settingsGeneration: number,
  signal?: AbortSignal | null
): void {
  if (
    settingsGeneration !== newTabNaturalSearchSettingsGeneration ||
    signal?.aborted
  ) {
    throw new DOMException('AI 搜索请求已失效。', 'AbortError')
  }
}

async function refreshNewTabNaturalSearchAiConfiguredState(): Promise<boolean> {
  try {
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    const naturalSearchAiConfigured = naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured
    })
    return naturalSearchAiConfigured
  } catch {
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured: false
    })
    return false
  }
}

function getSearchBookmarkSuggestions(query: string): Promise<SearchBookmarkSuggestion[]> {
  if (!state.searchIndexReady) {
    return state.searchIndexReadyPromise.then(() => getSearchBookmarkSuggestions(query))
  }

  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = getSearchSuggestionCacheEntry(searchSuggestionCache, cacheKey)
  if (cached) {
    return cached.promise
  }

  const suggestionsPromise = getPopupSearchBookmarkSuggestionsFromIndex(
    query,
    state.preparedSearchIndex,
    SEARCH_SUGGESTION_LIMIT
  )
  setSearchSuggestionCacheEntry(searchSuggestionCache, cacheKey, suggestionsPromise)
  return suggestionsPromise
}

function getNaturalSearchBookmarkSuggestions(
  query: string,
  options: NaturalSearchSuggestionOptions = {}
): Promise<SearchBookmarkSuggestion[]> {
  if (!state.searchSettings.naturalSearchEnabled) {
    return Promise.resolve([])
  }

  if (!state.searchIndexReady) {
    return state.searchIndexReadyPromise.then(() => getNaturalSearchBookmarkSuggestions(query, options))
  }

  const cacheKey = getSearchSuggestionCacheKey(query)
  const cached = getSearchSuggestionCacheEntry(naturalSearchSuggestionCache, cacheKey)
  if (cached) {
    if (state.naturalSearchPending) {
      options.onPendingChange?.()
    }
    return cached.promise
  }

  const settingsGeneration = newTabNaturalSearchSettingsGeneration
  const suggestionsPromise = resolveNewTabNaturalSearchPlan(query, options, settingsGeneration)
    .then(async (plan) => {
      throwIfNewTabNaturalSearchRequestStale(settingsGeneration)
      const suggestions = await getNaturalSearchBookmarkSuggestionsFromIndex(
        query,
        state.preparedSearchIndex,
        SEARCH_SUGGESTION_LIMIT,
        { naturalSearchPlan: plan }
      )
      throwIfNewTabNaturalSearchRequestStale(settingsGeneration)
      return suggestions
    })
  setSearchSuggestionCacheEntry(naturalSearchSuggestionCache, cacheKey, suggestionsPromise)
  return suggestionsPromise
}

async function resolveNewTabNaturalSearchPlan(
  query: string,
  options: NaturalSearchSuggestionOptions = {},
  settingsGeneration = newTabNaturalSearchSettingsGeneration
): Promise<NaturalSearchPlan> {
  const naturalSearch = await import('../popup/natural-search.js')
  const localPlan = naturalSearch.buildLocalNaturalSearchPlan(query)
  const normalizedQuery = normalizeNewTabSearchText(query)

  throwIfNewTabNaturalSearchRequestStale(settingsGeneration)

  if (!state.searchSettings.naturalSearchEnabled) {
    state.naturalSearchPlan = null
    return localPlan
  }

  const planCacheKey = getNaturalSearchPlanCacheKey(normalizedQuery)
  const cachedPlan = state.naturalSearchPlanCache.get(planCacheKey)
  if (cachedPlan) {
    state.naturalSearchPlan = cachedPlan
    state.naturalSearchError = ''
    return cachedPlan
  }

  abortNewTabNaturalSearchRequest()
  const controller = new AbortController()
  state.naturalSearchAbortController = controller
  state.naturalSearchPending = true
  state.naturalSearchError = ''
  options.onPendingChange?.()

  try {
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    const settings = await naturalSearchAi.loadNaturalSearchAiProviderSettings()
    throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)
    if (!naturalSearchAi.hasConfiguredNaturalSearchAiProvider(settings)) {
      state.searchSettings = normalizeSearchSettings({
        ...state.searchSettings,
        naturalSearchEnabled: false,
        naturalSearchAiConfigured: false
      })
      state.naturalSearchError = ''
      state.naturalSearchPlan = null
      setSettingsSaveStatus('error', '请配置 AI 渠道。')
      openAiProviderSettings()
      scheduleSearchSettingsSave()
      return localPlan
    }
    state.searchSettings = normalizeSearchSettings({
      ...state.searchSettings,
      naturalSearchAiConfigured: true
    })

    const plan = await naturalSearchAi.requestNaturalSearchAiPlan({
      query,
      localPlan,
      settings,
      signal: controller.signal
    })
    throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)
    state.naturalSearchPlan = plan
    state.naturalSearchError = ''
    if (plan.source === 'ai') {
      state.naturalSearchPlanCache.set(planCacheKey, plan)
    }
    return plan
  } catch (error) {
    if (
      settingsGeneration !== newTabNaturalSearchSettingsGeneration ||
      controller.signal.aborted ||
      isNewTabNaturalSearchAbortError(error)
    ) {
      throw error
    }
    const naturalSearchAi = await import('../popup/natural-search-ai.js')
    throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)
    state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)
    state.naturalSearchPlan = null
    return localPlan
  } finally {
    if (state.naturalSearchAbortController === controller) {
      state.naturalSearchAbortController = null
      state.naturalSearchPending = false
      options.onPendingChange?.()
    }
  }
}

function getSearchSuggestionCacheEntry(
  cache: Map<string, SearchSuggestionCacheEntry>,
  cacheKey: string,
  now = Date.now()
): SearchSuggestionCacheEntry | null {
  const cached = cache.get(cacheKey)
  if (!cached) {
    return null
  }

  if (now - cached.updatedAt > SEARCH_SUGGESTION_CACHE_TTL_MS) {
    cache.delete(cacheKey)
    return null
  }

  cache.delete(cacheKey)
  cache.set(cacheKey, cached)
  return cached
}

function setSearchSuggestionCacheEntry(
  cache: Map<string, SearchSuggestionCacheEntry>,
  cacheKey: string,
  promise: Promise<SearchBookmarkSuggestion[]>
): void {
  cache.set(cacheKey, {
    promise,
    updatedAt: Date.now()
  })
  promise.catch(() => {
    if (cache.get(cacheKey)?.promise === promise) {
      cache.delete(cacheKey)
    }
  })
  pruneSearchSuggestionCache(cache)
}

function pruneSearchSuggestionCache(
  cache: Map<string, SearchSuggestionCacheEntry>,
  now = Date.now()
): void {
  for (const [cacheKey, entry] of cache.entries()) {
    if (now - entry.updatedAt > SEARCH_SUGGESTION_CACHE_TTL_MS) {
      cache.delete(cacheKey)
    }
  }

  while (cache.size > SEARCH_SUGGESTION_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) {
      break
    }
    cache.delete(oldestKey)
  }
}

function shouldLoadNaturalSearchSuggestions(
  query: string,
  directSuggestions: SearchBookmarkSuggestion[]
): boolean {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery) {
    return false
  }
  if (state.searchSettings.naturalSearchEnabled) {
    return true
  }
  return false
}

function normalizeNewTabBookmarkTagIndex(raw: unknown): BookmarkTagIndex {
  const source = raw && typeof raw === 'object'
    ? raw as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: BookmarkTagIndex['records'] = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeNewTabBookmarkTagRecord(rawRecord, fallbackBookmarkId)
    if (record) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: 1,
    updatedAt: normalizeNewTabTimestamp(source.updatedAt) || getLatestNewTabBookmarkTagUpdatedAt(records),
    records
  }
}

function normalizeNewTabBookmarkTagRecord(raw: unknown, fallbackBookmarkId: string): BookmarkTagRecord | null {
  const source = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const bookmarkId = normalizeNewTabTagText(source.bookmarkId || fallbackBookmarkId)
  const url = normalizeNewTabTagText(source.url)
  if (!bookmarkId || !url) {
    return null
  }

  const generatedAt = normalizeNewTabTimestamp(source.generatedAt) || Date.now()
  const updatedAt = normalizeNewTabTimestamp(source.updatedAt) || generatedAt
  const manualTags = normalizeNewTabBookmarkTagList(source.manualTags, 12)
  const record: BookmarkTagRecord = {
    schemaVersion: 1,
    bookmarkId,
    url,
    normalizedUrl: normalizeNewTabTagText(source.normalizedUrl || url),
    duplicateKey: normalizeNewTabTagText(source.duplicateKey || source.normalizedUrl || url),
    title: normalizeNewTabTagText(source.title, 180),
    path: normalizeNewTabTagText(source.path, 240),
    summary: normalizeNewTabTagText(source.summary, 500),
    contentType: normalizeNewTabTagText(source.contentType || source.content_type, 40),
    topics: normalizeNewTabTagTextList(source.topics, 8, 40),
    tags: normalizeNewTabBookmarkTagList(source.tags, 12),
    aliases: normalizeNewTabTagTextList(source.aliases, 20, 40),
    confidence: normalizeNewTabTagConfidence(source.confidence),
    source: normalizeNewTabBookmarkTagSource(source.source),
    model: normalizeNewTabTagText(source.model, 120),
    extraction: normalizeNewTabBookmarkTagExtraction(source.extraction),
    generatedAt,
    updatedAt
  }

  if (manualTags.length) {
    record.manualTags = manualTags
    record.manualUpdatedAt = normalizeNewTabTimestamp(source.manualUpdatedAt) || updatedAt
  }

  return record
}

function normalizeNewTabBookmarkTagExtraction(raw: unknown): BookmarkTagExtraction {
  const source = raw && typeof raw === 'object'
    ? raw as { status?: unknown; source?: unknown; warnings?: unknown }
    : {}

  return {
    status: normalizeNewTabTagText(source.status, 40),
    source: normalizeNewTabTagText(source.source, 80),
    warnings: normalizeNewTabTagTextList(source.warnings, 4, 40)
  }
}

function normalizeNewTabBookmarkTagSource(value: unknown): BookmarkTagSource {
  const source = String(value || '').trim()
  return source === 'ai_naming' ||
    source === 'auto_analyze' ||
    source === 'popup_smart' ||
    source === 'imported' ||
    source === 'manual'
    ? source
    : 'imported'
}

function normalizeNewTabBookmarkTagList(value: unknown, limit: number): string[] {
  return normalizeNewTabTagTextList(value, limit, 24)
}

function normalizeNewTabTagTextList(value: unknown, limit: number, itemLimit: number): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []
  const seen = new Set<string>()
  const output: string[] = []

  for (const item of values) {
    const text = normalizeNewTabTagText(item, itemLimit)
    const key = text.toLowerCase()
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

function normalizeNewTabTagText(value: unknown, limit = 1000): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabTagConfidence(value: unknown): number {
  const rawNumber = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/%$/, ''))
  if (!Number.isFinite(rawNumber)) {
    return 0
  }
  const normalized = rawNumber > 1 && rawNumber <= 100 ? rawNumber / 100 : rawNumber
  return Math.max(0, Math.min(normalized, 1))
}

function normalizeNewTabTimestamp(value: unknown): number {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0
}

function getLatestNewTabBookmarkTagUpdatedAt(records: BookmarkTagIndex['records']): number {
  return Object.values(records).reduce((latest, record) => Math.max(latest, Number(record.updatedAt) || 0), 0)
}

function normalizeNewTabContentSnapshotIndex(raw: unknown): ContentSnapshotIndex {
  const source = raw && typeof raw === 'object'
    ? raw as { updatedAt?: unknown; records?: unknown }
    : {}
  const rawRecords = source.records && typeof source.records === 'object'
    ? source.records as Record<string, unknown>
    : {}
  const records: ContentSnapshotIndex['records'] = {}

  for (const [fallbackBookmarkId, rawRecord] of Object.entries(rawRecords)) {
    const record = normalizeNewTabContentSnapshotRecord(rawRecord, fallbackBookmarkId)
    if (record.bookmarkId && record.snapshotId) {
      records[record.bookmarkId] = record
    }
  }

  return {
    version: 1,
    updatedAt: Number(source.updatedAt) || 0,
    records
  }
}

function normalizeNewTabContentSnapshotRecord(raw: unknown, fallbackBookmarkId: string): ContentSnapshotIndex['records'][string] {
  const source = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {}
  const bookmarkId = String(source.bookmarkId || fallbackBookmarkId || '').trim()
  const snapshotId = String(source.snapshotId || bookmarkId || '').trim()
  const fullTextStorage = ['local', 'idb'].includes(String(source.fullTextStorage))
    ? String(source.fullTextStorage) as ContentSnapshotIndex['records'][string]['fullTextStorage']
    : 'none'

  return {
    snapshotId,
    bookmarkId,
    url: String(source.url || '').trim(),
    title: normalizeNewTabSnapshotText(source.title),
    summary: normalizeNewTabSnapshotText(source.summary),
    headings: normalizeNewTabSnapshotTextList(source.headings, 28),
    canonicalUrl: String(source.canonicalUrl || '').trim(),
    finalUrl: String(source.finalUrl || '').trim(),
    contentType: normalizeNewTabSnapshotText(source.contentType),
    source: normalizeNewTabSnapshotText(source.source),
    extractionStatus: normalizeNewTabSnapshotText(source.extractionStatus),
    extractedAt: Number(source.extractedAt) || 0,
    hasFullText: source.hasFullText === true,
    fullTextBytes: Number(source.fullTextBytes) || 0,
    fullTextStorage,
    fullText: undefined,
    fullTextRef: fullTextStorage === 'idb' ? String(source.fullTextRef || snapshotId || '').trim() : undefined,
    warnings: normalizeNewTabSnapshotTextList(source.warnings, 8)
  }
}

function normalizeNewTabSnapshotText(value: unknown, limit = 500): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function normalizeNewTabSnapshotTextList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.flatMap(item => { const mappedResult = normalizeNewTabSnapshotText(item, 120); return mappedResult ? [mappedResult] : [] }).slice(0, limit)
    : []
}

function getSearchSuggestionCacheKey(query: string): string {
  return [
    state.preparedSearchIndex.entries.length,
    state.bookmarkTagIndex?.updatedAt || 0,
    state.searchSnapshotIndex?.updatedAt || 0,
    state.searchSettings.naturalSearchEnabled ? 'ai' : 'local',
    normalizeNewTabSearchText(query)
  ].join(':')
}

function getNaturalSearchDateBucket(): string {
  return formatNewTabLocalDate(Date.now())
}

function getNaturalSearchPlanCacheKey(normalizedQuery: string): string {
  return `${getNaturalSearchDateBucket()}\u0000${normalizedQuery}`
}

function getSearchSuggestionElementId(index: number): string {
  return `newtab-search-suggestion-${index}`
}

function formatSearchSuggestionUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname
    return `${parsedUrl.hostname}${pathname}`
  } catch {
    return url.replace(/^https?:\/\//i, '')
  }
}

function isCommandSuggestion(suggestion: NewTabSearchSuggestion): suggestion is NewTabCommandSearchSuggestion {
  return suggestion.suggestionType === 'command'
}

function openSearchSuggestion(suggestion: NewTabSearchSuggestion): void {
  if (isCommandSuggestion(suggestion)) {
    suggestion.command.run()
    return
  }

  openBookmarkSuggestion(suggestion)
}

function openBookmarkSuggestion(suggestion: SearchBookmarkSuggestion): void {
  const bookmark = state.allBookmarkMap.get(String(suggestion.id)) || getBookmarkById(suggestion.id)
  if (!bookmark) {
    openSearchTarget(suggestion.url)
    return
  }

  void recordBookmarkOpen(bookmark)
  openSearchTarget(suggestion.url)
}

function createClockModule(): NewTabPageModule | null {
  const settings = state.timeSettings
  if (!settings.enabled) {
    dispatchNewtabClockView(null)
    return null
  }

  dispatchNewtabClockView(createFallbackClockWidgetState(new Date(), settings))
  hydrateClockText()

  return {
    id: 'clock',
    kind: 'clock',
    placement: 'utility'
  }
}

function createBookmarkSections(sections: NewTabFolderSection[]): NewTabBookmarksModule {
  let speedDial = false
  for (const moduleKey of getVisibleNewTabModules(state.moduleSettings)) {
    const module = createConfigurableNewTabModule(moduleKey)
    if (module === 'speedDial') {
      speedDial = true
    }
  }

  if (state.folderSettings.browseMode === 'navigation') {
    return createBookmarkNavigationModule(speedDial)
  }

  const sourceNavigation = createSourceNavigation(sections)
  let renderedBookmarkIndex = 0
  const sectionModels: BookmarkFolderSectionViewModel[] = sections.map((section) => {
    const dragging = section.id === state.draggingFolderId && Boolean(state.folderDragOriginalOrderIds.length)
    const sectionModel: BookmarkFolderSectionViewModel = {
      anchorId: getNewTabSourceAnchorId(section.id),
      bookmarkCount: section.bookmarks.length,
      dragging,
      folderId: section.id,
      grid: null,
      onAddBookmark: openAddBookmarkMenuForElement,
      onClick: handleFolderHeaderClick,
      onDragPointerDown: (event) => {
        handleFolderDragPointerDown(section.id, event.currentTarget, event)
      },
      onReorderKeyDown: (event) => {
        handleFolderReorderKeyDown(section.id, event)
      },
      onOpenFolderSettings: openFolderSourceSettings,
      path: section.path,
      title: section.title
    }

    if (section.bookmarks.length) {
      const startIndex = renderedBookmarkIndex
      const initialVisibleCount = Math.min(
        section.bookmarks.length,
        Math.max(0, BOOKMARK_TILE_INITIAL_RENDER_LIMIT - startIndex)
      )
      sectionModel.grid = {
        ariaLabel: `${section.title || '文件夹'}书签`,
        busy: state.reorderingBookmarks,
        chunkSize: BOOKMARK_TILE_RENDER_CHUNK_SIZE,
        folderId: section.id,
        initialVisibleCount,
        items: section.bookmarks.map((bookmark, index) =>
          createBookmarkTileViewModel(bookmark, section.id, startIndex + index)
        )
      }
      renderedBookmarkIndex += section.bookmarks.length
    }

    return sectionModel
  })

  const reorderStatusMessage = state.bookmarkReorderError || state.folderReorderStatus
  const viewModel: BookmarkContentViewModel = {
    content: createBookmarkContentStyleState(),
    browseMode: 'expanded',
    navigation: null,
    portal: null,
    reorderStatus: reorderStatusMessage
      ? {
          message: reorderStatusMessage,
          tone: state.bookmarkReorderError ? 'error' : state.folderReorderStatusTone
        }
      : null,
    sections: sectionModels,
    sourceNavigation,
    speedDial
  }

  dispatchNewtabBookmarkContentView(viewModel)
  return {
    id: 'bookmarks',
    iconVerticalCenter: state.iconSettings.verticalCenter,
    kind: 'bookmarks',
    placement: 'primary'
  }
}

// 导航模式：把当前浏览层级渲染成单一扁平网格（子文件夹卡片在前、直属书签在后），
// 顶部一条面包屑。根层（path 空）用选中的来源文件夹作为子文件夹卡片；进入后
// 用该文件夹的直接子文件夹 + 直属书签。全程复用同一套书签卡片视觉，且不再有
// 任何竖向分组 section（形变从结构上消失）。
function createBookmarkNavigationModule(
  speedDial: boolean
): NewTabBookmarksModule {
  const level = resolveBookmarkNavigationLevel()
  const folderCards: BookmarkFolderCardViewModel[] = level.folders.map((folder) => ({
    bookmarkCount: getFolderBookmarkCounts(folder).totalBookmarkCount,
    folderId: String(folder.id),
    onOpen: (event) => {
      event.preventDefault()
      event.stopPropagation()
      enterBookmarkNavigationFolder(String(folder.id))
    },
    title: String(folder.title || '未命名文件夹').trim() || '未命名文件夹'
  }))

  const items = level.bookmarks.map((bookmark, index) =>
    createBookmarkTileViewModel(bookmark, level.folderId, folderCards.length + index)
  )
  const initialVisibleCount = Math.min(items.length, Math.max(0, BOOKMARK_TILE_INITIAL_RENDER_LIMIT - folderCards.length))

  const navigation: BookmarkNavigationViewModel = {
    ariaLabel: `${level.title || '书签'}导航`,
    breadcrumb: level.breadcrumb,
    chunkSize: BOOKMARK_TILE_RENDER_CHUNK_SIZE,
    folderCards,
    initialVisibleCount,
    items
  }

  const reorderStatusMessage = state.bookmarkReorderError || state.folderReorderStatus
  const viewModel: BookmarkContentViewModel = {
    content: createBookmarkContentStyleState(),
    browseMode: 'navigation',
    navigation,
    portal: null,
    reorderStatus: reorderStatusMessage
      ? {
          message: reorderStatusMessage,
          tone: state.bookmarkReorderError ? 'error' : state.folderReorderStatusTone
        }
      : null,
    sections: [],
    sourceNavigation: null,
    speedDial
  }

  dispatchNewtabBookmarkContentView(viewModel)
  return {
    id: 'bookmarks',
    iconVerticalCenter: state.iconSettings.verticalCenter,
    kind: 'bookmarks',
    placement: 'primary'
  }
}

interface BookmarkNavigationLevel {
  breadcrumb: BookmarkNavigationViewModel['breadcrumb']
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
  folderId: string
  folders: chrome.bookmarks.BookmarkTreeNode[]
  title: string
}

// 依据 state.bookmarkNavigationPath 解析当前层级。路径里失效的 folderId 会被截断，
// 保证始终落在一个有效层级（最坏回到根来源层）。根层直接用选中的来源文件夹作为
// 文件夹卡片（不用展开模式那套 getDisplayableNewTabSourceFolders 扁平化结果，否则
// 嵌套子文件夹会错误地平铺到根层）。
function resolveBookmarkNavigationLevel(): BookmarkNavigationLevel {
  const rootBreadcrumb = {
    folderId: '',
    onNavigate: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      exitBookmarkNavigationToRoot()
    },
    title: '书签'
  }

  const rootSourceFolders = (): chrome.bookmarks.BookmarkTreeNode[] => {
    const seen = new Set<string>()
    const folders: chrome.bookmarks.BookmarkTreeNode[] = []
    for (const folderId of normalizeFolderIds(state.folderSettings.selectedFolderIds)) {
      const node = state.folderNodeMap.get(folderId) || null
      if (!node || node.url || seen.has(String(node.id))) {
        continue
      }
      seen.add(String(node.id))
      folders.push(node)
    }
    return folders
  }

  const path = state.bookmarkNavigationPath
  if (!path.length) {
    return {
      breadcrumb: [rootBreadcrumb],
      bookmarks: [],
      folderId: '',
      folders: rootSourceFolders(),
      title: '书签'
    }
  }

  const breadcrumb: BookmarkNavigationViewModel['breadcrumb'] = [rootBreadcrumb]
  let currentNode: chrome.bookmarks.BookmarkTreeNode | null = null
  const validatedPath: string[] = []
  for (const folderId of path) {
    const node = state.folderNodeMap.get(folderId) || null
    if (!node || node.url) {
      break
    }
    validatedPath.push(folderId)
    currentNode = node
    breadcrumb.push({
      folderId,
      onNavigate: (event) => {
        event.preventDefault()
        event.stopPropagation()
        navigateBookmarkNavigationTo(folderId)
      },
      title: String(node.title || '未命名文件夹').trim() || '未命名文件夹'
    })
  }
  if (validatedPath.length !== path.length) {
    state.bookmarkNavigationPath = validatedPath
  }

  if (!currentNode) {
    return {
      breadcrumb: [rootBreadcrumb],
      bookmarks: [],
      folderId: '',
      folders: rootSourceFolders(),
      title: '书签'
    }
  }

  const children = currentNode.children || []
  return {
    breadcrumb,
    bookmarks: children.filter((child) => Boolean(child.url)),
    folderId: String(currentNode.id),
    folders: children.filter((child) => !child.url),
    title: String(currentNode.title || '未命名文件夹').trim() || '未命名文件夹'
  }
}

function enterBookmarkNavigationFolder(folderId: string): void {
  const id = String(folderId || '').trim()
  if (!id || !state.folderNodeMap.has(id)) {
    return
  }
  state.bookmarkNavigationPath = [...state.bookmarkNavigationPath, id]
  rerenderBookmarkNavigation()
}

function navigateBookmarkNavigationTo(folderId: string): void {
  const index = state.bookmarkNavigationPath.indexOf(String(folderId))
  if (index < 0) {
    return
  }
  state.bookmarkNavigationPath = state.bookmarkNavigationPath.slice(0, index + 1)
  rerenderBookmarkNavigation()
}

function exitBookmarkNavigationToRoot(): void {
  if (!state.bookmarkNavigationPath.length) {
    return
  }
  state.bookmarkNavigationPath = []
  rerenderBookmarkNavigation()
}

function rerenderBookmarkNavigation(): void {
  if (!renderBookmarkSections()) {
    render()
  }
  scheduleAdaptiveNewTabLayoutUpdate()
}

function createBookmarkContentStyleState(): BookmarkContentStyleState {
  const gridSettings = {
    ...state.iconSettings,
    columns: getResponsiveIconColumns(state.iconSettings)
  }

  return {
    columnGap: getIconGapPx(state.iconSettings.columnGap),
    columns: gridSettings.columns,
    fixedGridWidth: getFixedIconGridWidthPx(gridSettings),
    folderGap: getFolderGapPx(state.iconSettings.folderGap),
    iconShellSize: state.iconSettings.iconShellSize,
    layoutMode: state.iconSettings.layoutMode,
    pageWidth: getIconPageWidthPx(state.iconSettings.pageWidth),
    reordering: state.reorderingBookmarks,
    rowGap: getIconRowGapPx(state.iconSettings.rowGap),
    showTitles: state.iconSettings.showTitles,
    tileWidth: getEffectiveIconTileWidthPx(state.iconSettings),
    titleLines: state.iconSettings.titleLines,
    verticalCenter: state.iconSettings.verticalCenter
  }
}

function createConfigurableNewTabModule(key: NewTabModuleSettingKey): 'speedDial' | null {
  if (key === 'speedDial') {
    return createSpeedDialPanel()
  }
  return null
}

function getActiveWorkspacePinnedIds(): string[] {
  return getActiveNewTabWorkspace(state.workspaceSettings).pinnedIds
}

function isBookmarkPinnedInSpeedDial(pinnedIds: string[], bookmarkId: string): boolean {
  const id = String(bookmarkId || '').trim()
  return Boolean(id && pinnedIds.includes(id))
}

function getSpeedDialPinActionCopyLocal(isPinned: boolean): {
  label: string
  status: string
  ariaLabel: string
} {
  return isPinned
    ? {
        label: '取消固定',
        status: '已取消固定入口',
        ariaLabel: '取消固定入口'
      }
    : {
        label: '设为固定入口',
        status: '已添加固定入口',
        ariaLabel: '将书签设为固定入口'
      }
}

function createSpeedDialPanel(): 'speedDial' | null {
  if (!state.moduleSettings.speedDial) {
    dispatchNewtabSpeedDialView(null)
    return null
  }

  hydrateSpeedDialPanel()
  return 'speedDial'
}

function handleBackgroundFilterHoverToggle(enabled: boolean): void {
  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    maskFilterHover: enabled
  })
  commitBackgroundSettings(previousSettings, nextSettings)
}

function hydrateSpeedDialPanel(): void {
  if (!state.moduleSettings.speedDial) {
    return
  }
  const activeWorkspace = getActiveNewTabWorkspace(state.workspaceSettings)
  const items = buildSpeedDialItems({
    pinnedIds: activeWorkspace.pinnedIds,
    bookmarks: state.allBookmarkMap
  })
  renderSpeedDialPanel(items)
}

function refreshSpeedDialPanel(): void {
  if (state.moduleSettings.speedDial) {
    hydrateSpeedDialPanel()
  } else {
    dispatchNewtabSpeedDialView(null)
  }
}

function renderSpeedDialPanel(
  items: SpeedDialItem[]
): void {
  if (!items.length) {
    dispatchNewtabSpeedDialView({
      ariaBusy: false,
      content: {
        type: 'empty',
        state: createSpeedDialEmptyState()
      },
      meta: state.speedDialReorderError || '尚未固定',
      metaTone: state.speedDialReorderError ? 'error' : ''
    })
    return
  }

  const cardModels: SpeedDialCardViewModel[] = []
  for (const item of items) {
    const bookmark = getBookmarkById(item.id)
    if (!bookmark?.url) {
      continue
    }
    const renderIndex = cardModels.length
    cardModels.push(createSpeedDialCardViewModel(item, bookmark, renderIndex))
  }

  dispatchNewtabSpeedDialView({
    ariaBusy: false,
    content: {
      type: 'items',
      busy: state.reorderingSpeedDial,
      items: cardModels
    },
    meta: state.speedDialReorderError || `${items.length} 个固定入口`,
    metaTone: state.speedDialReorderError ? 'error' : ''
  })
}

function createSpeedDialCardViewModel(
  item: SpeedDialItem,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  renderIndex = 0
): SpeedDialCardViewModel {
  const customIcon = state.customIcons[String(item.id)]
  const faviconLoadAttributes = getSpeedDialFaviconLoadAttributes(renderIndex)
  return {
    customIcon: Boolean(customIcon),
    detail: item.detail,
    dragging: String(item.id) === state.speedDialDraggingBookmarkId && Boolean(state.speedDialDragOriginalOrderIds.length),
    fallbackLabel: item.fallbackLabel,
    favicon: {
      fetchpriority: faviconLoadAttributes.fetchpriority,
      loading: faviconLoadAttributes.loading,
      src: customIcon || getFaviconUrl(item.url, item.id)
    },
    id: item.id,
    onContextMenu: (event) => {
      handleBookmarkContextMenu(item.id, event)
    },
    onDragPointerDown: (event) => {
      const card = getNewtabSpeedDialNodes().cards.get(String(item.id)) || event.currentTarget
      handleSpeedDialDragPointerDown(item.id, card, event)
    },
    onReorderKeyDown: (event) => {
      handleSpeedDialReorderKeyDown(String(item.id), event)
    },
    onNavigate: (event) => {
      handleBookmarkNavigation(event, bookmark, item.url)
    },
    title: item.title,
    url: item.url
  }
}

function createSourceNavigation(sections: NewTabFolderSection[]): SourceNavigationState | null {
  if (!state.generalSettings.showSourceNavigation || sections.length < 2) {
    return null
  }

  const items = buildNewTabSourceNavigationItems(sections)
  if (items.length < 2) {
    return null
  }

  return {
    items
  }
}

function getResponsiveIconColumns(settings: IconSettings): number {
  return getResponsiveFixedIconColumns(
    settings,
    getNewtabViewportWidth()
  )
}

function getNewtabViewportWidth(): number {
  return window.innerWidth || 1280
}

function getNewtabViewportHeight(): number {
  return window.innerHeight || 0
}

function getNewtabViewportRect(): DOMRect {
  return new DOMRect(0, 0, getNewtabViewportWidth(), getNewtabViewportHeight())
}

function createBookmarkTileViewModel(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  folderId: string,
  renderIndex = 0
): BookmarkTileViewModel {
  const url = String(bookmark.url || '')
  const title = String(bookmark.title || '').trim() || url
  const bookmarkId = String(bookmark.id)
  const customIcon = state.customIcons[bookmarkId]
  return {
    customIcon: Boolean(customIcon),
    dragging: bookmarkId === state.draggingBookmarkId && Boolean(state.dragOriginalOrderIds.length),
    fallbackLabel: getFallbackLabel(title),
    favicon: {
      fetchpriority: renderIndex < HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'low',
      loading: renderIndex < EAGER_FAVICON_LIMIT ? 'eager' : 'lazy',
      src: customIcon || getFaviconUrl(url, bookmarkId)
    },
    folderId,
    id: bookmarkId,
    onContextMenu: (event) => {
      handleBookmarkContextMenu(bookmarkId, event)
    },
    onDragPointerDown: (event) => {
      const tile = getNewtabBookmarkContentNodes().tiles.get(bookmarkId) || event.currentTarget
      handleBookmarkDragPointerDown(bookmarkId, folderId, tile, event)
    },
    onReorderKeyDown: (event) => {
      handleBookmarkReorderKeyDown(bookmarkId, folderId, event)
    },
    onNavigate: (event) => {
      handleBookmarkNavigation(event, bookmark, url)
    },
    title,
    url
  }
}

function cleanupNewTabController(): void {
  newTabControllerStarted = false
  newTabControllerGeneration += 1
  refreshNewTabSearchSuggestionsAfterAiSettingsChange = null
  if (newTabStorageEventsBound) {
    chrome.storage.onChanged.removeListener(handleNewTabStorageChanged)
    newTabStorageEventsBound = false
  }
  unregisterNewtabContentShellActions()
  unregisterNewtabContentShellActions = () => {}
  unregisterNewtabContentLayoutNodes()
  unregisterNewtabContentLayoutNodes = () => {}
  unregisterNewtabKeyboardActions()
  unregisterNewtabKeyboardActions = () => {}
  unregisterNewtabLifecycleActions()
  unregisterNewtabLifecycleActions = () => {}
  unregisterNewtabSettingsDrawerNodes()
  unregisterNewtabSettingsDrawerNodes = () => {}
  unregisterNewtabWindowActions()
  unregisterNewtabWindowActions = () => {}
  unregisterNewtabBookmarkEventActions()
  unregisterNewtabBookmarkEventActions = () => {}
  window.clearTimeout(clockTimer)
  clockTimer = 0
  window.clearTimeout(featuredBackgroundRefreshTimer)
  featuredBackgroundRefreshTimer = 0
  window.clearTimeout(featuredBackgroundPreferencesSaveTimer)
  featuredBackgroundPreferencesSaveTimer = 0
  clearFeaturedBackgroundPreviewWarmTimers()
  clearFeaturedBackgroundHoverPreview()
  revokeFeaturedBackgroundGalleryObjectUrls()
  revokeFeaturedBackgroundGalleryPreviewObjectUrls()
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = 0
  window.clearTimeout(searchSettingsSettleTimer)
  searchSettingsSettleTimer = 0
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = 0
  window.clearTimeout(timeSettingsSaveTimer)
  timeSettingsSaveTimer = 0
  window.clearTimeout(settingsSaveStatusTimer)
  settingsSaveStatusTimer = 0
  window.clearTimeout(folderReorderStatusTimer)
  folderReorderStatusTimer = 0
  window.clearTimeout(bookmarkChangeRefreshTimer)
  bookmarkChangeRefreshTimer = 0
  window.clearTimeout(state.dragLongPressTimer)
  state.dragLongPressTimer = 0
  window.clearTimeout(state.speedDialDragLongPressTimer)
  state.speedDialDragLongPressTimer = 0
  window.clearTimeout(state.folderDragLongPressTimer)
  state.folderDragLongPressTimer = 0
  window.cancelAnimationFrame(resizeLayoutFrame)
  resizeLayoutFrame = 0
  window.cancelAnimationFrame(verticalCenterCollisionFrame)
  verticalCenterCollisionFrame = 0
  window.cancelAnimationFrame(autoSearchLayoutRevealFrame)
  autoSearchLayoutRevealFrame = 0
  lastMeasuredSearchSlot = null
  window.cancelAnimationFrame(verticalCenterContentSettleFrame)
  verticalCenterContentSettleFrame = 0
  settledVerticalCenterContent = null
  window.cancelAnimationFrame(deferredRenderFrame)
  deferredRenderFrame = 0
  window.cancelAnimationFrame(bookmarkDropCommitFrame)
  bookmarkDropCommitFrame = 0
  resetAutoSearchLayoutSettle()
  setAutoSearchLayoutPending(false)
  removeBookmarkDragGhost()
  removeSpeedDialDragGhost()
  removeFolderDragGhost()
  setActiveBackgroundObjectUrl('')
  clearBackgroundMedia()
  abortNewTabNaturalSearchRequest()
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
}

function getFeaturedBackgroundPreviewCacheKey(imageUrl: string): string {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }
  return `${FEATURED_BACKGROUND_PREVIEW_CACHE_KEY_PREFIX}${normalizedUrl}`
}

function getFeaturedBackgroundPreviewCandidates(imageUrl: string, provider: FeaturedBackgroundItem['provider']): string[] {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return []
  }

  const urls = new Set<string>()
  const fallbackUrl = getFeaturedBackgroundPreviewImageUrl({ provider }, normalizedUrl)
  if (fallbackUrl) {
    urls.add(fallbackUrl)
  }
  urls.add(normalizedUrl)
  return [...urls]
}

async function getFeaturedBackgroundPreviewCacheRecord(imageUrl: string): Promise<{
  blob: Blob
  url: string
  type: string
  updatedAt: number
} | null> {
  const key = getFeaturedBackgroundPreviewCacheKey(imageUrl)
  if (!key) {
    return null
  }

  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const request = store.get(key)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          url?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (!record?.blob || !(record.blob instanceof Blob) || String(record.url || '') !== normalizeBackgroundImageUrl(imageUrl)) {
          resolve(null)
          return
        }
        resolve({
          blob: record.blob,
          url: String(record.url || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        })
      }
      request.onerror = () => {
        reject(request.error || new Error('精选图库预览缓存读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function clearFeaturedBackgroundPreviewCache(): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const prefix = FEATURED_BACKGROUND_PREVIEW_CACHE_KEY_PREFIX
      const request = store.openKeyCursor(IDBKeyRange.bound(prefix, `${prefix}\uffff`))
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) {
          resolve()
          return
        }
        store.delete(cursor.key)
        cursor.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('精选图库预览缓存清除失败。'))
      transaction.onabort = () => reject(transaction.error || new Error('精选图库预览缓存清除失败。'))
    })
  } finally {
    db.close()
  }
}

async function createFeaturedBackgroundPreviewObjectUrl(imageUrl: string): Promise<string> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  return featuredBackgroundGalleryPreviewObjectUrlCache.resolve(
    normalizedUrl,
    () => getFeaturedBackgroundPreviewCacheRecord(normalizedUrl).then((record) => record?.blob || null),
    { fallbackUrl: '' }
  )
}

function revokeFeaturedBackgroundGalleryPreviewObjectUrls(): void {
  featuredBackgroundGalleryPreviewObjectUrlCache.clear()
}

function handleBookmarkNavigation(
  event: MouseEvent | ReactMouseEvent<HTMLAnchorElement>,
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  fallbackUrl = ''
): void {
  const bookmarkId = String(bookmark.id || '').trim()
  const currentBookmark = state.allBookmarkMap.get(bookmarkId) || getBookmarkById(bookmarkId) || bookmark
  const url = String(currentBookmark.url || fallbackUrl || '').trim()
  if (!url) {
    return
  }

  if (shouldSuppressNewtabActionClick()) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    void recordBookmarkOpen(currentBookmark)
    return
  }

  event.preventDefault()
  if (state.generalSettings.openBookmarksInNewTab) {
    const opened = window.open(url, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    void recordBookmarkOpen(currentBookmark)
    return
  }

  void recordBookmarkOpen(currentBookmark)
  window.location.assign(url)
}

function shouldSuppressNewtabActionClick(): boolean {
  return Boolean(
    state.dragSuppressClick ||
    state.speedDialDragSuppressClick ||
    state.folderDragSuppressClick ||
    state.draggingBookmarkId ||
    state.speedDialDraggingBookmarkId ||
    state.draggingFolderId
  )
}

function buildFolderNodeMap(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
  if (!rootNode) {
    return map
  }

  const walk = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (!node.url) {
      map.set(String(node.id), node)
      for (const child of node.children || []) {
        if (!child.url) {
          walk(child)
        }
      }
    }
  }

  walk(rootNode)
  return map
}

function buildAllBookmarks(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return collectPortalBookmarkSourceItems(rootNode) as chrome.bookmarks.BookmarkTreeNode[]
}

function buildNewTabFolderSections(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null,
  settings: NewTabFolderSettings,
  folderData = state.folderData,
  folderNodeMap = state.folderNodeMap
): NewTabFolderSection[] {
  if (!rootNode) {
    return []
  }

  const resolvedFolderData = folderData || getBookmarkCatalog(rootNode).extracted
  const resolvedFolderNodeMap = folderNodeMap.size ? folderNodeMap : buildFolderNodeMap(rootNode)
  const selectedIds = normalizeFolderIds(settings.selectedFolderIds)
  const sections: NewTabFolderSection[] = []
  const seenSectionIds = new Set<string>()

  for (const folderId of selectedIds) {
    const node = resolvedFolderNodeMap.get(folderId) || null
    if (!node || node.url) {
      continue
    }

    for (const displayNode of getDisplayableNewTabSourceFolders(node)) {
      const sectionId = String(displayNode.id || '').trim()
      if (!sectionId || seenSectionIds.has(sectionId)) {
        continue
      }

      const folder = resolvedFolderData.folderMap.get(sectionId)
      sections.push(createFolderSection(displayNode, folder, folderId))
      seenSectionIds.add(sectionId)
    }
  }

  return sections
}

function createFolderSection(
  node: chrome.bookmarks.BookmarkTreeNode,
  folder?: FolderRecord,
  sourceId = String(node.id)
): NewTabFolderSection {
  const title = String(folder?.title || node.title || '未命名文件夹').trim() || '未命名文件夹'
  const counts = getFolderBookmarkCounts(node)
  return {
    id: String(node.id),
    sourceId,
    title,
    path: String(folder?.path || title),
    node,
    bookmarks: getDirectBookmarks(node),
    directBookmarkCount: counts.directBookmarkCount,
    totalBookmarkCount: counts.totalBookmarkCount
  }
}

function getDirectBookmarks(
  folderNode: chrome.bookmarks.BookmarkTreeNode | null
): chrome.bookmarks.BookmarkTreeNode[] {
  return (folderNode?.children || []).filter((child) => Boolean(child.url))
}

function getAllSectionBookmarks(): chrome.bookmarks.BookmarkTreeNode[] {
  return state.folderSections.flatMap((section) => section.bookmarks)
}

function refreshDerivedBookmarkState(): void {
  state.folderNode = state.folderSections[0]?.node || null
  state.bookmarks = getAllSectionBookmarks()
  state.bookmarkMap = new Map(state.bookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
  state.allBookmarks = buildAllBookmarks(state.rootNode)
  state.allBookmarkMap = new Map(state.allBookmarks.map((bookmark) => [String(bookmark.id), bookmark]))
}

function rebuildNewTabSearchIndex(): void {
  const catalog = getBookmarkCatalog()
  if (
    state.searchIndex &&
    lastBuiltSearchIndexCatalogVersion &&
    lastBuiltSearchIndexCatalogVersion === catalog.version
  ) {
    state.searchIndexReady = true
    state.searchIndexReadyPromise = searchIndexReadyPromise
    resolveSearchIndexReady()
    return
  }
  state.searchIndex = buildNewTabSearchIndex({
    bookmarks: catalog.extracted.bookmarks,
    tagIndex: state.bookmarkTagIndex,
    snapshotIndex: state.searchSnapshotIndex
  })
  lastBuiltSearchIndexCatalogVersion = catalog.version
  state.preparedSearchIndex = prepareNewTabSearchIndex(state.searchIndex)
  searchSuggestionCache.clear()
  naturalSearchSuggestionCache.clear()
  state.naturalSearchPlanCache.clear()
  state.searchIndexReady = true
  state.searchIndexReadyPromise = searchIndexReadyPromise
  resolveSearchIndexReady()
  perfMark('newtab.searchReady')
  perfMeasure('newtab.searchReadyMs', 'newtab.domContentLoaded', 'newtab.searchReady')
}

function getBookmarkById(bookmarkId: string): chrome.bookmarks.BookmarkTreeNode | null {
  return state.bookmarkMap.get(String(bookmarkId)) || state.allBookmarkMap.get(String(bookmarkId)) || null
}

function getBookmarkFolderPath(bookmark: chrome.bookmarks.BookmarkTreeNode): string {
  const parentId = String(bookmark.parentId || '')
  return state.folderSections.find((section) => section.id === parentId)?.path ||
    state.folderData?.folderMap.get(parentId)?.path ||
    ''
}

async function recordBookmarkOpen(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  const bookmarkId = String(bookmark.id || '').trim()
  const url = String(bookmark.url || '').trim()
  if (!bookmarkId || !url) {
    return
  }

  const now = Date.now()
  const previousRecord = state.activity.records[bookmarkId]
  const nextRecord: NewTabActivityRecord = {
    bookmarkId,
    title: String(bookmark.title || '').trim() || url,
    url,
    openCount: Math.min((previousRecord?.openCount || 0) + 1, 9999),
    firstOpenedAt: previousRecord?.firstOpenedAt || now,
    lastOpenedAt: now
  }
  state.activity = normalizeNewTabActivity({
    ...state.activity,
    records: {
      ...state.activity.records,
      [bookmarkId]: nextRecord
    }
  }, state.allBookmarks)

  await saveNewTabActivityRecord(nextRecord).catch((error) => {
    console.warn('新标签页打开记录保存失败。', error)
  })
}

async function removeBookmarkFromActivity(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  state.activity = await saveNewTabActivityRemoval(normalizedId)
}

async function removeBookmarkFromWorkspacePins(bookmarkId: string): Promise<void> {
  const normalizedId = String(bookmarkId || '').trim()
  if (!normalizedId) {
    return
  }

  let nextSettings = state.workspaceSettings
  for (const workspace of state.workspaceSettings.workspaces) {
    const nextPinnedIds = workspace.pinnedIds.filter((id) => id !== normalizedId)
    if (nextPinnedIds.length === workspace.pinnedIds.length) {
      continue
    }
    nextSettings = updateNewTabWorkspace(
      nextSettings,
      workspace.id,
      { pinnedIds: nextPinnedIds },
      { validBookmarkIds: state.allBookmarkMap.keys() }
    )
  }

  state.workspaceSettings = nextSettings
  await saveNewTabWorkspaceSettings()
}

async function saveNewTabActivityRecord(record: NewTabActivityRecord): Promise<void> {
  const activityRepository = await loadNewTabActivityRepositoryLazy()
  state.activity = await activityRepository.upsertNewTabActivityRecordInRepository(
    state.activity,
    record,
    normalizeNewTabActivityForCurrentBookmarks
  )
}

async function saveNewTabActivityRemoval(bookmarkId: string): Promise<NewTabActivityState> {
  const activityRepository = await loadNewTabActivityRepositoryLazy()
  return activityRepository.removeNewTabActivityRecordInRepository(
    state.activity,
    bookmarkId,
    normalizeNewTabActivityForCurrentBookmarks
  )
}

async function loadNewTabActivityRepositoryLazy(): Promise<NewTabActivityRepositoryModule> {
  return import('../shared/repositories/activity-repository.js')
}

function normalizeNewTabActivityForCurrentBookmarks(rawActivity: unknown): NewTabActivityState {
  return normalizeNewTabActivity(rawActivity, state.allBookmarks)
}

async function saveNewTabWorkspaceSettings(): Promise<void> {
  state.workspaceSettings = normalizeNewTabWorkspaceSettings(state.workspaceSettings, {
    validBookmarkIds: state.allBookmarkMap.keys()
  })
  await setLocalStorage({
    [STORAGE_KEYS.newTabWorkspaceSettings]: state.workspaceSettings
  })
}

async function saveNewTabModuleSettings(): Promise<void> {
  state.moduleSettings = normalizeNewTabModuleSettings(state.moduleSettings)
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabModuleSettings]: state.moduleSettings
  })
}

function normalizeNewTabActivity(
  rawActivity: unknown,
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
): NewTabActivityState {
  const validIds = new Set(bookmarks.map((bookmark) => String(bookmark.id)))
  const source = rawActivity && typeof rawActivity === 'object' && !Array.isArray(rawActivity)
    ? rawActivity as Record<string, unknown>
    : {}
  const pinnedIds = Array.isArray(source.pinnedIds)
    ? uniqueActivityIds(source.pinnedIds, validIds).slice(0, QUICK_ACCESS_ITEM_LIMIT)
    : []
  const rawRecords = source.records && typeof source.records === 'object' && !Array.isArray(source.records)
    ? source.records as Record<string, unknown>
    : {}
  const records: Record<string, NewTabActivityRecord> = {}

  const normalizedRecords = Object.entries(rawRecords)
    .map(([bookmarkId, value]) => normalizeActivityRecord(bookmarkId, value, validIds))
    .filter((record): record is NewTabActivityRecord => Boolean(record))
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, ACTIVITY_RECORD_LIMIT)

  for (const record of normalizedRecords) {
    records[record.bookmarkId] = record
  }

  return { pinnedIds, records }
}

function uniqueActivityIds(values: unknown[], validIds: Set<string>): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const id = String(value || '').trim()
    if (!id || seen.has(id) || !validIds.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function normalizeActivityRecord(
  bookmarkId: string,
  value: unknown,
  validIds: Set<string>
): NewTabActivityRecord | null {
  const id = String(bookmarkId || '').trim()
  if (!id || !validIds.has(id) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const source = value as Record<string, unknown>
  const openCount = Math.max(0, Math.min(Math.floor(Number(source.openCount) || 0), 9999))
  const lastOpenedAt = Number(source.lastOpenedAt) || 0
  if (openCount <= 0 || lastOpenedAt <= 0) {
    return null
  }

  return {
    bookmarkId: id,
    title: String(source.title || '').trim().slice(0, 160),
    url: String(source.url || '').trim().slice(0, 2048),
    openCount,
    firstOpenedAt: Number(source.firstOpenedAt) || lastOpenedAt,
    lastOpenedAt
  }
}

function getActiveMenuBookmark(): chrome.bookmarks.BookmarkTreeNode | null {
  return state.activeMenuBookmarkId ? getBookmarkById(state.activeMenuBookmarkId) : null
}

function renderBookmarkMenu({ focusFirst = true, focusAction = '' } = {}): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    dispatchNewtabBookmarkEditMenuView(null)
    return
  }

  const bookmarkLabel = getBookmarkActionLabelContext(bookmark)
  const pinCopy = getSpeedDialPinActionCopyLocal(isActiveMenuBookmarkPinned())
  const deleteLabel = state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除书签' : '删除书签'
  dispatchNewtabBookmarkEditMenuView({
    closing: false,
    focusAction,
    focusFirst,
    onExitComplete: finalizeBookmarkMenuClose,
    menu: {
      actions: [
        createMenuActionViewModel(
          pinCopy.label,
          'pin',
          toggleActiveMenuBookmarkPin,
          { actionId: 'toggle-pin', ariaLabel: `${pinCopy.ariaLabel}：${bookmarkLabel}` }
        ),
        createMenuActionViewModel('复制链接', 'copy', copyActiveMenuBookmarkUrl, {
          actionId: 'copy-url',
          ariaLabel: `复制书签链接：${bookmarkLabel}`
        }),
        createMenuActionViewModel(
          state.pendingDeleteBookmarkId === String(bookmark.id) ? '确认删除 1 个' : '删除链接',
          'trash',
          deleteActiveMenuBookmark,
          { actionId: 'delete-bookmark', variant: 'danger', ariaLabel: `${deleteLabel}：${bookmarkLabel}` }
        ),
        createMenuActionViewModel('刷新图标', 'refresh', refreshActiveMenuIcon, {
          actionId: 'refresh-icon',
          ariaLabel: `刷新书签图标：${bookmarkLabel}`
        }),
        createMenuActionViewModel('保存更改', 'save', saveBookmarkMenuChanges, {
          actionId: 'save-bookmark',
          ariaLabel: `保存书签更改：${bookmarkLabel}`
        })
      ],
      error: state.menuError,
      fields: [
        createMenuTextFieldViewModel('标题', 'Example', state.editTitle, (value) => {
          state.editTitle = value
        }),
        createMenuTextFieldViewModel('链接', 'https://example.com/', state.editUrl, (value) => {
          state.editUrl = value
        })
      ],
      iconMode: state.editIconMode === 'custom' ? 'custom' : 'website',
      iconModeDisabled: state.menuBusy,
      onCustomIconFileSelect: handleCustomIconFileSelect,
      onCloseRequest: closeBookmarkMenu,
      onIconModeChange: handleIconModeChange,
      status: state.menuStatus,
      statusTone: state.pendingDeleteBookmarkId === String(bookmark.id) ? 'warning' : '',
      x: state.menuX,
      y: state.menuY
    }
  })
}

function renderAddBookmarkMenu({ focusFirst = true } = {}): void {
  if (!state.addMenuOpen) {
    dispatchNewtabBookmarkAddMenuView(null)
    return
  }

  dispatchNewtabBookmarkAddMenuView({
    closing: false,
    focusFirst,
    onExitComplete: finalizeAddBookmarkMenuClose,
    menu: {
      actions: [
        createMenuActionViewModel('添加书签', 'plus', saveAddedBookmark, {
          disabled: state.addMenuBusy
        })
      ],
      error: state.addMenuError,
      expanded: state.addMenuExpanded,
      fields: [
        createMenuTextFieldViewModel('标题', 'Example', state.addTitle, (value) => {
          state.addTitle = value
        }, {
          disabled: state.addMenuBusy,
          onEnter: saveAddedBookmark
        }),
        createMenuTextFieldViewModel('链接', 'https://example.com', state.addUrl, (value) => {
          state.addUrl = value
        }, {
          disabled: state.addMenuBusy,
          onEnter: saveAddedBookmark
        })
      ],
      onCloseRequest: closeAddBookmarkMenu,
      onExpand: expandAddBookmarkMenu,
      x: state.addMenuX,
      y: state.addMenuY
    }
  })
}

function handleIconModeChange(nextMode: 'website' | 'custom'): void {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  if (nextMode === 'website') {
    state.editIconMode = 'website'
    state.pendingCustomIconDataUrl = ''
    state.pendingDeleteBookmarkId = ''
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false })
    return
  }

  renderBookmarkMenu({ focusFirst: false })
}

async function handleCustomIconFileSelect(file: File | null): Promise<void> {
  const bookmark = getActiveMenuBookmark()
  if (!bookmark) {
    closeBookmarkMenu()
    return
  }

  if (!file) {
    state.editIconMode = state.customIcons[bookmark.id] ? 'custom' : 'website'
    state.pendingCustomIconDataUrl = ''
    state.menuBusy = false
    state.pendingDeleteBookmarkId = ''
    state.menuError = ''
    state.menuStatus = ''
    renderBookmarkMenu({ focusFirst: false })
    return
  }

  state.menuBusy = true
  state.pendingDeleteBookmarkId = ''
  state.menuError = ''
  state.menuStatus = ''
  renderBookmarkMenu({ focusFirst: false })

  try {
    const dataUrl = await readCustomIconFile(file)
    state.menuBusy = false
    state.editIconMode = 'custom'
    state.pendingCustomIconDataUrl = dataUrl
    renderBookmarkMenu({ focusFirst: false })
  } catch (error) {
    state.menuBusy = false
    state.menuStatus = ''
    state.menuError =
      error instanceof Error ? error.message : '自定义图片读取失败，请重试。'
    state.editIconMode = state.customIcons[bookmark.id] ? 'custom' : 'website'
    renderBookmarkMenu({ focusFirst: false })
  }
}

function createMenuTextFieldViewModel(
  label: string,
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
  {
    disabled = state.menuBusy,
    onEnter = saveBookmarkMenuChanges
  }: {
    disabled?: boolean
    onEnter?: () => void | Promise<void>
  } = {}
): BookmarkMenuTextFieldViewModel {
  return {
    disabled,
    id: label === '链接' ? 'url' : 'title',
    label,
    onChange(value: string) {
      state.pendingDeleteBookmarkId = ''
      onInput(value)
    },
    onEnter,
    placeholder,
    type: label === '链接' ? 'url' : 'text',
    value
  }
}

function createMenuActionViewModel(
  label: string,
  icon: MenuActionIcon,
  action: () => void | Promise<void>,
  {
    disabled = state.menuBusy,
    actionId = '',
    variant = '',
    ariaLabel = label
  }: {
    disabled?: boolean
    actionId?: string
    variant?: 'danger' | ''
    ariaLabel?: string
  } = {}
): BookmarkMenuActionViewModel {
  return {
    actionId,
    ariaLabel,
    disabled,
    icon,
    id: actionId || `${icon}:${label}`,
    label,
    onSelect: action,
    variant
  }
}

function normalizeBookmarkInputUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) {
    throw new Error('链接不能为空。')
  }

  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`

  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('unsupported protocol')
    }
    return parsedUrl.href
  } catch {
    throw new Error('请输入有效链接。')
  }
}

async function persistCustomIconChoice(bookmarkId: string): Promise<void> {
  const nextIcons = { ...state.customIcons }

  if (state.editIconMode === 'custom') {
    const iconData = state.pendingCustomIconDataUrl || nextIcons[bookmarkId]
    if (!iconData) {
      throw new Error('请选择自定义图片，或切回网站图标。')
    }
    nextIcons[bookmarkId] = iconData
  } else {
    delete nextIcons[bookmarkId]
  }

  await saveCustomIcons(nextIcons)
}

async function saveCustomIcons(nextIcons: Record<string, string>): Promise<void> {
  state.customIcons = nextIcons
  await setLocalStorage({
    [STORAGE_KEYS.newTabCustomIcons]: nextIcons
  })
}

function normalizeCustomIcons(rawIcons: unknown): Record<string, string> {
  if (!rawIcons || typeof rawIcons !== 'object' || Array.isArray(rawIcons)) {
    return {}
  }

  const normalized: Record<string, string> = {}
  for (const [bookmarkId, value] of Object.entries(rawIcons as Record<string, unknown>)) {
    const key = String(bookmarkId || '').trim()
    const dataUrl = String(value || '').trim()
    if (key && dataUrl.startsWith('data:image/')) {
      normalized[key] = dataUrl
    }
  }
  return normalized
}

function normalizeBackgroundSettings(rawSettings: unknown): typeof DEFAULT_BACKGROUND_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_BACKGROUND_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const type = SUPPORTED_BACKGROUND_TYPES.has(String(settings.type))
    ? String(settings.type)
    : DEFAULT_BACKGROUND_SETTINGS.type
  const featuredId = normalizeFeaturedBackgroundId(settings.featuredId)
  return {
    type,
    color: normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    imageName: String(settings.imageName || '').trim(),
    videoName: String(settings.videoName || '').trim(),
    url: String(settings.url || '').trim(),
    featuredId,
    maskEnabled: settings.maskEnabled === true,
    maskOverlay: normalizeBackgroundMaskPercentage(
      settings.maskOverlay,
      DEFAULT_BACKGROUND_SETTINGS.maskOverlay
    ),
    maskFilterHover: settings.maskFilterHover !== false,
    maskStyle: normalizeBackgroundMaskStyle(settings.maskStyle),
    maskBlur: normalizeBackgroundMaskBlur(settings.maskBlur, DEFAULT_BACKGROUND_SETTINGS.maskBlur),
    maskFilterStrength: normalizeBackgroundMaskPercentage(
      settings.maskFilterStrength,
      DEFAULT_BACKGROUND_SETTINGS.maskFilterStrength
    ),
    maskFilterSize: normalizeBackgroundMaskPercentage(
      settings.maskFilterSize,
      DEFAULT_BACKGROUND_SETTINGS.maskFilterSize
    ),
    maskFilterSpacing: normalizeBackgroundMaskPercentage(
      settings.maskFilterSpacing,
      DEFAULT_BACKGROUND_SETTINGS.maskFilterSpacing
    )
  }
}

function normalizeFeaturedBackgroundId(value: unknown): string {
  const id = String(value || '').trim()
  if (!id) {
    return ''
  }
  if (getStoredFeaturedBackgroundItemById(id)) {
    return id
  }
  if (!backgroundGalleryModule || !state.featuredBackgroundGalleryHydrated) {
    return id
  }
  return backgroundGalleryModule.getFeaturedBackgroundItemById(id)?.id || ''
}

function normalizeFeaturedBackgroundGallery(rawItems: unknown): FeaturedBackgroundItem[] {
  if (!Array.isArray(rawItems)) {
    return []
  }

  const items: FeaturedBackgroundItem[] = []
  const seen = new Set<string>()
  for (const rawItem of rawItems) {
    const item = normalizeFeaturedBackgroundGalleryItem(rawItem)
    if (!item || seen.has(item.id)) {
      continue
    }
    seen.add(item.id)
    items.push(item)
  }
  return items.slice(0, 72)
}

function normalizeFeaturedBackgroundGalleryItem(rawItem: unknown): FeaturedBackgroundItem | null {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return null
  }

  const item = rawItem as Record<string, unknown>
  const id = String(item.id || '').trim()
  const title = String(item.title || '').trim()
  const provider = String(item.provider || '')
  const imageUrl = normalizeBackgroundImageUrl(String(item.imageUrl || ''))
  const sourceUrl = normalizeBackgroundImageUrl(String(item.sourceUrl || ''))
  const credit = String(item.credit || '').trim()
  const license = String(item.license || '').trim()
  if (!id || !title || !imageUrl || !sourceUrl || !credit || !license ||
    !isFeaturedBackgroundProvider(provider)) {
    return null
  }

  return {
    id,
    title,
    provider,
    imageUrl,
    sourceUrl,
    credit,
    license,
    accentColor: normalizeHexColor(item.accentColor, '#050506'),
    dynamic: item.dynamic === true,
    width: normalizePositiveDimension(item.width),
    height: normalizePositiveDimension(item.height)
  }
}

function normalizeFeaturedBackgroundFavoriteIds(rawIds: unknown): string[] {
  const source = Array.isArray(rawIds) ? rawIds : []
  return [...new Set(source.flatMap(id => { const mappedResult = String(id || '').trim(); return mappedResult ? [mappedResult] : [] }))].slice(0, 72)
}

function normalizePositiveDimension(value: unknown): number | undefined {
  const dimension = Math.round(Number(value))
  return Number.isFinite(dimension) && dimension > 0 ? dimension : undefined
}

function syncBackgroundSettingsControls(): void {
  const settings = state.backgroundSettings
  updateBackgroundStartupCacheStatus(settings)

  if (settings.type === 'featured') {
    void hydrateFeaturedBackgroundOptions()
  }
  syncFeaturedBackgroundDisplayPreferenceControls()
}

function createBackgroundSettingsView() {
  const settings = state.backgroundSettings
  const featuredItem = settings.type === 'featured'
    ? getActiveFeaturedBackgroundItemSync(settings)
    : null
  if (settings.type === 'featured' && !featuredItem) {
    void hydrateFeaturedBackgroundCredit(settings)
  }

  return createNewtabBackgroundSettingsView(
    settings,
    state.featuredBackgroundPreferences,
    FEATURED_BACKGROUND_DISPLAY_LIMITS,
    {
      ready: backgroundSettingsHydrated,
      backgroundStatus: state.backgroundStatus,
      backgroundStatusTone: state.backgroundStatusTone,
      featuredCreditHref: featuredItem?.sourceUrl || 'https://images.nasa.gov/',
      featuredCreditText: featuredItem ? `${featuredItem.title} · ${featuredItem.credit}` : '正在载入精选图库',
      featuredCreditTitle: featuredItem ? `${featuredItem.license} · ${featuredItem.sourceUrl}` : '',
      featuredPickerExpanded: isFeaturedBackgroundPickerOpen(),
      featuredPickerLabel: getFeaturedBackgroundPickerLabel(settings),
      featuredPickerSelected: Boolean(settings.featuredId)
    }
  )
}

async function saveBackgroundSettings(): Promise<void> {
  syncInstantWallpaperTargetForSettings(state.backgroundSettings)
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabBackgroundSettings]: state.backgroundSettings
  })
  preloadedBackgroundSettings = state.backgroundSettings
}

async function ensureCurrentBackgroundStartupCache(
  settings = state.backgroundSettings,
  mediaSignature = getBackgroundMediaSignature(settings)
): Promise<void> {
  if (!mediaSignature || settings.type === 'color') {
    return
  }
  if (hasCurrentInstantWallpaperStartupImage(mediaSignature, settings)) {
    updateBackgroundStartupCacheStatus(settings)
    return
  }

  if (settings.type === 'image' || settings.type === 'video') {
    const mediaRecord = await getBackgroundMedia(settings.type).catch(() => null)
    if (mediaRecord?.blob) {
      await updateInstantWallpaperFromBlob(mediaRecord.blob, mediaSignature, settings)
    }
    return
  }

  if (isRemoteBackgroundType(settings.type)) {
    const imageUrl = getRemoteBackgroundImageUrl(settings)
    if (!imageUrl) {
      return
    }
    await ensureBackgroundImageFetchPermission(imageUrl)
    await cacheBackgroundUrlImage(imageUrl, mediaSignature, settings)
  }
}

function scheduleCurrentBackgroundStartupCache(
  settings = state.backgroundSettings,
  { delay = BACKGROUND_STARTUP_CACHE_IDLE_DELAY_MS }: { delay?: number } = {}
): void {
  window.clearTimeout(backgroundStartupCacheTimer)
  backgroundStartupCacheTimer = 0
  const requestId = ++backgroundStartupCacheRequestId
  if (!getBackgroundMediaSignature(settings) || settings.type === 'color') {
    return
  }
  if (hasCurrentInstantWallpaperStartupImage(getBackgroundMediaSignature(settings), settings)) {
    updateBackgroundStartupCacheStatus(settings)
    return
  }

  backgroundStartupCacheTimer = window.setTimeout(() => {
    backgroundStartupCacheTimer = 0
    runIdle(() => {
      if (requestId !== backgroundStartupCacheRequestId) {
        return
      }
      void ensureCurrentBackgroundStartupCache(settings)
    }, { timeout: 6000 })
  }, Math.max(0, delay))
}

function migrateStoredFeaturedBackgroundId(gallery = backgroundGalleryModule): void {
  if (!gallery || state.backgroundSettings.type !== 'featured' || !state.backgroundSettings.featuredId) {
    return
  }

  if (gallery.getFeaturedBackgroundItemById(state.backgroundSettings.featuredId)) {
    return
  }
  if (getStoredFeaturedBackgroundItemById(state.backgroundSettings.featuredId) || !state.featuredBackgroundGalleryHydrated) {
    return
  }

  const previousSettings = state.backgroundSettings
  const nextSettings = normalizeBackgroundSettings({
    ...state.backgroundSettings,
    featuredId: ''
  })
  state.backgroundSettings = nextSettings
  backgroundSettingsMutationVersion += 1
  preloadedBackgroundSettings = nextSettings
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(nextSettings))
  syncInstantWallpaperTargetForSettings(nextSettings)
  syncBackgroundSettingsControls()
  scheduleFeaturedBackgroundDailyRefresh()
  void saveBackgroundSettings().catch((error) => {
    console.warn('精选图库旧配置迁移失败。', error)
  })
  void applyBackgroundSettingsAfterCacheUpdate(shouldClearBackgroundUrlCache(previousSettings, nextSettings))
}

function shouldClearBackgroundUrlCache(
  previousSettings: typeof DEFAULT_BACKGROUND_SETTINGS,
  nextSettings: typeof DEFAULT_BACKGROUND_SETTINGS
): boolean {
  void previousSettings
  void nextSettings
  return false
}

function getBackgroundMediaSignature(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  const featuredItem = settings.type === 'featured'
    ? getActiveFeaturedBackgroundItemSync(settings)
    : null
  const signatureParts = [
    settings.type,
    normalizeHexColor(settings.color, DEFAULT_BACKGROUND_SETTINGS.color),
    settings.imageName,
    settings.videoName,
    normalizeBackgroundImageUrl(settings.url),
    settings.type === 'featured' ? settings.featuredId : '',
    settings.type === 'featured' && !settings.featuredId ? getFeaturedBackgroundDateSeed() : '',
    settings.type === 'featured' ? featuredItem?.id || 'pending-featured' : ''
  ]
  if (settings.type === 'featured' && !featuredItem) {
    const reusableSignature = getReusableFeaturedBackgroundSignature(`${signatureParts.slice(0, -1).join('|')}|`)
    if (reusableSignature) {
      return reusableSignature
    }
  }
  return signatureParts.join('|')
}

function getReusableFeaturedBackgroundSignature(signaturePrefix: string): string {
  const targetSignature = readInstantWallpaperTarget()?.signature || ''
  if (isConcreteFeaturedBackgroundSignature(targetSignature, signaturePrefix)) {
    return targetSignature
  }
  const instantSignature = readInstantWallpaper()?.signature || ''
  if (isConcreteFeaturedBackgroundSignature(instantSignature, signaturePrefix)) {
    return instantSignature
  }
  return ''
}

function isConcreteFeaturedBackgroundSignature(signature: string, signaturePrefix: string): boolean {
  return Boolean(
    signature &&
    signature.startsWith(signaturePrefix) &&
    !signature.endsWith('|pending-featured')
  )
}

function setBackgroundStatus(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  state.backgroundStatus = message
  state.backgroundStatusTone = tone
}

function getBackgroundMediaSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/quota|storage|空间|容量/i.test(message)) {
    return '保存失败：浏览器本地存储空间可能不足，请换用更小文件或清理空间后重试。'
  }
  return '保存失败：请确认文件可读取，或换用更小的图片/视频后重试。'
}

function updateBackgroundStartupCacheStatus(settings = state.backgroundSettings): void {
  const mediaKey = getBackgroundMediaSignature(settings)
  const cacheRequired = settings.type !== 'color'
  const cacheReady = !cacheRequired || hasCurrentInstantWallpaperStartupImage(mediaKey, settings)

  if (!cacheRequired) {
    state.backgroundUrlCacheStatus = ''
    return
  }

  state.backgroundUrlCacheStatus = cacheReady
    ? '首屏缓存已准备'
    : '首屏缓存准备中...'
}

function hasAppliedBackgroundMedia(settings: typeof DEFAULT_BACKGROUND_SETTINGS): boolean {
  const media = getNewtabBackgroundMediaView()
  if (settings.type === 'color') {
    return true
  }
  if (settings.type === 'video') {
    return media.kind === 'video' && Boolean(media.src)
  }
  if (settings.type === 'image' || settings.type === 'urls' || settings.type === 'featured') {
    return media.kind === 'image' && Boolean(media.src)
  }
  return true
}

function setWallpaperPlaceholderColor(color = getBackgroundPlaceholderColor(state.backgroundSettings)): void {
  const normalizedColor = normalizeInstantWallpaperColor(color)
  dispatchNewtabInstantWallpaperView({
    backgroundColor: normalizedColor,
    placeholderColor: normalizedColor
  })
}

function getBackgroundPlaceholderColor(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  const allowDarkColor = settings.type === 'color'
  if (settings.type === 'featured') {
    return getNonBlackPlaceholderColor(
      getActiveFeaturedBackgroundItemSync(settings)?.accentColor ||
      settings.color ||
      DEFAULT_FEATURED_BACKGROUND_PLACEHOLDER_COLOR
    )
  }
  const color = normalizeInstantWallpaperColor(settings.color || getInstantWallpaperFallbackColor())
  return allowDarkColor ? color : getNonBlackPlaceholderColor(color)
}

function markWallpaperReady(): void {
  dispatchNewtabInstantWallpaperView({
    booting: false,
    loading: false,
    pending: false,
    loaderVisible: false
  })
  recordNewTabBackgroundReady()
}

function markWallpaperPending(): void {
  const instantWallpaper = getNewtabInstantWallpaperView()
  dispatchNewtabInstantWallpaperView({
    loading: true,
    pending: true,
    ready: hasUsableInstantWallpaperPreview(instantWallpaper.previewImage),
    remoteReady: false
  })
}

function markRuntimeWallpaperApplied(): void {
  dispatchNewtabInstantWallpaperView({
    booting: false
  })
}

function hasUsableInstantWallpaperPreview(previewImage: string): boolean {
  const normalizedPreviewImage = String(previewImage || '').trim()
  return Boolean(normalizedPreviewImage && normalizedPreviewImage !== 'none')
}

function markInstantWallpaperRemoteReady(mediaKey = lastAppliedBackgroundMediaSignature): void {
  if (!mediaKey) {
    return
  }
  const instantWallpaper = getNewtabInstantWallpaperView()
  const wallpaperKey = instantWallpaper.signature
  if (wallpaperKey && wallpaperKey !== mediaKey) {
    return
  }
  dispatchNewtabInstantWallpaperView({
    remoteReady: true
  })
}

function getCurrentInstantWallpaper(mediaKey: string): ReturnType<typeof readInstantWallpaper> {
  const instantWallpaper = readInstantWallpaper()
  const wallpaperKey = instantWallpaper?.signature || ''
  return (
    mediaKey &&
    wallpaperKey === mediaKey &&
    instantWallpaper.ready !== false
  ) ? instantWallpaper : null
}

function hasCurrentInstantWallpaperStartupImage(
  mediaKey: string,
  settings = state.backgroundSettings
): boolean {
  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return false
  }
  if (readInstantWallpaperImageDataUrl(instantWallpaper) || readInstantWallpaperDataUrl(instantWallpaper)) {
    return true
  }
  return isRemoteBackgroundType(settings.type) && Boolean(getRemoteBackgroundImageUrl(settings))
}

function ensureInstantWallpaperFallbackStyles(mediaKey: string): boolean {
  const instantWallpaperView = getNewtabInstantWallpaperView()
  const wallpaperKey = instantWallpaperView.signature
  if (
    instantWallpaperView.remoteReady &&
    wallpaperKey === mediaKey
  ) {
    dispatchNewtabInstantWallpaperView({
      pending: false,
      ready: true
    })
    return true
  }

  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return false
  }
  const imageDataUrl = readInstantWallpaperImageDataUrl(instantWallpaper)
  const dataUrl = imageDataUrl || readInstantWallpaperDataUrl(instantWallpaper)
  if (!dataUrl) {
    return false
  }

  const placeholderColor = normalizeInstantWallpaperColor(
    instantWallpaper.placeholderColor || getBackgroundPlaceholderColor(state.backgroundSettings)
  )
  dispatchNewtabInstantWallpaperView({
    backgroundColor: placeholderColor,
    image: imageDataUrl ? `url("${escapeCssUrl(imageDataUrl)}")` : '',
    pending: false,
    placeholderColor,
    position: instantWallpaper.backgroundPosition || 'center',
    previewImage: `url("${escapeCssUrl(dataUrl)}")`,
    ready: true,
    remoteReady: false,
    signature: mediaKey,
    size: normalizeStoredBackgroundSizeCss(instantWallpaper.backgroundSize)
  })
  return true
}

async function applyBackgroundSettings(): Promise<void> {
  const applyToken = ++backgroundApplyToken
  const settings = state.backgroundSettings
  if (settings.type === 'featured' && !backgroundGalleryModule && !getActiveFeaturedBackgroundItemSync(settings)) {
    const mediaKey = getBackgroundMediaSignature(settings)
    setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))
    syncInstantWallpaperTargetForSettings(settings, mediaKey)
    ensureInstantWallpaperFallbackStyles(mediaKey)
    markWallpaperReady()
    void loadBackgroundGalleryModule()
      .then(() => {
        if (applyToken === backgroundApplyToken && state.backgroundSettings.type === 'featured') {
          void applyBackgroundSettings()
        }
      })
      .catch(() => {})
    return
  }
  const mediaKey = getBackgroundMediaSignature(settings)
  const appliedMediaKey = lastAppliedBackgroundMediaSignature
  applyFeaturedBackgroundDisplayPreferences()
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))

  if (
    mediaKey === appliedMediaKey &&
    hasAppliedBackgroundMedia(settings)
  ) {
    if (settings.type === 'video' || getNewtabInstantWallpaperView().remoteReady) {
      markInstantWallpaperRemoteReady(mediaKey)
    }
    markWallpaperReady()
    return
  }

  if (settings.type === 'color') {
    clearBackgroundMedia()
    setActiveBackgroundObjectUrl('')
    activeBackgroundImageNaturalSize = null
    activeBackgroundImageNaturalSizeSignature = ''
    markRuntimeWallpaperApplied()
    clearInstantWallpaperIfSignatureChanged('')
    syncInstantWallpaperTargetForSettings(settings, mediaKey)
    setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))
    lastAppliedBackgroundMediaSignature = mediaKey
    markWallpaperReady()
    return
  }

  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(settings))

  if (isRemoteBackgroundType(settings.type)) {
    const imageUrl = getRemoteBackgroundImageUrl(settings)
    if (imageUrl) {
      syncInstantWallpaperTargetForSettings(settings, mediaKey)
      clearBackgroundMedia()
      setActiveBackgroundObjectUrl('')
      activeBackgroundImageNaturalSize = getStoredBackgroundNaturalSizeForSettings(settings)
      activeBackgroundImageNaturalSizeSignature = activeBackgroundImageNaturalSize ? mediaKey : ''
      const hasInstantWallpaperFallback = ensureInstantWallpaperFallbackStyles(mediaKey)
      if (!hasInstantWallpaperFallback) {
        markWallpaperPending()
      }
      applyDirectRemoteBackgroundImage(imageUrl, mediaKey, {
        revealWhenReady: !hasInstantWallpaperFallback
      })
      if (hasInstantWallpaperFallback) {
        markWallpaperReady()
      }
      void applyUrlBackgroundImage(imageUrl, applyToken, mediaKey, settings)
    } else {
      clearBackgroundMedia()
      setActiveBackgroundObjectUrl('')
      activeBackgroundImageNaturalSize = null
      activeBackgroundImageNaturalSizeSignature = ''
      markRuntimeWallpaperApplied()
      clearInstantWallpaperIfSignatureChanged('')
      syncInstantWallpaperTargetForSettings(settings, mediaKey)
      lastAppliedBackgroundMediaSignature = mediaKey
      markWallpaperReady()
    }
    return
  }

  if (settings.type !== 'image' && settings.type !== 'video') {
    lastAppliedBackgroundMediaSignature = mediaKey
    markWallpaperReady()
    return
  }

  clearBackgroundMedia()
  setActiveBackgroundObjectUrl('')
  activeBackgroundImageNaturalSize = null
  activeBackgroundImageNaturalSizeSignature = ''
  clearInstantWallpaperIfSignatureChanged(mediaKey)
  syncInstantWallpaperTargetForSettings(settings, mediaKey)
  if (ensureInstantWallpaperFallbackStyles(mediaKey)) {
    markWallpaperReady()
  } else {
    markWallpaperPending()
  }

  const mediaType = settings.type
  let mediaRecord: Awaited<ReturnType<typeof getBackgroundMedia>>
  try {
    mediaRecord = await getBackgroundMedia(mediaType)
  } catch {
    if (applyToken === backgroundApplyToken) {
      markWallpaperReady()
    }
    return
  }
  if (applyToken !== backgroundApplyToken || !mediaRecord) {
    if (applyToken === backgroundApplyToken) {
      markWallpaperReady()
    }
    return
  }

  const objectUrl = URL.createObjectURL(mediaRecord.blob)
  setActiveBackgroundObjectUrl(objectUrl)
  if (mediaType === 'image') {
    if (applyToken !== backgroundApplyToken) {
      return
    }
    const readyImage = await waitForBackgroundImageReady(objectUrl, applyToken)
    if (readyImage) {
      setBackgroundImageMedia(objectUrl)
      markRuntimeWallpaperApplied()
      lastAppliedBackgroundMediaSignature = mediaKey
      void updateInstantWallpaperFromBlob(mediaRecord.blob, mediaKey)
    } else {
      setActiveBackgroundObjectUrl('')
    }
    markWallpaperReady()
    return
  }
  if (applyToken !== backgroundApplyToken) {
    return
  }

  const ready = await waitForBackgroundVideoSourceReady(objectUrl)
  if (ready) {
    setBackgroundVideoMedia(objectUrl, mediaKey)
    markRuntimeWallpaperApplied()
    lastAppliedBackgroundMediaSignature = mediaKey
    void updateInstantWallpaperFromBlob(mediaRecord.blob, mediaKey)
  } else {
    setActiveBackgroundObjectUrl('')
  }
  markWallpaperReady()
}

function waitForBackgroundImageReady(
  imageUrl: string,
  applyToken: number,
  timeoutMs = BACKGROUND_IMAGE_READY_TIMEOUT_MS
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timeout = 0

    const settle = (readyImage: HTMLImageElement | null) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(applyToken === backgroundApplyToken ? readyImage : null)
    }

    timeout = window.setTimeout(() => {
      settle(null)
    }, timeoutMs)
    image.onload = () => {
      settle(image)
    }
    image.onerror = () => {
      settle(null)
    }
    image.src = imageUrl
  })
}

async function applyUrlBackgroundImage(
  imageUrl: string,
  applyToken: number,
  mediaSignature: string,
  settings = state.backgroundSettings
): Promise<void> {
  try {
    if (applyToken !== backgroundApplyToken) {
      return
    }
    const cachedRecord = await getBackgroundUrlCache(imageUrl)

    if (cachedRecord) {
      if (applyToken !== backgroundApplyToken) {
        return
      }
      const ready = await setBackgroundImageFromBlob(cachedRecord.blob, applyToken, {
        preserveCurrentUntilReady: true
      }, mediaSignature)
      if (ready) {
        lastAppliedBackgroundMediaSignature = mediaSignature
        await updateInstantWallpaperFromBlob(cachedRecord.blob, mediaSignature, settings)
      }
      markWallpaperReady()
      return
    }

    void cacheBackgroundUrlImage(imageUrl, mediaSignature, settings)
  } catch {
    if (applyToken === backgroundApplyToken) {
      applyDirectRemoteBackgroundImage(imageUrl, mediaSignature)
      markWallpaperReady()
      void cacheBackgroundUrlImage(imageUrl, mediaSignature, settings)
    }
  }
}

function applyDirectRemoteBackgroundImage(
  imageUrl: string,
  mediaKey: string,
  {
    markApplied = true,
    revealWhenReady = false
  }: {
    markApplied?: boolean
    revealWhenReady?: boolean
  } = {}
): void {
  const applyToken = backgroundApplyToken
  clearBackgroundMedia()
  setActiveBackgroundObjectUrl('')
  applyFeaturedBackgroundDisplayPreferences()
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, mediaKey)
  setBackgroundImageMedia(imageUrl)
  markRuntimeWallpaperApplied()
  if (markApplied) {
    lastAppliedBackgroundMediaSignature = mediaKey
    void waitForBackgroundImageReady(imageUrl, applyToken).then((readyImage) => {
      const appliedMediaKey = lastAppliedBackgroundMediaSignature
      if (applyToken !== backgroundApplyToken || mediaKey !== appliedMediaKey) {
        return
      }
      if (readyImage) {
        setActiveBackgroundImageNaturalSize(imageUrl, readyImage, mediaKey)
        applyFeaturedBackgroundDisplayPreferences()
      }
      if (revealWhenReady) {
        markWallpaperReady()
      }
    })
  }
}

async function cacheBackgroundUrlImage(
  imageUrl: string,
  mediaSignature = '',
  settings = state.backgroundSettings,
  options: { applyToCurrentPage?: boolean; applyToken?: number } = {}
): Promise<void> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return
  }

  const applyToken = options.applyToken ?? backgroundApplyToken
  const shouldApplyToCurrentPage = options.applyToCurrentPage === true && Boolean(mediaSignature)
  const cachedRecord = await getBackgroundUrlCache(normalizedUrl)
  if (cachedRecord) {
    if (mediaSignature) {
      await updateInstantWallpaperFromBlob(cachedRecord.blob, mediaSignature, settings)
    }
    if (shouldApplyToCurrentPage) {
      await applyCachedRemoteBackgroundBlobToCurrentPage(cachedRecord.blob, mediaSignature, applyToken)
    }
    state.backgroundUrlCacheStatus = `已缓存 ${formatBytes(cachedRecord.blob.size)}`
    updateBackgroundStartupCacheStatus(settings)
    syncBackgroundSettingsControls()
    return
  }

  const permissionGranted = await ensureBackgroundImageFetchPermission(normalizedUrl)
  if (!permissionGranted) {
    state.backgroundUrlCacheStatus = '未授权该图片域名，首屏缓存可能无法准备。'
    updateBackgroundStartupCacheStatus(settings)
    syncBackgroundSettingsControls()
    return
  }

  let cacheTask = backgroundUrlCacheTaskByUrl.get(normalizedUrl)
  if (!cacheTask) {
    cacheTask = createBackgroundUrlCacheTask(normalizedUrl, settings)
    backgroundUrlCacheTaskByUrl.set(normalizedUrl, cacheTask)
    state.backgroundUrlCachePendingUrls.add(normalizedUrl)
    state.backgroundUrlCacheBusy = state.backgroundUrlCachePendingUrls.size > 0
    state.backgroundUrlCacheStatus = '下载中...'
  }

  try {
    const startupBlob = await cacheTask.startupBlob
    if (mediaSignature) {
      await updateInstantWallpaperFromBlob(startupBlob, mediaSignature, settings)
    }
    if (shouldApplyToCurrentPage) {
      await applyCachedRemoteBackgroundBlobToCurrentPage(startupBlob, mediaSignature, applyToken)
    }

    state.backgroundUrlCacheStatus = mediaSignature ? '首屏缓存已准备' : `已缓存 ${formatBytes(startupBlob.size)}`
    updateBackgroundStartupCacheStatus(settings)
    syncBackgroundSettingsControls()

    const durableBlob = await cacheTask.durableBlob.catch(() => startupBlob)
    if (mediaSignature) {
      await updateInstantWallpaperFromBlob(durableBlob, mediaSignature, settings)
    }
    if (shouldApplyToCurrentPage && durableBlob !== startupBlob) {
      await applyCachedRemoteBackgroundBlobToCurrentPage(durableBlob, mediaSignature, applyToken)
    }
    state.backgroundUrlCacheStatus = `已缓存 ${formatBytes(durableBlob.size)}`
    syncBackgroundSettingsControls()
  } catch (error) {
    state.backgroundUrlCacheStatus = '首屏缓存准备失败'
    syncBackgroundSettingsControls()
    console.warn('新标签页背景首屏缓存准备失败。', error)
  } finally {
    if (backgroundUrlCacheTaskByUrl.get(normalizedUrl) === cacheTask) {
      backgroundUrlCacheTaskByUrl.delete(normalizedUrl)
      state.backgroundUrlCachePendingUrls.delete(normalizedUrl)
      state.backgroundUrlCacheBusy = state.backgroundUrlCachePendingUrls.size > 0
    }
  }
}

function createBackgroundUrlCacheTask(
  imageUrl: string,
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundUrlCacheTask {
  const startupPreviewUrl = getStartupPreviewImageUrl(settings, imageUrl)
  const startupBlob = fetchStartupBackgroundUrlImage(startupPreviewUrl, imageUrl)
  const durableBlob = startupBlob.then(async (blob) => {
    let durable = blob
    if (startupPreviewUrl && startupPreviewUrl !== imageUrl) {
      try {
        durable = await fetchBackgroundUrlImage(imageUrl)
      } catch {
        durable = blob
      }
    }
    try {
      await saveBackgroundUrlCache(imageUrl, durable)
    } catch {
      // The visible wallpaper and instant startup cache are more important than the durable cache.
    }
    return durable
  })
  durableBlob.catch(() => {})

  return {
    startupBlob,
    durableBlob
  }
}

async function fetchStartupBackgroundUrlImage(previewUrl: string, imageUrl: string): Promise<Blob> {
  const normalizedPreviewUrl = normalizeBackgroundImageUrl(previewUrl)
  if (!normalizedPreviewUrl || normalizedPreviewUrl === imageUrl) {
    return fetchBackgroundUrlImage(imageUrl)
  }

  try {
    await ensureBackgroundImageFetchPermission(normalizedPreviewUrl)
    return await fetchBackgroundUrlImage(normalizedPreviewUrl)
  } catch {
    return fetchBackgroundUrlImage(imageUrl)
  }
}

async function applyCachedRemoteBackgroundBlobToCurrentPage(
  blob: Blob,
  mediaKey: string,
  applyToken: number
): Promise<boolean> {
  const currentMediaKey = getBackgroundMediaSignature(state.backgroundSettings)
  if (
    applyToken !== backgroundApplyToken ||
    !mediaKey ||
    mediaKey !== currentMediaKey
  ) {
    return false
  }

  const ready = await setBackgroundImageFromBlob(blob, applyToken, {
    preserveCurrentUntilReady: true
  }, mediaKey)
  const nextMediaKey = getBackgroundMediaSignature(state.backgroundSettings)
  if (
    !ready ||
    applyToken !== backgroundApplyToken ||
    mediaKey !== nextMediaKey
  ) {
    return false
  }

  lastAppliedBackgroundMediaSignature = mediaKey
  markWallpaperReady()
  return true
}

async function warmFeaturedBackgroundPickerPreviewObjectUrls(gallery: BackgroundGalleryModule): Promise<void> {
  const urls = getFeaturedBackgroundPickerPreviewUrls(gallery)
  const previewKey = urls.join('|')
  if (!previewKey) {
    return
  }
  const activePreviewKey = featuredBackgroundGalleryPreviewObjectUrlWarmSignature
  if (
    featuredBackgroundGalleryPreviewObjectUrlWarmTask &&
    activePreviewKey === previewKey
  ) {
    return featuredBackgroundGalleryPreviewObjectUrlWarmTask
  }

  featuredBackgroundGalleryPreviewObjectUrlWarmSignature = previewKey
  featuredBackgroundGalleryPreviewObjectUrlWarmTask = warmFeaturedBackgroundPreviewObjectUrls(urls).finally(() => {
    const activePreviewKey = featuredBackgroundGalleryPreviewObjectUrlWarmSignature
    if (activePreviewKey === previewKey) {
      featuredBackgroundGalleryPreviewObjectUrlWarmTask = null
    }
  })
  return featuredBackgroundGalleryPreviewObjectUrlWarmTask
}

async function warmFeaturedBackgroundPreviewObjectUrls(urls: string[]): Promise<void> {
  const runWorker = async (workerIndex: number, index = workerIndex): Promise<void> => {
    if (index >= urls.length) {
      return
    }
    await createFeaturedBackgroundPreviewObjectUrl(urls[index])
    await runWorker(workerIndex, index + FEATURED_BACKGROUND_PREVIEW_OBJECT_URL_WARM_CONCURRENCY)
  }
  const workers = Array.from(
    { length: Math.min(FEATURED_BACKGROUND_PREVIEW_OBJECT_URL_WARM_CONCURRENCY, urls.length) },
    (_, workerIndex) => runWorker(workerIndex)
  )
  await Promise.all(workers)
}

async function ensureBackgroundImageFetchPermission(
  imageUrl: string,
  { request = false }: { request?: boolean } = {}
): Promise<boolean> {
  const originPattern = getBackgroundImageOriginPattern(imageUrl)
  if (!originPattern || !chrome.permissions?.contains) {
    return true
  }
  const query = { origins: [originPattern] }
  if (await containsChromePermissions(query)) {
    return true
  }
  if (!request || !chrome.permissions?.request) {
    return false
  }
  return requestChromePermissions(query)
}

function getBackgroundImageOriginPattern(imageUrl: string): string {
  try {
    const url = new URL(imageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return ''
    }
    return `${url.protocol}//${url.host}/*`
  } catch {
    return ''
  }
}

function getFeaturedBackgroundPickerPreviewUrls(gallery: BackgroundGalleryModule): string[] {
  const urls = new Set<string>()

  for (const item of getFeaturedBackgroundPickerItems(gallery)) {
    const previewUrl = getFeaturedBackgroundPreviewSourceUrl(item.provider, item.imageUrl)
    if (previewUrl) {
      urls.add(previewUrl)
    }
  }
  return [...urls]
}

async function setBackgroundImageFromBlob(
  blob: Blob,
  applyToken = backgroundApplyToken,
  { preserveCurrentUntilReady = false }: { preserveCurrentUntilReady?: boolean } = {},
  mediaSignature = ''
): Promise<boolean> {
  const objectUrl = URL.createObjectURL(blob)
  if (!preserveCurrentUntilReady) {
    setActiveBackgroundObjectUrl(objectUrl)
  }
  const readyImage = await waitForBackgroundImageReady(objectUrl, applyToken)
  const backgroundApplyStillCurrent = applyToken === backgroundApplyToken
  if (!backgroundApplyStillCurrent) {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    }
    return false
  }
  if (readyImage) {
    if (preserveCurrentUntilReady) {
      setActiveBackgroundObjectUrl(objectUrl)
    }
    setActiveBackgroundImageNaturalSize(objectUrl, readyImage, mediaSignature)
    applyFeaturedBackgroundDisplayPreferences()
    setBackgroundImageMedia(objectUrl)
    markRuntimeWallpaperApplied()
  } else {
    if (preserveCurrentUntilReady) {
      URL.revokeObjectURL(objectUrl)
    } else {
      setActiveBackgroundObjectUrl('')
    }
  }
  return Boolean(readyImage)
}

async function updateInstantWallpaperFromBlob(
  blob: Blob,
  mediaSignature: string,
  settings = state.backgroundSettings
): Promise<void> {
  if (!mediaSignature) {
    return
  }

  const displayCss = getBackgroundDisplayCssForSettings(settings)
  const recordBase = {
    signature: mediaSignature,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    placeholderColor: getBackgroundPlaceholderColor(settings),
    updatedAt: Date.now(),
    ready: true
  }

  const isVideoWallpaper = settings.type === 'video' || String(blob.type || '').toLowerCase().startsWith('video/')
  const [dataUrl, imageDataUrl] = isVideoWallpaper
    ? ['', await createInstantWallpaperVideoPosterDataUrl(blob, { force: true })]
    : await Promise.all([
        createFirstInstantWallpaperDataUrl(blob),
        createInstantWallpaperImageDataUrl(blob)
      ])
  const previewDataUrl = dataUrl || imageDataUrl
  if ((previewDataUrl || imageDataUrl) && saveInstantWallpaper({
    ...recordBase,
    dataUrl: previewDataUrl || undefined,
    imageDataUrl: imageDataUrl || undefined
  })) {
    syncInstantWallpaperTargetForSettings(settings, mediaSignature)
    updateBackgroundStartupCacheStatus(settings)
    return
  }

  syncInstantWallpaperTargetForSettings(settings, mediaSignature)
  updateBackgroundStartupCacheStatus(settings)
}

async function createFirstInstantWallpaperDataUrl(blob: Blob, attemptIndex = 0): Promise<string | null> {
  const attempt = INSTANT_WALLPAPER_STARTUP_CACHE_ATTEMPTS[attemptIndex]
  if (!attempt) {
    return null
  }
  const dataUrl = await createInstantWallpaperDataUrl(blob, attempt)
  return dataUrl || createFirstInstantWallpaperDataUrl(blob, attemptIndex + 1)
}

function syncInstantWallpaperTargetForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaSignature = getBackgroundMediaSignature(settings)
): void {
  // Mirror the mask independently of the wallpaper target so the boot script can
  // paint it on the first frame for every background type, solid colors included.
  saveBackgroundMaskSnapshot({
    maskEnabled: settings.maskEnabled,
    maskStyle: settings.maskStyle,
    maskOverlay: settings.maskOverlay,
    maskBlur: settings.maskBlur
  })
  const target = buildInstantWallpaperTargetForSettings(settings, mediaSignature)
  if (!target) {
    clearInstantWallpaperTarget()
    clearInstantWallpaperIfSignatureChanged('')
    return
  }

  const existingTarget = readInstantWallpaperTarget()
  saveInstantWallpaperTarget(target)
  const existingTargetKey = existingTarget?.signature
  const nextTargetKey = target.signature
  if (existingTargetKey && existingTargetKey !== nextTargetKey) {
    clearInstantWallpaperFallbackStyles()
  }
  clearInstantWallpaperIfSignatureChanged(nextTargetKey)
}

function buildInstantWallpaperTargetForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaKey = getBackgroundMediaSignature(settings)
): InstantWallpaperTargetRecord | null {
  if (!mediaKey) {
    return null
  }

  const displayCss = getBackgroundDisplayCssForSettings(settings)
  const instantWallpaper = readInstantWallpaper()
  const existingTarget = readInstantWallpaperTarget()
  const existingTargetKey = existingTarget?.signature
  const existingTargetMatches = existingTargetKey === mediaKey
  const resolvedImageUrl = isRemoteBackgroundType(settings.type) ? getRemoteBackgroundImageUrl(settings) : ''
  const imageUrl = resolvedImageUrl || (existingTargetMatches ? existingTarget.imageUrl : '')
  const imageDataUrlRef = instantWallpaper?.imageDataUrlRef ||
    (existingTargetMatches ? existingTarget.imageDataUrlRef : '') ||
    ''
  const previewUrl = getStartupPreviewImageUrl(settings, imageUrl) ||
    (existingTargetMatches ? existingTarget.previewUrl : '')
  return {
    signature: mediaKey,
    imageUrl,
    imageDataUrlRef,
    previewUrl,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    placeholderColor: getBackgroundPlaceholderColor(settings),
    maskEnabled: settings.maskEnabled,
    maskStyle: settings.maskStyle,
    maskOverlay: settings.maskOverlay,
    maskBlur: settings.maskBlur,
    cacheRequired: settings.type !== 'color',
    cacheReady: hasCurrentInstantWallpaperStartupImage(mediaKey, settings),
    updatedAt: Date.now()
  }
}

function getStartupPreviewImageUrl(settings: typeof DEFAULT_BACKGROUND_SETTINGS, imageUrl = getRemoteBackgroundImageUrl(settings)): string {
  if (settings.type !== 'featured') {
    return ''
  }

  const item = getActiveFeaturedBackgroundItemSync(settings)
  if (!item) {
    return ''
  }
  return getFeaturedBackgroundPreviewImageUrl(item, imageUrl)
}

function getFeaturedBackgroundPreviewImageUrl(
  item: Pick<FeaturedBackgroundItem, 'provider'>,
  imageUrl: string
): string {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  try {
    const url = new URL(normalizedUrl)
    if (item.provider === 'met' && url.hostname === 'images.metmuseum.org') {
      url.pathname = url.pathname.replace('/original/', '/web-large/')
      return url.href
    }
    if (item.provider === 'nasa' && url.hostname === 'images-assets.nasa.gov') {
      url.pathname = url.pathname.replace(/~(?:orig|large|medium|small)(\.[a-z0-9]+)$/i, '~large$1')
      return url.href
    }
    if (item.provider === 'wikimedia' && url.hostname === 'upload.wikimedia.org') {
      const pathParts = url.pathname.split('/')
      const filename = pathParts[pathParts.length - 1] || ''
      const resizedFilename = filename.replace(/^\d+px-/, '960px-')
      if (resizedFilename !== filename) {
        pathParts[pathParts.length - 1] = resizedFilename
        url.pathname = pathParts.join('/')
        return url.href
      }
      const commonsIndex = pathParts.findIndex((part) => part === 'commons')
      if (commonsIndex >= 0 && pathParts[commonsIndex + 1] !== 'thumb' && filename) {
        pathParts.splice(commonsIndex + 1, 0, 'thumb')
        pathParts.push(`960px-${filename}`)
        url.pathname = pathParts.join('/')
        return url.href
      }
    }
    if (item.provider === 'cleveland' && url.hostname === 'openaccess-cdn.clevelandart.org') {
      url.pathname = url.pathname.replace(/_print\.jpg$/i, '_web.jpg')
      return url.href
    }
  } catch {
    return ''
  }

  return ''
}

function getBackgroundDisplayCssForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundDisplayCss {
  if (settings.type === 'featured') {
    return getFeaturedBackgroundDisplayCss(
      state.featuredBackgroundPreferences,
      getFeaturedBackgroundDisplayImageSize(settings, getBackgroundMediaSignature(settings))
    )
  }
  return {
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
}

function normalizeStoredBackgroundSizeCss(value: unknown): string {
  const backgroundSize = String(value || '').trim()
  return /^\d+(?:\.\d+)?%\s+auto$/i.test(backgroundSize)
    ? 'cover'
    : backgroundSize || 'cover'
}

function clearInstantWallpaperIfSignatureChanged(mediaKey: string): void {
  const instantWallpaper = readInstantWallpaper()
  const instantWallpaperKey = instantWallpaper?.signature
  if (instantWallpaper && instantWallpaperKey !== mediaKey) {
    clearInstantWallpaper()
    clearInstantWallpaperFallbackStyles()
  }
}

function clearInstantWallpaperFallbackStyles(): void {
  dispatchNewtabInstantWallpaperView({
    image: '',
    pending: false,
    position: 'center',
    previewImage: '',
    ready: false,
    remoteReady: false,
    signature: '',
    size: 'cover'
  })
}

function getNonBlackPlaceholderColor(value: unknown): string {
  const color = normalizeInstantWallpaperColor(value)
  const parsed = parseHexColor(color)
  if (!parsed) {
    return getInstantWallpaperFallbackColor()
  }
  const luminance = (0.2126 * parsed.red + 0.7152 * parsed.green + 0.0722 * parsed.blue) / 255
  return luminance < 0.035 ? getInstantWallpaperFallbackColor() : color
}

function parseHexColor(value: string): { red: number; green: number; blue: number } | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value)
  if (!match) {
    return null
  }
  const raw = match[1]
  return {
    red: Number.parseInt(raw.slice(0, 2), 16),
    green: Number.parseInt(raw.slice(2, 4), 16),
    blue: Number.parseInt(raw.slice(4, 6), 16)
  }
}

function clearBackgroundMedia(): void {
  dispatchNewtabBackgroundMediaView({ kind: 'none', poster: '', src: '' })
}

function setBackgroundImageMedia(src: string): void {
  const displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
  dispatchNewtabBackgroundMediaView({
    backgroundPosition: displayCss.backgroundPosition,
    backgroundSize: displayCss.backgroundSize,
    kind: 'image',
    poster: '',
    src
  })
}

function setBackgroundVideoMedia(src: string, mediaKey: string): void {
  dispatchNewtabBackgroundMediaView({
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    kind: 'video',
    poster: getInstantWallpaperPosterUrl(mediaKey),
    src
  })
}

function getInstantWallpaperPosterUrl(mediaKey: string): string {
  const instantWallpaper = getCurrentInstantWallpaper(mediaKey)
  if (!instantWallpaper) {
    return ''
  }
  return readInstantWallpaperImageDataUrl(instantWallpaper) || readInstantWallpaperDataUrl(instantWallpaper)
}

function setActiveBackgroundObjectUrl(nextUrl: string): void {
  if (activeBackgroundObjectUrl && activeBackgroundObjectUrl !== nextUrl) {
    URL.revokeObjectURL(activeBackgroundObjectUrl)
  }
  activeBackgroundObjectUrl = nextUrl
}

function setActiveBackgroundImageNaturalSize(
  imageUrl: string,
  image: HTMLImageElement,
  mediaSignature = lastAppliedBackgroundMediaSignature
): void {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) {
    return
  }
  const naturalSize = { width, height }
  activeBackgroundImageNaturalSize = naturalSize
  activeBackgroundImageNaturalSizeSignature = mediaSignature
  if (imageUrl) {
    backgroundImageNaturalSizeByUrl.set(imageUrl, naturalSize)
  }
}

function getStoredBackgroundNaturalSizeForSettings(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS
): BackgroundImageNaturalSize | null {
  const imageUrl = isRemoteBackgroundType(settings.type) ? getRemoteBackgroundImageUrl(settings) : ''
  return imageUrl ? backgroundImageNaturalSizeByUrl.get(imageUrl) || null : null
}

function getFeaturedBackgroundDisplayImageSize(
  settings: typeof DEFAULT_BACKGROUND_SETTINGS,
  mediaKey = getBackgroundMediaSignature(settings)
): BackgroundImageNaturalSize | null {
  const activeItem = getActiveFeaturedBackgroundItemSync(settings)
  if (activeItem?.width && activeItem.height) {
    return {
      width: activeItem.width,
      height: activeItem.height
    }
  }
  const activeNaturalSizeKey = activeBackgroundImageNaturalSizeSignature
  if (
    activeBackgroundImageNaturalSize &&
    activeNaturalSizeKey === mediaKey
  ) {
    return activeBackgroundImageNaturalSize
  }
  return getStoredBackgroundNaturalSizeForSettings(settings)
}

function normalizeBackgroundImageUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl) {
    return ''
  }

  const candidate = /^[a-z][a-z\d+\-.]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }
    return parsedUrl.href
  } catch {
    return ''
  }
}

function isRemoteBackgroundType(type: unknown): boolean {
  return type === 'urls' || type === 'featured'
}

function getRemoteBackgroundImageUrl(settings: typeof DEFAULT_BACKGROUND_SETTINGS): string {
  if (settings.type === 'featured') {
    const featuredItem = getActiveFeaturedBackgroundItemSync(settings)
    if (featuredItem) {
      return featuredItem.imageUrl
    }
    void loadBackgroundGalleryModule().then(() => {
      if (settings === state.backgroundSettings) {
        void applyBackgroundSettings()
      }
    }).catch(() => {})
    return ''
  }

  if (settings.type === 'urls') {
    return normalizeBackgroundImageUrl(settings.url)
  }

  return ''
}

function getActiveFeaturedBackgroundItemSync(settings = state.backgroundSettings): FeaturedBackgroundItem | null {
  const galleryItem = getStoredFeaturedBackgroundItemById(settings.featuredId)
  if (galleryItem) {
    return galleryItem
  }
  if (!backgroundGalleryModule) {
    return null
  }
  return backgroundGalleryModule.getFeaturedBackgroundItemById(settings.featuredId) ||
    backgroundGalleryModule.selectFeaturedBackgroundItem(getFeaturedBackgroundDateSeed()) ||
    backgroundGalleryModule.getDefaultFeaturedBackgroundItem()
}

async function getActiveFeaturedBackgroundItem(settings = state.backgroundSettings): Promise<FeaturedBackgroundItem> {
  const galleryItem = getStoredFeaturedBackgroundItemById(settings.featuredId)
  if (galleryItem) {
    return galleryItem
  }
  const gallery = await loadBackgroundGalleryModule()
  return gallery.getFeaturedBackgroundItemById(settings.featuredId) ||
    gallery.selectFeaturedBackgroundItem(getFeaturedBackgroundDateSeed()) ||
    gallery.getDefaultFeaturedBackgroundItem()
}

function getStoredFeaturedBackgroundItemById(id: unknown): FeaturedBackgroundItem | null {
  const normalizedId = String(id || '').trim()
  if (!normalizedId) {
    return null
  }
  const item = state.featuredBackgroundGallery.find((galleryItem) => galleryItem.id === normalizedId)
  return item && isFeaturedBackgroundProvider(item.provider) ? item : null
}

function getFeaturedBackgroundDateSeed(): string {
  return formatNewTabLocalDate(Date.now())
}

function scheduleFeaturedBackgroundDailyRefresh(): void {
  window.clearTimeout(featuredBackgroundRefreshTimer)
  featuredBackgroundRefreshTimer = 0
  if (state.backgroundSettings.type !== 'featured' || hasExplicitFeaturedBackgroundSelection(state.backgroundSettings)) {
    return
  }

  const now = new Date()
  const nextMidnight = new Date(now)
  nextMidnight.setHours(24, 0, 0, 0)
  const delay = Math.max(1000, nextMidnight.getTime() - now.getTime() + FEATURED_BACKGROUND_DAILY_REFRESH_GRACE_MS)
  featuredBackgroundRefreshTimer = window.setTimeout(() => {
    featuredBackgroundRefreshTimer = 0
    applyFeaturedBackgroundDailyRefreshIfNeeded()
  }, delay)
}

function handleNewTabVisibilityChange(visibilityState: DocumentVisibilityState): void {
  if (visibilityState !== 'visible') {
    return
  }

  void hydrateFeaturedBackgroundOptions()
  applyFeaturedBackgroundDailyRefreshIfNeeded()
}

function applyFeaturedBackgroundDailyRefreshIfNeeded(): void {
  if (state.backgroundSettings.type !== 'featured' || hasExplicitFeaturedBackgroundSelection(state.backgroundSettings)) {
    return
  }

  const nextMediaKey = getBackgroundMediaSignature(state.backgroundSettings)
  const appliedMediaKey = lastAppliedBackgroundMediaSignature
  if (nextMediaKey === appliedMediaKey) {
    scheduleFeaturedBackgroundDailyRefresh()
    return
  }

  lastAppliedBackgroundMediaSignature = ''
  setWallpaperPlaceholderColor(getBackgroundPlaceholderColor(state.backgroundSettings))
  void hydrateFeaturedBackgroundOptions(true)
  syncBackgroundSettingsControls()
  void applyBackgroundSettings()
  scheduleFeaturedBackgroundDailyRefresh()
}

function hasExplicitFeaturedBackgroundSelection(settings = state.backgroundSettings): boolean {
  const featuredId = String(settings.featuredId || '').trim()
  if (!featuredId) {
    return false
  }

  if (getStoredFeaturedBackgroundItemById(featuredId)) {
    return true
  }
  return backgroundGalleryModule
    ? Boolean(backgroundGalleryModule.getFeaturedBackgroundItemById(featuredId))
    : true
}

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function openBackgroundMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKGROUND_MEDIA_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BACKGROUND_MEDIA_STORE)) {
        db.createObjectStore(BACKGROUND_MEDIA_STORE)
      }
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error || new Error('背景媒体数据库打开失败。'))
    }
  })
}

async function saveBackgroundMedia(mediaType: 'image' | 'video', file: File): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).put({
        blob: file,
        name: file.name,
        type: file.type,
        updatedAt: Date.now()
      }, mediaType)
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景媒体保存失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景媒体保存失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function getBackgroundMedia(mediaType: 'image' | 'video'): Promise<{
  blob: Blob
  name: string
  type: string
  updatedAt: number
} | null> {
  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const request = transaction.objectStore(BACKGROUND_MEDIA_STORE).get(mediaType)
      request.onsuccess = () => {
        const record = request.result as {
          blob?: unknown
          name?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined
        if (!record?.blob || !(record.blob instanceof Blob)) {
          resolve(null)
          return
        }
        resolve({
          blob: record.blob,
          name: String(record.name || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        })
      }
      request.onerror = () => {
        reject(request.error || new Error('背景媒体读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function getBackgroundUrlCache(imageUrl: string): Promise<{
  blob: Blob
  url: string
  type: string
  updatedAt: number
} | null> {
  const db = await openBackgroundMediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readonly')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const request = store.get(getBackgroundUrlCacheKey(imageUrl))
      const resolveCacheRecord = (record: {
        blob?: unknown
        url?: unknown
        type?: unknown
        updatedAt?: unknown
      } | undefined) => {
        if (
          !record?.blob ||
          !(record.blob instanceof Blob) ||
          String(record.url || '') !== imageUrl
        ) {
          return null
        }
        return {
          blob: record.blob,
          url: String(record.url || ''),
          type: String(record.type || ''),
          updatedAt: Number(record.updatedAt) || 0
        }
      }
      request.onsuccess = () => {
        const cached = resolveCacheRecord(request.result as {
          blob?: unknown
          url?: unknown
          type?: unknown
          updatedAt?: unknown
        } | undefined)
        if (cached) {
          resolve(cached)
          return
        }

        const legacyRequest = store.get(BACKGROUND_URL_CACHE_KEY)
        legacyRequest.onsuccess = () => {
          resolve(resolveCacheRecord(legacyRequest.result as {
            blob?: unknown
            url?: unknown
            type?: unknown
            updatedAt?: unknown
          } | undefined))
        }
        legacyRequest.onerror = () => {
          resolve(null)
        }
      }
      request.onerror = () => {
        reject(request.error || new Error('背景 URL 缓存读取失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function saveBackgroundUrlCache(imageUrl: string, blob: Blob): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      transaction.objectStore(BACKGROUND_MEDIA_STORE).put({
        blob,
        url: imageUrl,
        type: blob.type,
        updatedAt: Date.now()
      }, getBackgroundUrlCacheKey(imageUrl))
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景 URL 缓存保存失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景 URL 缓存保存失败。'))
      }
    })
  } finally {
    db.close()
  }
}

async function clearBackgroundUrlCache(): Promise<void> {
  const db = await openBackgroundMediaDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(BACKGROUND_MEDIA_STORE, 'readwrite')
      const store = transaction.objectStore(BACKGROUND_MEDIA_STORE)
      const key = getBackgroundUrlCacheKey()
      if (key) {
        store.delete(key)
      } else {
        store.delete(BACKGROUND_URL_CACHE_KEY)
      }
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error || new Error('背景 URL 缓存清除失败。'))
      }
      transaction.onabort = () => {
        reject(transaction.error || new Error('背景 URL 缓存清除失败。'))
      }
    })
  } finally {
    db.close()
  }
}

function getBackgroundUrlCacheKey(imageUrl = normalizeBackgroundImageUrl(state.backgroundSettings.url)): string {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  return `${BACKGROUND_URL_CACHE_KEY_PREFIX}${normalizedUrl}`
}

async function fetchBackgroundUrlImage(
  imageUrl: string,
  { maxBytes = BACKGROUND_URL_FULL_MAX_BYTES }: { maxBytes?: number } = {}
): Promise<Blob> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => {
    controller.abort()
  }, BACKGROUND_URL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(imageUrl, {
      cache: 'force-cache',
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`图片请求失败：${response.status}`)
    }

    const declaredSize = validateBackgroundContentLength(
      response.headers.get('content-length'),
      maxBytes
    )
    if (!declaredSize.allowed) {
      throw new Error(declaredSize.message)
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type
    if (!blob.size || !isBackgroundImageResponse(contentType, imageUrl)) {
      throw new Error('链接返回的内容不是图片。')
    }

    const finalSize = validateBackgroundBlobSize(blob.size, maxBytes)
    if (!finalSize.allowed) {
      throw new Error(finalSize.message)
    }

    const optimizedBlob = await createOptimizedBackgroundImageBlob(blob)
    const optimizedSize = validateBackgroundBlobSize(optimizedBlob.size, BACKGROUND_URL_PREVIEW_MAX_BYTES)
    if (!optimizedSize.allowed) {
      throw new Error(optimizedSize.message)
    }
    return optimizedBlob
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('远程图片下载超时。')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchFeaturedBackgroundDownloadBlob(imageUrl: string): Promise<Blob> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => {
    controller.abort()
  }, FEATURED_BACKGROUND_DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(imageUrl, {
      cache: 'force-cache',
      signal: controller.signal
    })
    if (!response.ok) {
      throw new Error(`图片请求失败：${response.status}`)
    }

    const declaredSize = validateBackgroundContentLength(
      response.headers.get('content-length'),
      BACKGROUND_URL_FULL_MAX_BYTES
    )
    if (!declaredSize.allowed) {
      throw new Error(declaredSize.message)
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type
    if (!blob.size || !isBackgroundImageResponse(contentType, imageUrl)) {
      throw new Error('链接返回的内容不是图片。')
    }

    const finalSize = validateBackgroundBlobSize(blob.size, BACKGROUND_URL_FULL_MAX_BYTES)
    if (!finalSize.allowed) {
      throw new Error(finalSize.message)
    }
    return blob
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('图片下载超时。')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function isBackgroundImageResponse(contentType: unknown, imageUrl: string): boolean {
  const normalizedType = String(contentType || '').toLowerCase()
  if (normalizedType.includes('image/svg+xml') || /\.svg(?:$|[?#])/i.test(imageUrl)) {
    return false
  }
  if (normalizedType.startsWith('image/')) {
    return true
  }

  return isKnownImageUrlWithoutContentType(imageUrl)
}

function isKnownImageUrlWithoutContentType(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    if (url.hostname === 'ids.si.edu' && /^\/ids\/(?:deliveryService|download)$/i.test(url.pathname)) {
      return true
    }
    return /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(url.pathname)
  } catch {
    return false
  }
}

function getFeaturedBackgroundDownloadFilename(item: FeaturedBackgroundItem, blob: Blob): string {
  const provider = slugifyDownloadFileSegment(item.provider) || 'featured'
  const title = slugifyDownloadFileSegment(item.title) ||
    slugifyDownloadFileSegment(item.id) ||
    'wallpaper'
  const extension = getImageDownloadExtension(item.imageUrl, blob.type)
  return `curator-${provider}-${title}.${extension}`
}

function getImageDownloadExtension(imageUrl: string, contentType: string): string {
  const normalizedType = String(contentType || '').toLowerCase()
  if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) {
    return 'jpg'
  }
  if (normalizedType.includes('png')) {
    return 'png'
  }
  if (normalizedType.includes('webp')) {
    return 'webp'
  }

  try {
    const path = new URL(imageUrl).pathname
    const match = /\.(jpe?g|png|webp)(?:$|[?#])/i.exec(path)
    if (match) {
      return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase()
    }
  } catch {
    return 'jpg'
  }
  return 'jpg'
}

function slugifyDownloadFileSegment(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function getFeaturedBackgroundDownloadErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/permission|denied|权限/i.test(message)) {
    return '下载失败：没有图片访问权限。'
  }
  if (/太大|不是图片|超时|请求失败/i.test(message)) {
    return `下载失败：${message}`
  }
  return '下载失败：请检查网络后重试。'
}

function normalizeSearchSettings(rawSettings: unknown): typeof DEFAULT_SEARCH_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_SEARCH_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const placeholder = Object.prototype.hasOwnProperty.call(settings, 'placeholder')
    ? String(settings.placeholder ?? '').trim()
    : DEFAULT_SEARCH_SETTINGS.placeholder
  const engine = normalizeSearchEngineId(settings.engine, DEFAULT_SEARCH_SETTINGS.engine)
  return {
    enabled: settings.enabled !== false,
    webSearchEnabled: settings.webSearchEnabled !== false,
    openInNewTab: settings.openInNewTab === true,
    engine,
    enabledEngines: normalizeEnabledSearchEngineIds(settings.enabledEngines, engine),
    placeholder,
    naturalSearchEnabled: settings.naturalSearchEnabled === true,
    naturalSearchAiConfigured: settings.naturalSearchAiConfigured === true,
    autoVerticalCenter: settings.autoVerticalCenter === true,
    width: clampNumber(settings.width, 16, 72, DEFAULT_SEARCH_SETTINGS.width),
    height: clampNumber(settings.height, 28, 56, DEFAULT_SEARCH_SETTINGS.height),
    offsetY: clampNumber(
      settings.offsetY,
      SEARCH_OFFSET_ABSOLUTE_MIN,
      SEARCH_OFFSET_ABSOLUTE_MAX,
      DEFAULT_SEARCH_SETTINGS.offsetY
    ),
    background: clampNumber(settings.background, 0, 92, DEFAULT_SEARCH_SETTINGS.background)
  }
}

function getSearchPlaceholder(settings: typeof DEFAULT_SEARCH_SETTINGS): string {
  return String(settings.placeholder ?? '').trim()
}

function syncSearchSettingsControls(): void {
  const settings = state.searchSettings
  const widthBounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  const offsetBounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  dispatchNewtabSearchSettingsView(createNewtabSearchSettingsView(settings, {
    offset: offsetBounds,
    width: widthBounds
  }))
  syncSearchWidthControl()
  syncSearchOffsetControl()
}

function syncSearchWidthControl(): void {
  const bounds = state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  dispatchNewtabSearchSettingsView(createNewtabSearchSettingsView(state.searchSettings, {
    offset: state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK,
    width: bounds
  }))
}

function syncSearchOffsetControl(): void {
  const bounds = state.searchOffsetBounds || SEARCH_OFFSET_BOUNDS_FALLBACK
  dispatchNewtabSearchSettingsView(createNewtabSearchSettingsView(state.searchSettings, {
    offset: bounds,
    width: state.searchWidthBounds || SEARCH_WIDTH_BOUNDS_FALLBACK
  }))
}

async function saveSearchSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabSearchSettings]: state.searchSettings
  })
}

function scheduleSearchSettingsSave(): void {
  window.clearTimeout(searchSettingsSaveTimer)
  searchSettingsSaveTimer = window.setTimeout(() => {
    searchSettingsSaveTimer = 0
    void saveSearchSettings().catch((error) => {
      console.warn('新标签页搜索设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function normalizeGeneralSettings(rawSettings: unknown): typeof DEFAULT_GENERAL_SETTINGS {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_GENERAL_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const legacyQuickAccess = settings.showFrequentBookmarks !== false || settings.showRecentBookmarks !== false
  return {
    hideSettingsTrigger: settings.hideSettingsTrigger === true,
    showQuickAccess: typeof settings.showQuickAccess === 'boolean'
      ? settings.showQuickAccess
      : legacyQuickAccess,
    showSourceNavigation: settings.showSourceNavigation !== false,
    openBookmarksInNewTab: settings.openBookmarksInNewTab === true
  }
}

function syncGeneralSettingsControls(): void {
  dispatchNewtabFolderSourceView(createFolderSourceView())
}

async function saveGeneralSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabGeneralSettings]: state.generalSettings
  })
}

function applyGeneralSettings(): void {
  dispatchNewtabFolderSourceView(createFolderSourceView())
}

function syncFolderSettingsControls(): void {
  measureNow('newtab.syncFolderSettingsControls', () => {
    dispatchNewtabFolderSourceView(createFolderSourceView())
  })
}

function syncNewTabModernSettingsControls(): void {
  syncModuleSettingsControls()
}

function syncModuleSettingsControls(): void {
  const rows = buildNewTabModuleSettingRows(state.moduleSettings)
  dispatchNewtabModuleSettingsView({
    rows: rows.map((setting) => createModuleSettingRowViewModel(setting))
  })
}

function createModuleSettingRowViewModel(
  setting: ReturnType<typeof buildNewTabModuleSettingRows>[number]
): NewtabModuleSettingRowView {
  return {
    description: setting.description,
    enabled: setting.enabled,
    key: setting.key,
    label: setting.label
  }
}

function handleModuleSettingToggle(key: NewTabModuleSettingKey, enabled: boolean): void {
  if (!key || !(key in state.moduleSettings)) {
    return
  }

  state.moduleSettings = normalizeNewTabModuleSettings({
    ...state.moduleSettings,
    [key]: enabled
  })
  void saveNewTabModuleSettings().catch((error) => {
    setSettingsSaveStatus('error', error instanceof Error ? error.message : '模块设置保存失败')
  })
  syncNewTabModernSettingsControls()
  scheduleRender({ updateClock: true })
}

function createFolderSourceView() {
  return {
    candidateQuery: state.folderCandidateQuery,
    candidates: createFolderCandidateControlsState(),
    candidatesExpanded: state.folderCandidatesExpanded,
    general: {
      hideSettingsTrigger: state.generalSettings.hideSettingsTrigger,
      openBookmarksInNewTab: state.generalSettings.openBookmarksInNewTab,
      showQuickAccess: state.generalSettings.showQuickAccess,
      showSourceNavigation: state.generalSettings.showSourceNavigation
    },
    hideFolderNames: state.folderSettings.hideFolderNames,
    browseMode: state.folderSettings.browseMode,
    selected: createSelectedFolderControlsState(),
    selectedCount: state.folderSettings.selectedFolderIds.length
  }
}

function createSelectedFolderControlsState(): NewtabSelectedFolderSourceState {
  const selectedIds = state.folderSettings.selectedFolderIds
  if (!selectedIds.length) {
    return {
      type: 'empty',
      message: '未选择来源文件夹。选择来源只会决定新标签页显示哪些书签，不会移动、删除或重排原有书签。'
    }
  }

  const folders = getFolderCandidateMap()
  const items: NewtabSelectedFolderSourceItemView[] = selectedIds.map((folderId) => {
    const folder = folders.get(folderId)
    return {
      affectedCount: folder?.totalBookmarkCount || 0,
      folderId,
      path: folder?.path || folderId,
      stats: folder ? formatFolderCandidateCountSummary(folder) : '来源不可用',
      title: folder?.title || '已删除的文件夹'
    }
  })
  return { type: 'items', items }
}

function createFolderCandidateControlsState(): NewtabFolderCandidateState {
  const candidates = getFilteredFolderCandidates()
  if (!candidates.length) {
    return {
      type: 'empty',
      message: '没有匹配的文件夹。请清空搜索词，或选择其他来源文件夹。'
    }
  }

  const selectedIds = new Set(state.folderSettings.selectedFolderIds)
  const activeId = resolveFolderCandidateActiveId(candidates)
  const items: NewtabFolderCandidateItemView[] = candidates.map((folder) => {
    const selected = selectedIds.has(folder.id)
    return {
      active: folder.id === activeId,
      badge: selected ? '已选' : String(folder.totalBookmarkCount),
      folderId: folder.id,
      path: folder.path,
      selected,
      stats: formatFolderCandidateCountSummary(folder),
      title: folder.title || '未命名文件夹'
    }
  })
  return { type: 'items', items }
}

function getFilteredFolderCandidates(): NewTabFolderCandidate[] {
  const query = normalizeSettingSearchText(state.folderCandidateQuery)
  return getFolderCandidatesForCurrentRender().filter((folder) => {
    if (!query) {
      return true
    }

    return folder.normalizedTitle.includes(query) || folder.normalizedPath.includes(query)
  })
}

function getFolderCandidatesForCurrentRender(): NewTabFolderCandidate[] {
  const cacheKey = buildFolderCandidateRenderKey({
    rootNode: state.rootNode,
    folderData: state.folderData,
    folderNodeMap: state.folderNodeMap,
    folderCandidateQuery: state.folderCandidateQuery,
    selectedFolderIds: state.folderSettings.selectedFolderIds,
    folderCandidatesExpanded: state.folderCandidatesExpanded
  })
  return getCachedFolderCandidates(state.folderCandidateCache, cacheKey, getFolderCandidates)
}

function getFolderCandidates(): NewTabFolderCandidate[] {
  if (!state.rootNode) {
    return []
  }

  const folderData = state.folderData || getBookmarkCatalog().extracted
  const folderNodeMap = state.folderNodeMap.size ? state.folderNodeMap : buildFolderNodeMap(state.rootNode)
  return folderData.folders.map((folder) => {
    const counts = getFolderBookmarkCounts(folderNodeMap.get(folder.id) || null)
    return {
      id: folder.id,
      title: folder.title,
      path: folder.path,
      normalizedTitle: folder.normalizedTitle,
      normalizedPath: folder.normalizedPath,
      directBookmarkCount: counts.directBookmarkCount,
      totalBookmarkCount: counts.totalBookmarkCount
    }
  })
}

function getFolderCandidateMap(): Map<string, NewTabFolderCandidate> {
  return new Map(getFolderCandidatesForCurrentRender().map((folder) => [folder.id, folder]))
}

function formatFolderCandidateCountSummary(folder: NewTabFolderCandidate): string {
  return `直属 ${folder.directBookmarkCount} / 合计 ${folder.totalBookmarkCount}`
}

function normalizeSettingSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function saveFolderSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabFolderSettings]: state.folderSettings
  })
}

function setFolderReorderStatus(message: string, tone: 'success' | 'error'): void {
  window.clearTimeout(folderReorderStatusTimer)
  state.folderReorderStatus = message
  state.folderReorderStatusTone = tone
  render()
  updateClockText()

  folderReorderStatusTimer = window.setTimeout(() => {
    clearFolderReorderStatus()
    render()
    updateClockText()
  }, tone === 'success' ? 1800 : 4200)
}

function clearFolderReorderStatus(): void {
  window.clearTimeout(folderReorderStatusTimer)
  folderReorderStatusTimer = 0
  state.folderReorderStatus = ''
  state.folderReorderStatusTone = 'success'
}

function applyFolderSettings(): void {
  dispatchNewtabFolderSourceView(createFolderSourceView())
}

function syncIconSettingsControls(): void {
  measureNow('newtab.syncIconSettingsControls', () => {
    renderIconPreviewIfNeeded()
  })
}

async function saveIconSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabIconSettings]: state.iconSettings
  })
}

function scheduleIconSettingsSave(): void {
  window.clearTimeout(iconSettingsSaveTimer)
  iconSettingsSaveTimer = window.setTimeout(() => {
    iconSettingsSaveTimer = 0
    void saveIconSettings().catch((error) => {
      console.warn('新标签页图标设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function commitIconSettings(nextSettings: IconSettings): void {
  state.iconSettings = withDetectedIconPreset(nextSettings)
  scheduleIconSettingsSave()
  applyIconSettingsLive()
  syncIconSettingsControls()
}

function applyIconSettingsLive(): void {
  const contentStyle = createBookmarkContentStyleState()
  const bookmarkView = getNewtabBookmarkContentView()
  if (!bookmarkView) {
    scheduleRender({ updateClock: true })
    return
  }

  patchNewtabBookmarkContentView((view) => ({
    ...view,
    content: contentStyle
  }))
  patchNewtabContentView((view) => {
    if (view.type !== 'page') {
      return view
    }
    return {
      ...view,
      iconVerticalCenter: String(state.iconSettings.verticalCenter),
      modules: view.modules.map((module) =>
        module.kind === 'bookmarks'
          ? { ...module, iconVerticalCenter: state.iconSettings.verticalCenter }
          : module
      )
    }
  })
  scheduleAdaptiveNewTabLayoutUpdate()
}

function withDetectedIconPreset(settings: IconSettings): IconSettings {
  const { preset: _preset, ...presetValues } = settings
  return {
    ...settings,
    preset: detectPresetFromValues(presetValues)
  }
}

function applyIconPreset(presetKey: IconLayoutPresetKey): void {
  const preset = ICON_LAYOUT_PRESETS[presetKey]
  state.iconSettings = normalizeIconSettings({
    ...preset,
    verticalCenter: state.iconSettings.verticalCenter,
    preset: presetKey
  })
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标预设保存失败。', error)
  })
  applyIconSettingsLive()
  syncIconSettingsControls()
  updateClockText()
}

function resetIconSettingsToDefaults(): void {
  state.iconSettings = normalizeIconSettings(DEFAULT_ICON_SETTINGS)
  void saveIconSettings().catch((error) => {
    console.warn('新标签页图标默认布局保存失败。', error)
  })
  applyIconSettingsLive()
  syncIconSettingsControls()
  updateClockText()
}

async function saveSettingsWithFeedback(values: Record<string, unknown>): Promise<void> {
  clearSettingsSaveStatus()
  try {
    await setLocalStorage(values)
    clearSettingsSaveStatus()
  } catch (error) {
    setSettingsSaveStatus('error', '保存失败，本次调整仅临时生效；刷新后会恢复到上次已保存状态')
    throw error
  }
}

function clearSettingsSaveStatus(): void {
  window.clearTimeout(settingsSaveStatusTimer)
  state.settingsSaveState = 'idle'
  state.settingsSaveMessage = ''
  syncSettingsSaveStatus()
}

function setSettingsSaveStatus(nextState: SettingsSaveState, message: string): void {
  window.clearTimeout(settingsSaveStatusTimer)
  state.settingsSaveState = nextState
  state.settingsSaveMessage = message
  syncSettingsSaveStatus()

  if (nextState === 'saved') {
    settingsSaveStatusTimer = window.setTimeout(() => {
      state.settingsSaveState = 'idle'
      state.settingsSaveMessage = ''
      syncSettingsSaveStatus()
    }, 1800)
  }
}

function syncSettingsSaveStatus(): void {
  dispatchNewtabSettingsDrawerSaveStatus(state.settingsSaveState, state.settingsSaveMessage)
}

function renderIconPreviewIfNeeded(): void {
  const previewKey = getIconPreviewSignature(state.iconSettings)
  if (lastIconPreviewKey === previewKey) {
    return
  }

  lastIconPreviewKey = previewKey
  renderIconPreview()
}

function renderIconPreview(): void {
  dispatchIconPreviewViewForSettings(state.iconSettings)
}

async function hydrateFeaturedBackgroundOptions(force = false): Promise<void> {
  const dateSeed = getFeaturedBackgroundDateSeed()
  if (state.backgroundSettings.type !== 'featured' ||
    (!force && featuredBackgroundOptionsHydratedDateSeed === dateSeed)) {
    return
  }

  await loadBackgroundGalleryModule()
  const currentDateSeed = getFeaturedBackgroundDateSeed()
  if (!force && featuredBackgroundOptionsHydratedDateSeed === currentDateSeed) {
    return
  }

  featuredBackgroundOptionsHydratedDateSeed = currentDateSeed
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
}

let featuredBackgroundModalReady = false
let featuredBackgroundModalReadyPromise: Promise<void> | null = null
let resolveFeaturedBackgroundModalReady: (() => void) | null = null

function ensureFeaturedBackgroundModalReady(): Promise<void> {
  if (featuredBackgroundModalReady) return Promise.resolve()
  if (!featuredBackgroundModalReadyPromise) {
    featuredBackgroundModalReadyPromise = new Promise<void>((resolve) => {
      resolveFeaturedBackgroundModalReady = resolve
    })
  }
  return featuredBackgroundModalReadyPromise
}

function initializeFeaturedBackgroundModal(): void {
  if (featuredBackgroundModalReady) return

  featuredBackgroundModalReady = true
  resolveFeaturedBackgroundModalReady?.()
  syncFeaturedBackgroundModalControls()
}

async function openFeaturedBackgroundPicker(): Promise<void> {
  await ensureFeaturedBackgroundModalReady()

  dispatchNewtabFeaturedBackgroundModalOpen(true)
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())

  await openFeaturedBackgroundPickerContent({
    getLoadedGallery: () => backgroundGalleryModule,
    loadGallery: loadBackgroundGalleryModule,
    isOpen: isFeaturedBackgroundPickerOpen,
    hasRenderedContent: hasRenderedFeaturedBackgroundPickerContent,
    showLoading: () => {
      dispatchNewtabFeaturedBackgroundPickerView({
        type: 'state',
        label: '正在载入精选图库'
      })
    },
    showError: () => {
      dispatchNewtabFeaturedBackgroundPickerView({
        type: 'state',
        label: '精选图库载入失败'
      })
    },
    render: renderFeaturedBackgroundPicker,
    focusInitialTarget: focusFeaturedBackgroundPickerInitialTarget,
    scheduleFrame: (callback) => {
      window.requestAnimationFrame(callback)
    },
    schedulePreviewWarm: (callback) => {
      scheduleFeaturedBackgroundPreviewWarm(callback)
    },
    warmPreviewObjectUrls: warmFeaturedBackgroundPickerPreviewObjectUrls
  })
}

function scheduleFeaturedBackgroundPreviewWarm(callback: () => void): void {
  window.clearTimeout(featuredBackgroundGalleryPreviewWarmTimer)
  featuredBackgroundGalleryPreviewWarmTimer = window.setTimeout(() => {
    featuredBackgroundGalleryPreviewWarmTimer = 0
    if (!isFeaturedBackgroundPickerOpen()) {
      return
    }
    runIdle(() => {
      if (isFeaturedBackgroundPickerOpen()) {
        callback()
      }
    }, { timeout: 1600 })
  }, 1600)
}

function clearFeaturedBackgroundPreviewWarmTimers(): void {
  window.clearTimeout(featuredBackgroundGalleryPreviewWarmTimer)
  featuredBackgroundGalleryPreviewWarmTimer = 0
}

function focusFeaturedBackgroundPickerInitialTarget(): void {
  if (!isFeaturedBackgroundPickerOpen()) {
    return
  }
  dispatchNewtabFeaturedBackgroundPickerInitialFocusRequest()
}

function closeFeaturedBackgroundPicker(): void {
  if (!isFeaturedBackgroundPickerOpen()) {
    return
  }

  clearFeaturedBackgroundHoverPreview()
  clearFeaturedBackgroundPreviewWarmTimers()
  dispatchNewtabFeaturedBackgroundModalOpen(false)
  dispatchNewtabFeaturedBackgroundPickerView(null)
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())

}

function handleFeaturedBackgroundModalCloseRequest(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  closeFeaturedBackgroundPicker()
}

function isFeaturedBackgroundPickerOpen(): boolean {
  return getNewtabFeaturedBackgroundModalOpen()
}

function renderFeaturedBackgroundPicker(gallery: BackgroundGalleryModule): void {
  if (!(getNewtabFeaturedBackgroundModalNodes().grid instanceof HTMLElement)) {
    window.requestAnimationFrame(() => {
      if (isFeaturedBackgroundPickerOpen()) {
        renderFeaturedBackgroundPicker(gallery)
      }
    })
    return
  }

  clearFeaturedBackgroundHoverPreview()
  const staticFeaturedBackgroundIds = new Set(gallery.FEATURED_BACKGROUND_ITEMS.map((item) => item.id))
  const selectedId = state.backgroundSettings.featuredId
  const pickerSections = getFeaturedBackgroundPickerSections(gallery)
  const pickerItems = [...pickerSections.favorites, ...pickerSections.refreshed]
  const renderKey = [
    selectedId,
    state.featuredBackgroundFavoriteIds.join(','),
    ...pickerItems.map((item) => `${item.id}:${item.imageUrl}`)
  ].join('|')
  if (featuredBackgroundPickerRenderKey === renderKey &&
    hasRenderedFeaturedBackgroundPickerContent()) {
    syncFeaturedBackgroundModalControls()
    return
  }

  syncFeaturedBackgroundModalControls()

  const providerGroups = createFeaturedBackgroundPickerProviderGroups({
    items: pickerSections.refreshed,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset: pickerSections.favorites.length
  })
  dispatchNewtabFeaturedBackgroundPickerView({
    type: 'sections',
    sections: [
      {
        type: 'grid',
        section: createFeaturedBackgroundPickerGridSectionViewModel({
          title: '收藏壁纸',
          emptyText: '还没有收藏壁纸',
          items: pickerSections.favorites,
          staticFeaturedBackgroundIds,
          selectedId,
          renderIndexOffset: 0
        })
      },
      {
        type: 'providers',
        title: '刷新图库',
        groups: providerGroups
      }
    ]
  })
  featuredBackgroundPickerRenderKey = renderKey
}

function hasRenderedFeaturedBackgroundPickerContent(): boolean {
  const view = getNewtabFeaturedBackgroundPickerView()
  if (!view || view.type !== 'sections') {
    return false
  }

  return view.sections.some((section) => {
    if (section.type === 'grid') {
      return section.section.cards.length > 0
    }

    return section.groups.some((group) => group.cards.length > 0)
  })
}

function createFeaturedBackgroundPickerProviderGroups(
  {
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerProviderGroupViewModel[] {
  const groups: FeaturedBackgroundPickerProviderGroupViewModel[] = []
  const usedProviders = new Set<FeaturedBackgroundItem['provider']>()
  let offset = renderIndexOffset

  const addProviderGroup = (provider: FeaturedBackgroundItem['provider']) => {
    const providerItems = items.filter((item) => item.provider === provider)
    if (!providerItems.length) {
      return
    }
    usedProviders.add(provider)
    groups.push(createFeaturedBackgroundPickerProviderGroupViewModel({
      title: FEATURED_BACKGROUND_PROVIDER_LABELS[provider],
      emptyText: FEATURED_BACKGROUND_PROVIDER_EMPTY_TEXT[provider],
      items: providerItems,
      staticFeaturedBackgroundIds,
      selectedId,
      renderIndexOffset: offset
    }))
    offset += providerItems.length
  }

  for (const provider of FEATURED_BACKGROUND_PROVIDER_ORDER) {
    addProviderGroup(provider)
  }
  for (const item of items) {
    if (!usedProviders.has(item.provider)) {
      addProviderGroup(item.provider)
    }
  }

  return groups
}

function createFeaturedBackgroundPickerProviderGroupViewModel(
  {
    title,
    emptyText,
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    title: string
    emptyText: string
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerProviderGroupViewModel {
  return {
    title,
    emptyText,
    cards: createFeaturedBackgroundPickerCardViewModels({
      items,
      staticFeaturedBackgroundIds,
      selectedId,
      renderIndexOffset
    })
  }
}

function createFeaturedBackgroundPickerGridSectionViewModel(
  {
    title,
    emptyText,
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    title: string
    emptyText: string
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerGridSectionViewModel {
  return {
    title,
    emptyText,
    cards: createFeaturedBackgroundPickerCardViewModels({
      items,
      staticFeaturedBackgroundIds,
      selectedId,
      renderIndexOffset
    })
  }
}

function createFeaturedBackgroundPickerCardViewModels(
  {
    items,
    staticFeaturedBackgroundIds,
    selectedId,
    renderIndexOffset
  }: {
    items: FeaturedBackgroundItem[]
    staticFeaturedBackgroundIds: Set<string>
    selectedId: string
    renderIndexOffset: number
  }
): FeaturedBackgroundPickerCardViewModel[] {
  return items.map((item, index) => createFeaturedBackgroundPickerCardViewModel({
    item,
    bundledPreviewUrl: staticFeaturedBackgroundIds.has(item.id)
      ? getFeaturedBackgroundBundledThumbnailUrl(item.id)
      : '',
    selected: selectedId === item.id,
    favorite: isFeaturedBackgroundFavorite(item.id),
    renderIndex: renderIndexOffset + index
  }))
}

function getFeaturedBackgroundPickerItems(gallery: BackgroundGalleryModule): FeaturedBackgroundItem[] {
  return buildFeaturedBackgroundPickerItems({
    storedItems: state.featuredBackgroundGallery,
    staticItems: gallery.FEATURED_BACKGROUND_ITEMS,
    favoriteIds: state.featuredBackgroundFavoriteIds,
    selectedId: state.backgroundSettings.featuredId
  })
}

function getFeaturedBackgroundPickerSections(gallery: BackgroundGalleryModule): FeaturedBackgroundPickerSections {
  return buildFeaturedBackgroundPickerSections({
    storedItems: state.featuredBackgroundGallery,
    staticItems: gallery.FEATURED_BACKGROUND_ITEMS,
    favoriteIds: state.featuredBackgroundFavoriteIds,
    selectedId: state.backgroundSettings.featuredId
  })
}

function getFeaturedBackgroundPreviewSourceUrl(
  itemOrProvider: FeaturedBackgroundItem['provider'] | Pick<FeaturedBackgroundItem, 'provider'>,
  imageUrl: string
): string {
  const provider = typeof itemOrProvider === 'string'
    ? itemOrProvider
    : itemOrProvider.provider
  const candidates = getFeaturedBackgroundPreviewCandidates(imageUrl, provider)
  return candidates[0] || ''
}

function getFeaturedBackgroundPreviewPlaceholderColor({
  provider,
  accentColor,
  imageUrl,
  title,
  credit
}: {
  provider: FeaturedBackgroundItem['provider']
  accentColor?: string
  imageUrl: string
  title: string
  credit: string
}): string {
  void imageUrl
  void title
  void credit
  if (typeof accentColor === 'string' && accentColor.trim()) {
    return getNonBlackPlaceholderColor(accentColor)
  }
  return getNonBlackPlaceholderColor(
    provider === 'met'
      ? '#18200f'
      : provider === 'nasa'
        ? '#06080d'
        : provider === 'cleveland'
          ? '#1c1518'
          : '#14191d'
  )
}

const FEATURED_BACKGROUND_BUNDLED_THUMBNAIL_URL_BY_ID: Record<string, string> = {
  'met-wheat-field-with-cypresses': 'featured-gallery-thumbnails/met-wheat-field-with-cypresses.jpg',
  'wikimedia-water-lilies-monet': 'featured-gallery-thumbnails/wikimedia-water-lilies-monet.jpg',
  'nasa-apollo-earthrise': 'featured-gallery-thumbnails/nasa-apollo-earthrise.jpg',
  'met-venice-from-the-porch': 'featured-gallery-thumbnails/met-venice-from-the-porch.jpg',
  'wikimedia-among-sierra-nevada': 'featured-gallery-thumbnails/wikimedia-among-sierra-nevada.jpg',
  'nasa-andromeda-infrared': 'featured-gallery-thumbnails/nasa-andromeda-infrared.jpg',
  'met-sunflowers': 'featured-gallery-thumbnails/met-sunflowers.jpg',
  'wikimedia-starry-night': 'featured-gallery-thumbnails/wikimedia-starry-night.jpg',
  'nasa-eagle-nebula-wise': 'featured-gallery-thumbnails/nasa-eagle-nebula-wise.jpg',
  'met-cypresses': 'featured-gallery-thumbnails/met-cypresses.jpg',
  'wikimedia-great-wave': 'featured-gallery-thumbnails/wikimedia-great-wave.jpg',
  'nasa-earth-limb-aurora': 'featured-gallery-thumbnails/nasa-earth-limb-aurora.jpg',
  'met-irises': 'featured-gallery-thumbnails/met-irises.jpg',
  'wikimedia-cotopaxi': 'featured-gallery-thumbnails/wikimedia-cotopaxi.jpg',
  'nasa-mars-landscape-curiosity': 'featured-gallery-thumbnails/nasa-mars-landscape-curiosity.jpg',
  'met-monet-family-garden': 'featured-gallery-thumbnails/met-monet-family-garden.jpg',
  'wikimedia-fighting-temeraire': 'featured-gallery-thumbnails/wikimedia-fighting-temeraire.jpg',
  'nasa-dust-devil-on-mars': 'featured-gallery-thumbnails/nasa-dust-devil-on-mars.jpg',
  'met-bouquet-flowers': 'featured-gallery-thumbnails/met-bouquet-flowers.jpg',
  'wikimedia-impression-sunrise': 'featured-gallery-thumbnails/wikimedia-impression-sunrise.jpg',
  'nasa-jupiter-southern-hemisphere': 'featured-gallery-thumbnails/nasa-jupiter-southern-hemisphere.jpg',
  'met-young-woman-water-pitcher': 'featured-gallery-thumbnails/met-young-woman-water-pitcher.jpg',
  'wikimedia-wanderer-sea-fog': 'featured-gallery-thumbnails/wikimedia-wanderer-sea-fog.jpg',
  'nasa-aurora-borealis-blankets-earth': 'featured-gallery-thumbnails/nasa-aurora-borealis-blankets-earth.jpg',
  'met-dance-class': 'featured-gallery-thumbnails/met-dance-class.jpg',
  'wikimedia-great-day-wrath': 'featured-gallery-thumbnails/wikimedia-great-day-wrath.jpg',
  'nasa-orion-nebula-infrared': 'featured-gallery-thumbnails/nasa-orion-nebula-infrared.jpg',
  'met-la-berceuse': 'featured-gallery-thumbnails/met-la-berceuse.jpg',
  'wikimedia-snow-storm-steamboat': 'featured-gallery-thumbnails/wikimedia-snow-storm-steamboat.jpg',
  'nasa-mars-cerberus-fossae': 'featured-gallery-thumbnails/nasa-mars-cerberus-fossae.jpg',
  'met-rembrandt-self-portrait': 'featured-gallery-thumbnails/met-rembrandt-self-portrait.jpg'
}

function getFeaturedBackgroundBundledThumbnailUrl(featuredId: string): string {
  const id = String(featuredId || '').trim()
  if (!id) return ''
  const path = FEATURED_BACKGROUND_BUNDLED_THUMBNAIL_URL_BY_ID[id]
  if (!path) return ''
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function') {
    return chrome.runtime.getURL(path)
  }
  return `/${path}`
}

async function resolveFeaturedBackgroundGalleryPreviewObjectUrlWithSource(
  imageUrl: string,
  { fallbackUrl = '' }: { fallbackUrl?: string } = {}
): Promise<string> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }

  const cachedObjectUrl = featuredBackgroundGalleryPreviewObjectUrlCache.get(normalizedUrl)
  if (cachedObjectUrl) {
    return cachedObjectUrl
  }

  return featuredBackgroundGalleryPreviewObjectUrlCache.resolve(
    normalizedUrl,
    async () => {
      const record = await getFeaturedBackgroundPreviewCacheRecord(normalizedUrl)
      if (record?.blob) {
        return record.blob
      }
      return null
    },
    { fallbackUrl: fallbackUrl || '' }
  )
}

async function resolveFeaturedBackgroundGalleryObjectUrl(imageUrl: string): Promise<string> {
  const normalizedUrl = normalizeBackgroundImageUrl(imageUrl)
  if (!normalizedUrl) {
    return ''
  }
  return featuredBackgroundGalleryObjectUrlCache.resolve(
    normalizedUrl,
    () => getBackgroundUrlCache(normalizedUrl).then((record) => record?.blob || null),
    { fallbackUrl: '' }
  )
}

function revokeFeaturedBackgroundGalleryObjectUrls(): void {
  featuredBackgroundGalleryObjectUrlCache.clear()
}

function createFeaturedBackgroundPickerCardViewModel({
  item,
  bundledPreviewUrl = '',
  selected,
  favorite = false,
  renderIndex = 0
}: {
  item: FeaturedBackgroundItem
  bundledPreviewUrl?: string
  selected: boolean
  favorite?: boolean
  renderIndex?: number
}): FeaturedBackgroundPickerCardViewModel {
  const imageUrl = item.imageUrl
  const title = item.title
  const previewAccentColor = getFeaturedBackgroundPreviewPlaceholderColor({
    provider: item.provider,
    accentColor: item.accentColor,
    imageUrl,
    title,
    credit: title
  })
  const remotePreviewUrl = getFeaturedBackgroundPreviewImageUrl({ provider: item.provider }, imageUrl) || imageUrl
  const previewFallbackUrls = [
    remotePreviewUrl,
    imageUrl
  ].filter((url, index, urls) => Boolean(url) && url !== bundledPreviewUrl && urls.indexOf(url) === index)
  const initialPreviewUrl = featuredBackgroundGalleryPreviewObjectUrlCache.get(remotePreviewUrl) ||
    bundledPreviewUrl ||
    remotePreviewUrl
  const resolutionText = formatFeaturedBackgroundResolution(item)

  return {
    favorite,
    fetchpriority: renderIndex < FEATURED_GALLERY_HIGH_PRIORITY_PREVIEW_LIMIT ? 'high' : 'auto',
    id: item.id,
    imageUrl,
    initialPreviewUrl,
    onClearHoverPreview: clearFeaturedBackgroundHoverPreview,
    onDownload: (_card, id) => downloadFeaturedBackgroundFromPicker(id),
    onFavoriteToggle: (_card, id) => toggleFeaturedBackgroundFavorite(id),
    onResolvePreviewObjectUrl: resolveFeaturedBackgroundPickerCardPreviewObjectUrl,
    onSelect: (_card, id) => selectFeaturedBackgroundFromPicker(id),
    onScheduleHoverPreview: scheduleFeaturedBackgroundHoverPreview,
    previewAccentColor,
    previewFallbackUrls,
    renderIndex,
    remotePreviewUrl,
    resolutionState: resolutionText ? 'ready' : 'pending',
    resolutionText: resolutionText || '检测中',
    selected,
    title
  }
}

function resolveFeaturedBackgroundPickerCardPreviewObjectUrl(
  remotePreviewUrl: string,
  fallbackUrl: string
): Promise<string> {
  return resolveFeaturedBackgroundGalleryPreviewObjectUrlWithSource(remotePreviewUrl, { fallbackUrl })
}

function formatFeaturedBackgroundResolution(item: Pick<FeaturedBackgroundItem, 'width' | 'height'>): string {
  const width = Number(item.width)
  const height = Number(item.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return ''
  }
  return `${Math.round(width)} x ${Math.round(height)}`
}

function scheduleFeaturedBackgroundHoverPreview(request: FeaturedBackgroundHoverPreviewRequest): void {
  if (!isFeaturedBackgroundPickerOpen()) {
    return
  }

  const card = request.element
  const imageUrl = request.imageUrl
  if (!imageUrl) {
    return
  }

  if (featuredBackgroundPreviewCard === card) {
    return
  }

  window.clearTimeout(featuredBackgroundPreviewTimer)
  featuredBackgroundPreviewTimer = window.setTimeout(() => {
    featuredBackgroundPreviewTimer = 0
    showFeaturedBackgroundHoverPreview(request)
  }, FEATURED_BACKGROUND_HOVER_PREVIEW_DELAY_MS)
}

function showFeaturedBackgroundHoverPreview(request: FeaturedBackgroundHoverPreviewRequest): void {
  const card = request.element
  if (!isFeaturedBackgroundPickerOpen() || !card.isConnected) {
    clearFeaturedBackgroundHoverPreview(card)
    return
  }

  const imageUrl = request.imageUrl
  if (!imageUrl) {
    return
  }

  const fallbackUrl = request.resolvedPreviewUrl || imageUrl
  const position = getFeaturedBackgroundHoverPreviewPosition(card)
  featuredBackgroundPreviewCard = card
  dispatchNewtabFeaturedBackgroundHoverPreviewView({
    ariaLabel: `${request.title || '精选图库壁纸'} 大图预览`,
    height: position.height,
    left: position.left,
    src: fallbackUrl,
    top: position.top,
    visible: true,
    width: position.width
  })
  void resolveFeaturedBackgroundGalleryObjectUrl(imageUrl).then((cachedUrl) => {
    if (!cachedUrl || featuredBackgroundPreviewCard !== card) {
      return
    }
    dispatchNewtabFeaturedBackgroundHoverPreviewSrc(cachedUrl)
  })
}

function getFeaturedBackgroundHoverPreviewPosition(card: HTMLElement): {
  height: number
  left: number
  top: number
  width: number
} {
  const cardRect = card.getBoundingClientRect()
  const modal = getNewtabFeaturedBackgroundModalNodes().modal
  const modalRect = modal instanceof HTMLElement
    ? modal.getBoundingClientRect()
    : getNewtabViewportRect()
  const previewWidth = Math.max(180, Math.min(560, window.innerWidth - 32))
  const previewHeight = Math.round(previewWidth * 0.625)
  const gap = 14
  const minLeft = modalRect.left + 16
  const maxLeft = modalRect.right - previewWidth - 16
  const left = Math.min(
    Math.max(cardRect.right + gap, minLeft),
    Math.max(minLeft, maxLeft)
  )
  const belowTop = cardRect.bottom + gap
  const aboveTop = cardRect.top - previewHeight - gap
  const maxTop = modalRect.bottom - previewHeight - 16
  const top = belowTop <= maxTop
    ? belowTop
    : Math.max(modalRect.top + 16, aboveTop)

  return {
    height: previewHeight,
    left,
    top,
    width: previewWidth
  }
}

function clearFeaturedBackgroundHoverPreview(card?: HTMLElement): void {
  if (card && featuredBackgroundPreviewCard && featuredBackgroundPreviewCard !== card) {
    return
  }

  window.clearTimeout(featuredBackgroundPreviewTimer)
  featuredBackgroundPreviewTimer = 0
  featuredBackgroundPreviewCard = null
  dispatchNewtabFeaturedBackgroundHoverPreviewHidden()
}

function applyFeaturedBackgroundDisplayPreferences(): void {
  const displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
  dispatchNewtabInstantWallpaperView({
    backgroundColor: getBackgroundPlaceholderColor(state.backgroundSettings),
    placeholderColor: getBackgroundPlaceholderColor(state.backgroundSettings),
    position: displayCss.backgroundPosition,
    size: displayCss.backgroundSize
  })
  dispatchNewtabBackgroundMediaView({
    backgroundPosition: displayCss.backgroundPosition,
    backgroundSize: displayCss.backgroundSize
  })
  updateInstantWallpaperDisplayCss(lastAppliedBackgroundMediaSignature, displayCss)
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, lastAppliedBackgroundMediaSignature || undefined)
}

function updateInstantWallpaperDisplayCss(
  mediaKey: string,
  displayCss = getBackgroundDisplayCssForSettings(state.backgroundSettings)
): void {
  if (!mediaKey) {
    return
  }
  const instantWallpaper = readInstantWallpaper()
  const instantWallpaperKey = instantWallpaper?.signature
  if (!instantWallpaper || instantWallpaperKey !== mediaKey) {
    return
  }
  saveInstantWallpaper({
    ...instantWallpaper,
    backgroundSize: displayCss.backgroundSize,
    backgroundPosition: displayCss.backgroundPosition,
    updatedAt: Date.now()
  })
  syncInstantWallpaperTargetForSettings(state.backgroundSettings, mediaKey)
}

function syncFeaturedBackgroundDisplayPreferenceControls(): void {
  dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
}

function syncFeaturedBackgroundModalControls(): void {
  state.featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences(state.featuredBackgroundPreferences)
  syncFeaturedBackgroundDisplayPreferenceControls()
  dispatchNewtabFeaturedBackgroundModalControls({
    refreshing: state.featuredBackgroundRefreshing,
    status: state.featuredBackgroundStatus,
    statusTone: state.featuredBackgroundStatusTone
  })
}

function isFeaturedBackgroundFavorite(featuredId: string): boolean {
  return state.featuredBackgroundFavoriteIds.includes(featuredId)
}

function scheduleFeaturedBackgroundPreferencesSave(): void {
  window.clearTimeout(featuredBackgroundPreferencesSaveTimer)
  featuredBackgroundPreferencesSaveTimer = window.setTimeout(() => {
    featuredBackgroundPreferencesSaveTimer = 0
    void saveFeaturedBackgroundPreferences().catch((error) => {
      console.warn('精选图库显示设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

async function saveFeaturedBackgroundPreferences(): Promise<void> {
  window.clearTimeout(featuredBackgroundPreferencesSaveTimer)
  featuredBackgroundPreferencesSaveTimer = 0
  state.featuredBackgroundPreferences = normalizeFeaturedBackgroundPreferences(state.featuredBackgroundPreferences)
  await setLocalStorage({
    [STORAGE_KEYS.newTabFeaturedBackgroundPreferences]: state.featuredBackgroundPreferences
  })
}

async function toggleFeaturedBackgroundFavorite(featuredId: string): Promise<void> {
  const id = String(featuredId || '').trim()
  if (!id) {
    return
  }

  const favoriteSet = new Set(state.featuredBackgroundFavoriteIds)
  if (favoriteSet.has(id)) {
    favoriteSet.delete(id)
  } else {
    favoriteSet.add(id)
  }
  state.featuredBackgroundFavoriteIds = [...favoriteSet]
  await saveFeaturedBackgroundFavorites()
  const gallery = await loadBackgroundGalleryModule()
  if (isFeaturedBackgroundPickerOpen()) {
    renderFeaturedBackgroundPicker(gallery)
  }
}

async function downloadFeaturedBackgroundFromPicker(featuredId: string): Promise<void> {
  const id = String(featuredId || '').trim()
  if (!id) {
    return
  }

  try {
    const item = await getFeaturedBackgroundDownloadItem(id)
    const imageUrl = normalizeBackgroundImageUrl(String(item?.imageUrl || ''))
    if (!item || !imageUrl) {
      setFeaturedBackgroundStatus('没有找到可下载的精选图。', 'warning')
      syncFeaturedBackgroundModalControls()
      return
    }

    const permissionGranted = await ensureBackgroundImageFetchPermission(imageUrl, { request: true })
    if (!permissionGranted) {
      setFeaturedBackgroundStatus('未完成图片访问授权，暂时无法下载。', 'warning')
      syncFeaturedBackgroundModalControls()
      return
    }

    setFeaturedBackgroundStatus(`正在下载 ${item.title}...`, 'info')
    syncFeaturedBackgroundModalControls()
    const blob = await fetchFeaturedBackgroundDownloadBlob(imageUrl)
    downloadBlobFile(getFeaturedBackgroundDownloadFilename(item, blob), blob)
    setFeaturedBackgroundStatus(`已开始下载 ${item.title}。`, 'success')
  } catch (error) {
    setFeaturedBackgroundStatus(getFeaturedBackgroundDownloadErrorMessage(error), 'error')
  } finally {
    syncFeaturedBackgroundModalControls()
  }
}

async function getFeaturedBackgroundDownloadItem(featuredId: string): Promise<FeaturedBackgroundItem | null> {
  const storedItem = getStoredFeaturedBackgroundItemById(featuredId)
  if (storedItem) {
    return storedItem
  }

  const gallery = backgroundGalleryModule || await loadBackgroundGalleryModule()
  return gallery.getFeaturedBackgroundItemById(featuredId)
}

async function saveFeaturedBackgroundFavorites(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabFeaturedBackgroundFavorites]: state.featuredBackgroundFavoriteIds
  })
}

async function saveFeaturedBackgroundGallery(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.newTabFeaturedBackgroundGallery]: state.featuredBackgroundGallery
  })
}

async function refreshFeaturedBackgroundGallery(): Promise<void> {
  if (state.featuredBackgroundRefreshing) {
    return
  }

  state.featuredBackgroundRefreshing = true
  setFeaturedBackgroundStatus('正在从开放图库拉取高清图...', 'info')
  syncFeaturedBackgroundModalControls()
  try {
    const permissionGranted = await ensureFeaturedBackgroundPermissions()
    if (!permissionGranted) {
      setFeaturedBackgroundStatus('未完成图库访问授权，暂时无法刷新。', 'warning')
      return
    }
    const refreshModule = await loadBackgroundGalleryRefreshModule()
    const fetchedItems = await refreshModule.fetchFreshFeaturedBackgroundItems({
      fetchJson,
      getImageSize: getRemoteImageSize
    }, {
      refreshSeed: `${getFeaturedBackgroundDateSeed()}:${Date.now()}`
    })
    if (!fetchedItems.length) {
      setFeaturedBackgroundStatus('没有拉取到满足高清要求的新图片。', 'warning')
      return
    }

    state.featuredBackgroundGallery = refreshModule.mergeFeaturedGalleryRefresh({
      existingItems: state.featuredBackgroundGallery,
      favoriteIds: state.featuredBackgroundFavoriteIds,
      fetchedItems
    })
    await saveFeaturedBackgroundGallery()
    const fetchedProviderCount = refreshModule.getFeaturedBackgroundRefreshProviderCount(fetchedItems)
    const providerText = fetchedProviderCount ? `，来自 ${fetchedProviderCount} 个渠道` : ''
    setFeaturedBackgroundStatus(
      `已拉取 ${fetchedItems.length} 张高分辨率图片${providerText}，收藏图片已保留。`,
      'success'
    )
    featuredBackgroundPickerRenderKey = ''
    await renderFeaturedBackgroundPickerAfterRefresh()
    void clearFeaturedBackgroundPreviewCache().catch((cacheError) => {
      console.warn('精选图库预览缓存清除失败。', cacheError)
    })
  } catch (error) {
    setFeaturedBackgroundStatus(getFeaturedBackgroundRefreshErrorMessage(error), 'error')
  } finally {
    state.featuredBackgroundRefreshing = false
    syncFeaturedBackgroundModalControls()
  }
}

async function renderFeaturedBackgroundPickerAfterRefresh(): Promise<void> {
  try {
    const gallery = await loadBackgroundGalleryModule()
    renderFeaturedBackgroundPicker(gallery)
  } catch (error) {
    console.warn('精选图库已刷新，但弹窗列表更新失败。', error)
  }
}

async function ensureFeaturedBackgroundPermissions(): Promise<boolean> {
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    return true
  }
  const refreshModule = await loadBackgroundGalleryRefreshModule()
  const query = { origins: refreshModule.getFeaturedBackgroundRefreshRequestOrigins() }
  if (await containsChromePermissions(query)) {
    return true
  }
  return requestChromePermissions(query)
}

function containsChromePermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains(query, (granted) => {
      if (chrome.runtime.lastError) {
        resolve(false)
        return
      }
      resolve(Boolean(granted))
    })
  })
}

function requestChromePermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request(query, (granted) => {
      if (chrome.runtime.lastError) {
        resolve(false)
        return
      }
      resolve(Boolean(granted))
    })
  })
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`)
  }
  return response.json()
}

function getRemoteImageSize(imageUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timeout = 0

    const settle = (size: { width: number; height: number } | null) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      resolve(size)
    }

    timeout = window.setTimeout(() => settle(null), REMOTE_BACKGROUND_READY_TIMEOUT_MS)
    image.onload = () => {
      settle({
        width: image.naturalWidth,
        height: image.naturalHeight
      })
    }
    image.onerror = () => settle(null)
    image.src = imageUrl
  })
}

function setFeaturedBackgroundStatus(
  message: string,
  tone: 'info' | 'success' | 'warning' | 'error' = 'info'
): void {
  state.featuredBackgroundStatus = message
  state.featuredBackgroundStatusTone = tone
}

function getFeaturedBackgroundRefreshErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/permission|denied|权限/i.test(message)) {
    return '图库刷新失败：没有第三方图库访问权限。'
  }
  if (/请求失败|status|404|403|401|500/i.test(message)) {
    return '图库刷新失败：图库接口暂时不可用，请稍后重试。'
  }
  return '图库刷新失败：请检查网络后重试。'
}

function selectFeaturedBackgroundFromPicker(featuredId: string): void {
  handleBackgroundSettingFieldChange('featuredId', featuredId)
  closeFeaturedBackgroundPicker()
}

function getFeaturedBackgroundPickerLabel(settings = state.backgroundSettings): string {
  const activeItem = getActiveFeaturedBackgroundItemSync(settings)
  if (!settings.featuredId) {
    return activeItem ? `精选图库 · ${activeItem.title}` : '选择壁纸'
  }

  return activeItem?.title || '当前精选图片'
}

async function hydrateFeaturedBackgroundCredit(settings: typeof DEFAULT_BACKGROUND_SETTINGS): Promise<void> {
  const hydrateVersion = ++featuredBackgroundUiVersion
  try {
    if (hydrateVersion !== featuredBackgroundUiVersion) {
      return
    }
    await getActiveFeaturedBackgroundItem(settings)
    dispatchNewtabBackgroundSettingsView(createBackgroundSettingsView())
  } catch {
    // The credit link is an enhancement for featured backgrounds; keep the generic source link if loading fails.
  }
}

function submitSearch(value: string, openAllEnabled = false): void {
  const query = String(value || '').trim()
  if (!query) {
    return
  }

  const directUrl = getDirectNavigationUrl(query)
  if (directUrl) {
    openSearchTarget(directUrl)
    return
  }

  if (state.searchSettings.webSearchEnabled === false) {
    return
  }

  const targets = planSearchOpenTargets(
    query,
    state.searchSettings.engine,
    state.searchSettings.enabledEngines,
    openAllEnabled,
    SEARCH_MULTI_OPEN_LIMIT
  )
  openSearchTargets(targets.map((target) => target.url))
}

function getDirectNavigationUrl(value: string): string {
  const rawUrl = String(value || '').trim()
  if (!rawUrl || /\s/.test(rawUrl)) {
    return ''
  }

  const hasScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(rawUrl)
  const looksLikeDomain =
    rawUrl.includes('.') ||
    /^localhost(?::\d+)?(?:\/|$)/i.test(rawUrl) ||
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(rawUrl)
  if (!hasScheme && !looksLikeDomain) {
    return ''
  }

  const candidate = hasScheme ? rawUrl : `https://${rawUrl}`
  try {
    const parsedUrl = new URL(candidate)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return ''
    }
    return parsedUrl.href
  } catch {
    return ''
  }
}

function openSearchTarget(targetUrl: string): void {
  openSearchTargets([targetUrl])
}

function openSearchTargets(targetUrls: string[]): void {
  const urls = targetUrls.filter(Boolean)
  if (!urls.length) {
    return
  }

  if (urls.length > 1) {
    for (const url of urls.slice(0, SEARCH_MULTI_OPEN_LIMIT)) {
      const opened = window.open(url, '_blank', 'noopener')
      if (opened) {
        opened.opener = null
      }
    }
    return
  }

  const targetUrl = urls[0]
  if (state.searchSettings.openInNewTab) {
    const opened = window.open(targetUrl, '_blank', 'noopener')
    if (opened) {
      opened.opener = null
    }
    return
  }

  window.location.assign(targetUrl)
}

function normalizeTimeSettingsLocal(rawSettings: unknown): NewTabTimeSettings {
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return { ...DEFAULT_TIME_SETTINGS }
  }

  const settings = rawSettings as Record<string, unknown>
  const rawDateFormat = String(settings.dateFormat)
  const dateFormat = rawDateFormat === 'iso'
    ? 'year-month-day'
    : rawDateFormat === 'auto' || rawDateFormat === 'zh'
      ? 'month-day-weekday'
      : rawDateFormat
  const timeZone = String(settings.timeZone)
  const displayMode = String(settings.displayMode)
  const density = String(settings.density)

  return {
    enabled: settings.enabled !== false,
    showSeconds: settings.showSeconds === true,
    hour12: settings.hour12 === true,
    clockSize: clampNumber(settings.clockSize, 70, 140, DEFAULT_TIME_SETTINGS.clockSize),
    dateFormat: (dateFormat || DEFAULT_TIME_SETTINGS.dateFormat) as NewTabTimeSettings['dateFormat'],
    timeZone: (timeZone || DEFAULT_TIME_SETTINGS.timeZone) as NewTabTimeSettings['timeZone'],
    displayMode: displayMode === 'time' || displayMode === 'date' || displayMode === 'time-date'
      ? displayMode as NewTabTimeSettings['displayMode']
      : DEFAULT_TIME_SETTINGS.displayMode,
    density: density === 'compact' || density === 'balanced' || density === 'comfortable'
      ? density as NewTabTimeSettings['density']
      : DEFAULT_TIME_SETTINGS.density
  }
}

function syncTimeSettingsControls(): void {
  const settings = state.timeSettings
  dispatchNewtabTimeSettingsView(createNewtabTimeSettingsView(settings))
}

async function saveTimeSettings(): Promise<void> {
  await saveSettingsWithFeedback({
    [STORAGE_KEYS.newTabTimeSettings]: state.timeSettings
  })
}

function scheduleTimeSettingsSave(): void {
  window.clearTimeout(timeSettingsSaveTimer)
  timeSettingsSaveTimer = window.setTimeout(() => {
    timeSettingsSaveTimer = 0
    void saveTimeSettings().catch((error) => {
      console.warn('新标签页时间设置保存失败。', error)
    })
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function scheduleClockTick(): void {
  window.clearTimeout(clockTimer)
  const delay = getClockUpdateDelayLocal(new Date(), state.timeSettings)
  if (delay <= 0) {
    clockTimer = 0
    return
  }

  clockTimer = window.setTimeout(() => {
    clockTimer = 0
    updateClockText()
    scheduleClockTick()
  }, delay)
}

function updateClockText(): void {
  if (!timeSettingsModule) {
    updateClockTextFallback()
    void hydrateClockText()
    return
  }

  const now = new Date()
  const settings = timeSettingsModule.normalizeTimeSettings(state.timeSettings)
  state.timeSettings = settings
  dispatchNewtabClockView({
    ariaLabel: timeSettingsModule.getClockAriaLabel(now, settings),
    dateDateTime: timeSettingsModule.formatClockDateTime(now, settings),
    dateText: timeSettingsModule.formatClockDate(now, settings),
    periodText: timeSettingsModule.formatClockPeriod(now, settings),
    settings,
    timeDateTime: timeSettingsModule.formatClockTimeDateTime(now, settings),
    timeText: timeSettingsModule.formatClockTime(now, settings)
  })
}

function updateClockTextFallback(): void {
  const now = new Date()
  dispatchNewtabClockView(createFallbackClockWidgetState(now, state.timeSettings))
}

function createFallbackClockWidgetState(
  date: Date,
  settings: NewTabTimeSettings
): NewtabClockView {
  return {
    ariaLabel: getFallbackClockAriaLabel(date, settings),
    dateDateTime: getFallbackClockDateTime(date),
    dateText: formatFallbackClockDate(date),
    periodText: formatFallbackClockPeriod(date),
    settings,
    timeDateTime: getFallbackClockTimeDateTime(date),
    timeText: formatFallbackClockTime(date, settings)
  }
}

function hydrateClockText(): void {
  const hydrateVersion = ++clockHydrationVersion
  void loadTimeSettingsModule()
    .then((timeSettings) => {
      if (hydrateVersion !== clockHydrationVersion) {
        return
      }
      updateClockText()
      scheduleClockTick()
    })
    .catch(() => {
      scheduleClockTick()
    })
}

function getClockUpdateDelayLocal(date: Date, settings: NewTabTimeSettings): number {
  if (!settings.enabled) {
    return 0
  }
  if (timeSettingsModule) {
    return timeSettingsModule.getClockUpdateDelay(date, settings)
  }
  const milliseconds = date.getMilliseconds()
  if (settings.displayMode === 'date') {
    return 60 * 60 * 1000
  }
  if (settings.showSeconds) {
    return Math.max(250, 1000 - milliseconds + 25)
  }
  return Math.max(1000, (60 - date.getSeconds()) * 1000 - milliseconds + 25)
}

function formatFallbackClockTime(date: Date, settings: NewTabTimeSettings): string {
  let hours = date.getHours()
  if (settings.hour12) {
    hours = hours % 12 || 12
  }
  const parts = [
    String(hours).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ]
  if (settings.showSeconds) {
    parts.push(String(date.getSeconds()).padStart(2, '0'))
  }
  return parts.join(':')
}

function formatFallbackClockPeriod(date: Date): string {
  return date.getHours() < 12 ? 'AM' : 'PM'
}

function formatFallbackClockDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${date.getFullYear()}.${month}.${day} ${weekday}`
}

function getFallbackClockAriaLabel(date: Date, settings: NewTabTimeSettings): string {
  const parts: string[] = []
  if (settings.displayMode !== 'date') {
    parts.push(settings.hour12
      ? `${formatFallbackClockTime(date, settings)} ${formatFallbackClockPeriod(date)}`
      : formatFallbackClockTime(date, settings))
  }
  if (settings.displayMode !== 'time') {
    parts.push(formatFallbackClockDate(date))
  }
  return parts.join('，')
}

function getFallbackClockTimeDateTime(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join(':')
}

function getFallbackClockDateTime(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

function formatBytes(bytes: number): string {
  const size = Math.max(0, Number(bytes) || 0)
  if (size < 1024) {
    return `${Math.round(size)} B`
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const color = String(value || '').trim()
  if (/^#[\da-f]{6}$/i.test(color)) {
    return color.toLowerCase()
  }
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((char) => `${char}${char}`).join('')}`.toLowerCase()
  }
  return fallback
}

function getFaviconUrl(url: string, bookmarkId = ''): string {
  const refreshToken = bookmarkId ? state.faviconRefreshTokens.get(bookmarkId) : 0
  return buildChromeFaviconUrl(
    chrome.runtime.getURL('/_favicon/'),
    url,
    {
      size: FAVICON_SIZE,
      cacheToken: refreshToken
    }
  )
}

function getFallbackLabel(title: string): string {
  const trimmed = title.trim()
  return (trimmed[0] || '*').toUpperCase()
}

function formatNewTabLocalDate(value: unknown): string {
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

