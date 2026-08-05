import type { BookmarkTagIndex, BookmarkTagRecord } from '../shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotRecord
} from '../shared/content-snapshots.js'
import type { BookmarkRecord } from '../shared/types.js'
import type { NaturalSearchPlan, NaturalSearchResultSet } from '../popup/natural-search.js'
import { indexBookmarkForSearch, searchBookmarksTopK } from '../popup/search-lookup.js'
import { extractDomain, normalizeSearchTextCompact } from '../shared/text.js'
import type { PopupSearchBookmark } from '../popup/search.js'
import { requiresPinyinTokens } from '../shared/search/pinyin-query.js'

export type NewTabContentState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'missing-folder'; reason: 'none-selected' | 'selected-unavailable' }
  | { type: 'bookmarks' }

export interface ResolveNewTabContentStateInput {
  loading: boolean
  error: string
  selectedFolderCount: number
  visibleFolderCount: number
}

export interface NewTabOnboardingModule {
  id: 'onboarding'
  kind: 'onboarding'
  onOpenFolderSettings: () => void
  onSkip: () => void
  placement: 'utility'
}

export interface NewTabClockModule {
  id: 'clock'
  kind: 'clock'
  placement: 'utility'
}

export interface NewTabClockSpacerModule {
  id: 'clock-spacer'
  kind: 'clock-spacer'
  placement: 'utility'
}

export interface NewTabSearchModule {
  id: 'search'
  kind: 'search'
  placement: 'utility'
}

export interface NewTabBookmarksModule {
  id: 'bookmarks'
  iconVerticalCenter: boolean
  kind: 'bookmarks'
  placement: 'primary'
}

export interface NewTabLoadingModule {
  kind: 'loading'
  id: 'state'
  label: string
  placement: 'primary'
}

export interface NewTabMissingFolderModule extends MissingFolderViewOptions {
  kind: 'missing-folder'
  id: 'state'
  placement: 'primary'
}

export type NewTabPageModule =
  | NewTabBookmarksModule
  | NewTabClockModule
  | NewTabClockSpacerModule
  | NewTabLoadingModule
  | NewTabMissingFolderModule
  | NewTabOnboardingModule
  | NewTabSearchModule

export interface NewTabPageOptions {
  modules: NewTabPageModule[]
}

export interface NewTabPageView {
  contentState: 'bookmarks' | 'empty'
  hasClock: boolean
  hasSearch: boolean
  iconVerticalCenter: string
  modules: NewTabPageModule[]
  primaryCollisionOffsetY: number
  type: 'page'
}

export interface NewTabStateView {
  action?: () => void
  actionLabel?: string
  message: string
  type: 'state'
}

export type NewTabContentView = NewTabPageView | NewTabStateView

