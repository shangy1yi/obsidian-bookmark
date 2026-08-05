import type { BookmarkRecord } from '../shared/types.js'
import {
  normalizeSearchTextCompact,
  normalizeText,
  stripCommonUrlPrefix
} from '../shared/text.js'
import { createTopKCollector } from '../shared/search/topk.js'
import { getEffectiveBookmarkTags, type BookmarkTagRecord } from '../shared/bookmark-tags.js'
import {
  buildSearchTextQuery,
  matchesParsedSearchQuery,
  parseSearchQuery,
  type ParsedSearchQuery
} from '../shared/search-query.js'
import { requiresPinyinTokens } from '../shared/search/pinyin-query.js'
import {
  buildContentSnapshotSearchText,
  type ContentSnapshotRecord
} from '../shared/content-snapshot-search.js'

export const MAX_POPUP_SEARCH_RESULTS = 20
export const POPUP_SEARCH_ASYNC_THRESHOLD = 1200
const SEARCH_PREFILTER_THRESHOLD = 1200
const SEARCH_CHUNK_SIZE = 260
const FIRST_BATCH_MAX_SCAN_WITH_RESULTS = 8000
const LOOSE_SUBSEQUENCE_MIN_COMPACT_LENGTH = 5
const RECENT_SORT_TERMS = new Set(['recent', 'new', 'newest', 'latest', '最近', '新近', '最近优先'])

export interface PopupSearchBookmark extends BookmarkRecord {
  normalizedPath: string
  tagSummary: string
  tagContentType: string
  tagTopics: string[]
  tagTags: string[]
  tagAliases: string[]
  tagPinyinFull: string[]
  tagPinyinInitials: string[]
  searchText: string
  searchTextCompact?: string
  pinyinEnriched?: boolean
  pinyinBaseSearchText?: string
}

export interface PopupSearchResult extends PopupSearchBookmark {
  score: number
  matchReasons: string[]
}

export interface CooperativeSearchOptions {
  isActive: () => boolean
  yieldWork?: () => Promise<unknown>
}

interface ParsedPopupSearchQuery extends ParsedSearchQuery {
  normalizedQuery: string
  queryTerms: string[]
  recencyHint: boolean
  hasStructuredFilters: boolean
}

export function indexBookmarkForSearch(
  bookmark: BookmarkRecord,
  tagRecord: BookmarkTagRecord | null = null,
  snapshotRecord: ContentSnapshotRecord | null = null,
  options: { includeFullText?: boolean } = {}
): PopupSearchBookmark {
  const normalizedPath = normalizeText(bookmark.path || '')
  const normalizedDomain = normalizeText(bookmark.domain || '')
  const tagSummary = normalizeText(tagRecord?.summary || '')
  const tagContentType = normalizeText(tagRecord?.contentType || '')
  const tagTopics = normalizeSearchList(tagRecord?.topics)
  const tagTags = normalizeSearchList(getEffectiveBookmarkTags(tagRecord))
  const tagAliases = normalizeSearchList(tagRecord?.aliases)
  const snapshotSearchText = buildContentSnapshotSearchText(snapshotRecord, options)

  const searchText = [
    bookmark.normalizedTitle,
    bookmark.normalizedUrl,
    normalizedPath,
    normalizedDomain,
    tagContentType,
    ...tagTopics,
    ...tagTags,
    ...tagAliases,
    tagSummary,
    snapshotSearchText
  ]
    .filter(Boolean)
    .join(' ')

  return {
    ...bookmark,
    normalizedPath,
    tagSummary,
    tagContentType,
    tagTopics,
    tagTags,
    tagAliases,
    tagPinyinFull: [],
    tagPinyinInitials: [],
    searchText,
    searchTextCompact: normalizeSearchTextCompact(searchText)
  }
}

export function searchBookmarks(
  query: string,
  bookmarks: PopupSearchBookmark[]
): PopupSearchResult[] {
  return searchBookmarksWithLimit(query, bookmarks, MAX_POPUP_SEARCH_RESULTS)
}

export function searchBookmarksUnbounded(
  query: string,
  bookmarks: PopupSearchBookmark[]
): PopupSearchResult[] {
  return searchBookmarksWithLimit(query, bookmarks, 0)
}

export function searchBookmarksTopK(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit: number,
  offset = 0
): PopupSearchResult[] {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0))
  if (!safeLimit) {
    return []
  }

  return searchBookmarksWithLimit(query, bookmarks, safeLimit + safeOffset)
    .slice(safeOffset, safeOffset + safeLimit)
}

export interface PopupSearchFirstBatch {
  results: PopupSearchResult[]
  scanned: number
  complete: boolean
}

export function searchBookmarksFirstBatch(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit = MAX_POPUP_SEARCH_RESULTS
): PopupSearchFirstBatch {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0))
  const parsedQuery = parsePopupSearchQuery(query)
  if (!safeLimit || !canUseFastFirstBatch(parsedQuery)) {
    return { results: [], scanned: 0, complete: false }
  }

  const topResults = createTopKCollector<PopupSearchResult>(safeLimit, compareSearchResults)
  const terms = getCandidateRequiredTerms(parsedQuery).filter(Boolean)
  let scanned = 0

  for (const bookmark of bookmarks) {
    scanned += 1
    if (!matchesFastFirstBatchCandidate(bookmark, parsedQuery, terms)) {
      continue
    }

    const match = scoreFastFirstBatchBookmark(bookmark, parsedQuery, terms)
    if (match.score > 0) {
      topResults.add({
        ...bookmark,
        score: match.score,
        matchReasons: match.reasons
      })
    }

    if (
      topResults.size >= safeLimit &&
      scanned >= FIRST_BATCH_MAX_SCAN_WITH_RESULTS
    ) {
      break
    }
  }

  return {
    results: topResults.sortedValues(),
    scanned,
    complete: scanned >= bookmarks.length
  }
}

