import type { BookmarkTagIndex } from '../shared/bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotSettings
} from '../shared/content-snapshot-search.js'
import {
  loadContentSnapshotIndex,
  loadContentSnapshotSettings
} from '../shared/content-snapshot-search.js'
import type { BookmarkRecord } from '../shared/types.js'
import type {
  BookmarkCatalogSnapshot
} from '../shared/bookmark-catalog.js'
import type { CooperativeEnrichOptions } from '../shared/search/pinyin.js'
import {
  indexBookmarkForSearch,
  type PopupSearchBookmark
} from './search.js'

let pinyinModulePromise: Promise<typeof import('../shared/search/pinyin.js')> | null = null

function loadPinyinModule(): Promise<typeof import('../shared/search/pinyin.js')> {
  pinyinModulePromise ||= import('../shared/search/pinyin.js')
  return pinyinModulePromise
}

const POPUP_SNAPSHOT_FULL_TEXT_LIMIT = 600

export interface PopupSearchIndexSource {
  bookmarks: BookmarkRecord[]
  tagIndex: BookmarkTagIndex | null
  snapshotIndex?: ContentSnapshotIndex | null
  includeFullText?: boolean
}

export interface PopupSearchIndexSnapshotState {
  settings: ContentSnapshotSettings | null
  index: ContentSnapshotIndex | null
}

export function buildLightPopupSearchIndex({
  bookmarks,
  tagIndex,
  snapshotIndex = null
}: PopupSearchIndexSource): PopupSearchBookmark[] {
  const tagRecords = tagIndex?.records || {}
  const snapshotRecords = snapshotIndex?.records || {}

  return bookmarks.map((bookmark) =>
    indexBookmarkForSearch(
      bookmark,
      tagRecords[bookmark.id] || null,
      snapshotRecords[bookmark.id] || null,
      { includeFullText: false }
    )
  )
}

export async function loadPopupSearchIndexSnapshotState(): Promise<PopupSearchIndexSnapshotState> {
  const [settings, index] = await Promise.all([
    loadContentSnapshotSettings().catch(() => null),
    loadContentSnapshotIndex().catch(() => null)
  ])
  return { settings, index }
}

export async function enrichLightPopupSearchIndexWithPinyin(
  indexed: PopupSearchBookmark[],
  options: CooperativeEnrichOptions = {}
): Promise<{ processed: number; enriched: number; aborted: boolean }> {
  const { enrichPinyinTokensCooperatively } = await loadPinyinModule()
  return enrichPinyinTokensCooperatively(indexed, options)
}

export function shouldWarmPopupSnapshotFullText(
  snapshotState: PopupSearchIndexSnapshotState | null
): boolean {
  return Boolean(
    snapshotState?.settings?.fullTextSearchEnabled &&
    snapshotState.index &&
    Object.values(snapshotState.index.records || {}).some((record) =>
      (record.fullTextStorage === 'local' && Boolean(record.fullText)) ||
      (record.fullTextStorage === 'idb' && Boolean(record.fullTextRef))
    )
  )
}

export function buildLightPopupSearchIndexFromCatalog(
  catalog: BookmarkCatalogSnapshot
): PopupSearchBookmark[] {
  return buildLightPopupSearchIndex({
    bookmarks: catalog.extracted.bookmarks,
    tagIndex: catalog.tagIndex,
    snapshotIndex: catalog.snapshotState?.index || null
  })
}

export function patchLightPopupSearchIndexFromCatalog(
  indexed: PopupSearchBookmark[],
  catalog: BookmarkCatalogSnapshot
): number {
  return patchPopupSearchIndexFromCatalog(indexed, catalog, {
    includeFullText: false
  })
}

export async function enrichExistingPopupSearchIndexWithSnapshotFullTextFromCatalog(
  indexed: PopupSearchBookmark[],
  catalog: BookmarkCatalogSnapshot,
  options: {
    isActive?: () => boolean
  } = {}
): Promise<number> {
  const snapshotIndex = catalog.snapshotState?.index || null
  if (!snapshotIndex) {
    if (options.isActive && !options.isActive()) {
      return 0
    }
    return patchLightPopupSearchIndexFromCatalog(indexed, catalog)
  }

  if (options.isActive && !options.isActive()) {
    return 0
  }
  const { buildContentSnapshotSearchMapWithFullText } = await import('../shared/content-snapshots.js')
  const snapshotSearchMap = await buildContentSnapshotSearchMapWithFullText(snapshotIndex, {
    includeFullText: true,
    maxRecords: POPUP_SNAPSHOT_FULL_TEXT_LIMIT
  }).catch(() => new Map<string, string>())
  const searchIndexStillActive = !(options.isActive && !options.isActive())
  if (!searchIndexStillActive) {
    return 0
  }

  return patchPopupSearchIndexFromCatalog(indexed, catalog, {
    includeFullText: true,
    snapshotSearchMap
  })
}

function patchPopupSearchIndexFromCatalog(
  indexed: PopupSearchBookmark[],
  catalog: BookmarkCatalogSnapshot,
  {
    includeFullText,
    snapshotSearchMap = null
  }: {
    includeFullText: boolean
    snapshotSearchMap?: Map<string, string> | null
  }
): number {
  const tagRecords = catalog.tagIndex?.records || {}
  const snapshotIndex = catalog.snapshotState?.index || null
  const snapshotRecords = snapshotIndex?.records || {}
  const sourceBookmarks = catalog.extracted.bookmarks
  let patched = 0

  for (let index = 0; index < indexed.length; index += 1) {
    const target = indexed[index]
    if (!target) {
      continue
    }

    const sourceBookmark = sourceBookmarks[index]?.id === target.id
      ? sourceBookmarks[index]
      : catalog.extracted.bookmarkMap.get(target.id) || target

    const next = indexBookmarkForSearch(
      sourceBookmark,
      tagRecords[target.id] || null,
      snapshotRecords[target.id] || null,
      { includeFullText }
    )
    const snapshotSearchText = snapshotSearchMap?.get(target.id)
    if (snapshotSearchText) {
      next.searchText = `${next.searchText} ${snapshotSearchText}`.trim()
    }

    patchPopupSearchBookmark(target, next)
    patched += 1
  }

  return patched
}

function patchPopupSearchBookmark(
  target: PopupSearchBookmark,
  next: PopupSearchBookmark
): void {
  Object.assign(target, next)
  target.tagPinyinFull = []
  target.tagPinyinInitials = []
  delete target.pinyinBaseSearchText
  delete target.pinyinEnriched
}
