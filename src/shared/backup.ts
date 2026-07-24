import {
  AUTO_BACKUP_RETENTION_LIMIT,
  BOOKMARKS_BAR_ID,
  STORAGE_KEYS
} from './constants.js'
import {
  createBookmark,
  getBookmarkTree,
  removeBookmarkTree
} from './bookmarks-api.js'
import { extractBookmarkData } from './bookmark-tree.js'
import {
  buildBookmarkTagDuplicateKey,
  loadBookmarkTagIndex,
  mergeBookmarkTagImport,
  normalizeBookmarkTagIndex,
  normalizeBookmarkTagUrl,
  restoreBookmarkTagIndexSnapshot,
  saveBookmarkTagIndex,
  type BookmarkTagIndex
} from './bookmark-tags.js'
import {
  loadNewTabActivityFromRepository,
  type NewTabActivityRepositoryState
} from './repositories/activity-repository.js'
import {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
  withLocalStorageTransaction,
  type LocalStorageTransaction
} from './storage.js'

const BACKUP_SCHEMA_VERSION = 1
const BACKUP_APP = 'curator-bookmarks'
const BACKUP_KIND = 'full-backup'
const AUTO_BACKUP_DB_NAME = 'curatorBookmarkHeavyUserData'
const AUTO_BACKUP_DB_VERSION = 2
const AUTO_BACKUP_STORE = 'autoBackups'
const CONTENT_FULL_TEXT_STORE = 'contentFullText'
const BACKUP_RESTORE_LOCK_NAME = 'curator:backup-restore'
const BACKUP_RESTORE_JOURNAL_KEY = 'restore-journal:active'
const BACKUP_RESTORE_RECEIPT_PREFIX = 'restore-receipt:'
const BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION = 2
type BackupRestoreJournalSchemaVersion = 1 | 2
export const BACKUP_RESTORE_ROLLED_BACK_CODE = 'backup-restore-rolled-back'

let fallbackBackupRestoreQueue = Promise.resolve()

export type DangerousOperationKind =
  | 'batch-delete'
  | 'batch-move'
  | 'duplicate-cleanup'
  | 'availability-cleanup'
  | 'folder-cleanup-delete'
  | 'folder-cleanup-merge'
  | 'folder-cleanup-move'
  | 'redirect-url-update'
  | 'batch-tag-update'
  | 'tag-import'
  | 'restore'

export type BackupRestoreMode = 'tagsOnly' | 'newTabOnly' | 'safeFull'

export interface AutoBackupBeforeDangerousOperationOptions {
  kind: DangerousOperationKind
  source: 'options' | 'popup' | 'newtab' | 'service-worker'
  reason: string
  targetBookmarkIds?: string[]
  targetFolderIds?: string[]
  estimatedChangeCount?: number
  retentionLimit?: number
  now?: number
  allowSkipOnFailure?: boolean
}

export interface AutoBackupHookResult {
  backupId: string
  fileName: string
  createdAt: number
  skipped: boolean
  reason?: string
  sizeBytes?: number
}

export interface AutoBackupIndexEntry extends AutoBackupHookResult {
  kind: DangerousOperationKind
  source: AutoBackupBeforeDangerousOperationOptions['source']
  operationReason: string
}

export interface CuratorBackupFileV1 {
  app: 'curator-bookmarks'
  kind: 'full-backup'
  schemaVersion: 1
  exportedAt: string
  extensionVersion: string
  manifestVersion: 3
  source: 'manual' | 'auto'
  redaction: {
    aiProviderSettings: 'apiKey-omitted'
    omittedFields: Array<'apiKey' | 'authorizationHeaders' | 'privacyAuditLog' | 'contentFullText' | 'contentSnapshotCache' | 'newTabBackgroundMedia' | 'userMediaCache'>
  }
  chromeBookmarks: {
    exportedAt: string
    tree: chrome.bookmarks.BookmarkTreeNode[]
  }
  storage: {
    bookmarkTagIndex: BookmarkTagIndex
    recycleBin: unknown[]
    ignoreRules: {
      bookmarks: unknown[]
      domains: unknown[]
      folders: unknown[]
    }
    redirectCache: unknown
    newTab: Record<string, unknown>
    popupPreferences?: unknown
    aiRejectedSuggestions?: unknown[]
    aiProviderSettings: Record<string, unknown> & {
      apiKeyRedacted: true
    }
  }
  notes?: string[]
}

export interface BackupRestorePreview {
  valid: boolean
  fileName?: string
  exportedAt: string
  extensionVersion: string
  counts: {
    bookmarkNodes: number
    bookmarkUrls: number
    missingBookmarkUrls: number
    tagRecords: number
    tagMatched: number
    tagUnmatched: number
    recycleEntries: number
    ignoreRules: number
    redirectEntries: number
    newTabSections: number
  }
  warnings: string[]
  modes: Array<{
    mode: BackupRestoreMode
    label: string
    description: string
  }>
}

export interface BackupRestoreResult {
  mode: BackupRestoreMode
  restored: {
    tags: number
    newTabSections: number
    storageSections: number
    copiedBookmarks: number
  }
  unmatchedTags: number
  skippedBookmarks: number
}

export interface JournaledBackupRestoreOptions {
  operationId: string
  now?: number
  withMutationLock?: BackupRestoreMutationLock
  beforeApply?: () => Promise<void>
}

export interface BackupRestoreRecoveryOptions {
  withMutationLock?: BackupRestoreMutationLock
}

export interface BackupRestoreRecoveryResult {
  operationId: string
  recovered: boolean
  errors: string[]
}

export type BackupRestoreMutationLock = <T>(task: () => Promise<T>) => Promise<T>

type BackupRestoreJournalStatus =
  | 'prepared'
  | 'applying'
  | 'copying-bookmarks'
  | 'rolling-back'
  | 'rollback-failed'

interface BackupRestoreJournal {
  backupId: typeof BACKUP_RESTORE_JOURNAL_KEY
  kind: 'restore-journal'
  schemaVersion: BackupRestoreJournalSchemaVersion
  operationId: string
  mode: BackupRestoreMode
  status: BackupRestoreJournalStatus
  startedAt: number
  updatedAt: number
  restoreStorageKeys: string[]
  previousStorage: Record<string, unknown>
  previousTagIndex: BookmarkTagIndex | null
  expectedTagIndex: BookmarkTagIndex | null
  expectedStorage: Record<string, unknown>
  restoreFolderTitle: string
  restoreFolderId: string
  tagStateMayHaveChanged: boolean
  storageStateMayHaveChanged: boolean
  lastError: string
  rollbackErrors: string[]
}

interface BackupRestoreReceipt {
  backupId: string
  kind: 'restore-receipt'
  schemaVersion: BackupRestoreJournalSchemaVersion
  operationId: string
  mode: BackupRestoreMode
  status: 'committed' | 'rolled-back' | 'preserved'
  completedAt: number
  result?: BackupRestoreResult
  error?: string
}

interface BackupRestoreSnapshot {
  currentBookmarks: Array<{ url: string; path?: string }>
  previousTagIndex: BookmarkTagIndex | null
  previousStorage: Record<string, unknown>
  restoreStorageKeys: string[]
}