function searchBookmarksWithLimit(
  query: string,
  bookmarks: PopupSearchBookmark[],
  limit: number
): PopupSearchResult[] {
  const parsedQuery = parsePopupSearchQuery(query)
  const candidates = getSearchCandidates(bookmarks, parsedQuery)
  const results: PopupSearchResult[] = []
  const bounded = limit > 0
  const topResults = bounded
    ? createTopKCollector<PopupSearchResult>(limit, compareSearchResults)
    : null

  for (const bookmark of candidates) {
    const match = scoreBookmarkWithReasons(bookmark, parsedQuery)
    if (match.score > 0) {
      const result = {
        ...bookmark,
        score: match.score,
        matchReasons: match.reasons
      }
      if (bounded) {
        topResults?.add(result)
      } else {
        results.push(result)
      }
    }
  }

  return topResults ? topResults.sortedValues() : results.sort(compareSearchResults)
}

export async function searchBookmarksCooperatively(
  query: string,
  bookmarks: PopupSearchBookmark[],
  options: CooperativeSearchOptions
): Promise<PopupSearchResult[]> {
  const parsedQuery = parsePopupSearchQuery(query)
  const candidates = await getSearchCandidatesCooperatively(
    bookmarks,
    parsedQuery,
    options
  )
  const results: PopupSearchResult[] = []

  await processSearchChunks(candidates, options, (bookmark) => {
    const match = scoreBookmarkWithReasons(bookmark, parsedQuery)
    if (match.score > 0) {
      appendTopSearchResult(results, {
        ...bookmark,
        score: match.score,
        matchReasons: match.reasons
      })
    }
  })

  return results
}

async function processSearchChunks<T>(
  items: T[],
  options: CooperativeSearchOptions,
  processItem: (item: T, index: number) => void,
  start = 0
): Promise<void> {
  if (start >= items.length) {
    return
  }

  assertSearchActive(options)
  const end = Math.min(start + SEARCH_CHUNK_SIZE, items.length)
  for (let index = start; index < end; index += 1) {
    processItem(items[index], index)
  }

  if (end < items.length) {
    await yieldSearchWork(options)
    await processSearchChunks(items, options, processItem, end)
  }
}

export function getQueryTerms(query: string): string[] {
  return [...new Set(String(query || '').split(/\s+/).filter(Boolean))]
}

export function normalizeQuery(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
}

function parsePopupSearchQuery(query: string): ParsedPopupSearchQuery {
  const parsed = parseSearchQuery(query)
  const excludedTerms = parsed.excludedTerms
  const recencyHint = parsed.textTerms.some(isRecencyHintTerm)
  const textTerms = parsed.textTerms.filter((term) => !isRecencyHintTerm(term))
  const normalizedQuery = buildSearchTextQuery({ ...parsed, textTerms, excludedTerms })
  return {
    ...parsed,
    textTerms,
    excludedTerms,
    normalizedQuery,
    queryTerms: getQueryTerms(normalizedQuery),
    recencyHint,
    hasStructuredFilters: Boolean(
      parsed.siteFilters.length ||
      parsed.folderFilters.length ||
      parsed.typeFilters.length ||
      excludedTerms.length ||
      parsed.dateRange
    )
  }
}

function isRecencyHintTerm(term: string): boolean {
  const normalized = normalizeText(term).replace(/^sort[:：]/, '')
  return RECENT_SORT_TERMS.has(normalized)
}

