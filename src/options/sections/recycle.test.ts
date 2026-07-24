import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { RECYCLE_BIN_LIMIT } from '../../shared/constants.js'

const RECYCLE_STORAGE_KEY = 'curatorBookmarkRecycleBin'
let storedEntries: unknown[] = []
let storageError = ''
let failWrites = false
let createdBookmarks: chrome.bookmarks.BookmarkTreeNode[] = []
let removedBookmarkIds: string[] = []
let bookmarkLookupUrl = ''
let bookmarkLookupError = ''
let bookmarkTreeLookupError = ''
let delayedWriteRecycleId = ''
let bookmarkRemoveError = ''
let storageWriteCount = 0
let failStorageWriteNumbers = new Set<number>()
let activeStorageTransactions = 0
let maxActiveStorageTransactions = 0
const storageTransactionTails = new Map<string, Promise<unknown>>()

const testLockManager = {
  request(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock) => Promise<unknown>
  ) {
    const previous = storageTransactionTails.get(name) || Promise.resolve()
    const operation = previous
      .catch(() => {})
      .then(async () => {
        activeStorageTransactions += 1
        maxActiveStorageTransactions = Math.max(
          maxActiveStorageTransactions,
          activeStorageTransactions
        )
        try {
          return await callback({
            name,
            mode: 'exclusive'
          } as Lock)
        } finally {
          activeStorageTransactions -= 1
        }
      })
    storageTransactionTails.set(
      name,
      operation.then(() => undefined, () => undefined)
    )
    return operation
  }
} as LockManager

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    locks: testLockManager
  } as Navigator
})

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      get lastError() {
        return storageError ? { message: storageError } : undefined
      }
    },
    storage: {
      local: {
        get(_keys: unknown, callback: (items: Record<string, unknown>) => void) {
          storageError = ''
          callback({ [RECYCLE_STORAGE_KEY]: structuredClone(storedEntries) })
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          storageWriteCount += 1
          const nextEntries = Array.isArray(payload[RECYCLE_STORAGE_KEY])
            ? structuredClone(payload[RECYCLE_STORAGE_KEY] as unknown[])
            : storedEntries
          const commit = () => {
            const shouldFail =
              failWrites ||
              failStorageWriteNumbers.has(storageWriteCount)
            storageError = shouldFail ? 'disk full' : ''
            if (!shouldFail) {
              storedEntries = nextEntries
            }
            callback()
            storageError = ''
          }
          if (
            delayedWriteRecycleId &&
            nextEntries.some((entry: any) => entry?.recycleId === delayedWriteRecycleId)
          ) {
            const delayedId = delayedWriteRecycleId
            delayedWriteRecycleId = ''
            setTimeout(() => {
              delayedWriteRecycleId = delayedId
              commit()
              delayedWriteRecycleId = ''
            }, 0)
            return
          }
          commit()
        }
      }
    },
    bookmarks: {
      get(
        bookmarkId: string,
        callback: (nodes: chrome.bookmarks.BookmarkTreeNode[]) => void
      ) {
        storageError = bookmarkLookupError
        callback(bookmarkLookupUrl
          ? [{
              id: bookmarkId,
              parentId: '1',
              title: bookmarkId,
              syncing: false,
              url: bookmarkLookupUrl
            }]
          : [])
        storageError = ''
      },
      getTree(callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) {
        const sourceEntry = (storedEntries as Array<{
          bookmarkId?: string
          title?: string
          url?: string
        }>).find((entry) => entry.url === bookmarkLookupUrl)
        storageError = bookmarkTreeLookupError
        callback([{
          id: '0',
          syncing: false,
          title: '',
          children: [{
            id: '1',
            parentId: '0',
            syncing: false,
            title: 'Bookmarks bar',
            children: sourceEntry && bookmarkLookupUrl
              ? [{
                  id: String(sourceEntry.bookmarkId || ''),
                  parentId: '1',
                  syncing: false,
                  title: String(sourceEntry.title || ''),
                  url: bookmarkLookupUrl
                }]
              : []
          }]
        }])
        storageError = ''
      },
      create(
        payload: chrome.bookmarks.CreateDetails,
        callback: (node: chrome.bookmarks.BookmarkTreeNode) => void
      ) {
        const node = {
          ...payload,
          id: `restored-${createdBookmarks.length + 1}`,
          parentId: payload.parentId || '1',
          syncing: false,
          title: payload.title || ''
        }
        createdBookmarks.push(node)
        callback(node)
      },
      remove(bookmarkId: string, callback: () => void) {
        removedBookmarkIds.push(bookmarkId)
        storageError = bookmarkRemoveError
        callback()
        storageError = ''
      }
    }
  }
})

const { availabilityState, managerState } = await import('../shared-options/state.js')
const {
  clearRecycleBin,
  restoreSelectedRecycleEntries
} = await import('./recycle.js')
const {
  deleteBookmarkToRecycle,
  restoreBookmarkFromRecycleEntry
} = await import('../../shared/recycle-bin.js')

