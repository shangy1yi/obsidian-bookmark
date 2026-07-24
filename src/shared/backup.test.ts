import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { IDBFactory } from 'fake-indexeddb'
import {
  BACKUP_RESTORE_ROLLED_BACK_CODE,
  executeJournaledCuratorBackupRestore,
  recoverInterruptedCuratorBackupRestore,
  restoreCuratorBackup,
  type BackupRestoreMutationLock,
  type CuratorBackupFileV1
} from './backup.js'
import {
  __resetBookmarkTagRepositoryForTest,
  loadBookmarkTagIndex,
  saveBookmarkTagIndex,
  type BookmarkTagIndex,
  type BookmarkTagRecord
} from './bookmark-tags.js'
import { STORAGE_KEYS } from './constants.js'

const AUTO_BACKUP_DB_NAME = 'curatorBookmarkHeavyUserData'
const AUTO_BACKUP_DB_VERSION = 2
const AUTO_BACKUP_STORE = 'autoBackups'
const ACTIVE_RESTORE_JOURNAL_KEY = 'restore-journal:active'
const RESTORE_RECEIPT_PREFIX = 'restore-receipt:'

const initialStorage: Record<string, unknown> = {
  [STORAGE_KEYS.bookmarkTagIndex]: {
    version: 1,
    updatedAt: 10,
    records: {}
  },
  [STORAGE_KEYS.newTabGeneralSettings]: {
    density: 'compact'
  },
  [STORAGE_KEYS.recycleBin]: [{ recycleId: 'old-entry' }],
  [STORAGE_KEYS.ignoreRules]: {
    bookmarks: [],
    domains: [{ domain: 'kept.example', createdAt: 1 }],
    folders: []
  },
  [STORAGE_KEYS.redirectCache]: {
    version: 1,
    results: [{ id: 'old-redirect' }]
  }
}

class TestLockManager {
  events: string[] = []
  private queues = new Map<string, Promise<void>>()

  request<T>(
    name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>
  ): Promise<T> {
    const queue = this.queues.get(name) || Promise.resolve()
    const result = queue.then(async () => {
      this.events.push(`${name}:start`)
      try {
        return await callback({
          name,
          mode: 'exclusive'
        } as Lock)
      } finally {
        this.events.push(`${name}:end`)
      }
    })
    this.queues.set(name, result.then(() => undefined, () => undefined))
    return result
  }
}

const lockManager = new TestLockManager()
let storageState: Record<string, unknown> = {}
let runtimeError = ''
let storageSetCalls = 0
let storageSetFailuresRemaining = 0
let beforeStorageSet: ((payload: Record<string, unknown>) => Promise<void> | void) | null = null
let failBookmarkCopy = false
let nextBookmarkId = 1
let beforeBookmarkCreate:
  | ((
    payload: chrome.bookmarks.CreateDetails,
    node: chrome.bookmarks.BookmarkTreeNode | null
  ) => Promise<void> | void)
  | null = null
const bookmarkNodes = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
const removedBookmarkTrees: string[] = []
const createdBookmarkPayloads: chrome.bookmarks.CreateDetails[] = []

function invokeChromeCallback(
  callback: (...args: any[]) => void,
  args: any[],
  error = ''
): void {
  runtimeError = error
  callback(...args)
  runtimeError = ''
}

function getRequestedStorageKeys(
  keys: string[] | string | Record<string, unknown> | null
): string[] {
  if (keys === null) {
    return Object.keys(storageState)
  }
  if (Array.isArray(keys)) {
    return keys
  }
  if (typeof keys === 'string') {
    return [keys]
  }
  return Object.keys(keys)
}

function materializeBookmarkNode(
  node: chrome.bookmarks.BookmarkTreeNode
): chrome.bookmarks.BookmarkTreeNode {
  const result = structuredClone(node)
  if (!result.url) {
    result.children = [...bookmarkNodes.values()]
      .filter((candidate) => candidate.parentId === result.id)
      .map(materializeBookmarkNode)
  }
  return result
}