function scoreBookmarkWithReasons(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): { score: number; reasons: string[] } {
  const { normalizedQuery, queryTerms } = parsedQuery
  const title = bookmark.normalizedTitle
  const url = bookmark.normalizedUrl
  const domain = normalizeText(bookmark.domain || '')
  const searchText = getBookmarkSearchText(bookmark)
  const compactSearchText = getCompactSearchText(bookmark)
  const compactQuery = normalizeSearchTextCompact(normalizedQuery)
  let score = 0
  let matched = false
  const reasons: string[] = []
  let strongMatch = false

  if (!matchesStructuredFilters(bookmark, parsedQuery, reasons)) {
    return { score: 0, reasons: [] }
  }

  if (!matchesRequiredPhraseTerms(bookmark, parsedQuery)) {
    return { score: 0, reasons: [] }
  }

  if (!normalizedQuery && !parsedQuery.hasStructuredFilters && !parsedQuery.recencyHint) {
    return { score: 0, reasons: [] }
  }

  if (parsedQuery.hasStructuredFilters) {
    score += 90
    matched = true
  }

  if (normalizedQuery && title === normalizedQuery) {
    score += 620
    matched = true
    strongMatch = true
    addReason(reasons, `命中：标题 ${bookmark.title}`)
  }

  if (normalizedQuery && title.startsWith(normalizedQuery)) {
    score += 420
    matched = true
    strongMatch = true
    addReason(reasons, `命中：标题前缀 ${normalizedQuery}`)
  }

  const titleIndex = normalizedQuery ? title.indexOf(normalizedQuery) : -1
  if (titleIndex !== -1) {
    score += 300 + getBoundaryMatchBonus(title, titleIndex, normalizedQuery.length, 46) - Math.min(titleIndex, 120)
    matched = true
    strongMatch = true
    addReason(reasons, `命中：标题 ${normalizedQuery}`)
  }

  const compactFieldMatch = scoreCompactFieldMatch(bookmark, compactQuery, normalizedQuery, reasons)
  if (compactFieldMatch.score > 0) {
    score += compactFieldMatch.score
    matched = true
    strongMatch = true
  }

  if (normalizedQuery) {
    const domainMatch = scoreDomainQueryMatch(domain, normalizedQuery)
    if (domainMatch > 0) {
      score += domainMatch
      matched = true
      strongMatch = true
      addReason(reasons, `命中：站点 ${domain || normalizedQuery}`)
    }
  }

  if (normalizedQuery && url.startsWith(normalizedQuery)) {
    score += 250
    matched = true
    strongMatch = true
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  }

  const urlIndex = normalizedQuery ? getBestSearchIndex(url, domain, normalizedQuery) : -1
  if (urlIndex !== -1) {
    score += 190 - Math.min(urlIndex, 100)
    matched = true
    strongMatch = true
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  }

  if (normalizedQuery || queryTerms.length) {
    const semanticMatch = scoreSemanticFields(bookmark, normalizedQuery, queryTerms, reasons)
    if (semanticMatch.score > 0) {
      score += semanticMatch.score
      matched = true
    }
  }

  let allTermsPresent = queryTerms.length > 0
  const unmatchedTerms: string[] = []

  for (const term of queryTerms) {
    let termMatched = false
    const termTitleIndex = getTextSearchIndex(title, term)
    const termUrlIndex = getBestSearchIndex(url, domain, term)

    if (termTitleIndex !== -1) {
      score += 72 + getBoundaryMatchBonus(title, termTitleIndex, term.length, 22) - Math.min(termTitleIndex, 40)
      termMatched = true
      matched = true
      strongMatch = true
      addReason(reasons, `命中：标题 ${term}`)
    }

    const domainTermMatch = scoreDomainTermMatch(domain, term)
    if (domainTermMatch > 0) {
      score += domainTermMatch
      termMatched = true
      matched = true
      strongMatch = true
      addReason(reasons, `命中：站点 ${domain || term}`)
    }

    if (termUrlIndex !== -1) {
      score += (domainTermMatch > 0 ? 22 : 45) - Math.min(termUrlIndex, 40)
      termMatched = true
      matched = true
      strongMatch = true
      addReason(reasons, `命中：网址 ${term}`)
    }

    if (
      !termMatched &&
      termMatchedSemanticField(bookmark, term)
    ) {
      termMatched = true
    }

    if (
      !termMatched &&
      searchText.includes(term)
    ) {
      score += 16
      termMatched = true
      matched = true
      addReason(reasons, `命中：网页内容 ${term}`)
    }

    if (!termMatched) {
      allTermsPresent = false
      unmatchedTerms.push(term)
    }
  }

  let approximateMatch = { score: 0, matchedCount: 0 }
  if (unmatchedTerms.length) {
    approximateMatch = scoreLatinApproximateTerms(bookmark, unmatchedTerms, reasons)
  }

  allTermsPresent = queryTerms.length === 0 || unmatchedTerms.length === approximateMatch.matchedCount

  if (queryTerms.length > 1 && !allTermsPresent) {
    return { score: 0, reasons: [] }
  }

  if (approximateMatch.score > 0) {
    score += strongMatch ? Math.round(approximateMatch.score * 0.7) : approximateMatch.score
    matched = true
  }

  if (allTermsPresent && queryTerms.length > 1) {
    score += 120 + scoreOrderedTermProximity(title, queryTerms) + scoreOrderedTermProximity(domain, queryTerms)
    insertReason(reasons, buildQueryCoverageReason(queryTerms), 1)
  }

  if (!matched && canUseLooseSubsequenceMatch(parsedQuery)) {
    const titleFuzzy = subsequenceScore(title, normalizedQuery)
    const urlFuzzy = subsequenceScore(url, normalizedQuery)
    const fuzzyScore = Math.max(titleFuzzy * 2, urlFuzzy)

    if (fuzzyScore > 0) {
      score += fuzzyScore
      matched = true
      addReason(reasons, `命中：模糊匹配 ${normalizedQuery}`)
    }
  }

  if (!strongMatch && compactQuery && canUseLooseSubsequenceMatch(parsedQuery)) {
    const compactFuzzyScore = Math.max(
      subsequenceScore(compactSearchText, compactQuery) * 2,
      subsequenceScore(normalizeSearchTextCompact(url), compactQuery)
    )
    if (compactFuzzyScore > 0) {
      score += Math.round(compactFuzzyScore * 0.8)
      matched = true
      addReason(reasons, `命中：紧凑模糊 ${normalizedQuery}`)
    }
  }

  if (normalizedQuery && title.includes(normalizedQuery) && url.includes(normalizedQuery)) {
    score += 38
  }

  if (parsedQuery.recencyHint) {
    const recencyBoost = getBookmarkRecencyBoost(bookmark)
    if (recencyBoost > 0) {
      score += recencyBoost
      matched = true
      insertReason(reasons, '排序：最近添加优先', 0)
    }
  }

  score -= Math.floor(bookmark.title.length / 28)

  return {
    score: matched ? Math.max(score, 0) : 0,
    reasons: prioritizeSearchReasons(reasons, 3)
  }
}

function canUseFastFirstBatch(parsedQuery: ParsedPopupSearchQuery): boolean {
  if (
    !parsedQuery.normalizedQuery ||
    parsedQuery.hasStructuredFilters ||
    parsedQuery.recencyHint
  ) {
    return false
  }

  return !parsedQuery.textTerms.some((term) => /\s/.test(term))
}