interface BackupRestoreApplyHooks {
  restoreFolderTitle?: string
  beforeTagChange?: (nextIndex: BookmarkTagIndex) => Promise<void> | void
  beforeStorageChange?: (payload: Record<string, unknown>) => Promise<void> | void
  beforeBookmarkCopy?: () => Promise<void> | void
  restoreFolderCreated?: (folderId: string) => Promise<void> | void
}

export async function createCuratorBackupFile(
  source: 'manual' | 'auto' = 'manual',
  now = Date.now()
): Promise<CuratorBackupFileV1> {
  const exportedAt = new Date(now).toISOString()
  const [tree, stored] = await Promise.all([
    getBookmarkTree(),
    getBackupStorageSnapshot()
  ])
  const [bookmarkTagIndex, newTabActivity] = await Promise.all([
    loadBookmarkTagIndex().catch(() =>
      normalizeBookmarkTagIndex(stored[STORAGE_KEYS.bookmarkTagIndex])
    ),
    loadNewTabActivityFromRepository(normalizeNewTabActivityForBackup).catch(() =>
      normalizeNewTabActivityForBackup(stored[STORAGE_KEYS.newTabActivity])
    )
  ])

  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    extensionVersion: getExtensionVersion(),
    manifestVersion: 3,
    source,
    redaction: {
      aiProviderSettings: 'apiKey-omitted',
      omittedFields: [
        'apiKey',
        'authorizationHeaders',
        'privacyAuditLog',
        'contentFullText',
        'contentSnapshotCache',
        'newTabBackgroundMedia',
        'userMediaCache'
      ]
    },
    chromeBookmarks: {
      exportedAt,
      tree
    },
    storage: {
      bookmarkTagIndex,
      recycleBin: normalizeUnknownArray(stored[STORAGE_KEYS.recycleBin]),
      ignoreRules: normalizeIgnoreRulesForBackup(stored[STORAGE_KEYS.ignoreRules]),
      redirectCache: stored[STORAGE_KEYS.redirectCache] ?? null,
      newTab: {
        customIcons: stored[STORAGE_KEYS.newTabCustomIcons] ?? null,
        backgroundSettings: stored[STORAGE_KEYS.newTabBackgroundSettings] ?? null,
        searchSettings: stored[STORAGE_KEYS.newTabSearchSettings] ?? null,
        iconSettings: stored[STORAGE_KEYS.newTabIconSettings] ?? null,
        timeSettings: stored[STORAGE_KEYS.newTabTimeSettings] ?? null,
        generalSettings: stored[STORAGE_KEYS.newTabGeneralSettings] ?? null,
        folderSettings: stored[STORAGE_KEYS.newTabFolderSettings] ?? null,
        activity: newTabActivity
      },
      popupPreferences: stored[STORAGE_KEYS.popupPreferences] ?? null,
      aiRejectedSuggestions: normalizeUnknownArray(stored[STORAGE_KEYS.aiRejectedSuggestions]),
      aiProviderSettings: redactAiProviderSettings(stored[STORAGE_KEYS.aiProviderSettings])
    },
    notes: [
      'AI Provider API Key is intentionally omitted.',
      'Authorization headers, privacy audit logs, AI usage counters, content full text/cache and diagnostic logs are intentionally omitted.',
      'New tab background media blobs and user media caches in IndexedDB are not included.'
    ]
  }
}

export function getBackupFileName(now = Date.now()): string {
  return `curator-backup-${new Date(now).toISOString().slice(0, 10)}.json`
}

export function parseCuratorBackupFile(payload: unknown): CuratorBackupFileV1 {
  const source = payload && typeof payload === 'object'
    ? payload as Partial<CuratorBackupFileV1>
    : {}
  if (
    source.app !== BACKUP_APP ||
    source.kind !== BACKUP_KIND ||
    source.schemaVersion !== BACKUP_SCHEMA_VERSION ||
    !source.storage ||
    !source.chromeBookmarks
  ) {
    throw new Error('备份文件格式不正确，无法恢复。')
  }

  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: String(source.exportedAt || ''),
    extensionVersion: String(source.extensionVersion || ''),
    manifestVersion: 3,
    source: source.source === 'auto' ? 'auto' : 'manual',
    redaction: {
      aiProviderSettings: 'apiKey-omitted',
      omittedFields: [
        'apiKey',
        'authorizationHeaders',
        'privacyAuditLog',
        'contentFullText',
        'contentSnapshotCache',
        'newTabBackgroundMedia',
        'userMediaCache'
      ]
    },
    chromeBookmarks: {
      exportedAt: String(source.chromeBookmarks.exportedAt || source.exportedAt || ''),
      tree: Array.isArray(source.chromeBookmarks.tree) ? source.chromeBookmarks.tree : []
    },
    storage: {
      bookmarkTagIndex: normalizeBookmarkTagIndex(source.storage.bookmarkTagIndex),
      recycleBin: normalizeUnknownArray(source.storage.recycleBin),
      ignoreRules: normalizeIgnoreRulesForBackup(source.storage.ignoreRules),
      redirectCache: source.storage.redirectCache ?? null,
      newTab: normalizeObject(source.storage.newTab),
      popupPreferences: source.storage.popupPreferences ?? null,
      aiRejectedSuggestions: normalizeUnknownArray(source.storage.aiRejectedSuggestions),
      aiProviderSettings: redactAiProviderSettings(source.storage.aiProviderSettings)
    },
    notes: Array.isArray(source.notes) ? source.notes.map((note) => String(note)) : []
  }
}

export async function buildBackupRestorePreview(
  backup: CuratorBackupFileV1,
  fileName = ''
): Promise<BackupRestorePreview> {
  const currentTree = await getBookmarkTree()
  const currentData = extractBookmarkData(currentTree[0])
  const backupBookmarks = extractBackupBookmarkNodes(backup.chromeBookmarks.tree)
  const currentInstances = new Set(
    currentData.bookmarks.map((bookmark) => buildBookmarkInstanceKey(bookmark.url, bookmark.path || ''))
  )
  const missingBookmarkUrls = extractBackupBookmarkInstances(backup.chromeBookmarks.tree).filter((instance) => {
    return !currentInstances.has(buildBookmarkInstanceKey(instance.url, instance.path))
  }).length
  const tagRecords = Object.values(backup.storage.bookmarkTagIndex.records)
  const matchedTags = tagRecords.filter((record) => {
    return currentData.bookmarkMap.has(record.bookmarkId) ||
      currentData.bookmarks.some((bookmark) => {
        return normalizeBookmarkTagUrl(bookmark.url) === record.normalizedUrl ||
          buildBookmarkTagDuplicateKey(bookmark.url) === record.duplicateKey
      })
  }).length

  const warnings: string[] = []
  if (hasApiKeyLikeField(backup)) {
    warnings.push('备份文件中出现疑似 API Key 字段，恢复会忽略这些字段。')
  }
  if (missingBookmarkUrls) {
    warnings.push(`有 ${missingBookmarkUrls} 条备份书签实例当前不存在；完整恢复会复制到新的恢复文件夹。`)
  }
  warnings.push('完整恢复会覆盖回收站、忽略规则、重定向缓存和弹窗偏好等集合类本地数据；不会覆盖 Chrome 现有书签树。')

  return {
    valid: true,
    fileName,
    exportedAt: backup.exportedAt,
    extensionVersion: backup.extensionVersion,
    counts: {
      bookmarkNodes: countBookmarkNodes(backup.chromeBookmarks.tree),
      bookmarkUrls: backupBookmarks.filter((node) => Boolean(node.url)).length,
      missingBookmarkUrls,
      tagRecords: tagRecords.length,
      tagMatched: matchedTags,
      tagUnmatched: tagRecords.length - matchedTags,
      recycleEntries: backup.storage.recycleBin.length,
      ignoreRules: countIgnoreRules(backup.storage.ignoreRules),
      redirectEntries: countRedirectEntries(backup.storage.redirectCache),
      newTabSections: countPresentObjectValues(backup.storage.newTab)
    },
    warnings,
    modes: [
      {
        mode: 'tagsOnly',
        label: '只恢复标签数据',
        description: '按书签 ID、规范 URL 和重复键匹配当前书签，不改动 Chrome 书签。'
      },
      {
        mode: 'newTabOnly',
        label: '只恢复新标签页设置',
        description: '恢复书签来源、布局、搜索、时间和背景设置；不恢复背景媒体缓存。'
      },
      {
        mode: 'safeFull',
        label: '恢复全部可安全恢复的数据',
        description: '恢复扩展本地数据并覆盖集合类本地记录；缺失书签按 URL 和路径实例复制到新的恢复文件夹，不替换现有书签树。'
      }
    ]
  }
}