function buildBookmarkTree(): chrome.bookmarks.BookmarkTreeNode[] {
  const bookmarkBar = bookmarkNodes.get('1')
  return [{
    id: '0',
    title: '',
    syncing: false,
    children: bookmarkBar ? [materializeBookmarkNode(bookmarkBar)] : []
  }]
}

function removeBookmarkNodeTree(bookmarkId: string): void {
  for (const child of [...bookmarkNodes.values()]) {
    if (child.parentId === bookmarkId) {
      removeBookmarkNodeTree(String(child.id))
    }
  }
  bookmarkNodes.delete(bookmarkId)
}

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
        return runtimeError ? { message: runtimeError } : undefined
      },
      getManifest() {
        return { version: '1.5.2' }
      }
    },
    storage: {
      local: {
        get(
          keys: string[] | string | Record<string, unknown> | null,
          callback: (items: Record<string, unknown>) => void
        ) {
          const result: Record<string, unknown> = {}
          for (const key of getRequestedStorageKeys(keys)) {
            if (Object.prototype.hasOwnProperty.call(storageState, key)) {
              result[key] = structuredClone(storageState[key])
            }
          }
          invokeChromeCallback(callback, [result])
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          storageSetCalls += 1
          void Promise.resolve(beforeStorageSet?.(structuredClone(payload)))
            .then(() => {
              if (storageSetFailuresRemaining > 0) {
                storageSetFailuresRemaining -= 1
                invokeChromeCallback(callback, [], 'simulated storage write failure')
                return
              }
              for (const [key, value] of Object.entries(payload)) {
                storageState[key] = structuredClone(value)
              }
              invokeChromeCallback(callback, [])
            })
            .catch((error) => {
              invokeChromeCallback(
                callback,
                [],
                error instanceof Error ? error.message : 'storage observer failed'
              )
            })
        },
        remove(keys: string[] | string, callback: () => void) {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete storageState[key]
          }
          invokeChromeCallback(callback, [])
        }
      }
    },
    bookmarks: {
      getTree(callback: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) {
        invokeChromeCallback(callback, [buildBookmarkTree()])
      },
      get(
        bookmarkId: string,
        callback: (nodes?: chrome.bookmarks.BookmarkTreeNode[]) => void
      ) {
        const node = bookmarkNodes.get(String(bookmarkId))
        if (!node) {
          invokeChromeCallback(callback, [undefined], 'bookmark not found')
          return
        }
        invokeChromeCallback(callback, [[materializeBookmarkNode(node)]])
      },
      create(
        payload: chrome.bookmarks.CreateDetails,
        callback: (node?: chrome.bookmarks.BookmarkTreeNode) => void
      ) {
        createdBookmarkPayloads.push(structuredClone(payload))
        void (async () => {
          if (payload.url && failBookmarkCopy) {
            await beforeBookmarkCreate?.(payload, null)
            invokeChromeCallback(callback, [undefined], 'simulated bookmark copy failure')
            return
          }

          const id = nextBookmarkId === 1 ? 'restore-root' : `bookmark-${nextBookmarkId}`
          nextBookmarkId += 1
          const node: chrome.bookmarks.BookmarkTreeNode = {
            id,
            parentId: payload.parentId,
            title: payload.title || '',
            url: payload.url,
            syncing: false
          }
          bookmarkNodes.set(id, node)
          await beforeBookmarkCreate?.(payload, node)
          invokeChromeCallback(callback, [materializeBookmarkNode(node)])
        })().catch((error) => {
          invokeChromeCallback(
            callback,
            [undefined],
            error instanceof Error ? error.message : 'bookmark observer failed'
          )
        })
      },
      removeTree(bookmarkId: string, callback: () => void) {
        removedBookmarkTrees.push(bookmarkId)
        removeBookmarkNodeTree(bookmarkId)
        invokeChromeCallback(callback, [])
      }
    }
  } as unknown as typeof chrome
})