function matchesFastFirstBatchCandidate(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  terms: string[]
): boolean {
  if (!terms.length) {
    return false
  }

  return terms.every((term) => matchesSearchCandidateText(bookmark, term))
}

function scoreFastFirstBatchBookmark(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  terms: string[]
): { score: number; reasons: string[] } {
  const normalizedQuery = parsedQuery.normalizedQuery
  const title = bookmark.normalizedTitle
  const url = bookmark.normalizedUrl
  const domain = normalizeText(bookmark.domain || '')
  const path = bookmark.normalizedPath
  const searchText = getBookmarkSearchText(bookmark)
  const compactQuery = normalizeSearchTextCompact(normalizedQuery)
  const reasons: string[] = []
  let score = 0

  if (title === normalizedQuery) {
    score += 620
    addReason(reasons, `命中：标题 ${bookmark.title}`)
  } else if (title.startsWith(normalizedQuery)) {
    score += 420
    addReason(reasons, `命中：标题前缀 ${normalizedQuery}`)
  } else {
    const titleIndex = title.indexOf(normalizedQuery)
    if (titleIndex !== -1) {
      score += 300 - Math.min(titleIndex, 120)
      addReason(reasons, `命中：标题 ${normalizedQuery}`)
    }
  }

  score += scoreCompactFieldMatch(bookmark, compactQuery, normalizedQuery, reasons).score

  if (url.startsWith(normalizedQuery) || domain.startsWith(normalizedQuery)) {
    score += 250
    addReason(reasons, `命中：网址 ${normalizedQuery}`)
  } else {
    const urlIndex = getBestSearchIndex(url, domain, normalizedQuery)
    if (urlIndex !== -1) {
      score += 190 - Math.min(urlIndex, 100)
      addReason(reasons, `命中：网址 ${normalizedQuery}`)
    }
  }

  if (path.includes(normalizedQuery)) {
    score += 40
    addReason(reasons, `命中：文件夹 ${bookmark.path || ''}`.trim())
  }

  if (searchText.includes(normalizedQuery)) {
    score += 24
  }

  if (score <= 0) {
    score += Math.max(12, terms.length * 12)
    addReason(reasons, buildQueryCoverageReason(terms) || `命中：本地索引 ${normalizedQuery}`)
  }

  if (terms.length > 1 && terms.every((term) => searchText.includes(term))) {
    score += 80
    insertReason(reasons, buildQueryCoverageReason(terms), 1)
  }

  score -= Math.floor(bookmark.title.length / 28)

  return {
    score: Math.max(score, 0),
    reasons: prioritizeSearchReasons(reasons, 3)
  }
}

function scoreSemanticFields(
  bookmark: PopupSearchBookmark,
  normalizedQuery: string,
  queryTerms: string[],
  reasons: string[]
): { score: number } {
  let score = 0
  const summaryEnabled = shouldUseSummaryForQuery(normalizedQuery)
  const terms = queryTerms.length ? queryTerms : [normalizedQuery]

  score += scoreListField(bookmark.tagAliases, normalizedQuery, terms, 65, (label) => {
    addReason(reasons, `命中：别名 ${label}`)
  })
  score += scoreListField(bookmark.tagTags, normalizedQuery, terms, 60, (labels) => {
    addReason(reasons, `标签：${labels}`)
  })
  score += scoreListField(bookmark.tagTopics, normalizedQuery, terms, 50, (labels) => {
    addReason(reasons, `主题：${labels}`)
  })
  score += scoreTextField(bookmark.normalizedPath, normalizedQuery, terms, 40, () => {
    addReason(reasons, `命中：文件夹 ${bookmark.path || ''}`.trim())
  })
  score += scoreTextField(bookmark.tagContentType, normalizedQuery, terms, 10, () => {
    addReason(reasons, `命中：类型 ${bookmark.tagContentType}`)
  })
  score += scoreListField(bookmark.tagPinyinInitials, normalizedQuery, terms, 58, () => {
    addReason(reasons, `命中：首字母 ${normalizedQuery}`)
  })
  score += scoreListField(bookmark.tagPinyinFull, normalizedQuery, terms, 52, () => {
    addReason(reasons, `命中：拼音 ${normalizedQuery}`)
  })

  if (summaryEnabled) {
    score += scoreTextField(bookmark.tagSummary, normalizedQuery, terms, 22, () => {
      addReason(reasons, `命中：摘要 ${normalizedQuery}`)
    })
  }

  return { score }
}

function scoreCompactFieldMatch(
  bookmark: PopupSearchBookmark,
  compactQuery: string,
  normalizedQuery: string,
  reasons: string[]
): { score: number } {
  if (!compactQuery) {
    return { score: 0 }
  }

  let bestMatch: { score: number; reason: string } | null = null
  const fields = getCompactSearchFields(bookmark)
  for (const field of fields) {
    if (!field.value) {
      continue
    }

    const score = getCompactFieldScore(field.value, compactQuery, field.weight)
    if (score <= 0) {
      continue
    }

    const reason = `命中：${field.label} ${normalizedQuery}`
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { score, reason }
    }
  }

  if (!bestMatch) {
    return { score: 0 }
  }

  addReason(reasons, bestMatch.reason)
  return { score: bestMatch.score }
}

