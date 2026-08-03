import { STORAGE_KEYS } from '../constants.js'
import {
  getLocalStorage,
  setLocalStorage,
  type LocalStorageTransaction
} from '../storage.js'
import type {
  ContentSnapshotIndex,
  ContentSnapshotRecord
} from '../content-snapshot-search.js'
import {
  CURATOR_DATA_STORES,
  applyCuratorDataStoreDeltaWithMeta,
  isCuratorDataDbAvailable,
  readCuratorDataStore,
  readCuratorDataStoreMeta,
  resetCuratorDataDbForTest,
  replaceCuratorDataStoreWithMeta
} from './curator-data-db.js'

const CONTENT_SNAPSHOT_REPOSITORY_META_KEY = 'contentSnapshots'

type NormalizeContentSnapshotIndex = (rawIndex: unknown) => ContentSnapshotIndex
type NormalizeContentSnapshotRecord = (rawRecord: unknown) => ContentSnapshotRecord

interface ContentSnapshotRepositoryNormalizers {
  normalizeIndex: NormalizeContentSnapshotIndex
  normalizeRecord: NormalizeContentSnapshotRecord
}

let normalizers: ContentSnapshotRepositoryNormalizers | null = null

export function configureContentSnapshotRepository(normalizerConfig: ContentSnapshotRepositoryNormalizers): void {
  normalizers = normalizerConfig
}

export async function loadContentSnapshotIndexFromRepository(
  transaction?: LocalStorageTransaction
): Promise<ContentSnapshotIndex> {
  const { normalizeIndex } = requireContentSnapshotRepositoryNormalizers()
  const idbIndex = await loadContentSnapshotIndexFromIndexedDb().catch(() => null)
  if (idbIndex) {
    const localIndex = await loadContentSnapshotIndexFromLocalStorage().catch(() => normalizeIndex(null))
    if (
      Object.keys(localIndex.records).length &&
      (
        Object.keys(idbIndex.records).length === 0 ||
        Number(localIndex.updatedAt) > Number(idbIndex.updatedAt)
      )
    ) {
      await migrateContentSnapshotIndexToIndexedDb(localIndex, transaction).catch(() => {})
      return localIndex
    }
    return idbIndex
  }

  const localIndex = await loadContentSnapshotIndexFromLocalStorage()
  if (Object.keys(localIndex.records).length && isCuratorDataDbAvailable()) {
    await migrateContentSnapshotIndexToIndexedDb(localIndex, transaction).catch(() => {})
  }
  return normalizeIndex(localIndex)
}

export async function updateContentSnapshotIndexInRepository(
  updater: (index: ContentSnapshotIndex) => ContentSnapshotIndex,
  transaction?: LocalStorageTransaction
): Promise<ContentSnapshotIndex> {
  const { normalizeIndex } = requireContentSnapshotRepositoryNormalizers()
  const current = await loadContentSnapshotIndexFromRepository(transaction)
  const nextIndex = normalizeIndex(updater(current))

  if (!isCuratorDataDbAvailable()) {
    await writeContentSnapshotIndexToLocalStorage(nextIndex, transaction)
    return nextIndex
  }

  try {
    const delta = diffContentSnapshotIndexes(current, nextIndex)
    if (delta.replaceAll) {
      await replaceContentSnapshotIndexInIndexedDb(nextIndex)
      await compactContentSnapshotIndexLocalStorage(nextIndex, transaction).catch(() => {})
    } else {
      const committedMeta = await applyCuratorDataStoreDeltaWithMeta(
        CURATOR_DATA_STORES.contentSnapshots,
        delta.upserts,
        delta.deletedIds,
        buildContentSnapshotRepositoryMeta(nextIndex)
      )
      await compactContentSnapshotIndexLocalStorageWithMeta(committedMeta, transaction).catch(() => {})
    }
  } catch {
    await writeContentSnapshotIndexToLocalStorage(nextIndex, transaction)
  }
  return nextIndex
}