beforeEach(() => {
  __resetBookmarkTagRepositoryForTest()
  globalThis.indexedDB = new IDBFactory()
  storageState = structuredClone(initialStorage)
  runtimeError = ''
  storageSetCalls = 0
  storageSetFailuresRemaining = 0
  beforeStorageSet = null
  failBookmarkCopy = false
  nextBookmarkId = 1
  beforeBookmarkCreate = null
  bookmarkNodes.clear()
  bookmarkNodes.set('1', {
    id: '1',
    parentId: '0',
    title: 'Bookmarks bar',
    syncing: false
  })
  removedBookmarkTrees.length = 0
  createdBookmarkPayloads.length = 0
  lockManager.events.length = 0
})

test('rolls back storage, tags, and the restore folder after a copy failure', async () => {
  failBookmarkCopy = true

  await assert.rejects(
    restoreCuratorBackup(buildBackup(), 'safeFull'),
    /simulated bookmark copy failure.*已自动回滚本次恢复写入/
  )

  assert.deepEqual(storageState, initialStorage)
  assert.deepEqual(removedBookmarkTrees, ['restore-root'])
})

test('journals before mutation and returns a committed receipt for duplicate operations', async () => {
  let journalAtMutation: Record<string, unknown> | null = null
  let mutationLockCalls = 0
  let beforeApplyCalls = 0
  let journalAtBeforeApply: Record<string, unknown> | null | undefined
  beforeStorageSet = async (payload) => {
    if (
      journalAtMutation === null &&
      Object.prototype.hasOwnProperty.call(payload, STORAGE_KEYS.newTabGeneralSettings)
    ) {
      journalAtMutation = await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY)
    }
  }
  const withMutationLock: BackupRestoreMutationLock = async (task) => {
    mutationLockCalls += 1
    return task()
  }

  const backup = buildBackup({ includeMissingBookmark: false })
  const firstResult = await executeJournaledCuratorBackupRestore(
    backup,
    'newTabOnly',
    {
      operationId: 'op-success',
      now: 0,
      withMutationLock,
      async beforeApply() {
        beforeApplyCalls += 1
        journalAtBeforeApply = await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY)
      }
    }
  )

  assert.equal(firstResult.restored.newTabSections, 1)
  assert.equal(mutationLockCalls, 0, 'non-safeFull restores must not take the mutation lock')
  assert.equal(beforeApplyCalls, 1)
  assert.equal(journalAtBeforeApply, null)
  assert.equal(journalAtMutation?.status, 'applying')
  assert.equal(journalAtMutation?.storageStateMayHaveChanged, true)
  assert.deepEqual(
    journalAtMutation?.expectedStorage,
    { [STORAGE_KEYS.newTabGeneralSettings]: { density: 'comfortable' } }
  )
  assert.equal(await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY), null)
  const receipt = await getAutoBackupRecord(`${RESTORE_RECEIPT_PREFIX}op-success`)
  assert.equal(receipt?.status, 'committed')

  const setCallsAfterFirstRun = storageSetCalls
  storageState[STORAGE_KEYS.newTabGeneralSettings] = { density: 'after-first-run' }
  const duplicateResult = await executeJournaledCuratorBackupRestore(
    buildBackup({
      includeMissingBookmark: false,
      density: 'must-not-be-applied'
    }),
    'newTabOnly',
    {
      operationId: 'op-success',
      withMutationLock,
      async beforeApply() {
        beforeApplyCalls += 1
      }
    }
  )

  assert.deepEqual(duplicateResult, firstResult)
  assert.equal(beforeApplyCalls, 1, 'receipt replay must skip beforeApply')
  assert.equal(storageSetCalls, setCallsAfterFirstRun)
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    { density: 'after-first-run' }
  )
})