function getCompactSearchFields(bookmark: PopupSearchBookmark): Array<{ value: string; label: string; weight: number }> {
  return [
    { value: normalizeSearchTextCompact(bookmark.normalizedTitle), label: '紧凑标题', weight: 240 },
    { value: normalizeSearchTextCompact(bookmark.normalizedUrl), label: '紧凑网址', weight: 170 },
    { value: normalizeSearchTextCompact(bookmark.domain || ''), label: '紧凑站点', weight: 210 },
    { value: normalizeSearchTextCompact(bookmark.normalizedPath), label: '紧凑文件夹', weight: 80 },
    ...bookmark.tagAliases.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '紧凑别名',
      weight: 130
    })),
    ...bookmark.tagTags.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '紧凑标签',
      weight: 120
    })),
    ...bookmark.tagTopics.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '紧凑主题',
      weight: 100
    })),
    ...bookmark.tagPinyinFull.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '拼音',
      weight: 150
    })),
    ...bookmark.tagPinyinInitials.map((value) => ({
      value: normalizeSearchTextCompact(value),
      label: '首字母',
      weight: 150
    }))
  ]
}

function getCompactFieldScore(value: string, query: string, weight: number): number {
  if (!value || !query) {
    return 0
  }

  if (value === query) {
    return weight + 280
  }

  if (value.startsWith(query)) {
    return weight + 150
  }

  const index = value.indexOf(query)
  if (index !== -1) {
    return Math.max(weight, weight + 72 - Math.min(index, 72))
  }

  return 0
}

function scoreListField(
  values: string[],
  normalizedQuery: string,
  queryTerms: string[],
  weight: number,
  onMatch: (label: string) => void
): number {
  if (!values.length) {
    return 0
  }

  let score = 0
  const matchedLabels: string[] = []
  for (const value of values) {
    if (value === normalizedQuery) {
      score += weight + 22
      matchedLabels.push(value)
    } else if (value.startsWith(normalizedQuery)) {
      score += weight + 10
      matchedLabels.push(value)
    } else if (textContainsSearchTerm(value, normalizedQuery)) {
      score += weight
      matchedLabels.push(value)
    } else {
      const matchedTerms = queryTerms.filter((term) => textContainsSearchTerm(value, term))
      if (matchedTerms.length) {
        score += Math.round(weight * (matchedTerms.length / queryTerms.length))
        matchedLabels.push(value)
      }
    }
  }

  if (matchedLabels.length) {
    onMatch(matchedLabels.slice(0, 3).join(' / '))
  }

  return score
}

function scoreTextField(
  value: string,
  normalizedQuery: string,
  queryTerms: string[],
  weight: number,
  onMatch: () => void
): number {
  if (!value) {
    return 0
  }

  if (value === normalizedQuery) {
    onMatch()
    return weight + 16
  }

  if (value.startsWith(normalizedQuery)) {
    onMatch()
    return weight + 8
  }

  if (value.includes(normalizedQuery)) {
    onMatch()
    return weight
  }

  const matchedTerms = queryTerms.filter((term) => value.includes(term))
  if (!matchedTerms.length) {
    return 0
  }

  onMatch()
  return Math.round(weight * (matchedTerms.length / queryTerms.length))
}

function matchesStructuredFilters(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery,
  reasons: string[]
): boolean {
  if (!parsedQuery.hasStructuredFilters) {
    return true
  }

  if (!matchesParsedSearchQuery(parsedQuery, {
    searchText: getBookmarkSearchText(bookmark),
    domain: bookmark.domain,
    url: bookmark.normalizedUrl,
    path: bookmark.path,
    type: bookmark.tagContentType,
    dateAdded: bookmark.dateAdded
  })) {
    return false
  }

  if (parsedQuery.siteFilters.length) {
    const domain = normalizeText(bookmark.domain || '')
    const url = bookmark.normalizedUrl || ''
    const matchedSite = parsedQuery.siteFilters.find((filter) =>
      domain.includes(filter) || url.includes(filter)
    )
    if (!matchedSite) {
      return false
    }
    addReason(reasons, `筛选：站点 ${matchedSite}`)
  }

  if (parsedQuery.folderFilters.length) {
    const matchedFolder = parsedQuery.folderFilters.find((filter) =>
      bookmark.normalizedPath.includes(filter)
    )
    if (!matchedFolder) {
      return false
    }
    addReason(reasons, `筛选：文件夹 ${matchedFolder}`)
  }

  if (parsedQuery.typeFilters.length) {
    const matchedType = parsedQuery.typeFilters.find((filter) =>
      bookmark.tagContentType.includes(filter)
    )
    if (!matchedType) {
      return false
    }
    addReason(reasons, `筛选：类型 ${matchedType}`)
  }

  if (parsedQuery.excludedTerms.length) {
    addReason(reasons, `排除：${parsedQuery.excludedTerms.join('、')}`)
  }

  if (parsedQuery.dateRange) {
    addReason(reasons, `筛选：${parsedQuery.dateRange.label}`)
  }

  return true
}

function matchesRequiredPhraseTerms(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): boolean {
  const phraseTerms = parsedQuery.textTerms.filter((term) => /\s/.test(term))
  if (!phraseTerms.length) {
    return true
  }

  const searchText = getBookmarkSearchText(bookmark)
  return phraseTerms.every((term) => searchText.includes(term))
}

function termMatchedSemanticField(bookmark: PopupSearchBookmark, term: string): boolean {
  return [
    bookmark.normalizedPath,
    bookmark.tagSummary,
    bookmark.tagContentType,
    ...bookmark.tagTopics,
    ...bookmark.tagTags,
    ...bookmark.tagAliases,
    ...bookmark.tagPinyinFull,
    ...bookmark.tagPinyinInitials
  ].some((value) => value.includes(term))
}

