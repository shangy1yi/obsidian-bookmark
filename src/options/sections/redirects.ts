import { STORAGE_KEYS } from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { getBookmarkById, updateBookmark } from '../../shared/bookmarks-api.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { displayUrl } from '../../shared/text.js'
import {
  availabilityState,
  managerState,
  createEmptyRedirectCache,
  normalizeHistoryRunScope
} from '../shared-options/state.js'
import {
  isInteractionLocked,
  syncSelectionSet,
  formatDateTime
} from '../shared-options/utils.js'
import { isRedirectedNavigation } from './classifier.js'
import { deleteBookmarksToRecycle } from './recycle.js'
import { publishResultsPagination } from '../components/results-pagination-store.js'
import { publishRedirectControls } from '../components/redirect-controls-store.js'
import { publishRedirectResults } from '../components/redirect-results-store.js'

const REDIRECT_RESULTS_PAGE_SIZE = 25

export function normalizeRedirectCache(rawCache) {
  if (!rawCache || typeof rawCache !== 'object') {
    return createEmptyRedirectCache()
  }

  return {
    savedAt: Number(rawCache.savedAt) || 0,
    scope: normalizeHistoryRunScope(rawCache.scope),
    results: normalizeRedirectCacheResults(rawCache.results)
  }
}

function normalizeRedirectCacheResults(entries) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.flatMap((flatMapValue, flatMapIndex, flatMapArray) => { const mappedResult = ((entry) => {
      const bookmarkId = String(entry?.id || '').trim()
      const url = String(entry?.url || '').trim()
      const finalUrl = String(entry?.finalUrl || '').trim()

      if (!bookmarkId || !url || !finalUrl) {
        return null
      }

      return {
        id: bookmarkId,
        title: String(entry?.title || '未命名书签').trim() || '未命名书签',
        url,
        finalUrl,
        path: String(entry?.path || '').trim(),
        parentId: String(entry?.parentId || '').trim(),
        index: Number.isFinite(Number(entry?.index)) ? Number(entry.index) : 0,
        ancestorIds: Array.isArray(entry?.ancestorIds)
          ? entry.ancestorIds.flatMap(folderId => { const mappedResult = String(folderId); return mappedResult ? [mappedResult] : [] })
          : [],
        badgeText: String(entry?.badgeText || '已跳转').trim() || '已跳转',
        detail: String(entry?.detail || '').trim(),
        status: 'redirected'
      }
    })(flatMapValue); return mappedResult ? [mappedResult] : [] })
}

function serializeRedirectCache(redirectCache = managerState.redirectCache) {
  return {
    version: 1,
    savedAt: Number(redirectCache?.savedAt) || 0,
    scope: normalizeHistoryRunScope(redirectCache?.scope),
    results: (Array.isArray(redirectCache?.results) ? redirectCache.results : []).map((result) => ({
      id: result.id,
      title: result.title,
      url: result.url,
      finalUrl: result.finalUrl,
      path: result.path,
      parentId: result.parentId,
      index: result.index,
      ancestorIds: Array.isArray(result.ancestorIds) ? result.ancestorIds : [],
      badgeText: result.badgeText,
      detail: result.detail
    }))
  }
}

export async function saveRedirectCache(redirectCache = managerState.redirectCache) {
  await setLocalStorage({
    [STORAGE_KEYS.redirectCache]: serializeRedirectCache(redirectCache)
  })
}

export function synchronizeRedirectResults() {
  const nextResults = availabilityState.redirectResults.filter((result) => {
    return isRedirectedNavigation(result.url, result.finalUrl || result.url)
  })

  if (nextResults.length !== availabilityState.redirectResults.length) {
    availabilityState.redirectResults = nextResults
    availabilityState.redirectedCount = nextResults.length
  }
}

