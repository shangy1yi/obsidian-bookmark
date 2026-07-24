import { displayUrl } from '../../shared/text.js'
import { getEffectiveBookmarkTags } from '../../shared/bookmark-tags.js'
import { availabilityState, aiNamingState, contentSnapshotState, managerState } from '../shared-options/state.js'
import {
  isInteractionLocked,
  compareByPathTitle,
  syncSelectionSet
} from '../shared-options/utils.js'
import { deleteBookmarksToRecycle } from './recycle.js'
import { publishDuplicateControls } from '../components/duplicate-controls-store.js'
import { publishDuplicateGroups } from '../components/duplicate-groups-store.js'

const DUPLICATE_STRATEGY_LABELS = {
  recommended: '按推荐选择',
  newest: '保留最新',
  oldest: '保留最早',
  'shorter-path': '保留路径最短',
  tagged: '保留有标签',
  'newtab-source': '保留新标签页来源',
  recent: '保留最近访问',
  'scope-or-shorter': '保留当前范围',
  folder: '保留指定文件夹'
}

export interface BuildDuplicateGroupsOptions {
  excludedFolderIds?: Iterable<string>
}

export function buildDuplicateGroups(bookmarks, options: BuildDuplicateGroupsOptions = {}) {
  const groupMap = new Map()
  const excludedFolderIds = new Set(
    [...(options.excludedFolderIds || [])].flatMap(folderId => { const mappedResult = String(folderId || '').trim(); return mappedResult ? [mappedResult] : [] })
  )

  for (const bookmark of bookmarks) {
    if (!bookmark?.url) {
      continue
    }

    if (isBookmarkInExcludedFolder(bookmark, excludedFolderIds)) {
      continue
    }

    const duplicateKey = String(bookmark.duplicateKey || '').trim()
    if (!duplicateKey) {
      continue
    }

    if (!groupMap.has(duplicateKey)) {
      groupMap.set(duplicateKey, [])
    }

    groupMap.get(duplicateKey).push(bookmark)
  }

  return [...groupMap.entries()].flatMap((combineValue, combineIndex, combineArray) => { if (!(([, items]) => items.length > 1)(combineValue)) return []; const combinedResult = (([key, items]) => buildDuplicateGroupModel(key, items))(combineValue); return [combinedResult] })
    .sort((left, right) => {
      return (
        right.riskWeight - left.riskWeight ||
        right.items.length - left.items.length ||
        left.displayUrl.localeCompare(right.displayUrl, 'zh-CN')
      )
    })
}

function isBookmarkInExcludedFolder(bookmark, excludedFolderIds: Set<string>): boolean {
  if (!excludedFolderIds.size) {
    return false
  }

  const parentId = String(bookmark.parentId || '').trim()
  if (parentId && excludedFolderIds.has(parentId)) {
    return true
  }

  const ancestorIds = Array.isArray(bookmark.ancestorIds) ? bookmark.ancestorIds : []
  return ancestorIds.some((folderId) => excludedFolderIds.has(String(folderId || '').trim()))
}

function buildDuplicateGroupModel(key, items) {
  const sortedItems = items.slice().sort(compareDuplicateItemsByNewest)
  const rankedItems = rankDuplicateGroupItems(sortedItems)
  const folders = collectDuplicateFolders(sortedItems)
  const isCrossFolder = folders.length > 1
  const titleKeys = new Set(sortedItems.map((item) => normalizeDuplicateTitle(item.title)))
  const hasTitleVariants = titleKeys.size > 1
  const recommendation = buildDuplicateRecommendation({
    latestItem: rankedItems.latestItem,
    oldestItem: rankedItems.oldestItem,
    shorterPathItem: rankedItems.shorterPathItem,
    fullerTitleItem: rankedItems.fullerTitleItem,
    taggedItem: rankedItems.taggedItem,
    newTabSourceItem: rankedItems.newTabSourceItem,
    recentItem: rankedItems.recentItem,
    isCrossFolder,
    hasTitleVariants
  })

  return {
    id: `duplicate-${hashDuplicateKey(key)}`,
    key,
    displayUrl: displayUrl(sortedItems[0].url),
    items: sortedItems,
    folders,
    isCrossFolder,
    hasTitleVariants,
    risk: isCrossFolder || hasTitleVariants ? 'high' : 'low',
    riskWeight: (isCrossFolder ? 2 : 0) + (hasTitleVariants ? 1 : 0),
    latestItemId: String(rankedItems.latestItem?.id || ''),
    oldestItemId: String(rankedItems.oldestItem?.id || ''),
    shorterPathItemId: String(rankedItems.shorterPathItem?.id || ''),
    fullerTitleItemId: String(rankedItems.fullerTitleItem?.id || ''),
    taggedItemId: hasDuplicateTagSignal(rankedItems.taggedItem) ? String(rankedItems.taggedItem?.id || '') : '',
    newTabSourceItemId: hasNewTabSourceSignal(rankedItems.newTabSourceItem) ? String(rankedItems.newTabSourceItem?.id || '') : '',
    recentItemId: hasRecentActivitySignal(rankedItems.recentItem) ? String(rankedItems.recentItem?.id || '') : '',
    recommendedKeepId: String(recommendation.item?.id || ''),
    recommendation
  }
}