function scoreLatinApproximateTerms(
  bookmark: PopupSearchBookmark,
  queryTerms: string[],
  reasons: string[]
): { score: number; matchedCount: number } {
  const latinTerms = queryTerms.filter(isApproximateLatinTerm)
  if (!latinTerms.length) {
    return { score: 0, matchedCount: 0 }
  }

  const tokens = collectApproximateSearchTokens(bookmark)
  if (!tokens.length) {
    return { score: 0, matchedCount: 0 }
  }

  let score = 0
  let matchedCount = 0
  for (const term of latinTerms) {
    if (tokens.some((token) => textContainsSearchTerm(token, term))) {
      matchedCount += 1
      score += 14
      continue
    }

    const match = findClosestLatinToken(term, tokens)
    if (!match) {
      continue
    }

    matchedCount += 1
    score += Math.max(24, 58 - match.distance * 12)
    addReason(reasons, `命中：近似 ${match.token} / ${term}`)
  }

  return { score, matchedCount }
}

function isApproximateLatinTerm(term: string): boolean {
  return /^[a-z0-9][a-z0-9+.#-]{3,}$/i.test(term)
}

function collectApproximateSearchTokens(bookmark: PopupSearchBookmark): string[] {
  const values = [
    bookmark.normalizedTitle,
    bookmark.normalizedUrl,
    normalizeText(bookmark.domain || ''),
    bookmark.normalizedPath,
    bookmark.tagSummary,
    bookmark.tagContentType,
    ...bookmark.tagTopics,
    ...bookmark.tagTags,
    ...bookmark.tagAliases
  ]
  const tokens = new Set<string>()

  for (const value of values) {
    const matches = String(value || '').match(/[a-z0-9][a-z0-9+.#-]{2,}/gi) || []
    for (const match of matches) {
      const token = normalizeText(match)
      if (token.length >= 3 && token.length <= 48) {
        tokens.add(token)
      }
    }
  }

  return [...tokens]
}

function findClosestLatinToken(
  term: string,
  tokens: string[]
): { token: string; distance: number } | null {
  let bestMatch: { token: string; distance: number } | null = null
  const maxDistance = getApproximateDistanceLimit(term)

  for (const token of tokens) {
    if (
      Math.abs(token.length - term.length) > maxDistance ||
      token[0] !== term[0]
    ) {
      continue
    }

    const distance = damerauLevenshteinDistance(term, token, maxDistance)
    if (distance > maxDistance) {
      continue
    }

    if (!bestMatch || distance < bestMatch.distance || token.length < bestMatch.token.length) {
      bestMatch = { token, distance }
    }
  }

  return bestMatch
}

function getApproximateDistanceLimit(term: string): number {
  if (term.length >= 8) {
    return 2
  }
  return term.length >= 5 ? 2 : 1
}

function damerauLevenshteinDistance(left: string, right: string, limit: number): number {
  const previousPreviousRow = new Array(right.length + 1).fill(0)
  let previousRow = Array.from({ length: right.length + 1 }, (_value, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = [leftIndex]
    let rowBest = currentRow[0]

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      let distance = Math.min(
        previousRow[rightIndex] + 1,
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex - 1] + substitutionCost
      )

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(distance, previousPreviousRow[rightIndex - 2] + 1)
      }

      currentRow[rightIndex] = distance
      rowBest = Math.min(rowBest, distance)
    }

    if (rowBest > limit) {
      return limit + 1
    }

    previousPreviousRow.splice(0, previousPreviousRow.length, ...previousRow)
    previousRow = currentRow
  }

  return previousRow[right.length] ?? limit + 1
}

function shouldUseSummaryForQuery(normalizedQuery: string): boolean {
  if (normalizedQuery.length < 2) {
    return false
  }
  return !/^[\u3400-\u9fff]$/u.test(normalizedQuery)
}

function normalizeSearchList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return [...new Set(values.flatMap(value => { const mappedResult = normalizeText(value); return mappedResult ? [mappedResult] : [] }))]
}

function addReason(reasons: string[], reason: string): void {
  const text = normalizeReasonText(reason)
  if (text && !reasons.includes(text)) {
    reasons.push(text)
  }
}

function insertReason(reasons: string[], reason: string, index: number): void {
  const text = normalizeReasonText(reason)
  if (!text || reasons.includes(text)) {
    return
  }

  reasons.splice(Math.max(0, Math.min(index, reasons.length)), 0, text)
}

function normalizeReasonText(reason: string): string {
  const text = String(reason || '').replace(/\s+/g, ' ').trim()
  return text
}

function prioritizeSearchReasons(reasons: string[], limit: number): string[] {
  const visibleLimit = Math.max(0, limit)
  if (!visibleLimit || reasons.length <= visibleLimit) {
    return reasons.slice(0, visibleLimit)
  }

  const explicitReasons = reasons.filter(isExplicitSearchReason)
  const supportingReasons = reasons.filter((reason) => !isExplicitSearchReason(reason))
  return [...explicitReasons, ...supportingReasons].slice(0, visibleLimit)
}

function isExplicitSearchReason(reason: string): boolean {
  return /^(筛选|排除|排序)：/.test(reason)
}

function buildQueryCoverageReason(queryTerms: string[]): string {
  const termSummary = formatReasonTerms(queryTerms)
  return termSummary ? `匹配：包含全部关键词 ${termSummary}` : ''
}