beforeEach(() => {
  storedEntries = []
  storageError = ''
  failWrites = false
  createdBookmarks = []
  removedBookmarkIds = []
  bookmarkLookupUrl = ''
  bookmarkLookupError = ''
  bookmarkTreeLookupError = ''
  delayedWriteRecycleId = ''
  bookmarkRemoveError = ''
  storageWriteCount = 0
  failStorageWriteNumbers = new Set()
  activeStorageTransactions = 0
  maxActiveStorageTransactions = 0
  storageTransactionTails.clear()
  managerState.recycleBin = []
  managerState.selectedRecycleIds = new Set()
  availabilityState.deleting = false
  availabilityState.runSessionActive = false
  availabilityState.retestingSelection = false
  availabilityState.settingsSaving = false
  availabilityState.stopRequested = false
  availabilityState.lastError = ''
})

function recycleEntry(id: string) {
  return {
    recycleId: id,
    bookmarkId: id,
    title: id,
    url: `https://${id}.example/`,
    parentId: '1',
    index: 0,
    path: 'Bookmarks',
    source: 'test',
    deletedAt: 1
  }
}

test('keeps recycle state and unlocks the UI when persistence fails', async () => {
  const entry = recycleEntry('entry-1')
  storedEntries = [entry]
  managerState.recycleBin = [entry]
  managerState.selectedRecycleIds = new Set(['entry-1'])
  availabilityState.deleting = false
  availabilityState.runSessionActive = false
  availabilityState.retestingSelection = false
  availabilityState.settingsSaving = false
  availabilityState.stopRequested = false
  failWrites = true
  let renderCount = 0

  await clearRecycleBin({
    claimAvailabilityMutationLock: async () => () => {},
    confirm: async () => true,
    renderAvailabilitySection() {
      renderCount += 1
    }
  })

  assert.deepEqual(managerState.recycleBin, [entry])
  assert.deepEqual(storedEntries, [entry])
  assert.equal(availabilityState.deleting, false)
  assert.match(availabilityState.lastError, /disk full/)
  assert.ok(renderCount >= 2)
  failWrites = false
})

test('rolls back restored bookmarks when recycle persistence fails', async () => {
  const entry = recycleEntry('entry-restore')
  storedEntries = [entry]
  managerState.recycleBin = [entry]
  managerState.selectedRecycleIds = new Set(['entry-restore'])
  availabilityState.deleting = false
  availabilityState.runSessionActive = false
  availabilityState.retestingSelection = false
  availabilityState.settingsSaving = false
  availabilityState.stopRequested = false
  createdBookmarks = []
  removedBookmarkIds = []
  failWrites = true

  await restoreSelectedRecycleEntries({
    claimAvailabilityMutationLock: async () => () => {},
    async hydrateAvailabilityCatalog() {},
    renderAvailabilitySection() {}
  })

  assert.equal(createdBookmarks.length, 1)
  assert.deepEqual(removedBookmarkIds, ['restored-1'])
  assert.deepEqual(storedEntries, [entry])
  assert.deepEqual(managerState.recycleBin, [entry])
  assert.equal(availabilityState.deleting, false)
  assert.match(availabilityState.lastError, /已撤销本次恢复/)
  failWrites = false
})

test('revalidates the bookmark URL after recycle persistence and before deletion', async () => {
  const entry = recycleEntry('bookmark-stale')
  entry.url = 'https://old.example/'
  storedEntries = []
  removedBookmarkIds = []
  bookmarkLookupUrl = 'https://changed.example/'
  failWrites = false

  const deleted = await deleteBookmarkToRecycle(
    'bookmark-stale',
    entry,
    { expectedUrl: 'https://old.example/' }
  )

  assert.equal(deleted, false)
  assert.deepEqual(removedBookmarkIds, [])
  assert.deepEqual(storedEntries, [])
  bookmarkLookupUrl = ''
})

test('restores the full recycle snapshot when bookmark deletion fails at capacity', async () => {
  const baseDeletedAt = Date.now() + RECYCLE_BIN_LIMIT
  const originalEntries = Array.from({ length: RECYCLE_BIN_LIMIT }, (_value, index) => ({
    ...recycleEntry(`existing-${index}`),
    deletedAt: baseDeletedAt - index
  }))
  const newEntry = {
    ...recycleEntry('new-at-capacity'),
    deletedAt: baseDeletedAt + 1
  }
  storedEntries = structuredClone(originalEntries)
  removedBookmarkIds = []
  bookmarkLookupUrl = newEntry.url
  bookmarkRemoveError = 'bookmark delete denied'
  failWrites = false

  await assert.rejects(
    deleteBookmarkToRecycle(
      String(newEntry.bookmarkId),
      newEntry,
      { expectedUrl: String(newEntry.url) }
    ),
    /bookmark delete denied/
  )

  assert.deepEqual(storedEntries, originalEntries)
  assert.equal(
    (storedEntries as Array<{ recycleId?: string }>).some(
      (entry) => entry.recycleId === newEntry.recycleId
    ),
    false
  )
  bookmarkLookupUrl = ''
  bookmarkRemoveError = ''
})