export interface NewTabSearchIndexBookmark {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface NewTabSearchIndexSection {
  title: string
  path: string
  bookmarks: NewTabSearchIndexBookmark[]
}

export interface NewTabSearchIndexSource {
  bookmarks: BookmarkRecord[]
  tagIndex?: BookmarkTagIndex | null
  snapshotIndex?: ContentSnapshotIndex | null
}

export interface NewTabSourceNavigationSection {
  id: string
  title: string
  path: string
  bookmarks: NewTabSearchIndexBookmark[]
}

export interface NewTabSourceNavigationItem {
  id: string
  anchorId: string
  title: string
  path: string
  bookmarkCount: number
}

export interface NewTabSearchIndexEntry {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  normalizedTitle: string
  normalizedUrl: string
  normalizedFolderTitle: string
  normalizedSearchText: string
  order: number
  sourceDateAdded?: number
  sourceBookmark?: BookmarkRecord
  sourceTagRecord?: BookmarkTagRecord | null
  sourceSnapshotRecord?: ContentSnapshotRecord | null
}

export interface NewTabPopupSearchSourceEntry {
  entryId: string
  bookmark: BookmarkRecord
  tagRecord: BookmarkTagRecord | null
  snapshotRecord: ContentSnapshotRecord | null
}

export interface NewTabPreparedSearchIndex {
  entries: NewTabSearchIndexEntry[]
  entriesById: Map<string, NewTabSearchIndexEntry>
  popupSearchEntries: NewTabPopupSearchSourceEntry[]
  popupSearchBookmarks?: PopupSearchBookmark[]
  popupSearchPinyinReady?: boolean
  supportsPopupSearch: boolean
}

export interface SearchBookmarkSuggestion {
  id: string
  title: string
  url: string
  folderTitle: string
  folderPath: string
  score: number
  order: number
}

export interface PortalBookmarkActivityRecord {
  bookmarkId: string
  openCount: number
  lastOpenedAt: number
}

export interface PortalBookmarkSourceItem {
  id: string
  title?: string
  url?: string
  dateAdded?: number
}

export interface BookmarkTreeSourceItem extends PortalBookmarkSourceItem {
  children?: BookmarkTreeSourceItem[]
}

export interface MissingFolderViewOptions {
  creatingFolder: boolean
  reason: 'none-selected' | 'selected-unavailable'
  onCreateFolder: () => void
  onOpenFolderSettings: () => void
}

export interface VerticalCenterCollisionOffsetInput {
  utilityBottom: number
  contentTop: number
  minimumGap?: number
}

export interface AdaptiveSearchOffsetBoundsInput {
  currentOffsetY: number
  searchTop: number
  searchBottom: number
  viewportTop: number
  viewportBottom: number
  previousModuleBottom?: number
  primaryContentTop?: number
  minimumGap?: number
  minimumRange?: number
  absoluteMin?: number
  absoluteMax?: number
}

export interface AdaptiveSearchOffsetBounds {
  min: number
  max: number
}

export interface AutoCenteredSearchOffsetInput {
  currentOffsetY: number
  searchTop: number
  searchBottom: number
  viewportTop: number
  viewportBottom: number
  previousModuleBottom?: number
  nextModuleTop?: number
  minimumGap?: number
  minOffsetY?: number
  maxOffsetY?: number
  fallbackOffsetY?: number
}

export interface AdaptiveSearchWidthBoundsInput {
  viewportWidth: number
  containerWidth: number
  minWidthVw?: number
  maxWidthVw?: number
  minWidthPx?: number
}

const DEFAULT_VERTICAL_CENTER_COLLISION_GAP = 12
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_GAP = 12
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_MINIMUM_RANGE = 24
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_MIN = -240
const DEFAULT_ADAPTIVE_SEARCH_OFFSET_MAX = 240
const DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_VW = 16
const DEFAULT_ADAPTIVE_SEARCH_WIDTH_MAX_VW = 72
const DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_PX = 220

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

export function getVerticalCenterCollisionOffset({
  utilityBottom,
  contentTop,
  minimumGap = DEFAULT_VERTICAL_CENTER_COLLISION_GAP
}: VerticalCenterCollisionOffsetInput): number {
  const requiredTop = utilityBottom + Math.max(0, minimumGap)
  const offset = Math.ceil(requiredTop - contentTop)
  if (!Number.isFinite(offset)) {
    return 0
  }
  return Math.max(0, offset)
}

export function getAdaptiveSearchOffsetBounds({
  currentOffsetY,
  searchTop,
  searchBottom,
  viewportTop,
  viewportBottom,
  previousModuleBottom,
  primaryContentTop,
  minimumGap = DEFAULT_ADAPTIVE_SEARCH_OFFSET_GAP,
  minimumRange = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MINIMUM_RANGE,
  absoluteMin = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MIN,
  absoluteMax = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MAX
}: AdaptiveSearchOffsetBoundsInput): AdaptiveSearchOffsetBounds {
  const safeGap = Math.max(0, minimumGap)
  const minBound = Math.min(absoluteMin, absoluteMax)
  const maxBound = Math.max(absoluteMin, absoluteMax)
  const currentOffset = Number.isFinite(currentOffsetY) ? currentOffsetY : 0
  const safeViewportTop = Number.isFinite(viewportTop) ? viewportTop : 0
  const safeViewportBottom = Number.isFinite(viewportBottom) ? viewportBottom : safeViewportTop
  const topCandidates = [safeViewportTop + safeGap]

  if (Number.isFinite(previousModuleBottom)) {
    topCandidates.push(Number(previousModuleBottom) + safeGap)
  }

  const bottomCandidates = [safeViewportBottom - safeGap]
  if (Number.isFinite(primaryContentTop)) {
    bottomCandidates.push(Number(primaryContentTop) - safeGap)
  }

  const minimumTop = Math.max(...topCandidates)
  const maximumBottom = Math.min(...bottomCandidates)
  const measuredMin = Math.floor(currentOffset + minimumTop - searchTop)
  const measuredMax = Math.ceil(currentOffset + maximumBottom - searchBottom)

  if (!Number.isFinite(measuredMin) || !Number.isFinite(measuredMax)) {
    const fallback = Math.min(maxBound, Math.max(minBound, currentOffset))
    return { min: fallback, max: fallback }
  }

  const min = Math.min(maxBound, Math.max(minBound, measuredMin))
  const max = Math.min(maxBound, Math.max(minBound, measuredMax))
  if (max < min) {
    const fallback = Math.min(maxBound, Math.max(minBound, currentOffset))
    const halfRange = Math.max(1, Math.ceil(minimumRange / 2))
    return {
      min: Math.max(minBound, fallback - halfRange),
      max: Math.min(maxBound, fallback + halfRange)
    }
  }

  return { min, max }
}

export function getAutoCenteredSearchOffsetY({
  currentOffsetY,
  searchTop,
  searchBottom,
  viewportTop,
  viewportBottom,
  previousModuleBottom,
  nextModuleTop,
  minimumGap = DEFAULT_ADAPTIVE_SEARCH_OFFSET_GAP,
  minOffsetY = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MIN,
  maxOffsetY = DEFAULT_ADAPTIVE_SEARCH_OFFSET_MAX,
  fallbackOffsetY = currentOffsetY
}: AutoCenteredSearchOffsetInput): number {
  const min = Math.min(minOffsetY, maxOffsetY)
  const max = Math.max(minOffsetY, maxOffsetY)
  const fallback = clampNumber(fallbackOffsetY, min, max, 0)
  const safeGap = Math.max(0, minimumGap)
  const safeViewportTop = Number.isFinite(viewportTop) ? viewportTop : 0
  const safeViewportBottom = Number.isFinite(viewportBottom) ? viewportBottom : safeViewportTop
  const topCandidates = [safeViewportTop + safeGap]
  const bottomCandidates = [safeViewportBottom - safeGap]

  if (Number.isFinite(previousModuleBottom)) {
    topCandidates.push(Number(previousModuleBottom) + safeGap)
  }
  if (Number.isFinite(nextModuleTop)) {
    bottomCandidates.push(Number(nextModuleTop) - safeGap)
  }

  const availableTop = Math.max(...topCandidates)
  const availableBottom = Math.min(...bottomCandidates)
  const searchHeight = searchBottom - searchTop

  if (
    !Number.isFinite(currentOffsetY) ||
    !Number.isFinite(searchTop) ||
    !Number.isFinite(searchBottom) ||
    !Number.isFinite(searchHeight) ||
    searchHeight <= 0 ||
    !Number.isFinite(availableTop) ||
    !Number.isFinite(availableBottom) ||
    availableBottom <= availableTop
  ) {
    return fallback
  }

  const centeredTop = availableTop + ((availableBottom - availableTop - searchHeight) / 2)
  const offset = Math.round(currentOffsetY + centeredTop - searchTop)
  return clampNumber(offset, min, max, fallback)
}

export function getAdaptiveSearchWidthBounds({
  viewportWidth,
  containerWidth,
  minWidthVw = DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_VW,
  maxWidthVw = DEFAULT_ADAPTIVE_SEARCH_WIDTH_MAX_VW,
  minWidthPx = DEFAULT_ADAPTIVE_SEARCH_WIDTH_MIN_PX
}: AdaptiveSearchWidthBoundsInput): { min: number; max: number } {
  const min = Math.max(1, Math.floor(Math.min(minWidthVw, maxWidthVw)))
  const absoluteMax = Math.max(min, Math.ceil(Math.max(minWidthVw, maxWidthVw)))
  const safeViewportWidth = Math.max(1, viewportWidth)
  const safeContainerWidth = Math.max(0, containerWidth)
  const minWidthPercent = Math.ceil((Math.max(0, minWidthPx) / safeViewportWidth) * 100)
  const availableWidthPercent = Math.floor((safeContainerWidth / safeViewportWidth) * 100)
  const max = Math.min(
    absoluteMax,
    Math.max(min, minWidthPercent, availableWidthPercent)
  )

  return { min, max }
}

export function resolveNewTabContentState(
  input: ResolveNewTabContentStateInput
): NewTabContentState {
  if (input.loading) {
    return { type: 'loading' }
  }

  if (input.error) {
    return { type: 'error', message: input.error }
  }

  if (!input.visibleFolderCount) {
    return {
      type: 'missing-folder',
      reason: input.selectedFolderCount > 0 ? 'selected-unavailable' : 'none-selected'
    }
  }

  return { type: 'bookmarks' }
}

export interface NewTabSearchSuggestionOptions {
  now?: number
  naturalSearchPlan?: NaturalSearchPlan | null
}

export function buildNewTabSearchIndex(
  source: NewTabSearchIndexSection[] | NewTabSearchIndexSource
): NewTabSearchIndexEntry[] {
  if (!Array.isArray(source)) {
    return buildNewTabSearchIndexFromBookmarks(source)
  }

  const entries: NewTabSearchIndexEntry[] = []
  let order = 0

  for (const section of source) {
    const folderTitle = section.title || '未命名文件夹'
    const folderPath = section.path || section.title || ''
    const normalizedFolderTitle = normalizeNewTabSearchText(folderTitle)

    for (const bookmark of section.bookmarks) {
      const url = String(bookmark.url || '').trim()
      if (!url) {
        continue
      }

      const title = String(bookmark.title || '').trim() || url
      entries.push({
        id: String(bookmark.id),
        title,
        url,
        folderTitle,
        folderPath,
        normalizedTitle: normalizeNewTabSearchText(title),
        normalizedUrl: normalizeNewTabSearchText(url),
        normalizedFolderTitle,
        normalizedSearchText: buildNewTabEntrySearchText({
          title,
          url,
          folderTitle,
          folderPath
        }),
        order,
        sourceDateAdded: Number(bookmark.dateAdded) || 0
      })
      order += 1
    }
  }

  return entries
}

export function prepareNewTabSearchIndex(index: NewTabSearchIndexEntry[]): NewTabPreparedSearchIndex {
  const entriesById = new Map<string, NewTabSearchIndexEntry>()
  const popupSearchEntries: NewTabPopupSearchSourceEntry[] = []
  let supportsPopupSearch = true

  for (const entry of index) {
    entriesById.set(entry.id, entry)
    if (!entry.sourceBookmark) {
      supportsPopupSearch = false
      continue
    }
    popupSearchEntries.push({
      entryId: entry.id,
      bookmark: entry.sourceBookmark,
      tagRecord: entry.sourceTagRecord || null,
      snapshotRecord: entry.sourceSnapshotRecord || null
    })
  }

  return {
    entries: index,
    entriesById,
    popupSearchEntries,
    supportsPopupSearch
  }
}

function buildNewTabSearchIndexFromBookmarks({
  bookmarks,
  tagIndex = null,
  snapshotIndex = null
}: NewTabSearchIndexSource): NewTabSearchIndexEntry[] {
  const tagRecords = tagIndex?.records || {}
  const snapshotRecords = snapshotIndex?.records || {}

  return bookmarks
    .map((bookmark, order): NewTabSearchIndexEntry | null => {
      const url = String(bookmark.url || '').trim()
      if (!url) {
        return null
      }

      const title = String(bookmark.title || '').trim() || url
      const folderPath = String(bookmark.path || '').trim()
      const folderTitle = getNewTabSearchFolderTitle(folderPath)
      const tagRecord = tagRecords[bookmark.id] || null
      const snapshotRecord = snapshotRecords[bookmark.id] || null
      return {
        id: String(bookmark.id),
        title,
        url,
        folderTitle,
        folderPath,
        normalizedTitle: normalizeNewTabSearchText(bookmark.normalizedTitle || title),
        normalizedUrl: normalizeNewTabSearchText(bookmark.normalizedUrl || url),
        normalizedFolderTitle: normalizeNewTabSearchText(folderTitle),
        normalizedSearchText: buildNewTabEntrySearchText({
          bookmark,
          title,
          url,
          folderTitle,
          folderPath,
          tagRecord,
          snapshotRecord
        }),
        order,
        sourceDateAdded: Number(bookmark.dateAdded) || 0,
        sourceBookmark: bookmark,
        sourceTagRecord: tagRecord,
        sourceSnapshotRecord: snapshotRecord
      }
    })
    .filter((entry): entry is NewTabSearchIndexEntry => Boolean(entry))
}

function buildNewTabEntrySearchText({
  bookmark,
  title,
  url,
  folderTitle,
  folderPath,
  tagRecord = null,
  snapshotRecord = null
}: {
  bookmark?: BookmarkRecord
  title: string
  url: string
  folderTitle: string
  folderPath: string
  tagRecord?: BookmarkTagRecord | null
  snapshotRecord?: ContentSnapshotRecord | null
}): string {
  return [
    title,
    url,
    bookmark?.normalizedTitle,
    bookmark?.normalizedUrl,
    bookmark?.domain,
    folderTitle,
    folderPath,
    tagRecord?.summary,
    tagRecord?.contentType,
    ...(tagRecord?.topics || []),
    ...(tagRecord?.tags || []),
    ...(tagRecord?.manualTags || []),
    ...(tagRecord?.aliases || []),
    snapshotRecord?.title,
    snapshotRecord?.summary,
    snapshotRecord?.canonicalUrl,
    snapshotRecord?.finalUrl,
    snapshotRecord?.contentType,
    ...(snapshotRecord?.headings || [])
  ].flatMap(value => { const mappedResult = normalizeNewTabSearchText(String(value || '')); return mappedResult ? [mappedResult] : [] })
    .join(' ')
}

function getNewTabSearchFolderTitle(path: string): string {
  const parts = String(path || '').split('/').flatMap(part => { const mappedResult = part.trim(); return mappedResult ? [mappedResult] : [] })
  return parts.at(-1) || '未归档路径'
}

export function buildNewTabSourceNavigationItems(
  sections: NewTabSourceNavigationSection[]
): NewTabSourceNavigationItem[] {
  return sections
    .map((section) => {
      const id = String(section.id || '').trim()
      if (!id) {
        return null
      }

      const title = String(section.title || '').trim() || '未命名文件夹'
      return {
        id,
        anchorId: getNewTabSourceAnchorId(id),
        title,
        path: String(section.path || title).trim() || title,
        bookmarkCount: section.bookmarks.filter((bookmark) => String(bookmark.url || '').trim()).length
      }
    })
    .filter((item): item is NewTabSourceNavigationItem => Boolean(item))
}

export function getNewTabSourceAnchorId(sourceId: string): string {
  const normalizedId = String(sourceId || '').trim()
  const safeId = normalizedId
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `newtab-source-${safeId || 'folder'}`
}

function getSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[] | NewTabPreparedSearchIndex,
  limit: number,
  _options: NewTabSearchSuggestionOptions = {}
): SearchBookmarkSuggestion[] {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const preparedIndex = Array.isArray(index) ? prepareNewTabSearchIndex(index) : index
  const popupBookmarks = getFallbackPopupSearchBookmarks(preparedIndex.entries)
  const results = searchBookmarksTopK(query, popupBookmarks, limit)
  return results
    .map((result) => getSuggestionFromFallbackPopupResult(preparedIndex, result.id, result.score))
    .filter((suggestion): suggestion is SearchBookmarkSuggestion => Boolean(suggestion))
}

