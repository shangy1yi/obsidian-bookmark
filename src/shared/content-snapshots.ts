import { CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT, STORAGE_KEYS } from './constants.js'
import {
  setLocalStorage,
  withLocalStorageTransaction
} from './storage.js'
import {
  applyContentSnapshotRecordsDeltaInRepository,
  loadContentSnapshotIndexFromRepository,
  resetContentSnapshotRepositoryForTest,
  updateContentSnapshotIndexInRepository
} from './repositories/snapshot-repository.js'
import {
  buildContentSnapshotSearchMap,
  cleanContentSnapshotText as cleanText,
  normalizeContentSnapshotIndex,
  normalizeContentSnapshotSettings,
  normalizeContentSnapshotTextList as normalizeTextList,
  truncateContentSnapshotText as truncateCleanText,
  type ContentSnapshotIndex,
  type ContentSnapshotRecord,
  type ContentSnapshotSettings
} from './content-snapshot-search.js'
import { normalizeText } from './text.js'
import type { BookmarkRecord } from './types.js'

export {
  DEFAULT_CONTENT_SNAPSHOT_SETTINGS,
  buildContentSnapshotSearchMap,
  buildContentSnapshotSearchText,
  loadContentSnapshotIndex,
  loadContentSnapshotSettings,
  normalizeContentSnapshotIndex,
  normalizeContentSnapshotSettings
} from './content-snapshot-search.js'
export type {
  ContentSnapshotIndex,
  ContentSnapshotRecord,
  ContentSnapshotSettings
} from './content-snapshot-search.js'

export const HEAVY_USER_DB_NAME = 'curatorBookmarkHeavyUserData'
export const HEAVY_USER_DB_VERSION = 2
export const CONTENT_FULL_TEXT_STORE = 'contentFullText'
export const AUTO_BACKUP_STORE = 'autoBackups'

let contentSnapshotIndexWriteQueue: Promise<unknown> = Promise.resolve()
interface ContentFullTextOperations {
  put: (record: ContentFullTextRecord) => Promise<void>
  putMany: (records: ContentFullTextRecord[]) => Promise<void>
  get: (snapshotId: string) => Promise<string>
  getMany: (snapshotIds: string[]) => Promise<Map<string, string>>
  delete: (snapshotId: string) => Promise<void>
  deleteMany: (snapshotIds: string[]) => Promise<void>
}

let contentFullTextOperations: ContentFullTextOperations = {
  put: putContentFullText,
  putMany: putContentFullTexts,
  get: getContentFullText,
  getMany: getContentFullTexts,
  delete: deleteContentFullText,
  deleteMany: deleteContentFullTexts
}

export interface ContentSnapshotSourceContext {
  finalUrl?: string
  title?: string
  description?: string
  ogDescription?: string
  canonicalUrl?: string
  headings?: string[]
  mainText?: string
  contentType?: string
  source?: string
  extractionStatus?: string
  contentLength?: number
  warnings?: string[]
}

export interface ContentFullTextRecord {
  snapshotId: string
  bookmarkId: string
  text: string
  bytes: number
  savedAt: number
}

export interface ContentSnapshotSaveInput {
  bookmark: Pick<BookmarkRecord, 'id' | 'url' | 'title'>
  context: ContentSnapshotSourceContext
  settings?: ContentSnapshotSettings
  now?: number
}

export async function saveContentSnapshotSettings(settings: unknown): Promise<ContentSnapshotSettings> {
  const normalized = normalizeContentSnapshotSettings(settings)
  await setLocalStorage({
    [STORAGE_KEYS.contentSnapshotSettings]: normalized
  })
  return normalized
}

export async function saveContentSnapshotFromContext({
  bookmark,
  context,
  settings,
  now = Date.now()
}: ContentSnapshotSaveInput): Promise<ContentSnapshotRecord | null> {
  const records = await saveContentSnapshotsFromContexts([{
    bookmark,
    context,
    settings,
    now
  }])
  return records[0] || null
}