function rankDuplicateGroupItems(sortedItems) {
  const [firstItem] = sortedItems
  const ranked = {
    latestItem: firstItem || null,
    oldestItem: firstItem || null,
    shorterPathItem: firstItem || null,
    fullerTitleItem: firstItem || null,
    taggedItem: firstItem || null,
    newTabSourceItem: firstItem || null,
    recentItem: firstItem || null
  }

  for (const item of sortedItems) {
    if (compareDuplicateItemsByOldest(item, ranked.oldestItem) < 0) {
      ranked.oldestItem = item
    }
    if (compareDuplicateItemsByShorterPath(item, ranked.shorterPathItem) < 0) {
      ranked.shorterPathItem = item
    }
    if (compareDuplicateItemsByFullerTitle(item, ranked.fullerTitleItem) < 0) {
      ranked.fullerTitleItem = item
    }
    if (compareDuplicateItemsByTagSignal(item, ranked.taggedItem) < 0) {
      ranked.taggedItem = item
    }
    if (compareDuplicateItemsByNewTabSource(item, ranked.newTabSourceItem) < 0) {
      ranked.newTabSourceItem = item
    }
    if (compareDuplicateItemsByRecentActivity(item, ranked.recentItem) < 0) {
      ranked.recentItem = item
    }
  }

  return ranked
}

function collectDuplicateFolders(items) {
  const seenFolders = new Set()
  const folders = []

  for (const item of items) {
    const folderId = String(item.parentId || '')
    if (seenFolders.has(folderId)) {
      continue
    }

    seenFolders.add(folderId)
    folders.push({
      id: folderId,
      title: availabilityState.folderMap.get(folderId)?.title || item.path || '文件夹',
      path: availabilityState.folderMap.get(folderId)?.path || item.path || '未归档路径'
    })
  }

  return folders.sort((left, right) => {
    return String(left.path || left.title).localeCompare(String(right.path || right.title), 'zh-CN')
  })
}

function buildDuplicateRecommendation({
  latestItem,
  oldestItem,
  shorterPathItem,
  fullerTitleItem,
  taggedItem,
  newTabSourceItem,
  recentItem,
  isCrossFolder,
  hasTitleVariants
}) {
  if (hasDuplicateTagSignal(taggedItem)) {
    const tagReason = getDuplicateTagRecommendationReason(taggedItem)
    return {
      kind: tagReason.kind,
      label: tagReason.label,
      item: taggedItem,
      reason: tagReason.reason
    }
  }

  if (hasNewTabSourceSignal(newTabSourceItem)) {
    return {
      kind: 'newtab-source',
      label: '新标签页来源',
      item: newTabSourceItem,
      reason: '该副本位于新标签页展示来源中，优先保留可避免破坏新标签页入口。'
    }
  }

  if (hasRecentActivitySignal(recentItem)) {
    return {
      kind: 'recent',
      label: '最近访问',
      item: recentItem,
      reason: '该副本最近在新标签页打开过，优先保留仍在使用的副本。'
    }
  }

  if (hasTitleVariants && fullerTitleItem) {
    return {
      kind: 'fuller-title',
      label: '标题更完整',
      item: fullerTitleItem,
      reason: '同一 URL 存在不同标题，优先保留标题信息更完整的副本。'
    }
  }

  if (isCrossFolder && shorterPathItem) {
    return {
      kind: 'shorter-path',
      label: '路径更短',
      item: shorterPathItem,
      reason: '跨文件夹重复，优先保留路径更短、层级更清晰的副本。'
    }
  }

  return {
    kind: 'latest',
    label: '最新',
    item: latestItem || oldestItem,
    reason: '没有更强的使用信号时，默认保留最近添加的副本。'
  }
}