export async function getPopupSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[] | NewTabPreparedSearchIndex,
  limit: number,
  options: NewTabSearchSuggestionOptions = {}
): Promise<SearchBookmarkSuggestion[]> {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const preparedIndex = Array.isArray(index) ? prepareNewTabSearchIndex(index) : index
  if (!preparedIndex.supportsPopupSearch || !preparedIndex.popupSearchEntries.length) {
    return getSearchBookmarkSuggestionsFromIndex(query, preparedIndex, limit, options)
  }

  const popupBookmarks = getPreparedPopupSearchBookmarks(preparedIndex, indexBookmarkForSearch)
  await ensurePopupBookmarksHavePinyinIfNeeded(query, preparedIndex, popupBookmarks)

  return searchBookmarksTopK(query, popupBookmarks, limit)
    .map((result) => getSuggestionFromPopupResult(preparedIndex, result.id, result.score))
    .filter((suggestion): suggestion is SearchBookmarkSuggestion => Boolean(suggestion))
}

export async function getNaturalSearchBookmarkSuggestionsFromIndex(
  query: string,
  index: NewTabSearchIndexEntry[] | NewTabPreparedSearchIndex,
  limit: number,
  options: NewTabSearchSuggestionOptions = {}
): Promise<SearchBookmarkSuggestion[]> {
  const normalizedQuery = normalizeNewTabSearchText(query)
  if (!normalizedQuery || limit <= 0) {
    return []
  }

  const preparedIndex = Array.isArray(index) ? prepareNewTabSearchIndex(index) : index
  if (!preparedIndex.supportsPopupSearch || !preparedIndex.popupSearchEntries.length) {
    return getSearchBookmarkSuggestionsFromIndex(query, preparedIndex, limit, options)
  }

  const {
    buildLocalNaturalSearchPlan,
    filterBookmarksByNaturalDateRange,
    mergeNaturalSearchResultSets
  } = await import('../popup/natural-search.js')

  const plan = options.naturalSearchPlan || buildLocalNaturalSearchPlan(query, options.now)
  const popupBookmarks = getPreparedPopupSearchBookmarks(preparedIndex, indexBookmarkForSearch)
  const pinyinQuery = [query, ...plan.queries].find((value) => {
    return Boolean(value && requiresPinyinTokens(value))
  })
  if (pinyinQuery) {
    await ensurePopupBookmarksHavePinyinIfNeeded(pinyinQuery, preparedIndex, popupBookmarks)
  }
  const bookmarks = filterBookmarksByNaturalDateRange(popupBookmarks, plan)
  const resultSets: NaturalSearchResultSet[] = []
  const seenQueries = new Set<string>()

  const directQuery = normalizeNewTabSearchText(query)
  if (directQuery) {
    const directResults = searchBookmarksTopK(query, bookmarks, limit)
    if (directResults.length) {
      resultSets.push({ query, results: directResults })
      seenQueries.add(directQuery)
    }
  }

  for (const naturalQuery of plan.queries) {
    const normalizedNaturalQuery = normalizeNewTabSearchText(naturalQuery)
    if (!normalizedNaturalQuery || seenQueries.has(normalizedNaturalQuery)) {
      continue
    }

    seenQueries.add(normalizedNaturalQuery)
    const results = searchBookmarksTopK(naturalQuery, bookmarks, limit)
    if (results.length) {
      resultSets.push({ query: naturalQuery, results })
    }
  }

  if (!resultSets.length) {
    return []
  }

  return mergeNaturalSearchResultSets(plan, resultSets)
    .map((result) => getSuggestionFromPopupResult(preparedIndex, result.id, result.score))
    .filter((suggestion): suggestion is SearchBookmarkSuggestion => Boolean(suggestion))
    .slice(0, limit)
}

