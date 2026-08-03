export const CURATOR_DATA_DB_NAME = 'curatorData'
export const CURATOR_DATA_DB_VERSION = 1

export const CURATOR_DATA_STORES = {
  bookmarkTags: 'bookmarkTags',
  contentSnapshots: 'contentSnapshots',
  activityRecords: 'activityRecords',
  metadata: 'metadata'
} as const

type CuratorDataStoreName = (typeof CURATOR_DATA_STORES)[keyof typeof CURATOR_DATA_STORES]

const STORE_KEY_PATHS: Record<CuratorDataStoreName, string> = {
  [CURATOR_DATA_STORES.bookmarkTags]: 'bookmarkId',
  [CURATOR_DATA_STORES.contentSnapshots]: 'bookmarkId',
  [CURATOR_DATA_STORES.activityRecords]: 'bookmarkId',
  [CURATOR_DATA_STORES.metadata]: 'key'
}

let curatorDataDbPromise: Promise<IDBDatabase> | null = null
let curatorDataDbFailureForTest: ((operation: string) => Error | null | undefined) | null = null

export interface CuratorDataStoreMeta {
  key: string
  version: 1
  updatedAt: number
  recordCount: number
  migratedAt: number
  compactedAt?: number
  clearedAt?: number
}

export function isCuratorDataDbAvailable(): boolean {
  const factory = getIndexedDbFactory()
  return Boolean(factory && typeof factory.open === 'function')
}

export async function readCuratorDataStore<T extends object>(
  storeName: CuratorDataStoreName
): Promise<T[]> {
  const db = await openCuratorDataDb()
  return runCuratorDataValueRequest<T[]>(db, storeName, 'readonly', (store) => store.getAll())
}

export async function replaceCuratorDataStore<T extends object>(
  storeName: CuratorDataStoreName,
  records: T[]
): Promise<void> {
  const keyPath = STORE_KEY_PATHS[storeName]
  await runCuratorDataTransaction(storeName, 'readwrite', (store) => {
    store.clear()
    for (const record of records) {
      const source = record as Record<string, unknown>
      if (record && String(source[keyPath] || '').trim()) {
        store.put(record)
      }
    }
  })
}

export async function replaceCuratorDataStoreWithMeta<T extends object>(
  storeName: CuratorDataStoreName,
  records: T[],
  meta: CuratorDataStoreMeta
): Promise<void> {
  const keyPath = STORE_KEY_PATHS[storeName]
  await runCuratorDataMultiStoreTransaction(
    [storeName, CURATOR_DATA_STORES.metadata],
    (stores) => {
      const dataStore = stores[storeName]
      dataStore.clear()
      for (const record of records) {
        const source = record as Record<string, unknown>
        if (record && String(source[keyPath] || '').trim()) {
          dataStore.put(record)
        }
      }
      stores[CURATOR_DATA_STORES.metadata].put(meta)
    }
  )
}

export async function applyCuratorDataStoreDelta<T extends object>(
  storeName: CuratorDataStoreName,
  upserts: T[],
  deletedKeys: string[]
): Promise<void> {
  const keyPath = STORE_KEY_PATHS[storeName]
  await runCuratorDataTransaction(storeName, 'readwrite', (store) => {
    for (const record of upserts) {
      const source = record as Record<string, unknown>
      if (record && String(source[keyPath] || '').trim()) {
        store.put(record)
      }
    }
    for (const key of deletedKeys) {
      const normalizedKey = String(key || '').trim()
      if (normalizedKey) {
        store.delete(normalizedKey)
      }
    }
  })
}

export async function applyCuratorDataStoreDeltaWithMeta<T extends object>(
  storeName: CuratorDataStoreName,
  upserts: T[],
  deletedKeys: string[],
  meta: CuratorDataStoreMeta
): Promise<CuratorDataStoreMeta> {
  const keyPath = STORE_KEY_PATHS[storeName]
  const db = await openCuratorDataDb()
  return new Promise<CuratorDataStoreMeta>((resolve, reject) => {
    const transaction = db.transaction(
      [storeName, CURATOR_DATA_STORES.metadata],
      'readwrite'
    )
    const dataStore = transaction.objectStore(storeName)
    const metadataStore = transaction.objectStore(CURATOR_DATA_STORES.metadata)
    let committedMeta: CuratorDataStoreMeta | null = null

    try {
      for (const record of upserts) {
        const source = record as Record<string, unknown>
        if (record && String(source[keyPath] || '').trim()) {
          dataStore.put(record)
        }
      }
      for (const key of deletedKeys) {
        const normalizedKey = String(key || '').trim()
        if (normalizedKey) {
          dataStore.delete(normalizedKey)
        }
      }

      const existingMetaRequest = metadataStore.get(meta.key)
      const recordCountRequest = dataStore.count()
      let existingMeta: CuratorDataStoreMeta | null = null
      let existingMetaLoaded = false
      let recordCount: number | null = null

      const writeComputedMeta = () => {
        if (!existingMetaLoaded || recordCount === null || committedMeta) {
          return
        }
        const existingUpdatedAt = Number(existingMeta?.updatedAt) || 0
        committedMeta = {
          ...meta,
          updatedAt: Math.max(existingUpdatedAt, Number(meta.updatedAt) || 0),
          recordCount,
          migratedAt: Number(existingMeta?.migratedAt) || Number(meta.migratedAt) || Date.now()
        }
        metadataStore.put(committedMeta)
      }

      existingMetaRequest.addEventListener('success', () => {
        const value = existingMetaRequest.result
        existingMeta = value && typeof value === 'object'
          ? value as CuratorDataStoreMeta
          : null
        existingMetaLoaded = true
        writeComputedMeta()
      })
      recordCountRequest.addEventListener('success', () => {
        recordCount = Number(recordCountRequest.result) || 0
        writeComputedMeta()
      })

      const injectedFailure = curatorDataDbFailureForTest?.('apply-delta-with-meta')
      if (injectedFailure) {
        throw injectedFailure
      }
    } catch (error) {
      transaction.abort()
      reject(error)
      return
    }

    transaction.addEventListener('complete', () => {
      if (!committedMeta) {
        reject(new Error('数据仓库元数据写入失败。'))
        return
      }
      resolve(committedMeta)
    })
    transaction.addEventListener('error', () => {
      reject(transaction.error || new Error('数据仓库写入失败。'))
    })
    transaction.addEventListener('abort', () => {
      reject(transaction.error || new Error('数据仓库写入中断。'))
    })
  })
}