export async function applyContentSnapshotRecordsDeltaInRepository(
  current: ContentSnapshotIndex,
  {
    upserts,
    deletedIds = [],
    updatedAt = Date.now()
  }: {
    upserts: ContentSnapshotRecord[]
    deletedIds?: string[]
    updatedAt?: number
  },
  transaction?: LocalStorageTransaction
): Promise<ContentSnapshotIndex> {
  const { normalizeIndex, normalizeRecord } = requireContentSnapshotRepositoryNormalizers()
  const normalizedCurrent = normalizeIndex(current)
  const normalizedUpserts = dedupeContentSnapshotRecords(
    upserts
      .map((record) => normalizeRecord(record))
      .filter((record) => record.bookmarkId && record.snapshotId)
  )
  const upsertIds = new Set(normalizedUpserts.map((record) => record.bookmarkId))
  const normalizedDeletedIds = Array.from(new Set(
    deletedIds
      .map((id) => String(id || '').trim())
      .filter((id) => id && !upsertIds.has(id))
  ))
  if (!normalizedUpserts.length && !normalizedDeletedIds.length) {
    return normalizedCurrent
  }
  const nextRecords = { ...normalizedCurrent.records }
  for (const id of normalizedDeletedIds) {
    delete nextRecords[id]
  }
  for (const record of normalizedUpserts) {
    nextRecords[record.bookmarkId] = record
  }
  const nextIndex = normalizeIndex({
    version: 1,
    updatedAt: Math.max(
      Number(updatedAt) || 0,
      (Number(normalizedCurrent.updatedAt) || 0) + 1
    ),
    records: nextRecords
  })

  if (!isCuratorDataDbAvailable()) {
    await writeContentSnapshotIndexToLocalStorage(nextIndex, transaction)
    return nextIndex
  }

  try {
    const committedMeta = await applyCuratorDataStoreDeltaWithMeta(
      CURATOR_DATA_STORES.contentSnapshots,
      normalizedUpserts,
      normalizedDeletedIds,
      buildContentSnapshotRepositoryMeta(nextIndex)
    )
    await compactContentSnapshotIndexLocalStorageWithMeta(committedMeta, transaction).catch(() => {})
  } catch {
    await writeContentSnapshotIndexToLocalStorage(nextIndex, transaction)
  }
  return nextIndex
}

export function resetContentSnapshotRepositoryForTest(): void {
  resetCuratorDataDbForTest()
}

async function loadContentSnapshotIndexFromIndexedDb(): Promise<ContentSnapshotIndex | null> {
  const { normalizeIndex, normalizeRecord } = requireContentSnapshotRepositoryNormalizers()
  if (!isCuratorDataDbAvailable()) {
    return null
  }

  const meta = await readCuratorDataStoreMeta(CONTENT_SNAPSHOT_REPOSITORY_META_KEY)
  if (!meta) {
    return null
  }

  const records: Record<string, ContentSnapshotRecord> = {}
  const storedRecords = await readCuratorDataStore<ContentSnapshotRecord>(CURATOR_DATA_STORES.contentSnapshots)
  if (storedRecords.length < meta.recordCount) {
    return null
  }
  for (const rawRecord of storedRecords) {
    const record = normalizeRecord(rawRecord)
    if (record.bookmarkId && record.snapshotId) {
      records[record.bookmarkId] = record
    }
  }

  return normalizeIndex({
    version: 1,
    updatedAt: meta.updatedAt,
    records
  })
}

async function loadContentSnapshotIndexFromLocalStorage(): Promise<ContentSnapshotIndex> {
  const { normalizeIndex } = requireContentSnapshotRepositoryNormalizers()
  const stored = await getLocalStorage([STORAGE_KEYS.contentSnapshotIndex])
  return normalizeIndex(stored[STORAGE_KEYS.contentSnapshotIndex])
}