export function renderDuplicateSection() {
  const validIds = new Set(
    managerState.duplicateGroups.flatMap((group) => group.items.map((item) => String(item.id)))
  )
  syncSelectionSet(managerState.selectedDuplicateIds, validIds)

  const summary = getDuplicateSummary()
  const selectionStats = getDuplicateSelectionStats()
  const visibleGroups = managerState.duplicateGroups

  const controlsState = buildDuplicateControlsState(summary, selectionStats, visibleGroups)
  publishDuplicateControls(controlsState)

  publishDuplicateGroups({
    catalogLoading: availabilityState.catalogLoading,
    currentScopeFolderId: String(availabilityState.scopeFolderId || ''),
    groups: visibleGroups,
    locked: isInteractionLocked(),
    selectedIds: managerState.selectedDuplicateIds,
    selectionStats,
    tagBadgeLabels: buildDuplicateTagBadgeLabels(visibleGroups)
  })
}

function buildDuplicateControlsState(summary, selectionStats, visibleGroups) {
  const candidateCount = visibleGroups.reduce((count, group) => count + Math.max(0, group.items.length - 1), 0)

  return {
    groupCountLabel: `${managerState.duplicateGroups.length} 组重复`,
    locked: isInteractionLocked(),
    resultCount: visibleGroups.length,
    resultsSubtitle: selectionStats.deleteCount > 0
      ? `已选 ${selectionStats.deleteCount} 条，可继续调整。`
      : `${visibleGroups.length} 组重复，建议清理 ${candidateCount} 条。`,
    selectionStats,
    strategyStatus: managerState.duplicateStrategyStatus || '先选择副本，再确认处理。',
    summary
  }
}

export function toggleDuplicateItemSelection(bookmarkId, checked, callbacks) {
  const normalizedBookmarkId = String(bookmarkId || '').trim()
  if (isInteractionLocked() || !normalizedBookmarkId) {
    return
  }

  if (checked === true) {
    managerState.selectedDuplicateIds.add(normalizedBookmarkId)
  } else if (checked === false) {
    managerState.selectedDuplicateIds.delete(normalizedBookmarkId)
  } else if (managerState.selectedDuplicateIds.has(normalizedBookmarkId)) {
    managerState.selectedDuplicateIds.delete(normalizedBookmarkId)
  } else {
    managerState.selectedDuplicateIds.add(normalizedBookmarkId)
  }
  managerState.duplicateStrategyStatus = '已手动调整选择。'
  callbacks.renderAvailabilitySection()
}

export function applyDuplicateGroupStrategy(groupId, strategy, callbacks) {
  if (isInteractionLocked()) {
    return
  }

  const normalizedStrategy = normalizeDuplicateStrategy(strategy)
  const result = selectDuplicateGroupByStrategy(String(groupId || '').trim(), normalizedStrategy)
  setDuplicateStrategyStatus(result, DUPLICATE_STRATEGY_LABELS[normalizedStrategy])
  callbacks.renderAvailabilitySection()
}

export function applyDuplicateStrategy(strategy, callbacks) {
  if (isInteractionLocked()) {
    return
  }

  const normalizedStrategy = normalizeDuplicateStrategy(strategy)
  const result = selectDuplicateGroupsByStrategy(normalizedStrategy, managerState.duplicateGroups)
  setDuplicateStrategyStatus(result, DUPLICATE_STRATEGY_LABELS[normalizedStrategy])
  callbacks.renderAvailabilitySection()
}

export function clearDuplicateSelection(callbacks) {
  managerState.selectedDuplicateIds.clear()
  managerState.duplicateStrategyStatus = ''
  callbacks.renderAvailabilitySection()
}

export async function deleteSelectedDuplicates(callbacks) {
  const selectionStats = getDuplicateSelectionStats()
  if (isInteractionLocked() || !selectionStats.deleteCount) {
    return
  }

  if (selectionStats.unsafeGroupCount > 0) {
    availabilityState.lastError = '重复书签回收已拦截：每组至少需要保留 1 条。'
    callbacks.renderAvailabilitySection()
    return
  }

  const targetIds = getSelectedDuplicateIds()
  const deleteCandidates = targetIds.flatMap((bookmarkId) => {
    const item = getDuplicateItemById(bookmarkId)
    return item?.url
      ? [{
          id: String(item.id),
          expectedUrl: String(item.url)
        }]
      : []
  })
  if (!deleteCandidates.length) {
    return
  }
  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `移入回收站 ${deleteCandidates.length} 条重复书签？`,
        copy: `这些重复项会从 Chrome 书签中移除并进入扩展回收站；本次会保留 ${selectionStats.keepCount} 条。`,
        confirmLabel: '移入回收站',
        label: '移入回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(
    deleteCandidates,
    `重复书签批量清理：移入回收站 ${deleteCandidates.length} 条，保留 ${selectionStats.keepCount} 条`,
    callbacks.recycleCallbacks
  )
  clearDuplicateSelection(callbacks)
}