function getPreparedPopupSearchBookmarks(
  index: NewTabPreparedSearchIndex,
  indexBookmarkForSearch: typeof import('../popup/search-lookup.js').indexBookmarkForSearch
): PopupSearchBookmark[] {
  if (index.popupSearchBookmarks) {
    return index.popupSearchBookmarks
  }

  index.popupSearchBookmarks = index.popupSearchEntries.map((entry) =>
    indexBookmarkForSearch(entry.bookmark, entry.tagRecord, entry.snapshotRecord, {
      includeFullText: false
    })
  )
  return index.popupSearchBookmarks
}

async function ensurePopupBookmarksHavePinyinIfNeeded(
  query: string,
  index: NewTabPreparedSearchIndex,
  popupBookmarks: PopupSearchBookmark[]
): Promise<void> {
  if (index.popupSearchPinyinReady) {
    return
  }
  if (!query) {
    return
  }
  if (!requiresPinyinTokens(query)) {
    return
  }
  const { enrichPinyinTokensCooperatively } = await import('../shared/search/pinyin.js')
  await enrichPinyinTokensCooperatively(popupBookmarks)
  index.popupSearchPinyinReady = true
}

function getSuggestionFromPopupResult(
  index: NewTabPreparedSearchIndex,
  resultId: string,
  score: number
): SearchBookmarkSuggestion | null {
  const entry = index.entriesById.get(resultId)
  if (!entry) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    folderTitle: entry.folderTitle,
    folderPath: entry.folderPath,
    score,
    order: entry.order
  }
}