export function restoreCuratorBackup(
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode
): Promise<BackupRestoreResult> {
  return withLocalStorageTransaction(async (transaction) => {
    const snapshot = await captureBackupRestoreSnapshot(backup, mode, transaction)
    let tagStateMayHaveChanged = false
    let storageStateMayHaveChanged = false
    let restoreFolderId = ''

    try {
      return await applyCuratorBackupRestore(backup, mode, transaction, snapshot, {
        beforeTagChange() {
          tagStateMayHaveChanged = true
        },
        beforeStorageChange() {
          storageStateMayHaveChanged = true
        },
        restoreFolderCreated(folderId) {
          restoreFolderId = folderId
        }
      })
    } catch (error) {
      const rollbackErrors = await rollbackBackupRestoreSnapshot(snapshot, transaction, {
        restoreFolderId,
        restoreFolderTitle: '',
        restoreTagState: tagStateMayHaveChanged,
        restoreStorageState: storageStateMayHaveChanged
      })
      throw buildBackupRestoreFailure(error, rollbackErrors)
    }
  })
}

export async function executeJournaledCuratorBackupRestore(
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode,
  {
    operationId: rawOperationId,
    now = Date.now(),
    withMutationLock,
    beforeApply
  }: JournaledBackupRestoreOptions
): Promise<BackupRestoreResult> {
  const operationId = normalizeBackupRestoreOperationId(rawOperationId)
  assertBackupRestoreMode(mode)

  return withBackupRestoreLock(async () => {
    const receipt = await getBackupRestoreReceipt(operationId)
    if (receipt) {
      return resolveBackupRestoreReceipt(receipt)
    }

    const activeJournal = await getActiveBackupRestoreJournal()
    if (activeJournal) {
      const recovery = await recoverBackupRestoreJournal(
        activeJournal,
        withMutationLock
      )
      if (!recovery.recovered) {
        throw new Error(
          `上一次备份恢复尚未完成回滚：${recovery.errors.join('；') || '未知错误'}。`
        )
      }
      if (activeJournal.operationId === operationId) {
        const recoveredReceipt = await getBackupRestoreReceipt(operationId)
        if (recoveredReceipt) {
          return resolveBackupRestoreReceipt(recoveredReceipt)
        }
      }
    }

    return runWithOptionalBackupRestoreMutationLock(
      mode,
      withMutationLock,
      async () => {
        await beforeApply?.()
        return withLocalStorageTransaction(async (transaction) => {
        const snapshot = await captureBackupRestoreSnapshot(backup, mode, transaction)
        const restoreFolderTitle = buildJournaledRestoreFolderTitle(operationId, now)
        let journal: BackupRestoreJournal = {
          backupId: BACKUP_RESTORE_JOURNAL_KEY,
          kind: 'restore-journal',
          schemaVersion: BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION,
          operationId,
          mode,
          status: 'prepared',
          startedAt: now,
          updatedAt: now,
          restoreStorageKeys: snapshot.restoreStorageKeys,
          previousStorage: snapshot.previousStorage,
          previousTagIndex: snapshot.previousTagIndex,
          expectedTagIndex: null,
          expectedStorage: {},
          restoreFolderTitle,
          restoreFolderId: '',
          tagStateMayHaveChanged: false,
          storageStateMayHaveChanged: false,
          lastError: '',
          rollbackErrors: []
        }
        await putAutoBackup(journal)

        const updateJournal = async (
          patch: Partial<Omit<
            BackupRestoreJournal,
            'backupId' | 'kind' | 'schemaVersion' | 'operationId'
          >>
        ): Promise<void> => {
          journal = {
            ...journal,
            ...patch,
            updatedAt: Date.now()
          }
          await putAutoBackup(journal)
        }

        try {
          await updateJournal({ status: 'applying' })
          const result = await applyCuratorBackupRestore(
            backup,
            mode,
            transaction,
            snapshot,
            {
              restoreFolderTitle,
              async beforeTagChange(nextIndex) {
                await updateJournal({
                  tagStateMayHaveChanged: true,
                  expectedTagIndex: normalizeBookmarkTagIndex(nextIndex)
                })
              },
              async beforeStorageChange(payload) {
                await updateJournal({
                  storageStateMayHaveChanged: true,
                  expectedStorage: {
                    ...journal.expectedStorage,
                    ...payload
                  }
                })
              },
              async beforeBookmarkCopy() {
                if (journal.status !== 'copying-bookmarks') {
                  await updateJournal({ status: 'copying-bookmarks' })
                }
              },
              async restoreFolderCreated(folderId) {
                await updateJournal({ restoreFolderId: folderId })
              }
            }
          )
          await replaceActiveJournalWithReceipt({
            backupId: getBackupRestoreReceiptKey(operationId),
            kind: 'restore-receipt',
            schemaVersion: BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION,
            operationId,
            mode,
            status: 'committed',
            completedAt: Date.now(),
            result
          })
          return result
        } catch (error) {
          journal = {
            ...journal,
            status: 'rolling-back',
            updatedAt: Date.now(),
            lastError: formatUnknownError(error),
            rollbackErrors: []
          }
          await putAutoBackup(journal).catch(() => {})
          const rollbackErrors = await rollbackBackupRestoreJournalUnderTransaction(
            journal,
            transaction
          )
          if (rollbackErrors.length) {
            journal = {
              ...journal,
              status: 'rollback-failed',
              updatedAt: Date.now(),
              rollbackErrors
            }
            await putAutoBackup(journal).catch(() => {})
            throw buildBackupRestoreFailure(error, rollbackErrors)
          }

          const failure = buildBackupRestoreFailure(error, [])
          await replaceActiveJournalWithReceipt({
            backupId: getBackupRestoreReceiptKey(operationId),
            kind: 'restore-receipt',
            schemaVersion: BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION,
            operationId,
            mode,
            status: 'rolled-back',
            completedAt: Date.now(),
            error: failure.message
          })
          throw failure
        }
        })
      }
    )
  })
}