test('safeFull restore lock order is restore, mutation, then local storage', async () => {
  const withMutationLock: BackupRestoreMutationLock = async <T>(
    task: () => Promise<T>
  ): Promise<T> => {
    lockManager.events.push('mutation:start')
    try {
      return await task()
    } finally {
      lockManager.events.push('mutation:end')
    }
  }

  await executeJournaledCuratorBackupRestore(
    buildBackup({ includeMissingBookmark: false }),
    'safeFull',
    {
      operationId: 'op-lock-order',
      withMutationLock,
      async beforeApply() {
        lockManager.events.push('before-apply')
      }
    }
  )

  const events = lockManager.events
  assert.ok(
    events.indexOf('curator:backup-restore:start') <
      events.indexOf('mutation:start')
  )
  assert.ok(
    events.indexOf('mutation:start') <
      events.indexOf('before-apply')
  )
  assert.ok(
    events.indexOf('before-apply') <
      events.indexOf('curator:local-storage-transaction:start')
  )
  assert.ok(
    events.indexOf('curator:local-storage-transaction:end') <
      events.indexOf('mutation:end')
  )
  assert.ok(
    events.indexOf('mutation:end') <
      events.indexOf('curator:backup-restore:end')
  )
})

test('beforeApply failure leaves no journal, receipt, or restored state', async () => {
  await assert.rejects(
    executeJournaledCuratorBackupRestore(
      buildBackup({ includeMissingBookmark: false }),
      'newTabOnly',
      {
        operationId: 'op-before-apply-failure',
        async beforeApply() {
          throw new Error('simulated auto backup failure')
        }
      }
    ),
    /simulated auto backup failure/
  )

  assert.deepEqual(storageState, initialStorage)
  assert.equal(await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY), null)
  assert.equal(
    await getAutoBackupRecord(
      `${RESTORE_RECEIPT_PREFIX}op-before-apply-failure`
    ),
    null
  )
})

test('records the unique restore folder id before copying children', async () => {
  let journalBeforeChildCopy: Record<string, unknown> | null = null
  failBookmarkCopy = true
  beforeBookmarkCreate = async (payload) => {
    if (payload.url) {
      journalBeforeChildCopy = await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY)
    }
  }

  await assert.rejects(
    executeJournaledCuratorBackupRestore(buildBackup(), 'safeFull', {
      operationId: 'op-folder',
      now: 0
    }),
    /simulated bookmark copy failure/
  )

  assert.equal(journalBeforeChildCopy?.status, 'copying-bookmarks')
  assert.equal(journalBeforeChildCopy?.restoreFolderId, 'restore-root')
  assert.equal(
    journalBeforeChildCopy?.restoreFolderTitle,
    'Curator Restore 1970-01-01 [op-folder]'
  )
  assert.equal(
    createdBookmarkPayloads[0]?.title,
    'Curator Restore 1970-01-01 [op-folder]'
  )
  assert.deepEqual(removedBookmarkTrees, ['restore-root'])
  assert.equal(await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY), null)
  assert.equal(
    (await getAutoBackupRecord(`${RESTORE_RECEIPT_PREFIX}op-folder`))?.status,
    'rolled-back'
  )
  await assert.rejects(
    executeJournaledCuratorBackupRestore(buildBackup(), 'safeFull', {
      operationId: 'op-folder',
      now: 0
    }),
    (error: unknown) => {
      return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === BACKUP_RESTORE_ROLLED_BACK_CODE
      )
    }
  )
})

test('journaled rollback restores tags written with the recorded target timestamp', async () => {
  bookmarkNodes.set('existing-tag', {
    id: 'existing-tag',
    parentId: '1',
    title: 'Existing tag target',
    url: 'https://existing-tag.example/',
    syncing: false
  })
  const backup = buildBackup()
  backup.storage.bookmarkTagIndex = buildTagIndex({
    'existing-tag': buildTagRecord(
      'existing-tag',
      'https://existing-tag.example/'
    )
  })
  failBookmarkCopy = true

  await assert.rejects(
    executeJournaledCuratorBackupRestore(backup, 'safeFull', {
      operationId: 'op-tag-target-time',
      now: 0
    }),
    /simulated bookmark copy failure/
  )

  assert.deepEqual((await loadBookmarkTagIndex()).records, {})
  assert.equal(
    (await getAutoBackupRecord(
      `${RESTORE_RECEIPT_PREFIX}op-tag-target-time`
    ))?.status,
    'rolled-back'
  )
})