function getCachedRedirectResults() {
  return managerState.redirectCache.results.flatMap((flatMapValue, flatMapIndex, flatMapArray) => { const mappedResult = ((cachedResult) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(cachedResult.id))
      if (
        !latestBookmark ||
        String(latestBookmark.url || '') !== String(cachedResult.url || '')
      ) {
        return null
      }

      const finalUrl = String(cachedResult.finalUrl || '').trim()
      if (!finalUrl || !isRedirectedNavigation(latestBookmark.url, finalUrl)) {
        return null
      }

      return {
        ...cachedResult,
        title: latestBookmark.title,
        url: latestBookmark.url,
        displayUrl: latestBookmark.displayUrl,
        path: latestBookmark.path,
        ancestorIds: latestBookmark.ancestorIds,
        parentId: latestBookmark.parentId,
        index: latestBookmark.index,
        domain: latestBookmark.domain,
        normalizedTitle: latestBookmark.normalizedTitle,
        normalizedUrl: latestBookmark.normalizedUrl,
        duplicateKey: latestBookmark.duplicateKey
      }
    })(flatMapValue); return mappedResult ? [mappedResult] : [] })
}

export function getRedirectSectionState(callbacks) {
  synchronizeRedirectResults()

  if (availabilityState.running || availabilityState.lastCompletedAt || availabilityState.redirectResults.length) {
    return {
      useCachedResults: false,
      results: availabilityState.redirectResults,
      scope: callbacks.getCurrentAvailabilityScopeMeta(),
      savedAt: availabilityState.lastCompletedAt
    }
  }

  return {
    useCachedResults: true,
    results: getCachedRedirectResults(),
    scope: normalizeHistoryRunScope(managerState.redirectCache.scope),
    savedAt: managerState.redirectCache.savedAt
  }
}

export async function persistRedirectCacheSnapshot(callbacks, {
  savedAt = managerState.redirectCache.savedAt || availabilityState.lastCompletedAt || Date.now(),
  scope = managerState.redirectCache.scope?.key
    ? managerState.redirectCache.scope
    : callbacks.getCurrentAvailabilityScopeMeta()
} = {}) {
  const scopeMeta = normalizeHistoryRunScope(scope)
  const nextRedirectCache = {
    savedAt: Number(savedAt) || 0,
    scope: scopeMeta,
    results: availabilityState.redirectResults.flatMap((combineValue, combineIndex, combineArray) => { if (!((result) => {
        return Boolean(String(result?.id || '').trim()) && isRedirectedNavigation(result.url, result.finalUrl || result.url)
      })(combineValue)) return []; const combinedResult = ((result) => ({
        id: String(result.id),
        title: String(result.title || '未命名书签'),
        url: String(result.url || ''),
        finalUrl: String(result.finalUrl || ''),
        path: String(result.path || ''),
        parentId: String(result.parentId || ''),
        index: Number.isFinite(Number(result.index)) ? Number(result.index) : 0,
        ancestorIds: Array.isArray(result.ancestorIds) ? result.ancestorIds.flatMap(folderId => { const mappedResult = String(folderId); return mappedResult ? [mappedResult] : [] }) : [],
        badgeText: String(result.badgeText || '已跳转'),
        detail: String(result.detail || ''),
        status: 'redirected'
      }))(combineValue); return [combinedResult] })
  }

  await saveRedirectCache(nextRedirectCache)
  managerState.redirectCache = nextRedirectCache
}

export async function mergeRetestedRedirectCache(
  retestedResults,
  { savedAt = managerState.redirectCache.savedAt || Date.now() } = {}
) {
  const normalizedScope = normalizeHistoryRunScope(managerState.redirectCache.scope)
  const testedIds = new Set(
    (Array.isArray(retestedResults) ? retestedResults : [])
      .map((result) => String(result?.id || '').trim())
      .filter(Boolean)
  )
  const retainedResults = managerState.redirectCache.results.filter((result) => {
    return !testedIds.has(String(result.id))
  })
  const redirectedResults = normalizeRedirectCacheResults(
    (Array.isArray(retestedResults) ? retestedResults : []).filter((result) => {
      return (
        result?.status === 'redirected' &&
        isResultInsideScope(result, normalizedScope) &&
        isRedirectedNavigation(result.url, result.finalUrl || result.url)
      )
    })
  )
  const mergedById = new Map(
    [...retainedResults, ...redirectedResults].map((result) => [String(result.id), result])
  )
  const nextRedirectCache = {
    savedAt: Number(savedAt) || Date.now(),
    scope: normalizedScope,
    results: [...mergedById.values()]
  }

  await saveRedirectCache(nextRedirectCache)
  managerState.redirectCache = nextRedirectCache
}