export function recoverInterruptedCuratorBackupRestore(
  { withMutationLock }: BackupRestoreRecoveryOptions = {}
):
  Promise<BackupRestoreRecoveryResult | null> {
  return withBackupRestoreLock(async () => {
    const journal = await getActiveBackupRestoreJournal()
    return journal
      ? recoverBackupRestoreJournal(journal, withMutationLock)
      : null
  })
}

async function captureBackupRestoreSnapshot(
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode,
  transaction: LocalStorageTransaction
): Promise<BackupRestoreSnapshot> {
  const restoreStorageKeys = getBackupRestoreStorageKeys(backup, mode)
  const [currentTree, previousTagIndex, previousStorage] = await Promise.all([
    getBookmarkTree(),
    mode === 'tagsOnly' || mode === 'safeFull'
      ? loadBookmarkTagIndex({ transaction })
      : Promise.resolve(null),
    restoreStorageKeys.length
      ? getLocalStorage(restoreStorageKeys)
      : Promise.resolve({})
  ])
  const currentData = extractBookmarkData(currentTree[0])
  return {
    currentBookmarks: currentData.bookmarks,
    previousTagIndex,
    previousStorage,
    restoreStorageKeys
  }
}

async function applyCuratorBackupRestore(
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode,
  transaction: LocalStorageTransaction,
  snapshot: BackupRestoreSnapshot,
  hooks: BackupRestoreApplyHooks = {}
): Promise<BackupRestoreResult> {
  const result: BackupRestoreResult = {
    mode,
    restored: {
      tags: 0,
      newTabSections: 0,
      storageSections: 0,
      copiedBookmarks: 0
    },
    unmatchedTags: 0,
    skippedBookmarks: 0
  }

  if (mode === 'tagsOnly' || mode === 'safeFull') {
    const tagImport = mergeBookmarkTagImport(snapshot.previousTagIndex, {
      records: Object.values(backup.storage.bookmarkTagIndex.records)
    }, snapshot.currentBookmarks)
    const tagUpdatedAt = Date.now()
    const tagTargetIndex = normalizeBookmarkTagIndex({
      ...tagImport.index,
      updatedAt: tagUpdatedAt
    })
    await hooks.beforeTagChange?.(tagTargetIndex)
    await saveBookmarkTagIndex(tagTargetIndex, {
      transaction,
      updatedAt: tagUpdatedAt
    })
    result.restored.tags = tagImport.added + tagImport.overwritten
    result.unmatchedTags = tagImport.unmatched
  }

  if (mode === 'newTabOnly' || mode === 'safeFull') {
    const newTabPayload = buildNewTabStoragePayload(backup.storage.newTab)
    if (Object.keys(newTabPayload).length) {
      await hooks.beforeStorageChange?.(newTabPayload)
      await setLocalStorage(newTabPayload, { transaction })
      result.restored.newTabSections = Object.keys(newTabPayload).length
    }
  }

  if (mode === 'safeFull') {
    const localPayload: Record<string, unknown> = {
      [STORAGE_KEYS.recycleBin]: backup.storage.recycleBin,
      [STORAGE_KEYS.ignoreRules]: backup.storage.ignoreRules,
      [STORAGE_KEYS.redirectCache]: backup.storage.redirectCache,
      [STORAGE_KEYS.popupPreferences]: backup.storage.popupPreferences,
      [STORAGE_KEYS.aiRejectedSuggestions]: backup.storage.aiRejectedSuggestions
    }
    localPayload[STORAGE_KEYS.aiProviderSettings] = mergeRestoredAiProviderSettings(
      snapshot.previousStorage[STORAGE_KEYS.aiProviderSettings],
      backup.storage.aiProviderSettings
    )
    await hooks.beforeStorageChange?.(localPayload)
    await setLocalStorage(localPayload, { transaction })
    result.restored.storageSections = Object.keys(localPayload).length

    const copyResult = await copyMissingBookmarksToRestoreFolder(
      backup,
      snapshot.currentBookmarks,
      {
        restoreFolderTitle: hooks.restoreFolderTitle,
        beforeCreate: hooks.beforeBookmarkCopy,
        onCreated: hooks.restoreFolderCreated
      }
    )
    result.restored.copiedBookmarks = copyResult.copied
    result.skippedBookmarks = copyResult.skipped
  }

  return result
}

export async function createAutoBackupBeforeDangerousOperation(
  options: AutoBackupBeforeDangerousOperationOptions
): Promise<AutoBackupHookResult> {
  const createdAt = options.now ?? Date.now()
  const retentionLimit = Math.max(1, options.retentionLimit ?? AUTO_BACKUP_RETENTION_LIMIT)

  try {
    const backup = await createCuratorBackupFile('auto', createdAt)
    const backupId = `auto-${createdAt}-${Math.random().toString(36).slice(2, 8)}`
    const fileName = getBackupFileName(createdAt)
    const sizeBytes = estimateJsonSizeBytes(backup)
    const { pruned } = await putAutoBackup({
      backupId,
      createdAt,
      fileName,
      kind: options.kind,
      source: options.source,
      operationReason: options.reason,
      targetBookmarkIds: options.targetBookmarkIds || [],
      targetFolderIds: options.targetFolderIds || [],
      estimatedChangeCount: options.estimatedChangeCount || 0,
      payload: backup
    }).then(() => updateAutoBackupIndex({
      backupId,
      fileName,
      createdAt,
      skipped: false,
      sizeBytes,
      kind: options.kind,
      source: options.source,
      operationReason: options.reason
    }, retentionLimit))
    await pruneAutoBackups(pruned)

    return {
      backupId,
      fileName,
      createdAt,
      skipped: false,
      sizeBytes
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : '自动备份失败'
    if (!options.allowSkipOnFailure) {
      throw new Error(`自动备份失败，已停止执行高风险操作：${reason}`)
    }

    return {
      backupId: `failed-${createdAt}`,
      fileName: '',
      createdAt,
      skipped: true,
      reason
    }
  }
}

function normalizeNewTabActivityForBackup(rawActivity: unknown): NewTabActivityRepositoryState {
  const source = normalizeObject(rawActivity)
  const rawRecords = normalizeObject(source.records)
  const records: NewTabActivityRepositoryState['records'] = {}

  for (const [bookmarkId, value] of Object.entries(rawRecords)) {
    const record = normalizeObject(value)
    const id = String(record.bookmarkId || bookmarkId || '').trim()
    const url = String(record.url || '').trim()
    const lastOpenedAt = Number(record.lastOpenedAt) || 0
    const openCount = Math.max(0, Math.min(Math.floor(Number(record.openCount) || 0), 9999))
    if (!id || !url || !lastOpenedAt || !openCount) {
      continue
    }
    records[id] = {
      bookmarkId: id,
      title: String(record.title || '').trim().slice(0, 160),
      url: url.slice(0, 2048),
      openCount,
      firstOpenedAt: Number(record.firstOpenedAt) || lastOpenedAt,
      lastOpenedAt
    }
  }

  return {
    pinnedIds: Array.isArray(source.pinnedIds)
      ? source.pinnedIds.flatMap(id => { const mappedResult = String(id || '').trim(); return mappedResult ? [mappedResult] : [] })
      : [],
    records
  }
}

async function getBackupStorageSnapshot(): Promise<Record<string, unknown>> {
  return getLocalStorage([
    STORAGE_KEYS.recycleBin,
    STORAGE_KEYS.ignoreRules,
    STORAGE_KEYS.redirectCache,
    STORAGE_KEYS.newTabCustomIcons,
    STORAGE_KEYS.newTabBackgroundSettings,
    STORAGE_KEYS.newTabSearchSettings,
    STORAGE_KEYS.newTabIconSettings,
    STORAGE_KEYS.newTabTimeSettings,
    STORAGE_KEYS.newTabGeneralSettings,
    STORAGE_KEYS.newTabFolderSettings,
    STORAGE_KEYS.newTabActivity,
    STORAGE_KEYS.popupPreferences,
    STORAGE_KEYS.aiRejectedSuggestions,
    STORAGE_KEYS.aiProviderSettings
  ])
}

function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version || ''
  } catch {
    return ''
  }
}