async function migrateContentSnapshotIndexToIndexedDb(
  index: ContentSnapshotIndex,
  transaction?: LocalStorageTransaction
): Promise<void> {
  await replaceContentSnapshotIndexInIndexedDb(index)
  await compactContentSnapshotIndexLocalStorage(index, transaction).catch(() => {})
}

async function replaceContentSnapshotIndexInIndexedDb(index: ContentSnapshotIndex): Promise<void> {
  await replaceCuratorDataStoreWithMeta(
    CURATOR_DATA_STORES.contentSnapshots,
    Object.values(index.records),
    buildContentSnapshotRepositoryMeta(index)
  )
}

function buildContentSnapshotRepositoryMeta(index: ContentSnapshotIndex) {
  return {
    key: CONTENT_SNAPSHOT_REPOSITORY_META_KEY,
    version: 1 as const,
    updatedAt: Number(index.updatedAt) || 0,
    recordCount: Object.keys(index.records || {}).length,
    migratedAt: Date.now(),
    compactedAt: Date.now()
  }
}

async function compactContentSnapshotIndexLocalStorage(
  index: ContentSnapshotIndex,
  transaction?: LocalStorageTransaction
): Promise<void> {
  await compactContentSnapshotIndexLocalStorageWithMeta(
    buildContentSnapshotRepositoryMeta(index),
    transaction
  )
}

async function compactContentSnapshotIndexLocalStorageWithMeta(
  meta: {
    updatedAt: number
    recordCount: number
  },
  transaction?: LocalStorageTransaction
): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.contentSnapshotIndex]: {
      version: 1,
      updatedAt: Number(meta.updatedAt) || 0,
      records: {},
      migratedTo: 'indexedDB',
      repository: CONTENT_SNAPSHOT_REPOSITORY_META_KEY,
      recordCount: Number(meta.recordCount) || 0,
      compactedAt: Date.now()
    }
  }, { transaction })
}

async function writeContentSnapshotIndexToLocalStorage(
  index: ContentSnapshotIndex,
  transaction?: LocalStorageTransaction
): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.contentSnapshotIndex]: index
  }, { transaction })
}

function diffContentSnapshotIndexes(
  current: ContentSnapshotIndex,
  nextIndex: ContentSnapshotIndex
): {
  replaceAll: boolean
  upserts: ContentSnapshotRecord[]
  deletedIds: string[]
} {
  const currentRecords = current.records || {}
  const nextRecords = nextIndex.records || {}
  const currentIds = Object.keys(currentRecords)
  const nextIds = Object.keys(nextRecords)
  const upserts: ContentSnapshotRecord[] = []
  const deletedIds: string[] = []

  for (const id of nextIds) {
    if (!areContentSnapshotRecordsEquivalent(currentRecords[id], nextRecords[id])) {
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

function areContentSnapshotRecordsEquivalent(
  left: ContentSnapshotRecord | undefined,
  right: ContentSnapshotRecord | undefined
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return left.bookmarkId === right.bookmarkId &&
    left.snapshotId === right.snapshotId &&
    left.extractedAt === right.extractedAt &&
    left.fullTextStorage === right.fullTextStorage &&
    left.fullTextRef === right.fullTextRef &&
    left.summary === right.summary &&
    left.title === right.title &&
    left.finalUrl === right.finalUrl
}

function dedupeContentSnapshotRecords(records: ContentSnapshotRecord[]): ContentSnapshotRecord[] {
  const recordsByBookmarkId = new Map<string, ContentSnapshotRecord>()
  for (const record of records) {
    recordsByBookmarkId.set(record.bookmarkId, record)
  }
  return Array.from(recordsByBookmarkId.values())
}

function requireContentSnapshotRepositoryNormalizers(): ContentSnapshotRepositoryNormalizers {
  if (!normalizers) {
    throw new Error('Content snapshot repository normalizers are not configured.')
  }
  return normalizers
}