export async function saveContentSnapshotsFromContexts(
  inputs: ContentSnapshotSaveInput[]
): Promise<ContentSnapshotRecord[]> {
  const entriesByBookmarkId = new Map<string, {
    record: ContentSnapshotRecord
    fullTextRecord: ContentFullTextRecord | null
  }>()
  for (const input of inputs) {
    const normalizedSettings = normalizeContentSnapshotSettings(input.settings)
    const bookmarkId = String(input.bookmark?.id || '').trim()
    if (!normalizedSettings.enabled || !bookmarkId) {
      continue
    }
    entriesByBookmarkId.set(bookmarkId, buildContentSnapshotRecord({
      bookmark: input.bookmark,
      context: input.context,
      settings: normalizedSettings,
      now: input.now ?? Date.now()
    }))
  }

  const entries = Array.from(entriesByBookmarkId.values())
  if (!entries.length) {
    return []
  }

  const task = contentSnapshotIndexWriteQueue.then(() => {
    return withLocalStorageTransaction(async (transaction) => {
      const current = await loadContentSnapshotIndexFromRepository(transaction)
      const records = entries.map((entry) => entry.record)
      const newFullTextRecords = entries.flatMap((entry) => (
        entry.fullTextRecord ? [entry.fullTextRecord] : []
      ))
      const existingFullTextRefs = new Set(
        Object.values(current.records).flatMap((record) => (
          record.fullTextStorage === 'idb' && record.fullTextRef
            ? [record.fullTextRef]
            : []
        ))
      )

      try {
        if (newFullTextRecords.length) {
          await contentFullTextOperations.putMany(newFullTextRecords)
        }
        const nextIndex = await applyContentSnapshotRecordsDeltaInRepository(
          current,
          {
            upserts: records,
            updatedAt: Math.max(...records.map((record) => record.extractedAt))
          },
          transaction
        )

        const retainedFullTextRefs = new Set(
          Object.values(nextIndex.records).flatMap((record) => (
            record.fullTextStorage === 'idb' && record.fullTextRef
              ? [record.fullTextRef]
              : []
          ))
        )
        const obsoleteFullTextRefs = Array.from(new Set(
          records.flatMap((record) => {
            const previous = current.records[record.bookmarkId]
            return previous?.fullTextStorage === 'idb' &&
              previous.fullTextRef &&
              previous.fullTextRef !== record.fullTextRef &&
              !retainedFullTextRefs.has(previous.fullTextRef)
              ? [previous.fullTextRef]
              : []
          })
        ))
        if (obsoleteFullTextRefs.length) {
          await contentFullTextOperations.deleteMany(obsoleteFullTextRefs).catch(() => {})
        }

        return records.flatMap((record) => {
          const saved = nextIndex.records[record.bookmarkId]
          return saved ? [saved] : []
        })
      } catch (error) {
        const uncommittedFullTextRefs = newFullTextRecords
          .map((record) => record.snapshotId)
          .filter((snapshotId) => !existingFullTextRefs.has(snapshotId))
        if (uncommittedFullTextRefs.length) {
          await contentFullTextOperations.deleteMany(uncommittedFullTextRefs).catch(() => {})
        }
        throw error
      }
    })
  })

  contentSnapshotIndexWriteQueue = task.catch(() => {})
  return task
}

export async function removeContentSnapshotForBookmark(bookmarkId: string, now = Date.now()): Promise<boolean> {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (!normalizedBookmarkId) {
    return false
  }

  let deletedFullTextRef = ''
  let removed = false
  await updateContentSnapshotIndex((index) => {
    const existing = index.records[normalizedBookmarkId] || null
    if (!existing) {
      return index
    }

    if (existing.fullTextStorage === 'idb' && existing.fullTextRef) {
      deletedFullTextRef = existing.fullTextRef
    }
    const records = { ...index.records }
    delete records[normalizedBookmarkId]
    removed = true
    return {
      version: 1,
      updatedAt: now,
      records
    }
  })

  if (deletedFullTextRef) {
    await contentFullTextOperations.delete(deletedFullTextRef).catch(() => {})
  }
  return removed
}