function redactAiProviderSettings(rawSettings: unknown): Record<string, unknown> & { apiKeyRedacted: true } {
  const source = normalizeObject(rawSettings)
  const { apiKey: _apiKey, api_key: _apiKeySnake, key: _key, token: _token, ...safeSettings } = source
  return {
    ...safeSettings,
    apiKeyRedacted: true
  }
}

function normalizeIgnoreRulesForBackup(rawRules: unknown): CuratorBackupFileV1['storage']['ignoreRules'] {
  const source = normalizeObject(rawRules)
  return {
    bookmarks: normalizeUnknownArray(source.bookmarks),
    domains: normalizeUnknownArray(source.domains),
    folders: normalizeUnknownArray(source.folders)
  }
}

function buildNewTabStoragePayload(newTab: Record<string, unknown>): Record<string, unknown> {
  const mapping: Array<[string, string]> = [
    ['customIcons', STORAGE_KEYS.newTabCustomIcons],
    ['backgroundSettings', STORAGE_KEYS.newTabBackgroundSettings],
    ['searchSettings', STORAGE_KEYS.newTabSearchSettings],
    ['iconSettings', STORAGE_KEYS.newTabIconSettings],
    ['timeSettings', STORAGE_KEYS.newTabTimeSettings],
    ['generalSettings', STORAGE_KEYS.newTabGeneralSettings],
    ['folderSettings', STORAGE_KEYS.newTabFolderSettings],
    ['activity', STORAGE_KEYS.newTabActivity]
  ]
  const payload: Record<string, unknown> = {}
  for (const [field, storageKey] of mapping) {
    if (newTab[field] !== undefined && newTab[field] !== null) {
      payload[storageKey] = newTab[field]
    }
  }
  return payload
}

function getBackupRestoreStorageKeys(
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode
): string[] {
  const keys = mode === 'newTabOnly' || mode === 'safeFull'
    ? Object.keys(buildNewTabStoragePayload(backup.storage.newTab))
    : []
  if (mode === 'tagsOnly' || mode === 'safeFull') {
    keys.push(STORAGE_KEYS.bookmarkTagIndex)
  }
  if (mode === 'safeFull') {
    keys.push(
      STORAGE_KEYS.recycleBin,
      STORAGE_KEYS.ignoreRules,
      STORAGE_KEYS.redirectCache,
      STORAGE_KEYS.popupPreferences,
      STORAGE_KEYS.aiRejectedSuggestions,
      STORAGE_KEYS.aiProviderSettings
    )
  }
  return [...new Set(keys)]
}

async function restoreLocalStorageSnapshot(
  snapshot: Record<string, unknown>,
  keys: string[],
  transaction: LocalStorageTransaction
): Promise<void> {
  const payload: Record<string, unknown> = {}
  const missingKeys: string[] = []
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      payload[key] = snapshot[key]
    } else {
      missingKeys.push(key)
    }
  }

  if (Object.keys(payload).length) {
    await setLocalStorage(payload, { transaction })
  }
  if (missingKeys.length) {
    await removeLocalStorage(missingKeys, { transaction })
  }
}

async function rollbackBackupRestoreSnapshot(
  snapshot: Pick<
    BackupRestoreSnapshot,
    'previousTagIndex' | 'previousStorage' | 'restoreStorageKeys'
  >,
  transaction: LocalStorageTransaction,
  {
    restoreFolderId,
    restoreFolderTitle,
    restoreTagState,
    restoreStorageState
  }: {
    restoreFolderId: string
    restoreFolderTitle: string
    restoreTagState: boolean
    restoreStorageState: boolean
  }
): Promise<string[]> {
  const rollbackErrors: string[] = []

  if (restoreFolderId || restoreFolderTitle) {
    try {
      await removeOwnedRestoreFolder(restoreFolderId, restoreFolderTitle)
    } catch (rollbackError) {
      rollbackErrors.push(formatBackupError('恢复文件夹', rollbackError))
    }
  }
  if (restoreTagState && snapshot.previousTagIndex) {
    try {
      await restoreBookmarkTagIndexSnapshot(snapshot.previousTagIndex, { transaction })
    } catch (rollbackError) {
      rollbackErrors.push(formatBackupError('标签数据', rollbackError))
    }
  }
  if (restoreStorageState) {
    try {
      await restoreLocalStorageSnapshot(
        snapshot.previousStorage,
        snapshot.restoreStorageKeys,
        transaction
      )
    } catch (rollbackError) {
      rollbackErrors.push(formatBackupError('本地配置', rollbackError))
    }
  }

  return rollbackErrors
}

async function rollbackBackupRestoreJournalUnderTransaction(
  journal: BackupRestoreJournal,
  transaction: LocalStorageTransaction
): Promise<string[]> {
  const verificationErrors: string[] = []
  let restoreTagState = false
  let restoreStorageKeys: string[] = []

  if (
    journal.tagStateMayHaveChanged &&
    journal.previousTagIndex &&
    journal.expectedTagIndex
  ) {
    try {
      const currentTagIndex = await loadBookmarkTagIndex({ transaction })
      restoreTagState = areBackupValuesEquivalent(
        currentTagIndex,
        journal.expectedTagIndex
      )
    } catch (error) {
      verificationErrors.push(formatBackupError('标签状态校验', error))
    }
  }

  const expectedStorageKeys = journal.storageStateMayHaveChanged
    ? Object.keys(journal.expectedStorage)
    : []
  if (expectedStorageKeys.length) {
    try {
      const currentStorage = await getLocalStorage(expectedStorageKeys)
      restoreStorageKeys = expectedStorageKeys.filter((storageKey) => {
        return Object.prototype.hasOwnProperty.call(currentStorage, storageKey) &&
          areBackupValuesEquivalent(
            currentStorage[storageKey],
            journal.expectedStorage[storageKey]
          )
      })
    } catch (error) {
      verificationErrors.push(formatBackupError('本地配置状态校验', error))
    }
  }

  if (verificationErrors.length) {
    return verificationErrors
  }

  return rollbackBackupRestoreSnapshot(
    {
      previousTagIndex: journal.previousTagIndex,
      previousStorage: journal.previousStorage,
      restoreStorageKeys
    },
    transaction,
    {
      restoreFolderId: journal.restoreFolderId,
      restoreFolderTitle: journal.restoreFolderTitle,
      restoreTagState,
      restoreStorageState: restoreStorageKeys.length > 0
    }
  )
}