function getDuplicateSummary() {
  const groups = managerState.duplicateGroups
  const selectionStats = getDuplicateSelectionStats(groups)

  return {
    totalGroups: groups.length,
    deleteCandidates: groups.reduce((count, group) => count + Math.max(0, group.items.length - 1), 0),
    crossFolderGroups: groups.filter((group) => group.isCrossFolder).length,
    sameFolderGroups: groups.filter((group) => !group.isCrossFolder).length,
    titleVariantGroups: groups.filter((group) => group.hasTitleVariants).length,
    highRiskGroups: groups.filter((group) => group.risk === 'high').length,
    lowRiskGroups: groups.filter((group) => group.risk === 'low').length,
    selectedItems: selectionStats.deleteCount
  }
}

function getDuplicateSelectionStats(groups = managerState.duplicateGroups) {
  let deleteCount = 0
  let keepCount = 0
  let groupCount = 0
  let unsafeGroupCount = 0

  for (const group of groups) {
    const selectedInGroup = group.items.filter((item) => {
      return managerState.selectedDuplicateIds.has(String(item.id))
    }).length

    if (!selectedInGroup) {
      continue
    }

    const keptInGroup = group.items.length - selectedInGroup
    groupCount += 1
    deleteCount += selectedInGroup
    keepCount += Math.max(0, keptInGroup)

    if (keptInGroup <= 0) {
      unsafeGroupCount += 1
    }
  }

  return {
    deleteCount,
    keepCount,
    groupCount,
    unsafeGroupCount
  }
}

function buildDuplicateTagBadgeLabels(groups) {
  const labels = {}
  for (const group of groups) {
    for (const item of group.items || []) {
      if (String(item.id) === String(group.taggedItemId)) {
        labels[String(item.id)] = getDuplicateTagBadgeLabel(item)
      }
    }
  }
  return labels
}

function selectDuplicateGroupsByStrategy(strategy, groups) {
  const result = {
    groupCount: 0,
    deleteCount: 0,
    keepCount: 0
  }

  for (const group of groups) {
    const groupResult = selectDuplicateGroupByStrategy(group.id, strategy)
    if (!groupResult.groupCount) {
      continue
    }

    result.groupCount += groupResult.groupCount
    result.deleteCount += groupResult.deleteCount
    result.keepCount += groupResult.keepCount
  }

  return result
}

function selectDuplicateGroupByStrategy(groupId, strategy) {
  const group = managerState.duplicateGroups.find((entry) => entry.id === groupId)
  if (!group || group.items.length <= 1) {
    return { groupCount: 0, deleteCount: 0, keepCount: 0 }
  }

  const keepItem = getDuplicateKeepItem(group, strategy)
  return selectDuplicateGroupKeepItem(group, keepItem)
}

function selectDuplicateGroupKeepItem(group, keepItem) {
  const keepId = String(keepItem?.id || '')
  if (!keepId) {
    return { groupCount: 0, deleteCount: 0, keepCount: 0 }
  }

  for (const item of group.items) {
    managerState.selectedDuplicateIds.delete(String(item.id))
  }

  let deleteCount = 0
  for (const item of group.items) {
    const itemId = String(item.id)
    if (itemId === keepId) {
      continue
    }

    managerState.selectedDuplicateIds.add(itemId)
    deleteCount += 1
  }

  return {
    groupCount: 1,
    deleteCount,
    keepCount: Math.max(0, group.items.length - deleteCount)
  }
}

