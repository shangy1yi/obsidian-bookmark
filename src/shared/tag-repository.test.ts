import assert from 'node:assert/strict'
import test from 'node:test'
import { IDBFactory } from 'fake-indexeddb'
import {
  __resetBookmarkTagRepositoryForTest,
  loadBookmarkTagIndex,
  restoreBookmarkTagIndexSnapshot,
  type BookmarkTagIndex
} from './bookmark-tags.js'
import { STORAGE_KEYS } from './constants.js'

class NonReentrantTestLockManager {
  requestCount = 0
  private queue = Promise.resolve()

  request<T>(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>
  ): Promise<T> {
    this.requestCount += 1
    const result = this.queue.then(() => callback({
      name,
      mode: 'exclusive'
    } as Lock))
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}

const lockManager = new NonReentrantTestLockManager()
let storageState: Record<string, unknown> = {}
let runtimeError = ''
let failStorageSet = false

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    locks: lockManager
  }
})

Object.defineProperty(globalThis, 'indexedDB', {
  configurable: true,
  writable: true,
  value: new IDBFactory()
})

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      get lastError() {
        return runtimeError
          ? { message: runtimeError }
          : undefined
      }
    },
    storage: {
      local: {
        get(keys: string[] | string, callback: (items: Record<string, unknown>) => void) {
          const requestedKeys = Array.isArray(keys) ? keys : [keys]
          const result: Record<string, unknown> = {}
          for (const key of requestedKeys) {
            if (Object.prototype.hasOwnProperty.call(storageState, key)) {
              result[key] = structuredClone(storageState[key])
            }
          }
          callback(result)
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          if (failStorageSet) {
            runtimeError = 'simulated tag compaction failure'
            callback()
            runtimeError = ''
            return
          }
          for (const [key, value] of Object.entries(payload)) {
            storageState[key] = structuredClone(value)
          }
          callback()
        },
        remove(keys: string[] | string, callback: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete storageState[key]
          }
          callback()
        }
      }
    }
  } as unknown as typeof chrome
})

test('migrates legacy tag records under one non-reentrant storage lock', async () => {
  __resetBookmarkTagRepositoryForTest()
  globalThis.indexedDB = new IDBFactory()
  lockManager.requestCount = 0
  runtimeError = ''
  failStorageSet = false
  storageState = {
    [STORAGE_KEYS.bookmarkTagIndex]: {
      version: 1,
      updatedAt: 10,
      records: {
        legacy: {
          schemaVersion: 1,
          bookmarkId: 'legacy',
          url: 'https://legacy.example/',
          normalizedUrl: 'https://legacy.example/',
          duplicateKey: 'legacy.example',
          title: 'Legacy',
          path: 'Bookmarks',
          summary: '',
          contentType: '',
          topics: [],
          tags: ['legacy'],
          aliases: [],
          confidence: 1,
          source: 'imported',
          model: '',
          extraction: {
            status: '',
            source: '',
            warnings: []
          },
          generatedAt: 10,
          updatedAt: 10
        }
      }
    }
  }

  let deadlockTimer: ReturnType<typeof setTimeout> | undefined
  const loaded = await Promise.race([
    loadBookmarkTagIndex(),
    new Promise<never>((_resolve, reject) => {
      deadlockTimer = setTimeout(
        () => reject(new Error('legacy tag migration deadlocked')),
        500
      )
    })
  ]).finally(() => {
    if (deadlockTimer) {
      clearTimeout(deadlockTimer)
    }
  })

  assert.equal(loaded.records.legacy?.bookmarkId, 'legacy')
  assert.deepEqual(
    (storageState[STORAGE_KEYS.bookmarkTagIndex] as { records?: unknown }).records,
    {},
    'successful migration must compact the legacy local records'
  )
  assert.equal(
    lockManager.requestCount,
    1,
    'migration must reuse the active transaction instead of requesting the same lock again'
  )
})

test('strict tag snapshot restore rejects a failed local compaction and remains retryable', async () => {
  __resetBookmarkTagRepositoryForTest()
  globalThis.indexedDB = new IDBFactory()
  lockManager.requestCount = 0
  runtimeError = ''
  failStorageSet = false
  storageState = {}

  const snapshot = {
    version: 1,
    updatedAt: 20,
    records: {
      restored: {
        schemaVersion: 1,
        bookmarkId: 'restored',
        url: 'https://restored.example/',
        normalizedUrl: 'https://restored.example/',
        duplicateKey: 'restored.example',
        title: 'Restored',
        path: 'Bookmarks',
        summary: '',
        contentType: '',
        topics: [],
        tags: ['restored'],
        aliases: [],
        confidence: 1,
        source: 'manual',
        model: '',
        extraction: {
          status: '',
          source: '',
          warnings: []
        },
        generatedAt: 20,
        updatedAt: 20
      }
    }
  } satisfies BookmarkTagIndex

  failStorageSet = true
  await assert.rejects(
    restoreBookmarkTagIndexSnapshot(snapshot),
    /simulated tag compaction failure/
  )

  failStorageSet = false
  await restoreBookmarkTagIndexSnapshot(snapshot)

  const restored = await loadBookmarkTagIndex()
  assert.deepEqual(restored.records.restored?.tags, ['restored'])
  assert.deepEqual(
    (storageState[STORAGE_KEYS.bookmarkTagIndex] as { records?: unknown }).records,
    {},
    'successful retry must leave the local compatibility record compacted'
  )
})