function formatReasonTerms(terms: string[]): string {
  const uniqueTerms = [...new Set(terms.flatMap(term => { const mappedResult = normalizeText(term); return mappedResult ? [mappedResult] : [] }))]
  const visibleTerms = uniqueTerms.slice(0, 4)
  if (!visibleTerms.length) {
    return ''
  }

  const suffix = uniqueTerms.length > visibleTerms.length ? ` 等 ${uniqueTerms.length} 个` : ''
  return `${visibleTerms.join(' / ')}${suffix}`
}

function getBookmarkRecencyBoost(bookmark: PopupSearchBookmark): number {
  const dateAdded = Number(bookmark.dateAdded)
  if (!Number.isFinite(dateAdded) || dateAdded <= 0) {
    return 0
  }

  const ageDays = Math.max(0, (Date.now() - dateAdded) / (24 * 60 * 60 * 1000))
  if (ageDays <= 7) {
    return 120
  }
  if (ageDays <= 30) {
    return 90
  }
  if (ageDays <= 90) {
    return 58
  }
  if (ageDays <= 180) {
    return 30
  }
  return 8
}

function getSearchCandidates(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery
): PopupSearchBookmark[] {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) {
    return bookmarks
  }

  if (requiresPinyinTokens(parsedQuery.normalizedQuery)) {
    return bookmarks.filter((bookmark) => matchesSearchCandidateFilters(bookmark, parsedQuery))
  }

  const requiredTerms = getCandidateRequiredTerms(parsedQuery)
  const directMatches = bookmarks.filter((bookmark) => {
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
      return false
    }
    return requiredTerms.every((term) => matchesSearchCandidateText(bookmark, term))
  })

  if (directMatches.length) {
    return directMatches
  }

  const prefix = parsedQuery.normalizedQuery.slice(0, Math.min(parsedQuery.normalizedQuery.length, 3))
  if (!prefix) {
    return bookmarks
  }

  const prefixMatches = bookmarks.filter((bookmark) => {
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
      return false
    }
    return matchesSearchCandidateText(bookmark, prefix)
  })

  return prefixMatches.length ? prefixMatches : bookmarks
}

async function getSearchCandidatesCooperatively(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  options: CooperativeSearchOptions
): Promise<PopupSearchBookmark[]> {
  if (bookmarks.length < SEARCH_PREFILTER_THRESHOLD) {
    return bookmarks
  }

  if (requiresPinyinTokens(parsedQuery.normalizedQuery)) {
    return bookmarks.filter((bookmark) => matchesSearchCandidateFilters(bookmark, parsedQuery))
  }

  const directMatches = await getDirectSearchCandidateMatches(bookmarks, parsedQuery, options)
  if (directMatches.length) {
    return directMatches
  }

  return getPrefixSearchCandidateMatches(bookmarks, parsedQuery, options)
}

async function getDirectSearchCandidateMatches(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  options: CooperativeSearchOptions
): Promise<PopupSearchBookmark[]> {
  const requiredTerms = getCandidateRequiredTerms(parsedQuery)
  const directMatches: PopupSearchBookmark[] = []

  await processSearchChunks(bookmarks, options, (bookmark) => {
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
      return
    }
    if (requiredTerms.every((term) => matchesSearchCandidateText(bookmark, term))) {
      directMatches.push(bookmark)
    }
  })

  return directMatches
}

async function getPrefixSearchCandidateMatches(
  bookmarks: PopupSearchBookmark[],
  parsedQuery: ParsedPopupSearchQuery,
  options: CooperativeSearchOptions
): Promise<PopupSearchBookmark[]> {
  const prefix = parsedQuery.normalizedQuery.slice(0, Math.min(parsedQuery.normalizedQuery.length, 3))
  if (!prefix) {
    return bookmarks
  }

  const prefixMatches: PopupSearchBookmark[] = []
  await processSearchChunks(bookmarks, options, (bookmark) => {
    if (!matchesSearchCandidateFilters(bookmark, parsedQuery)) {
      return
    }
    if (matchesSearchCandidateText(bookmark, prefix)) {
      prefixMatches.push(bookmark)
    }
  })

  return prefixMatches.length ? prefixMatches : bookmarks
}

function getCandidateRequiredTerms(parsedQuery: ParsedPopupSearchQuery): string[] {
  return parsedQuery.textTerms.length
    ? parsedQuery.textTerms
    : [parsedQuery.normalizedQuery]
}

function matchesSearchCandidateFilters(
  bookmark: PopupSearchBookmark,
  parsedQuery: ParsedPopupSearchQuery
): boolean {
  if (!parsedQuery.hasStructuredFilters) {
    return true
  }

  return matchesParsedSearchQuery(parsedQuery, {
    searchText: getBookmarkSearchText(bookmark),
    domain: bookmark.domain,
    url: bookmark.normalizedUrl,
    path: bookmark.path,
    type: bookmark.tagContentType,
    dateAdded: bookmark.dateAdded
  })
}

function getBookmarkSearchText(bookmark: PopupSearchBookmark): string {
  return bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
}

function getCompactSearchText(bookmark: PopupSearchBookmark): string {
  return bookmark.searchTextCompact || normalizeSearchTextCompact(getBookmarkSearchText(bookmark))
}

function matchesSearchCandidateText(bookmark: PopupSearchBookmark, term: string): boolean {
  if (!term) {
    return true
  }

  const searchText = getBookmarkSearchText(bookmark)
  if (searchText.includes(term)) {
    return true
  }

  const compactTerm = normalizeSearchTextCompact(term)
  if (!compactTerm) {
    return false
  }

  return getCompactSearchFields(bookmark).some((field) => field.value.includes(compactTerm))
}