export async function clearCuratorDataStore(storeName: CuratorDataStoreName): Promise<void> {
  await runCuratorDataTransaction(storeName, 'readwrite', (store) => {
    store.clear()
  })
}

export async function readCuratorDataStoreMeta(key: string): Promise<CuratorDataStoreMeta | null> {
  const db = await openCuratorDataDb()
  const meta = await runCuratorDataValueRequest<CuratorDataStoreMeta | undefined>(
    db,
    CURATOR_DATA_STORES.metadata,
    'readonly',
    (store) => store.get(key)
  )
  return meta && typeof meta === 'object' ? meta : null
}

export async function writeCuratorDataStoreMeta(meta: CuratorDataStoreMeta): Promise<void> {
  await runCuratorDataTransaction(CURATOR_DATA_STORES.metadata, 'readwrite', (store) => {
    store.put(meta)
  })
}

export function resetCuratorDataDbForTest(): void {
  if (curatorDataDbPromise) {
    void curatorDataDbPromise.then((db) => db.close()).catch(() => {})
  }
  curatorDataDbPromise = null
  curatorDataDbFailureForTest = null
}

export function setCuratorDataDbFailureForTest(
  failure: ((operation: string) => Error | null | undefined) | null
): void {
  curatorDataDbFailureForTest = failure
}

function openCuratorDataDb(): Promise<IDBDatabase> {
  if (curatorDataDbPromise) {
    return curatorDataDbPromise
  }

  const factory = getIndexedDbFactory()
  if (!factory) {
    return Promise.reject(new Error('IndexedDB is unavailable.'))
  }

  curatorDataDbPromise = new Promise((resolve, reject) => {
    const request = factory.open(CURATOR_DATA_DB_NAME, CURATOR_DATA_DB_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const db = request.result
      for (const [storeName, keyPath] of Object.entries(STORE_KEY_PATHS)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath })
        }
      }
    })
    request.addEventListener('success', () => {
      const db = request.result
      db.addEventListener?.('versionchange', () => {
        db.close()
        curatorDataDbPromise = null
      })
      resolve(db)
    })
    request.addEventListener('error', () => {
      curatorDataDbPromise = null
      reject(request.error || new Error('无法打开数据仓库。'))
    })
    request.addEventListener('blocked', () => {
      curatorDataDbPromise = null
      reject(new Error('数据仓库升级被其他页面阻塞。'))
    })
  })

  return curatorDataDbPromise
}

function runCuratorDataTransaction(
  storeName: CuratorDataStoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => void
): Promise<void> {
  return openCuratorDataDb().then((db) =>
    new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
      try {
        run(store)
      } catch (error) {
        reject(error)
        return
      }
      transaction.addEventListener('complete', () => resolve())
      transaction.addEventListener('error', () => {
        reject(transaction.error || new Error('数据仓库写入失败。'))
      })
      transaction.addEventListener('abort', () => {
        reject(transaction.error || new Error('数据仓库写入中断。'))
      })
    })
  )
}

function runCuratorDataMultiStoreTransaction(
  storeNames: CuratorDataStoreName[],
  run: (stores: Record<CuratorDataStoreName, IDBObjectStore>) => void
): Promise<void> {
  return openCuratorDataDb().then((db) =>
    new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite')
      const stores = Object.fromEntries(
        storeNames.map((storeName) => [
          storeName,
          transaction.objectStore(storeName)
        ])
      ) as Record<CuratorDataStoreName, IDBObjectStore>
      try {
        run(stores)
      } catch (error) {
        transaction.abort()
        reject(error)
        return
      }
      transaction.addEventListener('complete', () => resolve())
      transaction.addEventListener('error', () => {
        reject(transaction.error || new Error('数据仓库写入失败。'))
      })
      transaction.addEventListener('abort', () => {
        reject(transaction.error || new Error('数据仓库写入中断。'))
      })
    })
  )
}

function runCuratorDataValueRequest<T>(
  db: IDBDatabase,
  storeName: CuratorDataStoreName,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = createRequest(store)
    transaction.addEventListener('complete', () => resolve(request.result as T))
    transaction.addEventListener('error', () => {
      reject(transaction.error || new Error('数据仓库读取失败。'))
    })
    transaction.addEventListener('abort', () => {
      reject(transaction.error || new Error('数据仓库读取中断。'))
    })
  })
}

function getIndexedDbFactory(): IDBFactory | null {
  try {
    return globalThis.indexedDB && typeof globalThis.indexedDB.open === 'function'
      ? globalThis.indexedDB
      : null
  } catch {
    return null
  }
}
