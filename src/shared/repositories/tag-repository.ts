import { STORAGE_KEYS } from '../constants.js'
import {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
  type LocalStorageTransaction
} from '../storage.js'
import type {
  BookmarkTagIndex,
  BookmarkTagRecord
} from '../bookmark-tags.js'
import {
  CURATOR_DATA_STORES,
  applyCuratorDataStoreDeltaWithMeta,
  isCuratorDataDbAvailable,
  readCuratorDataStore,
  readCuratorDataStoreMeta,
  resetCuratorDataDbForTest,
  replaceCuratorDataStoreWithMeta
} from './curator-data-db.js'

const BOOKMARK_TAG_REPOSITORY_META_KEY = 'bookmarkTags'

type NormalizeBookmarkTagIndex = (rawIndex: unknown) => BookmarkTagIndex
type NormalizeBookmarkTagRecord = (rawRecord: unknown, fallback?: Partial<BookmarkTagRecord>) => BookmarkTagRecord | null

interface BookmarkTagRepositoryNormalizers {
  normalizeIndex: NormalizeBookmarkTagIndex
  normalizeRecord: NormalizeBookmarkTagRecord
}

let normalizers: BookmarkTagRepositoryNormalizers | null = null

export function configureBookmarkTagRepository(normalizerConfig: BookmarkTagRepositoryNormalizers): void {
  normalizers = normalizerConfig
}

export async function loadBookmarkTagIndexFromRepository(
  transaction?: LocalStorageTransaction
): Promise<BookmarkTagIndex> {
  const { normalizeIndex } = requireBookmarkTagRepositoryNormalizers()
  const idbIndex = await loadBookmarkTagIndexFromIndexedDb().catch(() => null)
  if (idbIndex) {
    const localIndex = await loadBookmarkTagIndexFromLocalStorage().catch(() => normalizeIndex(null))
    if (
      Object.keys(localIndex.records).length &&
      (
        Object.keys(idbIndex.records).length === 0 ||
        Number(localIndex.updatedAt) > Number(idbIndex.updatedAt)
      )
    ) {
      await migrateBookmarkTagIndexToIndexedDb(localIndex, transaction).catch(() => {})
      return localIndex
    }
    return idbIndex
  }

  const localIndex = await loadBookmarkTagIndexFromLocalStorage()
  if (Object.keys(localIndex.records).length && isCuratorDataDbAvailable()) {
    await migrateBookmarkTagIndexToIndexedDb(localIndex, transaction).catch(() => {})
  }
  return normalizeIndex(localIndex)
}

export async function saveBookmarkTagIndexToRepository(
  index: BookmarkTagIndex,
  transaction?: LocalStorageTransaction
): Promise<BookmarkTagIndex> {
  const { normalizeIndex } = requireBookmarkTagRepositoryNormalizers()
  const normalized = normalizeIndex(index)
  if (!isCuratorDataDbAvailable()) {
    await writeBookmarkTagIndexToLocalStorage(normalized, transaction)
    return normalized
  }

  try {
    await replaceBookmarkTagIndexInIndexedDb(normalized)
    await compactBookmarkTagIndexLocalStorage(normalized, transaction).catch(() => {})
  } catch {
    await writeBookmarkTagIndexToLocalStorage(normalized, transaction)
  }
  return normalized
}

export async function restoreBookmarkTagIndexInRepositoryStrict(
  index: BookmarkTagIndex,
  transaction?: LocalStorageTransaction
): Promise<BookmarkTagIndex> {
  const { normalizeIndex } = requireBookmarkTagRepositoryNormalizers()
  const normalized = normalizeIndex(index)
  if (!isCuratorDataDbAvailable()) {
    await writeBookmarkTagIndexToLocalStorage(normalized, transaction)
    return normalized
  }

  await replaceBookmarkTagIndexInIndexedDb(normalized)
  await compactBookmarkTagIndexLocalStorage(normalized, transaction)
  return normalized
}

export async function updateBookmarkTagIndexInRepository(
  updater: (index: BookmarkTagIndex) => BookmarkTagIndex,
  transaction?: LocalStorageTransaction
): Promise<BookmarkTagIndex> {
  const { normalizeIndex } = requireBookmarkTagRepositoryNormalizers()
  const current = await loadBookmarkTagIndexFromRepository(transaction)
  const nextIndex = normalizeIndex(updater(current))

  if (!isCuratorDataDbAvailable()) {
    await writeBookmarkTagIndexToLocalStorage(nextIndex, transaction)
    return nextIndex
  }

  try {
    const delta = diffBookmarkTagIndexes(current, nextIndex)
    if (delta.replaceAll) {
      await replaceBookmarkTagIndexInIndexedDb(nextIndex)
    } else {
      await applyCuratorDataStoreDeltaWithMeta(
        CURATOR_DATA_STORES.bookmarkTags,
        delta.upserts,
        delta.deletedIds,
        buildBookmarkTagRepositoryMeta(nextIndex)
      )
    }
    await compactBookmarkTagIndexLocalStorage(nextIndex, transaction).catch(() => {})
  } catch {
    await writeBookmarkTagIndexToLocalStorage(nextIndex, transaction)
  }
  return nextIndex
}