async function recoverBackupRestoreJournal(
  journal: BackupRestoreJournal,
  withMutationLock?: BackupRestoreMutationLock
): Promise<BackupRestoreRecoveryResult> {
  return runWithOptionalBackupRestoreMutationLock(
    journal.mode,
    withMutationLock,
    () => withLocalStorageTransaction(async (transaction) => {
      let currentJournal: BackupRestoreJournal = {
        ...journal,
        status: 'rolling-back',
        updatedAt: Date.now(),
        rollbackErrors: []
      }
      await putAutoBackup(currentJournal).catch(() => {})

      const isLegacyJournal = currentJournal.schemaVersion === 1
      const rollbackErrors = isLegacyJournal
        ? await rollbackBackupRestoreSnapshot(
            {
              previousTagIndex: currentJournal.previousTagIndex,
              previousStorage: currentJournal.previousStorage,
              restoreStorageKeys: []
            },
            transaction,
            {
              restoreFolderId: currentJournal.restoreFolderId,
              restoreFolderTitle: currentJournal.restoreFolderTitle,
              restoreTagState: false,
              restoreStorageState: false
            }
          )
        : await rollbackBackupRestoreJournalUnderTransaction(
            currentJournal,
            transaction
          )
      if (rollbackErrors.length) {
        currentJournal = {
          ...currentJournal,
          status: 'rollback-failed',
          updatedAt: Date.now(),
          rollbackErrors
        }
        await putAutoBackup(currentJournal).catch(() => {})
        return {
          operationId: currentJournal.operationId,
          recovered: false,
          errors: rollbackErrors
        }
      }

      await replaceActiveJournalWithReceipt({
        backupId: getBackupRestoreReceiptKey(currentJournal.operationId),
        kind: 'restore-receipt',
        schemaVersion: BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION,
        operationId: currentJournal.operationId,
        mode: currentJournal.mode,
        status: isLegacyJournal ? 'preserved' : 'rolled-back',
        completedAt: Date.now(),
        error: isLegacyJournal
          ? '检测到旧版恢复日志；无法安全确认哪些标签或设置由恢复写入，已保留当前数据并清理恢复专用文件夹。'
          : currentJournal.lastError || '上一次备份恢复中断，已自动回滚。'
      })
      return {
        operationId: currentJournal.operationId,
        recovered: true,
        errors: []
      }
    })
  )
}

async function removeOwnedRestoreFolder(
  restoreFolderId: string,
  restoreFolderTitle: string
): Promise<void> {
  const normalizedId = String(restoreFolderId || '').trim()
  const normalizedTitle = String(restoreFolderTitle || '').trim()
  const tree = await getBookmarkTree()
  if (normalizedId) {
    const existing = findBookmarkNodeById(tree[0], normalizedId)
    if (existing) {
      await removeBookmarkTree(normalizedId)
      return
    }
  }

  if (!normalizedTitle) {
    return
  }
  const bookmarkBar = findBookmarkNodeById(tree[0], BOOKMARKS_BAR_ID)
  const matchingFolderIds = (bookmarkBar?.children || [])
    .filter((node) => !node.url && String(node.title || '') === normalizedTitle)
    .map((node) => String(node.id || '').trim())
    .filter(Boolean)
  for (const folderId of matchingFolderIds) {
    await removeBookmarkTree(folderId)
  }
}

function findBookmarkNodeById(
  node: chrome.bookmarks.BookmarkTreeNode | undefined,
  bookmarkId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  if (!node) {
    return null
  }
  if (String(node.id) === bookmarkId) {
    return node
  }
  for (const child of node.children || []) {
    const match = findBookmarkNodeById(child, bookmarkId)
    if (match) {
      return match
    }
  }
  return null
}

function buildBackupRestoreFailure(error: unknown, rollbackErrors: string[]): Error {
  const message = formatUnknownError(error) || '备份恢复失败。'
  if (rollbackErrors.length) {
    return new Error(`${message} 自动回滚未完全成功：${rollbackErrors.join('；')}。`)
  }
  return Object.assign(
    new Error(`${message} 已自动回滚本次恢复写入。`),
    { code: BACKUP_RESTORE_ROLLED_BACK_CODE }
  )
}

function areBackupValuesEquivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeBackupValueForComparison(left)) ===
    JSON.stringify(normalizeBackupValueForComparison(right))
}

function normalizeBackupValueForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeBackupValueForComparison)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, child]) => [key, normalizeBackupValueForComparison(child)])
    )
  }
  if (value === undefined) {
    return { __curatorUndefined: true }
  }
  return value
}

function formatBackupError(label: string, error: unknown): string {
  return `${label}${error instanceof Error ? `：${error.message}` : '恢复失败'}`
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '备份恢复失败。')
}

function normalizeBackupRestoreOperationId(value: unknown): string {
  const operationId = String(value || '').trim()
  if (
    !operationId ||
    operationId.length > 128 ||
    !/^[a-z0-9._:-]+$/i.test(operationId)
  ) {
    throw new Error('备份恢复操作 ID 无效。')
  }
  return operationId
}

function assertBackupRestoreMode(mode: unknown): asserts mode is BackupRestoreMode {
  if (mode !== 'tagsOnly' && mode !== 'newTabOnly' && mode !== 'safeFull') {
    throw new Error('备份恢复模式无效。')
  }
}

function buildJournaledRestoreFolderTitle(operationId: string, now: number): string {
  const date = new Date(Number.isFinite(now) ? now : Date.now()).toISOString().slice(0, 10)
  return `Curator Restore ${date} [${operationId}]`
}

function getBackupRestoreReceiptKey(operationId: string): string {
  return `${BACKUP_RESTORE_RECEIPT_PREFIX}${operationId}`
}

function resolveBackupRestoreReceipt(receipt: BackupRestoreReceipt): BackupRestoreResult {
  if (receipt.status === 'committed' && receipt.result) {
    return receipt.result
  }
  const fallbackMessage = receipt.status === 'preserved'
    ? '这次旧版备份恢复已终止；当前数据已保留，未重复执行。'
    : '这次备份恢复此前已回滚，未重复执行。'
  throw Object.assign(
    new Error(receipt.error || fallbackMessage),
    { code: BACKUP_RESTORE_ROLLED_BACK_CODE }
  )
}

function withBackupRestoreLock<T>(task: () => Promise<T>): Promise<T> {
  const lockManager = globalThis.navigator?.locks
  if (lockManager) {
    return lockManager.request(
      BACKUP_RESTORE_LOCK_NAME,
      { mode: 'exclusive' },
      task
    )
  }

  const queuedTask = fallbackBackupRestoreQueue
    .catch(() => {})
    .then(task)
  fallbackBackupRestoreQueue = queuedTask.then(() => undefined, () => undefined)
  return queuedTask
}

function runWithOptionalBackupRestoreMutationLock<T>(
  mode: BackupRestoreMode,
  withMutationLock: BackupRestoreMutationLock | undefined,
  task: () => Promise<T>
): Promise<T> {
  return mode === 'safeFull' && withMutationLock
    ? withMutationLock(task)
    : task()
}