function isResultInsideScope(result, scope): boolean {
  if (scope.type !== 'folder' || !scope.folderId) {
    return true
  }

  const folderId = String(scope.folderId)
  return (
    String(result?.parentId || '') === folderId ||
    (Array.isArray(result?.ancestorIds) &&
      result.ancestorIds.some((ancestorId) => String(ancestorId) === folderId))
  )
}

export function removeRedirectIdsFromState(bookmarkIds) {
  const removedIdSet = new Set(bookmarkIds.flatMap(id => { const mappedResult = String(id); return mappedResult ? [mappedResult] : [] }))
  if (!removedIdSet.size) {
    return
  }

  availabilityState.redirectResults = availabilityState.redirectResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  availabilityState.redirectedCount = availabilityState.redirectResults.length
  managerState.redirectCache.results = managerState.redirectCache.results.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  managerState.selectedRedirectIds = new Set(
    [...managerState.selectedRedirectIds].filter((id) => !removedIdSet.has(String(id)))
  )
}

export function renderRedirectSection(callbacks) {
  const redirectSection = getRedirectSectionState(callbacks)
  const redirectResults = redirectSection.results

  syncSelectionSet(
    managerState.selectedRedirectIds,
    new Set(redirectResults.map((result) => String(result.id)))
  )

  publishRedirectControls({
    count: redirectResults.length,
    locked: isInteractionLocked(),
    selectedCount: managerState.selectedRedirectIds.size,
    subtitle: getRedirectResultsSubtitle(redirectSection, redirectResults.length)
  })

  if (!redirectResults.length) {
    const emptyMessage = availabilityState.lastCompletedAt
      ? '最近一次检测没有待更新重定向。'
      : redirectSection.useCachedResults && redirectSection.savedAt
        ? '当前没有可更新的缓存结果。'
        : '完成检测后显示待更新重定向。'
    publishRedirectResults({
      emptyMessage,
      locked: isInteractionLocked(),
      results: [],
      selectedIds: managerState.selectedRedirectIds
    })
    renderRedirectPagination(0)
    return
  }

  const pageResults = getRedirectPageResults(redirectResults)
  publishRedirectResults({
    emptyMessage: '',
    locked: isInteractionLocked(),
    results: pageResults,
    selectedIds: managerState.selectedRedirectIds
  })
  renderRedirectPagination(redirectResults.length)
}

function getRedirectResultsSubtitle(redirectSection, resultCount): string {
  if (redirectSection.useCachedResults && redirectSection.savedAt && resultCount) {
    return `缓存结果 · ${redirectSection.scope.label} · ${formatDateTime(redirectSection.savedAt)}`
  }
  if (redirectSection.useCachedResults) {
    return '完成检测后显示原地址与最终地址不同的结果。'
  }
  return '本次会话的重定向结果。'
}

export function toggleRedirectResultSelection(bookmarkId, checked, callbacks) {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (isInteractionLocked() || !normalizedBookmarkId) {
    return
  }

  if (checked === true) {
    managerState.selectedRedirectIds.add(normalizedBookmarkId)
  } else if (checked === false) {
    managerState.selectedRedirectIds.delete(normalizedBookmarkId)
  } else if (managerState.selectedRedirectIds.has(normalizedBookmarkId)) {
    managerState.selectedRedirectIds.delete(normalizedBookmarkId)
  } else {
    managerState.selectedRedirectIds.add(normalizedBookmarkId)
  }
  callbacks.renderAvailabilitySection()
}