test('recovers an interrupted safeFull restore idempotently by tag, local state, and title', async () => {
  await saveBookmarkTagIndex(buildTagIndex({
    mutated: buildTagRecord('mutated', 'https://mutated.example/')
  }))
  const interruptedRestoreTagIndex = await loadBookmarkTagIndex()
  storageState[STORAGE_KEYS.newTabGeneralSettings] = { density: 'mutated' }
  const restoreFolderTitle = 'Curator Restore 1970-01-01 [op-recovery]'
  bookmarkNodes.set('orphan-restore-root', {
    id: 'orphan-restore-root',
    parentId: '1',
    title: restoreFolderTitle,
    syncing: false
  })
  await putAutoBackupRecord(buildRestoreJournal({
    operationId: 'op-recovery',
    mode: 'safeFull',
    restoreStorageKeys: [
      STORAGE_KEYS.bookmarkTagIndex,
      STORAGE_KEYS.newTabGeneralSettings
    ],
    previousStorage: {
      [STORAGE_KEYS.bookmarkTagIndex]: initialStorage[STORAGE_KEYS.bookmarkTagIndex],
      [STORAGE_KEYS.newTabGeneralSettings]:
        initialStorage[STORAGE_KEYS.newTabGeneralSettings]
    },
    previousTagIndex: buildTagIndex({}),
    expectedTagIndex: interruptedRestoreTagIndex,
    restoreFolderTitle,
    restoreFolderId: 'stale-restore-root-id'
  }))
  lockManager.events.length = 0
  let mutationLockCalls = 0
  const withMutationLock: BackupRestoreMutationLock = async (task) => {
    mutationLockCalls += 1
    return task()
  }

  const recovery = await recoverInterruptedCuratorBackupRestore({ withMutationLock })

  assert.deepEqual(recovery, {
    operationId: 'op-recovery',
    recovered: true,
    errors: []
  })
  assert.equal(mutationLockCalls, 1)
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    initialStorage[STORAGE_KEYS.newTabGeneralSettings]
  )
  assert.deepEqual(
    storageState[STORAGE_KEYS.bookmarkTagIndex],
    initialStorage[STORAGE_KEYS.bookmarkTagIndex]
  )
  assert.deepEqual((await loadBookmarkTagIndex()).records, {})
  assert.equal(bookmarkNodes.has('orphan-restore-root'), false)
  assert.deepEqual(removedBookmarkTrees, ['orphan-restore-root'])
  assert.equal(await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY), null)
  assert.equal(
    (await getAutoBackupRecord(`${RESTORE_RECEIPT_PREFIX}op-recovery`))?.status,
    'rolled-back'
  )

  assert.equal(
    await recoverInterruptedCuratorBackupRestore({ withMutationLock }),
    null
  )
  assert.equal(mutationLockCalls, 1)
  assert.deepEqual(removedBookmarkTrees, ['orphan-restore-root'])
})

test('recovery preserves writes made after an interrupted restore', async () => {
  const restoreTargetTagIndex = buildTagIndex({
    target: buildTagRecord('target', 'https://target.example/')
  })
  const laterTagIndex = buildTagIndex({
    later: buildTagRecord('later', 'https://later.example/')
  })
  await saveBookmarkTagIndex(laterTagIndex)
  storageState[STORAGE_KEYS.newTabGeneralSettings] = { density: 'user-later' }

  await putAutoBackupRecord(buildRestoreJournal({
    operationId: 'op-preserve-later-writes',
    mode: 'safeFull',
    restoreStorageKeys: [STORAGE_KEYS.newTabGeneralSettings],
    previousStorage: {
      [STORAGE_KEYS.newTabGeneralSettings]:
        initialStorage[STORAGE_KEYS.newTabGeneralSettings]
    },
    previousTagIndex: buildTagIndex({}),
    expectedTagIndex: restoreTargetTagIndex,
    expectedStorage: {
      [STORAGE_KEYS.newTabGeneralSettings]: { density: 'restore-target' }
    },
    tagStateMayHaveChanged: true,
    storageStateMayHaveChanged: true
  }))

  const recovery = await recoverInterruptedCuratorBackupRestore()

  assert.deepEqual(recovery, {
    operationId: 'op-preserve-later-writes',
    recovered: true,
    errors: []
  })
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    { density: 'user-later' }
  )
  assert.deepEqual(
    Object.keys((await loadBookmarkTagIndex()).records),
    ['later']
  )
})

