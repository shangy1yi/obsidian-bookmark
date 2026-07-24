import type { NavigationNetworkEvidence, NavigationStatus } from './types.js'
import type { BookmarkTagAnalysisInput } from './bookmark-tags.js'
import type {
  BackupRestoreMode,
  BackupRestoreResult,
  CuratorBackupFileV1
} from './backup.js'

export const AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT = 6
export const AVAILABILITY_NAVIGATION_TIMEOUT_MIN_MS = 1000
export const AVAILABILITY_NAVIGATION_TIMEOUT_MAX_MS = 120000
export const AVAILABILITY_NAVIGATION_CHECK_ID_MAX_LENGTH = 128
export const AVAILABILITY_NAVIGATION_URL_MAX_LENGTH = 8192

export interface NavigationCheckMessage {
  type: 'availability:navigate'
  url: string
  timeoutMs?: number
  checkId?: string
}

export interface NavigationCancelMessage {
  type: 'availability:cancel'
  checkId: string
}

export interface AvailabilityProbeMessage {
  type: 'availability:probe'
  url: string
  method: 'HEAD' | 'GET'
  timeoutMs?: number
  deadlineAtMs?: number
  checkId?: string
}

export interface BackupRestoreMessage {
  type: 'backup:restore'
  operationId: string
  mode: BackupRestoreMode
  backup: CuratorBackupFileV1
}

export interface AvailabilityProbeResult {
  ok: boolean
  status: number
  finalUrl: string
  redirected: boolean
  detail: string
  errorCode: string
}

export interface BookmarkSaveMessage {
  type: 'bookmark:save'
  url: string
  title: string
  parentId?: string
  folderPath?: string
  bookmarkId?: string
  analysis?: BookmarkTagAnalysisInput
}

export interface InboxUndoLastMoveMessage {
  type: 'inbox:undo-last-move'
}

export interface RuntimeNotificationMessage {
  type: 'notification:create'
  notificationId: string
  title: string
  message: string
  contextMessage?: string
  priority?: number
  requireInteraction?: boolean
  silent?: boolean
}

export interface NavigationCheckResult {
  status: NavigationStatus
  finalUrl: string
  detail: string
  errorCode: string
  networkEvidence?: NavigationNetworkEvidence
}

export interface BookmarkSaveResult {
  bookmarkId: string
  parentId: string
  title: string
  url: string
  created: boolean
}

export interface InboxUndoLastMoveResult {
  bookmarkId: string
  parentId: string
  title: string
}

interface RuntimeMessageResponse<TResult = unknown> {
  ok: boolean
  result?: TResult
  error?: string
  errorName?: string
  errorCode?: string
}

export type RuntimeMessageValidationResult<TMessage> =
  | { ok: true; value: TMessage }
  | { ok: false; error: string }