function getSuggestionFromFallbackPopupResult(
  index: NewTabPreparedSearchIndex,
  resultId: string,
  score: number
): SearchBookmarkSuggestion | null {
  const entry = index.entriesById.get(resultId)
  if (!entry) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    url: entry.url,
    folderTitle: entry.folderTitle,
    folderPath: entry.folderPath,
    score,
    order: entry.order
  }
}

function getFallbackPopupSearchBookmarks(entries: NewTabSearchIndexEntry[]): PopupSearchBookmark[] {
  return entries.map((entry) => {
    const url = String(entry.url || '').trim()
    const title = String(entry.title || '').trim() || url
    const folderPath = String(entry.folderPath || '').trim()
    const domain = extractDomain(url)
    const normalizedTitle = normalizeNewTabSearchText(title)
    const normalizedUrl = normalizeNewTabSearchText(url)
    const normalizedFolderPath = normalizeNewTabSearchText(folderPath)

    return {
      id: entry.id,
      title,
      url,
      displayUrl: url,
      normalizedTitle,
      normalizedUrl,
      duplicateKey: normalizedUrl || normalizedTitle || entry.id,
      domain,
      path: folderPath,
      ancestorIds: [],
      parentId: '',
      index: entry.order,
      dateAdded: Number(entry.sourceDateAdded || entry.sourceBookmark?.dateAdded) || 0,
      normalizedPath: normalizedFolderPath,
      tagSummary: '',
      tagContentType: '',
      tagTopics: [],
      tagTags: [],
      tagAliases: [],
      tagPinyinFull: [],
      tagPinyinInitials: [],
      searchTextCompact: normalizeSearchTextCompact([
        title,
        url,
        domain,
        entry.folderTitle,
        folderPath
      ].flatMap(value => { const mappedResult = normalizeNewTabSearchText(String(value || '')); return mappedResult ? [mappedResult] : [] })
        .join(' ')),
      searchText: [
        title,
        url,
        domain,
        entry.folderTitle,
        folderPath
      ].flatMap(value => { const mappedResult = normalizeNewTabSearchText(String(value || '')); return mappedResult ? [mappedResult] : [] })
        .join(' ')
    } as PopupSearchBookmark
  })
}