test('legacy recovery preserves unverifiable data and records a terminal receipt', async () => {
  const laterTagIndex = buildTagIndex({
    later: buildTagRecord('later', 'https://later.example/')
  })
  await saveBookmarkTagIndex(laterTagIndex)
  storageState[STORAGE_KEYS.newTabGeneralSettings] = { density: 'user-later' }
  const restoreFolderTitle = 'Curator Restore 1970-01-01 [op-legacy-recovery]'
  bookmarkNodes.set('legacy-restore-root', {
    id: 'legacy-restore-root',
    parentId: '1',
    title: restoreFolderTitle,
    syncing: false
  })

  await putAutoBackupRecord(buildRestoreJournal({
    schemaVersion: 1,
    operationId: 'op-legacy-recovery',
    mode: 'safeFull',
    restoreStorageKeys: [STORAGE_KEYS.newTabGeneralSettings],
    previousStorage: {
      [STORAGE_KEYS.newTabGeneralSettings]:
        initialStorage[STORAGE_KEYS.newTabGeneralSettings]
    },
    previousTagIndex: buildTagIndex({}),
    restoreFolderTitle,
    restoreFolderId: 'legacy-restore-root'
  }))

  const recovery = await recoverInterruptedCuratorBackupRestore()

  assert.deepEqual(recovery, {
    operationId: 'op-legacy-recovery',
    recovered: true,
    errors: []
  })
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    { density: 'user-later' }
  )
  assert.deepEqual(
    Object.keys((await loadBookmarkTagIndex()).records),
    ['later']
  )
  assert.equal(bookmarkNodes.has('legacy-restore-root'), false)
  assert.deepEqual(removedBookmarkTrees, ['legacy-restore-root'])
  assert.equal(await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY), null)
  const receipt = await getAutoBackupRecord(
    `${RESTORE_RECEIPT_PREFIX}op-legacy-recovery`
  )
  assert.equal(receipt?.schemaVersion, 2)
  assert.equal(receipt?.status, 'preserved')

  await assert.rejects(
    executeJournaledCuratorBackupRestore(buildBackup(), 'safeFull', {
      operationId: 'op-legacy-recovery',
      now: 0
    }),
    (error: unknown) => {
      return Boolean(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === BACKUP_RESTORE_ROLLED_BACK_CODE &&
        'message' in error &&
        /旧版恢复日志/.test(String(error.message))
      )
    }
  )
})

test('prepared recovery does not overwrite state when no restore write began', async () => {
  await putAutoBackupRecord(buildRestoreJournal({
    operationId: 'op-prepared',
    mode: 'safeFull',
    restoreStorageKeys: [STORAGE_KEYS.newTabGeneralSettings],
    previousStorage: {
      [STORAGE_KEYS.newTabGeneralSettings]:
        initialStorage[STORAGE_KEYS.newTabGeneralSettings]
    },
    previousTagIndex: buildTagIndex({}),
    tagStateMayHaveChanged: false,
    storageStateMayHaveChanged: false,
    status: 'prepared'
  }))

  const laterTagIndex = buildTagIndex({
    later: buildTagRecord('later', 'https://later.example/')
  })
  await saveBookmarkTagIndex(laterTagIndex)
  storageState[STORAGE_KEYS.newTabGeneralSettings] = { density: 'user-later' }

  const recovery = await recoverInterruptedCuratorBackupRestore()

  assert.equal(recovery?.recovered, true)
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    { density: 'user-later' }
  )
  assert.deepEqual(
    Object.keys((await loadBookmarkTagIndex()).records),
    ['later']
  )
})