function getBestSearchIndex(left: string, right: string, term: string): number {
  const indices = [left.indexOf(term), right.indexOf(term)].filter((index) => index >= 0)
  return indices.length ? Math.min(...indices) : -1
}

function getTextSearchIndex(text: string, term: string): number {
  return text.indexOf(term)
}

function textContainsSearchTerm(text: string, term: string): boolean {
  return text.includes(term)
}

function scoreDomainQueryMatch(domain: string, normalizedQuery: string): number {
  if (!domain || !normalizedQuery) {
    return 0
  }

  const index = domain.indexOf(normalizedQuery)
  if (index === -1) {
    return 0
  }

  if (domain === normalizedQuery) {
    return 280
  }

  if (domain.startsWith(normalizedQuery)) {
    return 240 + getBoundaryMatchBonus(domain, 0, normalizedQuery.length, 28)
  }

  return Math.max(
    120,
    170 - Math.min(index, 90) + getBoundaryMatchBonus(domain, index, normalizedQuery.length, 24)
  )
}

function scoreDomainTermMatch(domain: string, term: string): number {
  if (!domain || !term) {
    return 0
  }

  const index = domain.indexOf(term)
  if (index === -1) {
    return 0
  }

  if (domain === term) {
    return 72
  }

  if (domain.startsWith(term)) {
    return 60 + getBoundaryMatchBonus(domain, 0, term.length, 18)
  }

  return Math.max(
    20,
    46 - Math.min(index, 48) + getBoundaryMatchBonus(domain, index, term.length, 16)
  )
}

function getBoundaryMatchBonus(text: string, index: number, length: number, maxBonus: number): number {
  if (!text || !Number.isFinite(index) || !Number.isFinite(length) || maxBonus <= 0) {
    return 0
  }

  const start = Math.max(0, index)
  const end = Math.max(start, index + length)
  const leftBoundary = start <= 0 || isSearchBoundaryChar(text[start - 1] || '')
  const rightBoundary = end >= text.length || isSearchBoundaryChar(text[end] || '')

  if (leftBoundary && rightBoundary) {
    return maxBonus
  }
  if (leftBoundary || rightBoundary) {
    return Math.round(maxBonus * 0.6)
  }
  return 0
}

function isSearchBoundaryChar(value: string): boolean {
  return !/[a-z0-9]/i.test(value)
}

function scoreOrderedTermProximity(text: string, terms: string[]): number {
  const orderedTerms = [...new Set(terms.flatMap(term => { const mappedResult = normalizeText(term); return mappedResult ? [mappedResult] : [] }))]
  if (!text || orderedTerms.length < 2) {
    return 0
  }

  let searchStart = 0
  let firstIndex = -1
  let lastEnd = -1

  for (const term of orderedTerms) {
    const index = text.indexOf(term, searchStart)
    if (index === -1) {
      return 0
    }

    if (firstIndex === -1) {
      firstIndex = index
    }
    lastEnd = index + term.length
    searchStart = index + term.length
  }

  const span = Math.max(1, lastEnd - firstIndex)
  return Math.max(0, 48 - Math.min(span, 48))
}

function canUseLooseSubsequenceMatch(parsedQuery: ParsedPopupSearchQuery): boolean {
  if (
    parsedQuery.hasStructuredFilters ||
    parsedQuery.recencyHint ||
    parsedQuery.queryTerms.length !== 1
  ) {
    return false
  }

  const compactQuery = normalizeSearchTextCompact(parsedQuery.normalizedQuery)
  if (compactQuery.length < LOOSE_SUBSEQUENCE_MIN_COMPACT_LENGTH) {
    return false
  }

  return !requiresPinyinTokens(parsedQuery.normalizedQuery)
}

function appendTopSearchResult(results: PopupSearchResult[], result: PopupSearchResult, limit = MAX_POPUP_SEARCH_RESULTS): void {
  results.push(result)
  results.sort(compareSearchResults)
  if (results.length > limit) {
    results.length = limit
  }
}

function compareSearchResults(left: PopupSearchResult, right: PopupSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  const dateDelta = Number(right.dateAdded || 0) - Number(left.dateAdded || 0)
  if (dateDelta !== 0) {
    return dateDelta
  }

  if (left.title.length !== right.title.length) {
    return left.title.length - right.title.length
  }

  return left.path.localeCompare(right.path, 'zh-Hans-CN')
}

function subsequenceScore(text: string, query: string): number {
  if (!text || !query || query.length < 2) {
    return 0
  }

  let textIndex = 0
  let queryIndex = 0
  let streak = 0
  let bestStreak = 0
  let gapPenalty = 0

  while (textIndex < text.length && queryIndex < query.length) {
    if (text[textIndex] === query[queryIndex]) {
      queryIndex += 1
      streak += 1
      bestStreak = Math.max(bestStreak, streak)
    } else if (queryIndex > 0) {
      streak = 0
      gapPenalty += 1
    }

    textIndex += 1
  }

  if (queryIndex !== query.length) {
    return 0
  }

  return 40 + query.length * 10 + bestStreak * 10 - gapPenalty
}

function assertSearchActive(options: CooperativeSearchOptions): void {
  if (!options.isActive()) {
    throw new Error('search-cancelled')
  }
}

function yieldSearchWork(options: CooperativeSearchOptions): Promise<unknown> {
  if (options.yieldWork) {
    return options.yieldWork()
  }

  return Promise.resolve()
}