test('serializes independent recycle modules across one storage transaction lock', async () => {
  storedEntries = []
  failWrites = false
  delayedWriteRecycleId = 'entry-b'
  activeStorageTransactions = 0
  maxActiveStorageTransactions = 0

  const moduleUrl = new URL('../../shared/recycle-bin.js', import.meta.url)
  const firstContext = await import(`${moduleUrl.href}?context=first`)
  const secondContext = await import(`${moduleUrl.href}?context=second`)

  await Promise.all([
    firstContext.appendRecycleEntry(recycleEntry('entry-a')),
    secondContext.appendRecycleEntry(recycleEntry('entry-b'))
  ])

  assert.deepEqual(
    (storedEntries as Array<{ recycleId?: string }>).map((entry) => entry.recycleId).sort(),
    ['entry-a', 'entry-b']
  )
  assert.equal(maxActiveStorageTransactions, 1)
  delayedWriteRecycleId = ''
})

test('rolls back a newly restored bookmark when consuming its recycle record fails', async () => {
  const entry = recycleEntry('entry-undo')
  storedEntries = [entry]
  createdBookmarks = []
  removedBookmarkIds = []
  failWrites = true

  await assert.rejects(
    restoreBookmarkFromRecycleEntry(entry.recycleId, async () => {
      const restoredBookmark = {
        id: 'restored-undo',
        parentId: '1',
        title: entry.title,
        url: entry.url,
        syncing: false
      }
      createdBookmarks.push(restoredBookmark)
      return restoredBookmark
    }),
    /disk full.*已撤销刚恢复的书签/
  )

  assert.deepEqual(removedBookmarkIds, ['restored-undo'])
  assert.deepEqual(storedEntries, [entry])
  failWrites = false
})

test('warns about a possible duplicate when recycle consumption and bookmark rollback both fail', async () => {
  const entry = recycleEntry('entry-double-failure')
  storedEntries = [entry]
  managerState.recycleBin = [entry]
  managerState.selectedRecycleIds = new Set([entry.recycleId])
  availabilityState.deleting = false
  availabilityState.runSessionActive = false
  availabilityState.retestingSelection = false
  availabilityState.settingsSaving = false
  availabilityState.stopRequested = false
  createdBookmarks = []
  removedBookmarkIds = []
  failWrites = true
  bookmarkRemoveError = 'bookmark rollback denied'

  await restoreSelectedRecycleEntries({
    claimAvailabilityMutationLock: async () => () => {},
    async hydrateAvailabilityCatalog() {},
    renderAvailabilitySection() {}
  })

  assert.equal(createdBookmarks.length, 1)
  assert.deepEqual(storedEntries, [entry])
  assert.match(availabilityState.lastError, /自动回滚也失败/)
  assert.match(availabilityState.lastError, /不要立即重试/)
  assert.doesNotMatch(availabilityState.lastError, /未创建重复书签/)

  failWrites = false
  bookmarkRemoveError = ''
})

test('cleans a phantom recycle record instead of restoring over its still-existing source', async () => {
  const entry = recycleEntry('entry-source-still-exists')
  storedEntries = []
  removedBookmarkIds = []
  storageWriteCount = 0
  failStorageWriteNumbers = new Set([2])
  bookmarkLookupUrl = entry.url
  bookmarkRemoveError = 'bookmark delete denied'

  await assert.rejects(
    deleteBookmarkToRecycle(entry.bookmarkId, entry, { expectedUrl: entry.url }),
    (error: unknown) => {
      return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'recycle-delete-rollback-failed'
      )
    }
  )
  assert.deepEqual(storedEntries, [entry])

  failStorageWriteNumbers = new Set()
  bookmarkRemoveError = ''
  let createCalled = false
  await assert.rejects(
    restoreBookmarkFromRecycleEntry(entry.recycleId, async () => {
      createCalled = true
      throw new Error('must not create a duplicate')
    }),
    (error: unknown) => {
      return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'recycle-restore-source-exists'
      )
    }
  )

  assert.equal(createCalled, false)
  assert.deepEqual(storedEntries, [])
  bookmarkLookupUrl = ''
})

test('keeps the recycle record when source bookmark existence cannot be verified', async () => {
  const entry = recycleEntry('entry-source-query-error')
  storedEntries = [entry]
  bookmarkLookupUrl = ''
  bookmarkLookupError = 'temporary bookmark lookup failure'
  bookmarkTreeLookupError = 'temporary bookmark tree failure'
  let createCalled = false

  await assert.rejects(
    restoreBookmarkFromRecycleEntry(entry.recycleId, async () => {
      createCalled = true
      throw new Error('must not create while source state is unknown')
    }),
    /无法确认书签是否存在/
  )

  assert.equal(createCalled, false)
  assert.deepEqual(storedEntries, [entry])
  bookmarkLookupError = ''
  bookmarkTreeLookupError = ''
})