test('retains a failed recovery journal and succeeds on the next attempt', async () => {
  storageState[STORAGE_KEYS.newTabGeneralSettings] = { density: 'mutated' }
  await putAutoBackupRecord(buildRestoreJournal({
    operationId: 'op-retry',
    mode: 'newTabOnly',
    restoreStorageKeys: [STORAGE_KEYS.newTabGeneralSettings],
    previousStorage: {
      [STORAGE_KEYS.newTabGeneralSettings]:
        initialStorage[STORAGE_KEYS.newTabGeneralSettings]
    }
  }))
  storageSetFailuresRemaining = 1

  const failedRecovery = await recoverInterruptedCuratorBackupRestore()

  assert.equal(failedRecovery?.recovered, false)
  assert.match(failedRecovery?.errors[0] || '', /simulated storage write failure/)
  assert.equal(
    (await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY))?.status,
    'rollback-failed'
  )
  assert.equal(await getAutoBackupRecord(`${RESTORE_RECEIPT_PREFIX}op-retry`), null)
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    { density: 'mutated' }
  )

  const successfulRetry = await recoverInterruptedCuratorBackupRestore()

  assert.equal(successfulRetry?.recovered, true)
  assert.equal(await getAutoBackupRecord(ACTIVE_RESTORE_JOURNAL_KEY), null)
  assert.equal(
    (await getAutoBackupRecord(`${RESTORE_RECEIPT_PREFIX}op-retry`))?.status,
    'rolled-back'
  )
  assert.deepEqual(
    storageState[STORAGE_KEYS.newTabGeneralSettings],
    initialStorage[STORAGE_KEYS.newTabGeneralSettings]
  )
})

function buildBackup({
  includeMissingBookmark = true,
  density = 'comfortable'
}: {
  includeMissingBookmark?: boolean
  density?: string
} = {}): CuratorBackupFileV1 {
  const bookmarkChildren: chrome.bookmarks.BookmarkTreeNode[] =
    includeMissingBookmark
      ? [{
          id: 'backup-bookmark',
          parentId: 'backup-bar',
          title: 'Missing bookmark',
          url: 'https://missing.example/',
          syncing: false
        }]
      : []

  return {
    app: 'curator-bookmarks',
    kind: 'full-backup',
    schemaVersion: 1,
    exportedAt: new Date(0).toISOString(),
    extensionVersion: '1.5.2',
    manifestVersion: 3,
    source: 'manual',
    redaction: {
      aiProviderSettings: 'apiKey-omitted',
      omittedFields: []
    },
    chromeBookmarks: {
      exportedAt: new Date(0).toISOString(),
      tree: [{
        id: 'backup-root',
        title: '',
        syncing: false,
        children: [{
          id: 'backup-bar',
          parentId: 'backup-root',
          title: 'Bookmarks bar',
          syncing: false,
          children: bookmarkChildren
        }]
      }]
    },
    storage: {
      bookmarkTagIndex: buildTagIndex({}),
      recycleBin: [{ recycleId: 'restored-entry' }],
      ignoreRules: {
        bookmarks: [],
        domains: [{ domain: 'restored.example', createdAt: 2 }],
        folders: []
      },
      redirectCache: {
        version: 1,
        results: [{ id: 'restored-redirect' }]
      },
      newTab: {
        generalSettings: {
          density
        }
      },
      popupPreferences: {
        compact: true
      },
      aiRejectedSuggestions: [],
      aiProviderSettings: {
        apiKeyRedacted: true,
        provider: 'openai'
      }
    }
  }
}

function buildTagIndex(records: Record<string, BookmarkTagRecord>): BookmarkTagIndex {
  return {
    version: 1,
    updatedAt: 20,
    records
  }
}