export function collectPortalBookmarkSourceItems(
  rootNode: BookmarkTreeSourceItem | null | undefined
): PortalBookmarkSourceItem[] {
  const bookmarks: PortalBookmarkSourceItem[] = []
  if (!rootNode) {
    return bookmarks
  }

  const walk = (node: BookmarkTreeSourceItem): void => {
    if (String(node.url || '').trim()) {
      bookmarks.push(node)
      return
    }

    for (const child of node.children || []) {
      walk(child)
    }
  }

  walk(rootNode)
  return bookmarks
}

export function normalizeNewTabSearchText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function createNewTabPage({ modules }: NewTabPageOptions): NewTabPageView {
  const bookmarkModule = modules.find(
    (module): module is NewTabBookmarksModule => module.kind === 'bookmarks'
  )

  return {
    contentState: bookmarkModule ? 'bookmarks' : 'empty',
    hasClock: modules.some((module) => module.id === 'clock'),
    hasSearch: modules.some((module) => module.id === 'search'),
    iconVerticalCenter: bookmarkModule ? String(bookmarkModule.iconVerticalCenter) : 'false',
    modules,
    primaryCollisionOffsetY: 0,
    type: 'page'
  }
}

export function createMissingFolderView({
  creatingFolder,
  reason,
  onCreateFolder,
  onOpenFolderSettings
}: MissingFolderViewOptions): NewTabMissingFolderModule {
  return {
    creatingFolder,
    id: 'state',
    kind: 'missing-folder',
    placement: 'primary',
    reason,
    onCreateFolder,
    onOpenFolderSettings
  }
}

export function createStateView(message: string, actionLabel = '', action?: () => void): NewTabStateView {
  return { action, actionLabel, message, type: 'state' }
}

export function createLoadingStateView(label = '正在加载书签'): NewTabLoadingModule {
  return {
    id: 'state',
    kind: 'loading',
    label,
    placement: 'primary'
  }
}