export async function clearBookmarkTagIndexInRepository(
  transaction?: LocalStorageTransaction
): Promise<void> {
  if (isCuratorDataDbAvailable()) {
    await replaceBookmarkTagIndexInIndexedDb({
      version: 1,
      updatedAt: Date.now(),
      records: {}
    })
  }
  await removeLocalStorage(STORAGE_KEYS.bookmarkTagIndex, { transaction })
}

export function resetBookmarkTagRepositoryForTest(): void {
  resetCuratorDataDbForTest()
}

async function loadBookmarkTagIndexFromIndexedDb(): Promise<BookmarkTagIndex | null> {
  const { normalizeIndex, normalizeRecord } = requireBookmarkTagRepositoryNormalizers()
  if (!isCuratorDataDbAvailable()) {
    return null
  }

  const meta = await readCuratorDataStoreMeta(BOOKMARK_TAG_REPOSITORY_META_KEY)
  if (!meta) {
    return null
  }

  const records: Record<string, BookmarkTagRecord> = {}
  const storedRecords = await readCuratorDataStore<BookmarkTagRecord>(CURATOR_DATA_STORES.bookmarkTags)
  if (storedRecords.length < meta.recordCount) {
    return null
  }
  for (const rawRecord of storedRecords) {
    const record = normalizeRecord(rawRecord)
    if (record) {
      records[record.bookmarkId] = record
    }
  }

  return normalizeIndex({
    version: 1,
    updatedAt: meta.updatedAt,
    records
  })
}

async function loadBookmarkTagIndexFromLocalStorage(): Promise<BookmarkTagIndex> {
  const { normalizeIndex } = requireBookmarkTagRepositoryNormalizers()
  const stored = await getLocalStorage([STORAGE_KEYS.bookmarkTagIndex])
  return normalizeIndex(stored[STORAGE_KEYS.bookmarkTagIndex])
}

async function migrateBookmarkTagIndexToIndexedDb(
  index: BookmarkTagIndex,
  transaction?: LocalStorageTransaction
): Promise<void> {
  await replaceBookmarkTagIndexInIndexedDb(index)
  await compactBookmarkTagIndexLocalStorage(index, transaction).catch(() => {})
}

async function replaceBookmarkTagIndexInIndexedDb(index: BookmarkTagIndex): Promise<void> {
  await replaceCuratorDataStoreWithMeta(
    CURATOR_DATA_STORES.bookmarkTags,
    Object.values(index.records),
    buildBookmarkTagRepositoryMeta(index)
  )
}

function buildBookmarkTagRepositoryMeta(index: BookmarkTagIndex) {
  return {
    key: BOOKMARK_TAG_REPOSITORY_META_KEY,
    version: 1 as const,
    updatedAt: Number(index.updatedAt) || 0,
    recordCount: Object.keys(index.records || {}).length,
    migratedAt: Date.now(),
    compactedAt: Date.now()
  }
}

async function compactBookmarkTagIndexLocalStorage(
  index: BookmarkTagIndex,
  transaction?: LocalStorageTransaction
): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.bookmarkTagIndex]: {
      version: 1,
      updatedAt: Number(index.updatedAt) || 0,
      records: {},
      migratedTo: 'indexedDB',
      repository: BOOKMARK_TAG_REPOSITORY_META_KEY,
      recordCount: Object.keys(index.records || {}).length,
      compactedAt: Date.now()
    }
  }, { transaction })
}

async function writeBookmarkTagIndexToLocalStorage(
  index: BookmarkTagIndex,
  transaction?: LocalStorageTransaction
): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.bookmarkTagIndex]: index
  }, { transaction })
}

function diffBookmarkTagIndexes(
  current: BookmarkTagIndex,
  nextIndex: BookmarkTagIndex
): {
  replaceAll: boolean
  upserts: BookmarkTagRecord[]
  deletedIds: string[]
} {
  const currentRecords = current.records || {}
  const nextRecords = nextIndex.records || {}
  const currentIds = Object.keys(currentRecords)
  const nextIds = Object.keys(nextRecords)
  const upserts: BookmarkTagRecord[] = []
  const deletedIds: string[] = []

  for (const id of nextIds) {
    if (!areBookmarkTagRecordsEquivalent(currentRecords[id], nextRecords[id])) {
      upserts.push(nextRecords[id])
    }
  }
  for (const id of currentIds) {
    if (!(id in nextRecords)) {
      deletedIds.push(id)
    }
  }

  return {
    replaceAll: upserts.length + deletedIds.length > Math.max(250, Math.ceil(nextIds.length * 0.4)),
    upserts,
    deletedIds
  }
}

function areBookmarkTagRecordsEquivalent(
  left: BookmarkTagRecord | undefined,
  right: BookmarkTagRecord | undefined
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return left.bookmarkId === right.bookmarkId &&
    left.updatedAt === right.updatedAt &&
    left.generatedAt === right.generatedAt &&
    left.manualUpdatedAt === right.manualUpdatedAt &&
    left.url === right.url &&
    left.summary === right.summary &&
    left.contentType === right.contentType &&
    left.source === right.source &&
    left.tags.length === right.tags.length &&
    left.manualTags?.length === right.manualTags?.length
}

function requireBookmarkTagRepositoryNormalizers(): BookmarkTagRepositoryNormalizers {
  if (!normalizers) {
    throw new Error('Bookmark tag repository normalizers are not configured.')
  }
  return normalizers
}