function updateContentSnapshotIndex(
  updater: (index: ContentSnapshotIndex) => ContentSnapshotIndex
): Promise<ContentSnapshotIndex> {
  const task = contentSnapshotIndexWriteQueue.then(async () => {
    return withLocalStorageTransaction((transaction) => {
      return updateContentSnapshotIndexInRepository((current) => {
        return normalizeContentSnapshotIndex(updater(current))
      }, transaction)
    })
  })

  contentSnapshotIndexWriteQueue = task.catch(() => {})
  return task
}

export function buildContentSnapshotRecord({
  bookmark,
  context,
  settings,
  now = Date.now()
}: {
  bookmark: Pick<BookmarkRecord, 'id' | 'url' | 'title'>
  context: ContentSnapshotSourceContext
  settings?: ContentSnapshotSettings
  now?: number
}): { record: ContentSnapshotRecord; fullTextRecord: ContentFullTextRecord | null } {
  const normalizedSettings = normalizeContentSnapshotSettings(settings)
  const bookmarkId = String(bookmark.id || '').trim()
  const snapshotId = `snapshot-${bookmarkId}-${now}`
  const mainText = cleanText(context.mainText || '')
  const fullTextBytes = estimateTextBytes(mainText)
  const shouldSaveFullText = normalizedSettings.saveFullText && Boolean(mainText)
  const useIndexedDb = shouldSaveFullText && fullTextBytes > CONTENT_SNAPSHOT_LOCAL_TEXT_LIMIT
  const summary = buildSnapshotSummary(context, mainText)

  const record: ContentSnapshotRecord = {
    snapshotId,
    bookmarkId,
    url: String(bookmark.url || '').trim(),
    title: cleanText(context.title || bookmark.title || ''),
    summary,
    headings: normalizeTextList(context.headings, 28, 120),
    canonicalUrl: String(context.canonicalUrl || '').trim(),
    finalUrl: String(context.finalUrl || bookmark.url || '').trim(),
    contentType: cleanText(context.contentType || inferContentTypeLabel(context)),
    source: cleanText(context.source || 'fallback'),
    extractionStatus: cleanText(context.extractionStatus || 'fallback'),
    extractedAt: now,
    hasFullText: shouldSaveFullText,
    fullTextBytes: shouldSaveFullText ? fullTextBytes : 0,
    fullTextStorage: shouldSaveFullText ? (useIndexedDb ? 'idb' : 'local') : 'none',
    fullText: shouldSaveFullText && !useIndexedDb ? mainText : undefined,
    fullTextRef: shouldSaveFullText && useIndexedDb ? snapshotId : undefined,
    warnings: normalizeTextList(context.warnings, 8, 160)
  }

  return {
    record,
    fullTextRecord: shouldSaveFullText && useIndexedDb
      ? {
          snapshotId,
          bookmarkId,
          text: mainText,
          bytes: fullTextBytes,
          savedAt: now
        }
      : null
  }
}

export async function buildContentSnapshotSearchMapWithFullText(
  index: ContentSnapshotIndex,
  options: { includeFullText?: boolean; maxRecords?: number } = {}
): Promise<Map<string, string>> {
  const searchMap = buildContentSnapshotSearchMap(index, {
    includeFullText: options.includeFullText
  })
  if (!options.includeFullText) {
    return searchMap
  }

  const maxRecords = Math.max(0, options.maxRecords ?? 600)
  const idbRecords = Object.values(index.records)
    .filter((record) => record.fullTextStorage === 'idb' && record.fullTextRef)
    .slice(0, maxRecords)

  if (!idbRecords.length) {
    return searchMap
  }

  const fullTexts = await contentFullTextOperations.getMany(
    idbRecords.map((record) => record.fullTextRef || '')
  )

  for (const record of idbRecords) {
    const fullText = fullTexts.get(record.fullTextRef || '')
    if (!fullText) {
      continue
    }
    const existing = searchMap.get(record.bookmarkId) || ''
    searchMap.set(record.bookmarkId, normalizeText(`${existing} ${fullText}`))
  }

  return searchMap
}