export function parseNavigationCheckMessage(
  value: unknown
): RuntimeMessageValidationResult<NavigationCheckMessage & { checkId: string }> {
  if (!isRecord(value) || value.type !== 'availability:navigate') {
    return { ok: false, error: '可用性导航消息格式无效。' }
  }

  const checkId = normalizeNavigationCheckId(value.checkId)
  if (!checkId) {
    return { ok: false, error: '可用性导航检查 ID 无效。' }
  }

  if (typeof value.url !== 'string') {
    return { ok: false, error: '可用性导航 URL 无效。' }
  }

  const rawUrl = value.url.trim()
  if (!rawUrl || rawUrl.length > AVAILABILITY_NAVIGATION_URL_MAX_LENGTH) {
    return { ok: false, error: '可用性导航 URL 无效或过长。' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return { ok: false, error: '可用性导航 URL 无效。' }
  }

  if (
    !/^https?:$/i.test(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return { ok: false, error: '可用性导航只接受不含凭据的 HTTP/HTTPS URL。' }
  }

  const timeoutResult = parseNavigationTimeout(value.timeoutMs)
  if ('error' in timeoutResult) {
    return { ok: false, error: timeoutResult.error }
  }
  return {
    ok: true,
    value: {
      type: 'availability:navigate',
      url: parsedUrl.href,
      checkId,
      ...(timeoutResult.value === undefined ? {} : { timeoutMs: timeoutResult.value })
    }
  }
}

export function parseNavigationCancelMessage(
  value: unknown
): RuntimeMessageValidationResult<NavigationCancelMessage> {
  if (!isRecord(value) || value.type !== 'availability:cancel') {
    return { ok: false, error: '可用性导航取消消息格式无效。' }
  }

  const checkId = normalizeNavigationCheckId(value.checkId)
  if (!checkId) {
    return { ok: false, error: '可用性导航检查 ID 无效。' }
  }

  return {
    ok: true,
    value: {
      type: 'availability:cancel',
      checkId
    }
  }
}

export function parseAvailabilityProbeMessage(
  value: unknown
): RuntimeMessageValidationResult<AvailabilityProbeMessage & { checkId: string }> {
  if (!isRecord(value) || value.type !== 'availability:probe') {
    return { ok: false, error: '可用性网络探测消息格式无效。' }
  }

  const checkId = normalizeNavigationCheckId(value.checkId)
  if (!checkId) {
    return { ok: false, error: '可用性网络探测 ID 无效。' }
  }

  if (value.method !== 'HEAD' && value.method !== 'GET') {
    return { ok: false, error: '可用性网络探测方法无效。' }
  }

  if (typeof value.url !== 'string') {
    return { ok: false, error: '可用性网络探测 URL 无效。' }
  }

  const rawUrl = value.url.trim()
  if (!rawUrl || rawUrl.length > AVAILABILITY_NAVIGATION_URL_MAX_LENGTH) {
    return { ok: false, error: '可用性网络探测 URL 无效或过长。' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return { ok: false, error: '可用性网络探测 URL 无效。' }
  }

  if (
    !/^https?:$/i.test(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return { ok: false, error: '可用性网络探测只接受不含凭据的 HTTP/HTTPS URL。' }
  }

  const timeoutResult = parseNavigationTimeout(value.timeoutMs)
  if ('error' in timeoutResult) {
    return { ok: false, error: timeoutResult.error }
  }
  const deadlineResult = parseAvailabilityProbeDeadline(value.deadlineAtMs)
  if ('error' in deadlineResult) {
    return { ok: false, error: deadlineResult.error }
  }

  return {
    ok: true,
    value: {
      type: 'availability:probe',
      url: parsedUrl.href,
      method: value.method,
      checkId,
      ...(timeoutResult.value === undefined ? {} : { timeoutMs: timeoutResult.value }),
      ...(deadlineResult.value === undefined ? {} : { deadlineAtMs: deadlineResult.value })
    }
  }
}

export function parseBackupRestoreMessage(
  value: unknown
): RuntimeMessageValidationResult<BackupRestoreMessage> {
  if (!isRecord(value) || value.type !== 'backup:restore') {
    return { ok: false, error: '备份恢复消息格式无效。' }
  }

  const operationId = String(value.operationId || '').trim()
  if (
    !operationId ||
    operationId.length > 128 ||
    !/^[a-z0-9._:-]+$/i.test(operationId)
  ) {
    return { ok: false, error: '备份恢复操作 ID 无效。' }
  }
  if (
    value.mode !== 'tagsOnly' &&
    value.mode !== 'newTabOnly' &&
    value.mode !== 'safeFull'
  ) {
    return { ok: false, error: '备份恢复范围无效。' }
  }
  if (!isRecord(value.backup)) {
    return { ok: false, error: '备份恢复数据无效。' }
  }

  return {
    ok: true,
    value: {
      type: 'backup:restore',
      operationId,
      mode: value.mode,
      backup: value.backup as unknown as CuratorBackupFileV1
    }
  }
}

export function requestNavigationCheck(
  url: string,
  timeoutMs?: number,
  checkId?: string
): Promise<NavigationCheckResult> {
  const message: NavigationCheckMessage = { type: 'availability:navigate', url, timeoutMs, checkId }
  return sendRuntimeMessage<NavigationCheckResult>(message)
}

export function cancelNavigationCheck(checkId: string): Promise<void> {
  const message: NavigationCancelMessage = { type: 'availability:cancel', checkId }
  return sendRuntimeMessage<void>(message)
}

export function requestBookmarkSave(payload: Omit<BookmarkSaveMessage, 'type'>): Promise<BookmarkSaveResult> {
  const message: BookmarkSaveMessage = { type: 'bookmark:save', ...payload }
  return sendRuntimeMessage<BookmarkSaveResult>(message)
}

export function requestRuntimeNotification(
  payload: Omit<RuntimeNotificationMessage, 'type'>
): Promise<void> {
  const message: RuntimeNotificationMessage = { type: 'notification:create', ...payload }
  return sendRuntimeMessage<void>(message)
}

function sendRuntimeMessage<TResult>(message: unknown): Promise<TResult> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: RuntimeMessageResponse<TResult>) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      if (!response?.ok) {
        const runtimeError = new Error(response?.error || '后台操作失败。')
        runtimeError.name = response?.errorName || 'Error'
        if (response?.errorCode) {
          Object.assign(runtimeError, { code: response.errorCode })
        }
        reject(runtimeError)
        return
      }

      resolve(response.result as TResult)
    })
  })
}

export function requestAvailabilityProbe(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs?: number,
  checkId?: string,
  deadlineAtMs?: number
): Promise<AvailabilityProbeResult> {
  const message: AvailabilityProbeMessage = {
    type: 'availability:probe',
    url,
    method,
    timeoutMs,
    checkId,
    deadlineAtMs
  }
  return sendRuntimeMessage<AvailabilityProbeResult>(message)
}

export function requestBackupRestore(
  operationId: string,
  backup: CuratorBackupFileV1,
  mode: BackupRestoreMode
): Promise<BackupRestoreResult> {
  const message: BackupRestoreMessage = {
    type: 'backup:restore',
    operationId,
    backup,
    mode
  }
  return sendRuntimeMessage<BackupRestoreResult>(message)
}

function parseNavigationTimeout(
  value: unknown
): RuntimeMessageValidationResult<number | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined }
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < AVAILABILITY_NAVIGATION_TIMEOUT_MIN_MS ||
    value > AVAILABILITY_NAVIGATION_TIMEOUT_MAX_MS
  ) {
    return {
      ok: false,
      error: `可用性导航超时必须在 ${AVAILABILITY_NAVIGATION_TIMEOUT_MIN_MS} 到 ${AVAILABILITY_NAVIGATION_TIMEOUT_MAX_MS} 毫秒之间。`
    }
  }

  return { ok: true, value: Math.round(value) }
}

function parseAvailabilityProbeDeadline(
  value: unknown
): RuntimeMessageValidationResult<number | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined }
  }
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    return { ok: false, error: '可用性网络探测截止时间无效。' }
  }
  return { ok: true, value }
}

function normalizeNavigationCheckId(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const checkId = value.trim()
  if (
    !checkId ||
    checkId.length > AVAILABILITY_NAVIGATION_CHECK_ID_MAX_LENGTH ||
    !/^[a-z0-9._:-]+$/i.test(checkId)
  ) {
    return ''
  }

  return checkId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