async function copyMissingBookmarksToRestoreFolder(
  backup: CuratorBackupFileV1,
  currentBookmarks: Array<{ url: string; path?: string }>,
  {
    restoreFolderTitle = '',
    beforeCreate,
    onCreated
  }: {
    restoreFolderTitle?: string
    beforeCreate?: () => Promise<void> | void
    onCreated?: (folderId: string) => Promise<void> | void
  } = {}
): Promise<{ copied: number; skipped: number }> {
  const knownInstances = new Set(
    currentBookmarks.map((bookmark) => buildBookmarkInstanceKey(bookmark.url, bookmark.path || ''))
  )
  const rootChildren = backup.chromeBookmarks.tree.flatMap((node) => node.children || [])
  const missingCount = extractBackupBookmarkInstances(backup.chromeBookmarks.tree)
    .filter((instance) => !knownInstances.has(buildBookmarkInstanceKey(instance.url, instance.path)))
    .length

  if (!missingCount) {
    return { copied: 0, skipped: 0 }
  }

  await beforeCreate?.()
  const restoreFolder = await createBookmark({
    parentId: BOOKMARKS_BAR_ID,
    title: restoreFolderTitle || `Curator Restore ${new Date().toISOString().slice(0, 10)}`
  })
  await onCreated?.(String(restoreFolder.id))
  return copyMissingNodesSequentially(
    rootChildren,
    String(restoreFolder.id),
    knownInstances,
    ''
  )
}

function copyMissingNodesSequentially(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  parentId: string,
  knownInstances: Set<string>,
  folderPath: string
): Promise<{ copied: number; skipped: number }> {
  return nodes.reduce<Promise<{ copied: number; skipped: number }>>((chain, node) => {
    return chain.then(async (totals) => {
      const result = await copyMissingNode(node, parentId, knownInstances, folderPath)
      return {
        copied: totals.copied + result.copied,
        skipped: totals.skipped + result.skipped
      }
    })
  }, Promise.resolve({ copied: 0, skipped: 0 }))
}

async function copyMissingNode(
  node: chrome.bookmarks.BookmarkTreeNode,
  parentId: string,
  knownInstances: Set<string>,
  folderPath: string
): Promise<{ copied: number; skipped: number }> {
  if (node.url) {
    const instanceKey = buildBookmarkInstanceKey(node.url, folderPath)
    if (knownInstances.has(instanceKey)) {
      return { copied: 0, skipped: 1 }
    }
    await createBookmark({
      parentId,
      title: node.title || node.url,
      url: node.url
    })
    knownInstances.add(instanceKey)
    return { copied: 1, skipped: 0 }
  }

  const children = node.children || []
  const nextFolderPath = buildChildFolderPath(folderPath, node.title)
  if (!children.some((child) => nodeHasMissingBookmark(child, knownInstances, nextFolderPath))) {
    return { copied: 0, skipped: children.length }
  }

  let folder: chrome.bookmarks.BookmarkTreeNode | null = null
  folder = await createBookmark({
    parentId,
    title: node.title || '未命名文件夹'
  })
  return copyMissingNodesSequentially(children, String(folder.id), knownInstances, nextFolderPath)
}

function nodeHasMissingBookmark(
  node: chrome.bookmarks.BookmarkTreeNode,
  knownInstances: Set<string>,
  folderPath: string
): boolean {
  if (node.url) {
    return !knownInstances.has(buildBookmarkInstanceKey(node.url, folderPath))
  }
  const nextFolderPath = buildChildFolderPath(folderPath, node.title)
  return (node.children || []).some((child) => nodeHasMissingBookmark(child, knownInstances, nextFolderPath))
}

function extractBackupBookmarkNodes(tree: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
  const output: chrome.bookmarks.BookmarkTreeNode[] = []
  const visit = (node: chrome.bookmarks.BookmarkTreeNode) => {
    output.push(node)
    for (const child of node.children || []) {
      visit(child)
    }
  }
  tree.forEach(visit)
  return output
}

function extractBackupBookmarkInstances(tree: chrome.bookmarks.BookmarkTreeNode[]): Array<{ url: string; path: string }> {
  const output: Array<{ url: string; path: string }> = []
  const visit = (node: chrome.bookmarks.BookmarkTreeNode, folderPath = '') => {
    if (node.url) {
      output.push({
        url: node.url,
        path: folderPath
      })
      return
    }
    const nextFolderPath = buildChildFolderPath(folderPath, node.title)
    for (const child of node.children || []) {
      visit(child, nextFolderPath)
    }
  }
  for (const root of tree) {
    for (const child of root.children || []) {
      visit(child, '')
    }
  }
  return output
}

function countBookmarkNodes(tree: chrome.bookmarks.BookmarkTreeNode[]): number {
  return extractBackupBookmarkNodes(tree).length
}

function countIgnoreRules(rules: CuratorBackupFileV1['storage']['ignoreRules']): number {
  return rules.bookmarks.length + rules.domains.length + rules.folders.length
}

function countRedirectEntries(cache: unknown): number {
  const source = normalizeObject(cache)
  return Array.isArray(source.results) ? source.results.length : 0
}

function countPresentObjectValues(value: Record<string, unknown>): number {
  return Object.values(value).filter((item) => item !== undefined && item !== null).length
}

function hasApiKeyLikeField(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasApiKeyLikeField(item))
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'apikey' || normalizedKey === 'api_key') {
      return true
    }
    if (hasApiKeyLikeField(child)) {
      return true
    }
  }
  return false
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function estimateJsonSizeBytes(value: unknown): number {
  const json = JSON.stringify(value)
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length
  }
  return json.length
}

function mergeRestoredAiProviderSettings(currentSettings: unknown, backupSettings: unknown): Record<string, unknown> {
  const current = normalizeObject(currentSettings)
  const safeBackupSettings = redactAiProviderSettings(backupSettings)
  const { apiKeyRedacted: _apiKeyRedacted, ...backupSafeFields } = safeBackupSettings
  return {
    ...current,
    ...backupSafeFields
  }
}

function buildChildFolderPath(parentPath: string, title: unknown): string {
  const segment = String(title || '').trim()
  if (!segment) {
    return parentPath
  }
  return parentPath ? `${parentPath} / ${segment}` : segment
}

function buildBookmarkInstanceKey(url: string, path: string): string {
  return `${normalizeBookmarkTagUrl(url)}\n${normalizePathKey(path)}`
}

function normalizePathKey(path: string): string {
  return String(path || '').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function openAutoBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTO_BACKUP_DB_NAME, AUTO_BACKUP_DB_VERSION)
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
    request.addEventListener('error', () => reject(request.error || new Error('无法打开自动备份数据库。')))
  })
}

async function putAutoBackup(record: object): Promise<void> {
  const db = await openAutoBackupDb()
  try {
    await runAutoBackupStoreRequest(db, 'readwrite', (store) => store.put(record))
  } finally {
    db.close()
  }
}

async function deleteAutoBackup(backupId: string): Promise<void> {
  const db = await openAutoBackupDb()
  try {
    await runAutoBackupStoreRequest(db, 'readwrite', (store) => store.delete(backupId))
  } finally {
    db.close()
  }
}