export async function putContentFullText(record: ContentFullTextRecord): Promise<void> {
  await putContentFullTexts([record])
}

export async function putContentFullTexts(records: ContentFullTextRecord[]): Promise<void> {
  const normalizedRecords = Array.from(new Map(
    records
      .filter((record) => String(record?.snapshotId || '').trim())
      .map((record) => [record.snapshotId, record] as const)
  ).values())
  if (!normalizedRecords.length) {
    return
  }
  const db = await openHeavyUserDb()
  try {
    await runStoreMutation(db, CONTENT_FULL_TEXT_STORE, (store) => {
      for (const record of normalizedRecords) {
        store.put(record)
      }
    })
  } finally {
    db.close()
  }
}

export async function getContentFullText(snapshotId: string): Promise<string> {
  if (!snapshotId) {
    return ''
  }
  const db = await openHeavyUserDb()
  const record = await runStoreValueRequest<ContentFullTextRecord | undefined>(
    db,
    CONTENT_FULL_TEXT_STORE,
    'readonly',
    (store) => store.get(snapshotId)
  )
  db.close()
  return cleanText(record?.text || '')
}

export async function getContentFullTexts(snapshotIds: string[]): Promise<Map<string, string>> {
  const uniqueSnapshotIds = Array.from(new Set(
    snapshotIds.flatMap(snapshotId => { const mappedResult = String(snapshotId || '').trim(); return mappedResult ? [mappedResult] : [] })
  ))
  const fullTexts = new Map<string, string>()
  if (!uniqueSnapshotIds.length) {
    return fullTexts
  }

  const db = await openHeavyUserDb()
  try {
    await runStoreValueBatchRequest<ContentFullTextRecord | undefined>(
      db,
      CONTENT_FULL_TEXT_STORE,
      uniqueSnapshotIds,
      (store, snapshotId) => store.get(snapshotId),
      (snapshotId, record) => {
        const text = cleanText(record?.text || '')
        if (text) {
          fullTexts.set(snapshotId, text)
        }
      }
    )
    return fullTexts
  } finally {
    db.close()
  }
}

export async function deleteContentFullText(snapshotId: string): Promise<void> {
  await deleteContentFullTexts([snapshotId])
}

export async function deleteContentFullTexts(snapshotIds: string[]): Promise<void> {
  const normalizedSnapshotIds = Array.from(new Set(
    snapshotIds
      .map((snapshotId) => String(snapshotId || '').trim())
      .filter(Boolean)
  ))
  if (!normalizedSnapshotIds.length) {
    return
  }
  const db = await openHeavyUserDb()
  try {
    await runStoreMutation(db, CONTENT_FULL_TEXT_STORE, (store) => {
      for (const snapshotId of normalizedSnapshotIds) {
        store.delete(snapshotId)
      }
    })
  } finally {
    db.close()
  }
}

export function setContentFullTextOperationsForTest(
  operations: Partial<typeof contentFullTextOperations>
): () => void {
  const previous = contentFullTextOperations
  const nextOperations = {
    ...contentFullTextOperations,
    ...operations
  }
  if (operations.get && !operations.getMany) {
    nextOperations.getMany = (snapshotIds: string[]) => getContentFullTextsWithSingleReads(snapshotIds, nextOperations.get)
  }
  if (operations.put && !operations.putMany) {
    nextOperations.putMany = async (records: ContentFullTextRecord[]) => {
      for (const record of records) {
        await nextOperations.put(record)
      }
    }
  }
  if (operations.delete && !operations.deleteMany) {
    nextOperations.deleteMany = async (snapshotIds: string[]) => {
      for (const snapshotId of snapshotIds) {
        await nextOperations.delete(snapshotId)
      }
    }
  }
  contentFullTextOperations = nextOperations
  return () => {
    contentFullTextOperations = previous
  }
}