export function updateRedirectResult(bookmarkId, callbacks) {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (isInteractionLocked()) {
    return
  }

  const bookmarkIdValue = normalizedBookmarkId
  if (!bookmarkIdValue) {
    return
  }

  updateRedirectEntries([bookmarkIdValue], callbacks)
}

export function clearRedirectSelection(callbacks) {
  managerState.selectedRedirectIds.clear()
  callbacks.renderAvailabilitySection()
}

export function selectAllRedirects(callbacks) {
  const { results } = getRedirectSectionState(callbacks)
  managerState.redirectResultsPage = 1
  managerState.selectedRedirectIds = new Set(
    results.map((result) => String(result.id))
  )
  callbacks.renderAvailabilitySection()
}

export async function updateSelectedRedirects(callbacks) {
  if (isInteractionLocked() || !managerState.selectedRedirectIds.size) {
    return
  }

  const selectedIds = [...managerState.selectedRedirectIds]
  const redirectSection = getRedirectSectionState(callbacks)
  const targetResults = redirectSection.results.filter((result) => {
    return selectedIds.includes(String(result.id))
  })
  if (!targetResults.length) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `更新 ${targetResults.length} 条重定向书签 URL？`,
        copy: `会把这些书签的原地址替换为最终地址：${formatRedirectImpactList(targetResults)}。书签标题和所在文件夹不变。`,
        confirmLabel: `更新 ${targetResults.length} 条 URL`,
        label: '更新 URL',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  await updateRedirectEntries(selectedIds, callbacks)
  clearRedirectSelection(callbacks)
}

export async function deleteSelectedRedirects(callbacks) {
  if (isInteractionLocked() || !managerState.selectedRedirectIds.size) {
    return
  }

  const selectedIds = [...managerState.selectedRedirectIds]
  const targetResults = getRedirectSectionState(callbacks).results.filter((result) => {
    return selectedIds.includes(String(result.id))
  })
  const deleteCandidates = targetResults.map((result) => ({
    id: String(result.id),
    expectedUrl: String(result.url || '')
  }))
  if (!deleteCandidates.length) {
    return
  }
  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `删除 ${deleteCandidates.length} 条重定向书签？`,
        copy: '这些书签会从 Chrome 书签中移除并进入回收站。重定向缓存中的对应结果也会被清理。',
        confirmLabel: '删除并移入回收站',
        label: '移入回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(deleteCandidates, '重定向书签批量删除', callbacks.recycleCallbacks)
  clearRedirectSelection(callbacks)
}

export async function deleteAllRedirects(callbacks) {
  const { results } = getRedirectSectionState(callbacks)
  if (isInteractionLocked() || !results.length) {
    return
  }

  const deleteCandidates = results.map((result) => ({
    id: String(result.id),
    expectedUrl: String(result.url || '')
  }))
  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `删除本区全部 ${deleteCandidates.length} 条重定向书签？`,
        copy: '这些书签会从 Chrome 书签中移除并进入回收站。此操作只影响当前重定向更新区。',
        confirmLabel: '删除本区并移入回收站',
        label: '移入回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(deleteCandidates, '重定向书签整区删除', callbacks.recycleCallbacks)
  clearRedirectSelection(callbacks)
}