function getDuplicateKeepItem(group, strategy) {
  const normalizedStrategy = normalizeDuplicateStrategy(strategy)

  if (normalizedStrategy === 'newest') {
    return getDuplicateGroupItem(group, group.latestItemId) || group.items[0]
  }

  if (normalizedStrategy === 'oldest') {
    return getDuplicateGroupItem(group, group.oldestItemId) || group.items[group.items.length - 1]
  }

  if (normalizedStrategy === 'shorter-path') {
    return getDuplicateGroupItem(group, group.shorterPathItemId) || group.items[0]
  }

  if (normalizedStrategy === 'tagged') {
    return getDuplicateGroupItem(group, group.taggedItemId) ||
      getDuplicateGroupItem(group, group.recommendedKeepId) ||
      group.items[0]
  }

  if (normalizedStrategy === 'newtab-source') {
    return getDuplicateGroupItem(group, group.newTabSourceItemId) ||
      getDuplicateGroupItem(group, group.recommendedKeepId) ||
      group.items[0]
  }

  if (normalizedStrategy === 'recent') {
    return getDuplicateGroupItem(group, group.recentItemId) ||
      getDuplicateGroupItem(group, group.recommendedKeepId) ||
      group.items[0]
  }

  if (normalizedStrategy === 'scope-or-shorter') {
    const scopeItem = getCurrentScopeDuplicateItem(group)
    if (scopeItem) {
      return scopeItem
    }

    return getDuplicateGroupItem(group, group.shorterPathItemId) || group.items[0]
  }

  return getDuplicateGroupItem(group, group.recommendedKeepId) || group.items[0]
}

function getCurrentScopeDuplicateItem(group) {
  const scopedItems = group.items
    .filter((item) => isBookmarkInCurrentDuplicateScope(item))
    .sort(compareDuplicateItemsByNewest)

  return scopedItems[0] || null
}

function getDuplicateGroupItem(group, bookmarkId) {
  const normalizedId = String(bookmarkId || '')
  return group.items.find((item) => String(item.id) === normalizedId) || null
}

function setDuplicateStrategyStatus(result, strategyLabel) {
  if (!result.groupCount) {
    managerState.duplicateStrategyStatus = '当前范围没有可应用的重复分组。'
    return
  }

  managerState.duplicateStrategyStatus =
    `${strategyLabel}：已选择 ${result.deleteCount} 条待移入回收站，保留 ${result.keepCount} 条。`
}

function getSelectedDuplicateIds() {
  const ids = []
  const seen = new Set()

  for (const group of managerState.duplicateGroups) {
    for (const item of group.items) {
      const itemId = String(item.id)
      if (!managerState.selectedDuplicateIds.has(itemId) || seen.has(itemId)) {
        continue
      }

      ids.push(itemId)
      seen.add(itemId)
    }
  }

  return ids
}

function getDuplicateItemById(bookmarkId) {
  const normalizedId = String(bookmarkId || '')
  for (const group of managerState.duplicateGroups) {
    const item = group.items.find((candidate) => String(candidate.id) === normalizedId)
    if (item) {
      return item
    }
  }
  return null
}

function normalizeDuplicateStrategy(strategy) {
  const normalized = String(strategy || 'recommended').trim()
  return Object.prototype.hasOwnProperty.call(DUPLICATE_STRATEGY_LABELS, normalized)
    ? normalized
    : 'recommended'
}

function compareDuplicateItemsByNewest(left, right) {
  return (
    (Number(right.dateAdded) || 0) - (Number(left.dateAdded) || 0) ||
    compareByPathTitle(left, right)
  )
}

function compareDuplicateItemsByOldest(left, right) {
  return (
    (Number(left.dateAdded) || 0) - (Number(right.dateAdded) || 0) ||
    compareByPathTitle(left, right)
  )
}