export function __resetContentSnapshotRepositoryForTest(): void {
  contentSnapshotIndexWriteQueue = Promise.resolve()
  resetContentSnapshotRepositoryForTest()
}

export function estimateTextBytes(value: unknown): number {
  const text = String(value || '')
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length
  }
  return text.length
}

async function getContentFullTextsWithSingleReads(
  snapshotIds: string[],
  getFullText: (snapshotId: string) => Promise<string>
): Promise<Map<string, string>> {
  const fullTexts = new Map<string, string>()
  const fullTextEntries = await Promise.all(snapshotIds.map(async (snapshotId) => {
    const fullText = await getFullText(snapshotId).catch(() => '')
    return { snapshotId, fullText }
  }))
  for (const { snapshotId, fullText } of fullTextEntries) {
    if (fullText) {
      fullTexts.set(snapshotId, fullText)
    }
  }
  return fullTexts
}

function buildSnapshotSummary(context: ContentSnapshotSourceContext, mainText: string): string {
  return truncateCleanText(
    context.description ||
      context.ogDescription ||
      mainText ||
      context.title ||
      '',
    700
  )
}

function inferContentTypeLabel(context: ContentSnapshotSourceContext): string {
  const source = String(context.source || '').toLowerCase()
  if (source === 'pdf') {
    return 'PDF'
  }
  if (source === 'github') {
    return 'GitHub README / 仓库'
  }
  if (source === 'youtube') {
    return 'YouTube 描述'
  }
  if (source === 'docs') {
    return '文档页'
  }
  return ''
}

function openHeavyUserDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HEAVY_USER_DB_NAME, HEAVY_USER_DB_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const db = request.result
      if (!db.objectStoreNames.contains(AUTO_BACKUP_STORE)) {
        db.createObjectStore(AUTO_BACKUP_STORE, { keyPath: 'backupId' })
      }
      if (!db.objectStoreNames.contains(CONTENT_FULL_TEXT_STORE)) {
        db.createObjectStore(CONTENT_FULL_TEXT_STORE, { keyPath: 'snapshotId' })
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error || new Error('无法打开全文索引数据库。')))
  })
}

function runStoreMutation(
  db: IDBDatabase,
  storeName: string,
  mutate: (store: IDBObjectStore) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    try {
      mutate(store)
    } catch (error) {
      transaction.abort()
      reject(error)
      return
    }
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error || new Error('全文索引存储失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('全文索引存储中断。')))
  })
}

function runStoreValueRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = createRequest(store)
    transaction.addEventListener('complete', () => resolve(request.result as T))
    transaction.addEventListener('error', () => reject(transaction.error || new Error('全文索引读取失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('全文索引读取中断。')))
  })
}

function runStoreValueBatchRequest<T>(
  db: IDBDatabase,
  storeName: string,
  snapshotIds: string[],
  createRequest: (store: IDBObjectStore, snapshotId: string) => IDBRequest,
  handleValue: (snapshotId: string, value: T) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)

    for (const snapshotId of snapshotIds) {
      let request: IDBRequest
      try {
        request = createRequest(store, snapshotId)
      } catch {
        continue
      }
      request.addEventListener('success', () => {
        handleValue(snapshotId, request.result as T)
      })
      request.addEventListener('error', (event) => {
        // Skip a bad record without letting one request abort the whole readonly batch.
        event.preventDefault()
        event.stopPropagation()
      })
    }

    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error || new Error('全文索引读取失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('全文索引读取中断。')))
  })
}