async function updateRedirectEntries(bookmarkIds, callbacks) {
  const releaseMutationLock = await callbacks.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }
  const redirectSection = getRedirectSectionState(callbacks)
  const targetResults = redirectSection.results.filter((result) => {
    return bookmarkIds.includes(String(result.id))
  })

  if (!targetResults.length) {
    releaseMutationLock()
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const updatedIds = []
  const skippedEntries = []
  let updateError = null
  const reconciliationWarnings = []

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'redirect-url-update',
      source: 'options',
      reason: `批量更新 ${targetResults.length} 条重定向 URL`,
      targetBookmarkIds: targetResults.map((result) => String(result.id)),
      estimatedChangeCount: targetResults.length
    })
    await updateRedirectResultsSequentially(targetResults, skippedEntries, updatedIds)
  } catch (error) {
    updateError = error
  } finally {
    if (updatedIds.length) {
      removeRedirectIdsFromState(updatedIds)
      try {
        await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      } catch (error) {
        reconciliationWarnings.push(
          error instanceof Error ? `目录刷新失败：${error.message}` : '目录刷新失败'
        )
      }
      try {
        await saveRedirectCache()
      } catch (error) {
        reconciliationWarnings.push(
          error instanceof Error ? `缓存保存失败：${error.message}` : '缓存保存失败'
        )
      }
    }

    try {
      if (updateError) {
        availabilityState.lastError =
          updateError instanceof Error
            ? `批量更新重定向过程中断，已更新 ${updatedIds.length} 条：${updateError.message}`
            : `批量更新重定向过程中断，已更新 ${updatedIds.length} 条。`
      } else if (updatedIds.length) {
        const skippedCopy = skippedEntries.length
          ? ` ${skippedEntries.length} 条因当前 URL 与检测时原 URL 不一致或书签已不存在而跳过。`
          : ''
        availabilityState.lastError = `已将 ${updatedIds.length} 条重定向书签更新为最终 URL。${skippedCopy}`.trim()
      } else if (skippedEntries.length) {
        availabilityState.lastError = `${skippedEntries.length} 条重定向结果已跳过：${skippedEntries[0].reason}`
      }

      if (reconciliationWarnings.length) {
        availabilityState.lastError = `${availabilityState.lastError || `已更新 ${updatedIds.length} 条书签。`} 但本地状态同步未完全成功：${reconciliationWarnings.join('；')}。`
      }
    } finally {
      availabilityState.deleting = false
      releaseMutationLock()
      callbacks.renderAvailabilitySection()
    }
  }
}

function updateRedirectResultsSequentially(targetResults, skippedEntries, updatedIds) {
  return targetResults.reduce((chain, result) => {
    return chain.then(async () => {
      const finalUrl = String(result.finalUrl || '').trim()
      if (!finalUrl || !isRedirectedNavigation(result.url, finalUrl)) {
        skippedEntries.push({
          id: result.id,
          reason: '最终 URL 已不再构成有效重定向。'
        })
        return
      }

      const latestBookmark = await getBookmarkById(String(result.id))
      if (!latestBookmark?.url) {
        skippedEntries.push({
          id: result.id,
          reason: '书签已不存在。'
        })
        return
      }

      if (String(latestBookmark.url) !== String(result.url || '')) {
        skippedEntries.push({
          id: result.id,
          reason: `当前 URL 已变更为 ${displayUrl(latestBookmark.url)}。`
        })
        return
      }

      await updateBookmark(result.id, { url: finalUrl })
      updatedIds.push(result.id)
    })
  }, Promise.resolve())
}

function getRedirectPageResults(results) {
  const page = getRedirectPage(results.length)
  const start = (page - 1) * REDIRECT_RESULTS_PAGE_SIZE
  return results.slice(start, start + REDIRECT_RESULTS_PAGE_SIZE)
}

function getRedirectPage(totalCount) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / REDIRECT_RESULTS_PAGE_SIZE))
  const page = Math.min(Math.max(1, Number(managerState.redirectResultsPage) || 1), totalPages)
  managerState.redirectResultsPage = page
  return page
}

function renderRedirectPagination(totalCount) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / REDIRECT_RESULTS_PAGE_SIZE))
  const page = getRedirectPage(totalCount)
  const start = totalCount ? (page - 1) * REDIRECT_RESULTS_PAGE_SIZE + 1 : 0
  const end = Math.min(totalCount, page * REDIRECT_RESULTS_PAGE_SIZE)

  publishResultsPagination('redirects', {
    end,
    kind: 'redirects',
    label: '重定向结果',
    page,
    start,
    totalCount,
    totalPages,
    visible: totalPages > 1
  })
}

function formatRedirectImpactList(results) {
  const names = results.slice(0, 3).map((result) => {
    return result.title || displayUrl(result.url) || result.id
  })
  const remaining = Math.max(0, results.length - names.length)
  return remaining ? `${names.join('、')} 等 ${results.length} 条` : names.join('、')
}