function compareDuplicateItemsByShorterPath(left, right) {
  return (
    getDuplicatePathDepth(left) - getDuplicatePathDepth(right) ||
    getDuplicatePathLength(left) - getDuplicatePathLength(right) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByFullerTitle(left, right) {
  return (
    getDuplicateTitleScore(right) - getDuplicateTitleScore(left) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByTagSignal(left, right) {
  return (
    getDuplicateTagSignalScore(right) - getDuplicateTagSignalScore(left) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByNewTabSource(left, right) {
  return (
    Number(hasNewTabSourceSignal(right)) - Number(hasNewTabSourceSignal(left)) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function compareDuplicateItemsByRecentActivity(left, right) {
  return (
    getDuplicateLastOpenedAt(right) - getDuplicateLastOpenedAt(left) ||
    compareDuplicateItemsByNewest(left, right)
  )
}

function getDuplicatePathDepth(item) {
  return String(item.path || '')
    .split('/').flatMap(part => { const mappedResult = part.trim(); return mappedResult ? [mappedResult] : [] }).length
}

function getDuplicatePathLength(item) {
  return String(item.path || '').trim().length || Number.MAX_SAFE_INTEGER
}

function getDuplicateTitleScore(item) {
  const title = String(item?.title || '').trim()
  if (!title || /^untitled$/i.test(title) || title === '未命名书签') {
    return 0
  }

  return title.replace(/\s+/g, '').length
}

function normalizeDuplicateTitle(title) {
  const normalized = String(title || '').trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized || '(empty)'
}

function isBookmarkInCurrentDuplicateScope(item) {
  const scopeFolderId = String(availabilityState.scopeFolderId || '').trim()
  if (!scopeFolderId) {
    return false
  }

  const ancestorIds = Array.isArray(item.ancestorIds) ? item.ancestorIds.map((id) => String(id)) : []
  return String(item.parentId || '') === scopeFolderId || ancestorIds.includes(scopeFolderId)
}

function hasDuplicateTagSignal(item) {
  return getDuplicateTagSignalScore(item) > 0
}

function getDuplicateTagSignalScore(item) {
  const bookmarkId = String(item?.id || '')
  if (!bookmarkId) {
    return 0
  }

  const tagRecord = aiNamingState.tagIndex?.records?.[bookmarkId] || null
  const snapshotRecord = contentSnapshotState.index?.records?.[bookmarkId] || null
  let score = 0
  if (tagRecord?.manualTags?.length) {
    score += 60
  }
  if (getEffectiveBookmarkTags(tagRecord).length) {
    score += 32
  }
  if (String(tagRecord?.summary || '').trim()) {
    score += 18
  }
  if (snapshotRecord?.summary || snapshotRecord?.hasFullText) {
    score += 12
  }
  return score
}

function getDuplicateTagRecommendationReason(item) {
  const bookmarkId = String(item?.id || '')
  const tagRecord = aiNamingState.tagIndex?.records?.[bookmarkId] || null
  const snapshotRecord = contentSnapshotState.index?.records?.[bookmarkId] || null
  if (tagRecord?.manualTags?.length) {
    return {
      kind: 'manual-tags',
      label: '有手动标签',
      reason: '该副本带有手动标签，包含人工整理信息，优先保留。'
    }
  }
  if (getEffectiveBookmarkTags(tagRecord).length) {
    return {
      kind: 'ai-tags',
      label: '有标签',
      reason: '该副本已有标签数据，保留后可继续用于智能检索和筛选。'
    }
  }
  if (String(tagRecord?.summary || '').trim() || snapshotRecord?.summary || snapshotRecord?.hasFullText) {
    return {
      kind: 'summary',
      label: '有摘要',
      reason: '该副本已有 AI 摘要或网页内容快照，保留后不会丢失分析上下文。'
    }
  }

  return {
    kind: 'tagged',
    label: '有整理信息',
    reason: '该副本已有整理数据，优先保留。'
  }
}

function getDuplicateTagBadgeLabel(item) {
  return getDuplicateTagRecommendationReason(item).label
}

function hasNewTabSourceSignal(item) {
  return isBookmarkInNewTabSource(item)
}

function isBookmarkInNewTabSource(item) {
  const path = String(item?.path || '')
  const folder = availabilityState.folderMap.get(String(item?.parentId || ''))
  return isNewTabSourcePath(path) || isNewTabSourcePath(folder?.path || folder?.title || '')
}

function isNewTabSourcePath(path) {
  return String(path || '')
    .split('/')
    .map((part) => part.trim())
    .some((part) => part === '标签页')
}

function hasRecentActivitySignal(item) {
  return getDuplicateLastOpenedAt(item) > 0
}

function getDuplicateLastOpenedAt(item) {
  const activity = item && typeof item === 'object'
    ? (item.activity || item.newTabActivity || item.activityRecord)
    : null
  if (activity && typeof activity === 'object') {
    return Number(activity.lastOpenedAt) || 0
  }

  const bookmarkId = String(item?.id || '')
  const activityRecords = (availabilityState as any).newTabActivity?.records ||
    (managerState as any).newTabActivity?.records ||
    null
  if (activityRecords && typeof activityRecords === 'object') {
    return Number(activityRecords[bookmarkId]?.lastOpenedAt) || 0
  }

  return 0
}

function hashDuplicateKey(value) {
  let hash = 0
  const input = String(value || '')
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }

  return Math.abs(hash).toString(36)
}