function buildTagRecord(bookmarkId: string, url: string): BookmarkTagRecord {
  return {
    schemaVersion: 1,
    bookmarkId,
    url,
    normalizedUrl: url,
    duplicateKey: new URL(url).hostname,
    title: bookmarkId,
    path: 'Bookmarks bar',
    summary: '',
    contentType: '',
    topics: [],
    tags: ['test'],
    aliases: [],
    confidence: 1,
    source: 'imported',
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

function buildRestoreJournal({
  schemaVersion = 2,
  operationId,
  mode,
  restoreStorageKeys,
  previousStorage,
  previousTagIndex = null,
  expectedTagIndex = null,
  expectedStorage,
  restoreFolderTitle = '',
  restoreFolderId = '',
  tagStateMayHaveChanged = Boolean(previousTagIndex),
  storageStateMayHaveChanged = true,
  status = 'applying'
}: {
  schemaVersion?: 1 | 2
  operationId: string
  mode: 'tagsOnly' | 'newTabOnly' | 'safeFull'
  restoreStorageKeys: string[]
  previousStorage: Record<string, unknown>
  previousTagIndex?: BookmarkTagIndex | null
  expectedTagIndex?: BookmarkTagIndex | null
  expectedStorage?: Record<string, unknown>
  restoreFolderTitle?: string
  restoreFolderId?: string
  tagStateMayHaveChanged?: boolean
  storageStateMayHaveChanged?: boolean
  status?: 'prepared' | 'applying'
}): Record<string, unknown> {
  const currentExpectedStorage = expectedStorage || Object.fromEntries(
    restoreStorageKeys.flatMap((storageKey) => {
      return Object.prototype.hasOwnProperty.call(storageState, storageKey)
        ? [[storageKey, structuredClone(storageState[storageKey])]]
        : []
    })
  )
  const journal: Record<string, unknown> = {
    backupId: ACTIVE_RESTORE_JOURNAL_KEY,
    kind: 'restore-journal',
    schemaVersion,
    operationId,
    mode,
    status,
    startedAt: 1,
    updatedAt: 1,
    restoreStorageKeys,
    previousStorage,
    previousTagIndex,
    restoreFolderTitle,
    restoreFolderId,
    tagStateMayHaveChanged,
    storageStateMayHaveChanged,
    lastError: 'simulated interruption',
    rollbackErrors: []
  }
  if (schemaVersion === 2) {
    journal.expectedTagIndex = expectedTagIndex
    journal.expectedStorage = currentExpectedStorage
  }
  return journal
}

function openAutoBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTO_BACKUP_DB_NAME, AUTO_BACKUP_DB_VERSION)
    request.addEventListener('upgradeneeded', () => {
      const db = request.result
      if (!db.objectStoreNames.contains(AUTO_BACKUP_STORE)) {
        db.createObjectStore(AUTO_BACKUP_STORE, { keyPath: 'backupId' })
      }
      if (!db.objectStoreNames.contains('contentFullText')) {
        db.createObjectStore('contentFullText', { keyPath: 'snapshotId' })
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => {
      reject(request.error || new Error('test database open failed'))
    })
  })
}

async function putAutoBackupRecord(record: Record<string, unknown>): Promise<void> {
  const db = await openAutoBackupDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(AUTO_BACKUP_STORE, 'readwrite')
      transaction.objectStore(AUTO_BACKUP_STORE).put(record)
      transaction.addEventListener('complete', () => resolve())
      transaction.addEventListener('error', () => {
        reject(transaction.error || new Error('test database write failed'))
      })
      transaction.addEventListener('abort', () => {
        reject(transaction.error || new Error('test database write aborted'))
      })
    })
  } finally {
    db.close()
  }
}

async function getAutoBackupRecord(
  backupId: string
): Promise<Record<string, any> | null> {
  const db = await openAutoBackupDb()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(AUTO_BACKUP_STORE, 'readonly')
      const request = transaction.objectStore(AUTO_BACKUP_STORE).get(backupId)
      transaction.addEventListener('complete', () => {
        resolve(request.result || null)
      })
      transaction.addEventListener('error', () => {
        reject(transaction.error || new Error('test database read failed'))
      })
      transaction.addEventListener('abort', () => {
        reject(transaction.error || new Error('test database read aborted'))
      })
    })
  } finally {
    db.close()
  }
}
