import type { BookmarkTagIndex } from './bookmark-tags.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotSettings
} from './content-snapshots.js'
import { extractBookmarkData } from './bookmark-tree.js'
import type {
  BookmarkCatalogVersionFingerprint,
  ExtractedBookmarkData
} from './types.js'

const BOOKMARK_CATALOG_VERSION_PREFIX = 'bookmark-catalog-v2'
const BOOKMARK_CATALOG_HASH_SEED = 0x811c9dc5
const BOOKMARK_CATALOG_HASH_ALT_SEED = 0x9e3779b9
const BOOKMARK_CATALOG_HASH_MULTIPLIER = 0x01000193
const BOOKMARK_CATALOG_HASH_ALT_MULTIPLIER = 0x85ebca6b

export interface BookmarkCatalogSnapshotState {
  settings: ContentSnapshotSettings | null
  index: ContentSnapshotIndex | null
}

export interface BookmarkCatalogSnapshot {
  readonly version: string
  includeFullText: boolean
  extracted: ExtractedBookmarkData
  tagIndex: BookmarkTagIndex | null
  snapshotState: BookmarkCatalogSnapshotState | null
}

export interface BookmarkCatalogSnapshotInput {
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined
  tagIndex?: BookmarkTagIndex | null
  snapshotState?: BookmarkCatalogSnapshotState | null
  includeFullText?: boolean
  extracted?: ExtractedBookmarkData | null
}

export function buildBookmarkCatalogSnapshot({
  rootNode,
  tagIndex = null,
  snapshotState = null,
  includeFullText = false,
  extracted: prebuiltExtracted = null
}: BookmarkCatalogSnapshotInput): BookmarkCatalogSnapshot {
  const extracted = prebuiltExtracted ?? extractBookmarkData(rootNode)
  let cachedVersion = ''
  return {
    get version(): string {
      if (!cachedVersion) {
        cachedVersion = createBookmarkCatalogVersion({
          extracted,
          tagIndex,
          snapshotState,
          includeFullText
        })
      }
      return cachedVersion
    },
    includeFullText,
    extracted,
    tagIndex,
    snapshotState
  }
}

function createBookmarkCatalogVersion({
  extracted,
  tagIndex = null,
  snapshotState = null,
  includeFullText = false
}: {
  extracted: Pick<ExtractedBookmarkData, 'bookmarks' | 'folders'> & {
    catalogVersionFingerprint?: BookmarkCatalogVersionFingerprint | null
  }
  tagIndex?: BookmarkTagIndex | null
  snapshotState?: BookmarkCatalogSnapshotState | null
  includeFullText?: boolean
}): string {
  const tagUpdatedAt = Number(tagIndex?.updatedAt) || 0
  const snapshotUpdatedAt = Number(snapshotState?.index?.updatedAt) || 0
  const snapshotEnabled = snapshotState?.settings?.fullTextSearchEnabled === true
  const fingerprint = getCatalogVersionFingerprint(extracted)

  return [
    BOOKMARK_CATALOG_VERSION_PREFIX,
    includeFullText ? 'full-text' : 'light',
    snapshotEnabled ? 'snapshot-enabled' : 'snapshot-disabled',
    String(extracted.bookmarks.length),
    String(extracted.folders.length),
    String(tagUpdatedAt),
    String(snapshotUpdatedAt),
    fingerprint.bookmarkHash,
    fingerprint.folderHash
  ].join('::')
}

function getCatalogVersionFingerprint(
  extracted: Pick<ExtractedBookmarkData, 'bookmarks' | 'folders'> & {
    catalogVersionFingerprint?: BookmarkCatalogVersionFingerprint | null
  }
): BookmarkCatalogVersionFingerprint {
  const fingerprint = extracted.catalogVersionFingerprint
  if (fingerprint?.bookmarkHash && fingerprint.folderHash) {
    return fingerprint
  }

  return {
    bookmarkHash: hashCatalogRecords(
      extracted.bookmarks,
      BOOKMARK_CATALOG_HASH_SEED,
      BOOKMARK_CATALOG_HASH_MULTIPLIER,
      (bookmark) => [
        bookmark.id,
        bookmark.parentId,
        bookmark.duplicateKey,
        String(bookmark.dateAdded || 0)
      ]
    ),
    folderHash: hashCatalogRecords(
      extracted.folders,
      BOOKMARK_CATALOG_HASH_ALT_SEED,
      BOOKMARK_CATALOG_HASH_ALT_MULTIPLIER,
      (folder) => [
        folder.id,
        folder.path,
        String(folder.bookmarkCount || 0),
        String(folder.folderCount || 0)
      ]
    )
  }
}

function hashCatalogRecords<T extends { id: string }>(
  records: T[],
  seed: number,
  multiplier: number,
  getValues: (record: T) => unknown[]
): string {
  let hash = seed >>> 0
  for (const record of records) {
    for (const value of getValues(record)) {
      hash = updateCatalogHash(hash, value, multiplier)
    }
    hash = updateCatalogHash(hash, '\u001f', multiplier)
  }
  return (hash >>> 0).toString(36)
}

function updateCatalogHash(hash: number, value: unknown, multiplier: number): number {
  let next = hash >>> 0
  const text = String(value ?? '')
  for (let index = 0; index < text.length; index += 1) {
    next ^= text.charCodeAt(index)
    next = Math.imul(next, multiplier) >>> 0
  }
  return next >>> 0
}