async function getAutoBackupRecord<T>(backupId: string): Promise<T | null> {
  const db = await openAutoBackupDb()
  try {
    return await runAutoBackupStoreValueRequest<T | undefined>(
      db,
      (store) => store.get(backupId)
    ).then((record) => record || null)
  } finally {
    db.close()
  }
}

async function getActiveBackupRestoreJournal(): Promise<BackupRestoreJournal | null> {
  const rawJournal = await getAutoBackupRecord<unknown>(BACKUP_RESTORE_JOURNAL_KEY)
  if (!rawJournal) {
    return null
  }
  return normalizeBackupRestoreJournal(rawJournal)
}

async function getBackupRestoreReceipt(
  operationId: string
): Promise<BackupRestoreReceipt | null> {
  const rawReceipt = await getAutoBackupRecord<unknown>(
    getBackupRestoreReceiptKey(operationId)
  )
  if (!rawReceipt) {
    return null
  }
  return normalizeBackupRestoreReceipt(rawReceipt)
}

async function replaceActiveJournalWithReceipt(
  receipt: BackupRestoreReceipt
): Promise<void> {
  const db = await openAutoBackupDb()
  try {
    await runAutoBackupStoreRequest(db, 'readwrite', (store) => {
      store.delete(BACKUP_RESTORE_JOURNAL_KEY)
      return store.put(receipt)
    })
  } finally {
    db.close()
  }
}

function runAutoBackupStoreRequest(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUTO_BACKUP_STORE, mode)
    const store = transaction.objectStore(AUTO_BACKUP_STORE)
    createRequest(store)
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error || new Error('自动备份存储失败。')))
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('自动备份存储中断。')))
  })
}

function runAutoBackupStoreValueRequest<T>(
  db: IDBDatabase,
  createRequest: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUTO_BACKUP_STORE, 'readonly')
    const store = transaction.objectStore(AUTO_BACKUP_STORE)
    let request: IDBRequest
    try {
      request = createRequest(store)
    } catch (error) {
      reject(error)
      return
    }
    transaction.addEventListener('complete', () => resolve(request.result as T))
    transaction.addEventListener('error', () => {
      reject(transaction.error || new Error('自动备份读取失败。'))
    })
    transaction.addEventListener('abort', () => {
      reject(transaction.error || new Error('自动备份读取中断。'))
    })
  })
}

function normalizeBackupRestoreJournal(value: unknown): BackupRestoreJournal {
  const source = normalizeObject(value)
  const operationId = normalizeBackupRestoreOperationId(source.operationId)
  assertBackupRestoreMode(source.mode)
  const schemaVersion = source.schemaVersion === 1 || source.schemaVersion === 2
    ? source.schemaVersion
    : null
  const validStatuses = new Set<BackupRestoreJournalStatus>([
    'prepared',
    'applying',
    'copying-bookmarks',
    'rolling-back',
    'rollback-failed'
  ])
  if (
    source.backupId !== BACKUP_RESTORE_JOURNAL_KEY ||
    source.kind !== 'restore-journal' ||
    !schemaVersion ||
    !validStatuses.has(source.status as BackupRestoreJournalStatus)
  ) {
    throw new Error('备份恢复日志损坏，已停止自动恢复。')
  }

  return {
    backupId: BACKUP_RESTORE_JOURNAL_KEY,
    kind: 'restore-journal',
    schemaVersion,
    operationId,
    mode: source.mode,
    status: source.status as BackupRestoreJournalStatus,
    startedAt: Number(source.startedAt) || 0,
    updatedAt: Number(source.updatedAt) || 0,
    restoreStorageKeys: Array.isArray(source.restoreStorageKeys)
      ? source.restoreStorageKeys.map((key) => String(key || '').trim()).filter(Boolean)
      : [],
    previousStorage: normalizeObject(source.previousStorage),
    previousTagIndex: source.previousTagIndex
      ? normalizeBookmarkTagIndex(source.previousTagIndex)
      : null,
    expectedTagIndex: schemaVersion === BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION &&
      source.expectedTagIndex
      ? normalizeBookmarkTagIndex(source.expectedTagIndex)
      : null,
    expectedStorage: schemaVersion === BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION
      ? normalizeObject(source.expectedStorage)
      : {},
    restoreFolderTitle: String(source.restoreFolderTitle || ''),
    restoreFolderId: String(source.restoreFolderId || ''),
    tagStateMayHaveChanged: Boolean(source.tagStateMayHaveChanged),
    storageStateMayHaveChanged: Boolean(source.storageStateMayHaveChanged),
    lastError: String(source.lastError || ''),
    rollbackErrors: Array.isArray(source.rollbackErrors)
      ? source.rollbackErrors.map((error) => String(error || '')).filter(Boolean)
      : []
  }
}

function normalizeBackupRestoreReceipt(value: unknown): BackupRestoreReceipt {
  const source = normalizeObject(value)
  const operationId = normalizeBackupRestoreOperationId(source.operationId)
  assertBackupRestoreMode(source.mode)
  const schemaVersion = source.schemaVersion === 1 || source.schemaVersion === 2
    ? source.schemaVersion
    : null
  const status = source.status === 'committed' ||
    source.status === 'rolled-back' ||
    (
      source.status === 'preserved' &&
      schemaVersion === BACKUP_RESTORE_JOURNAL_SCHEMA_VERSION
    )
    ? source.status
    : null
  if (
    source.backupId !== getBackupRestoreReceiptKey(operationId) ||
    source.kind !== 'restore-receipt' ||
    !schemaVersion ||
    !status
  ) {
    throw new Error('备份恢复回执损坏，已停止重复执行。')
  }

  return {
    backupId: getBackupRestoreReceiptKey(operationId),
    kind: 'restore-receipt',
    schemaVersion,
    operationId,
    mode: source.mode,
    status,
    completedAt: Number(source.completedAt) || 0,
    result: source.result as BackupRestoreResult | undefined,
    error: typeof source.error === 'string' ? source.error : undefined
  }
}

async function updateAutoBackupIndex(
  entry: AutoBackupIndexEntry,
  retentionLimit: number
): Promise<{ kept: AutoBackupIndexEntry[]; pruned: AutoBackupIndexEntry[] }> {
  const stored = await getLocalStorage([STORAGE_KEYS.autoBackupIndex])
  const current = Array.isArray(stored[STORAGE_KEYS.autoBackupIndex])
    ? stored[STORAGE_KEYS.autoBackupIndex] as AutoBackupIndexEntry[]
    : []
  const sorted = [entry, ...current]
    .filter((item) => item && typeof item.backupId === 'string')
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
  const kept = sorted.slice(0, retentionLimit)
  const pruned = sorted.slice(retentionLimit)

  await setLocalStorage({
    [STORAGE_KEYS.autoBackupIndex]: kept
  })
  return { kept, pruned }
}

async function pruneAutoBackups(prunedEntries: AutoBackupIndexEntry[]): Promise<void> {
  await Promise.all(
    prunedEntries.flatMap((combineValue, combineIndex, combineArray) => { if (!((entry) => entry?.backupId)(combineValue)) return []; const combinedResult = ((entry) => deleteAutoBackup(entry.backupId))(combineValue); return [combinedResult] })
  )
}
