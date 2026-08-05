import type { PopupSearchBookmark, PopupSearchResult } from './search.js'
import { getQueryTerms, normalizeQuery } from './search.js'

export interface NaturalSearchDateRange {
  from: number
  to: number
  label: string
}

export interface NaturalSearchPlan {
  rawQuery: string
  queries: string[]
  highlightQuery: string
  dateRange: NaturalSearchDateRange | null
  excludedTerms: string[]
  explanation: string
  source: 'local' | 'ai'
}

export interface NaturalSearchResultSet {
  query: string
  results: PopupSearchResult[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const NATURAL_QUERY_LIMIT = 5

const FILLER_PATTERNS = [
  /帮我/g,
  /帮忙/g,
  /麻烦/g,
  /请/g,
  /找一下/g,
  /找找/g,
  /搜索/g,
  /查找/g,
  /查一下/g,
  /找/g,
  /看看/g,
  /收藏的/g,
  /收藏/g,
  /书签/g,
  /链接/g,
  /网址/g,
  /页面/g,
  /那个/g,
  /这个/g,
  /一些/g,
  /一个/g,
  /之前/g,
  /以前/g,
  /我的/g,
  /我/g,
  /关于/g,
  /有关/g,
  /一下/g,
  /资料/g,
  /的/g
]

const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'about',
  'bookmark',
  'bookmarks',
  'find',
  'for',
  'from',
  'last',
  'link',
  'me',
  'my',
  'of',
  'page',
  'saved',
  'search',
  'show',
  'site',
  'that',
  'the',
  'this',
  'to',
  'week'
])

const SYNONYM_GROUPS: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /教程|教学|入门|指南|tutorial|guide|course/i, terms: ['教程', 'tutorial', 'guide', '入门'] },
  { pattern: /表格|数据表|grid|table|datatable|data grid/i, terms: ['表格', 'table', 'grid', 'data grid'] },
  { pattern: /文档|docs?|documentation|manual/i, terms: ['文档', 'docs', 'documentation'] },
  { pattern: /视频|video|youtube|bilibili|哔哩/i, terms: ['视频', 'video', 'youtube', 'bilibili'] },
  { pattern: /论文|paper|arxiv|research/i, terms: ['论文', 'paper', 'arxiv', 'research'] },
  { pattern: /博客|文章|blog|article|post/i, terms: ['博客', '文章', 'blog', 'article'] },
  { pattern: /工具|tool|utility/i, terms: ['工具', 'tool', 'utility'] }
]

const DATE_PHRASES = [
  /last\s+week/gi,
  /this\s+week/gi,
  /last\s+month/gi,
  /this\s+month/gi,
  /last\s+year/gi,
  /this\s+year/gi,
  /yesterday/gi,
  /today/gi,
  /(?:最近|近|过去)\s*\d+\s*天/g,
  /(?:最近|近|过去)\s*\d+\s*(?:周|星期|礼拜|个月|月)/g,
  /\d{4}[-/.]\d{1,2}(?:[-/.]\d{1,2})?/g,
  /\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*(?:日|号)?)?/g,
  /上周|上一周|本周|这周|今天|昨天|前天|上个月|本月|这个月|去年|今年|前年|最近一周|近一周|最近七天|近七天|过去七天|最近一个月|近一个月|过去一个月|最近半年|近半年|过去半年|最近|近期/g,
]

const CHINESE_EXCLUSION_PATTERN = /(?:不要|不看|排除|过滤掉|过滤|不是|别给我|剔除|去掉)\s*([a-z0-9][a-z0-9+.#/_-]*|[\u3400-\u9fff]{1,12})/gi
const ENGLISH_EXCLUSION_PATTERN = /\b(?:without|exclude|excluding|not|no)\s+([a-z0-9][a-z0-9+.#/_-]*)/gi
const DASH_EXCLUSION_PATTERN = /(^|\s)-([a-z0-9][a-z0-9+.#/_-]*|[\u3400-\u9fff]{1,12})/gi
const STRUCTURED_SEARCH_OPERATOR_PATTERN = /(^|\s)((?:site|domain|url|folder|path|type|kind|站点|域名|文件夹|目录|路径|类型|类别)[:：][^\s，。！？；、,!?;()[\]{}"'“”‘’]+)/gi

export function buildLocalNaturalSearchPlan(query: string, now = Date.now()): NaturalSearchPlan {
  const rawQuery = String(query || '').trim()
  const exclusion = extractNaturalSearchExclusions(rawQuery)
  const structuredOperators = extractStructuredSearchOperators(exclusion.query)
  const dateRange = parseNaturalDateRange(rawQuery, now)
  const cleanedQuery = cleanNaturalSearchQuery(structuredOperators.query)
  const normalizedCleanedQuery = normalizeQuery(cleanedQuery)
  const synonymTerms = collectSynonymTerms(exclusion.query)
  const baseTerms = getQueryTerms(normalizedCleanedQuery)
  const expandedTerms = uniqueNormalizedTerms([...structuredOperators.terms, ...baseTerms, ...synonymTerms])
  const expandedQuery = expandedTerms.join(' ')
  const excludedTerms = uniqueNormalizedTerms([
    ...exclusion.terms,
    ...collectSynonymTerms(exclusion.terms.join(' '))
  ])
  const queries = uniqueQueries([
    expandedQuery,
    normalizedCleanedQuery,
    ...synonymTerms
  ])

  return {
    rawQuery,
    queries: queries.length ? queries : uniqueQueries([normalizeQuery(rawQuery)]),
    highlightQuery: uniqueNormalizedTerms([...structuredOperators.terms, ...baseTerms, ...synonymTerms]).join(' ') || normalizeQuery(rawQuery),
    dateRange,
    excludedTerms,
    explanation: buildLocalExplanation({ dateRange, baseTerms, synonymTerms, excludedTerms }),
    source: 'local'
  }
}

export function normalizeNaturalSearchAiPlan(
  rawPlan: unknown,
  fallbackPlan: NaturalSearchPlan,
  now = Date.now()
): NaturalSearchPlan {
  const source = rawPlan && typeof rawPlan === 'object'
    ? rawPlan as Record<string, unknown>
    : {}
  const rawQueries = Array.isArray(source.queries) ? source.queries : []
  const rawKeywords = Array.isArray(source.keywords) ? source.keywords : []
  const queries = uniqueQueries([
    ...rawQueries.map((value) => String(value || '')),
    rawKeywords.map((value) => String(value || '')).join(' '),
    ...fallbackPlan.queries
  ])
  const excludedTerms = uniqueNormalizedTerms([
    ...fallbackPlan.excludedTerms,
    ...(Array.isArray(source.excluded_terms) ? source.excluded_terms.map((value) => String(value || '')) : [])
  ])
  const aiDateRange = normalizeAiDateRange(source.date_range, now)
  const dateRange = fallbackPlan.dateRange || aiDateRange
  const explanation = cleanNaturalText(source.explanation, 120) || fallbackPlan.explanation || 'AI 已改写查询'

  return {
    rawQuery: fallbackPlan.rawQuery,
    queries: queries.length ? queries : fallbackPlan.queries,
    highlightQuery: uniqueNormalizedTerms([
      ...getQueryTerms(queries.join(' ')),
      ...getQueryTerms(fallbackPlan.highlightQuery)
    ]).join(' ') || fallbackPlan.highlightQuery,
    dateRange,
    excludedTerms,
    explanation,
    source: 'ai'
  }
}

export function filterBookmarksByNaturalDateRange(
  bookmarks: PopupSearchBookmark[],
  plan: NaturalSearchPlan
): PopupSearchBookmark[] {
  if (!plan.dateRange) {
    return bookmarks
  }

  const { from, to } = plan.dateRange
  return bookmarks.filter((bookmark) => {
    const dateAdded = Number(bookmark.dateAdded)
    return Number.isFinite(dateAdded) && dateAdded >= from && dateAdded < to
  })
}

export function mergeNaturalSearchResultSets(
  plan: NaturalSearchPlan,
  resultSets: NaturalSearchResultSet[]
): PopupSearchResult[] {
  const merged = new Map<string, PopupSearchResult>()

  resultSets.forEach((resultSet, queryIndex) => {
    const queryBoost = Math.max(20, 90 - queryIndex * 16)
    for (const result of resultSet.results) {
      if (matchesExcludedTerms(result, plan.excludedTerms)) {
        continue
      }

      const existing = merged.get(result.id)
      const nextScore = result.score + queryBoost + (plan.dateRange ? 22 : 0)
      const nextReasons = buildNaturalMatchReasons(plan, result.matchReasons, resultSet.query)
      if (!existing || nextScore > existing.score) {
        merged.set(result.id, {
          ...result,
          score: nextScore,
          matchReasons: nextReasons
        })
        continue
      }

      existing.score += Math.round(queryBoost / 4)
      existing.matchReasons = mergeReasons(existing.matchReasons, nextReasons)
    }
  })

  return [...merged.values()].sort(compareNaturalSearchResults)
}

export function getNaturalSearchStatusLabel(plan: NaturalSearchPlan | null): string {
  if (!plan) {
    return '自然语言搜索'
  }

  const parts = [plan.source === 'ai' ? 'AI 解析' : '本地解析']
  if (plan.dateRange?.label) {
    parts.push(plan.dateRange.label)
  }
  const keywordSummary = getNaturalKeywordSummary(plan)
  if (keywordSummary) {
    parts.push(`关键词 ${keywordSummary}`)
  }
  const exclusionSummary = formatNaturalTerms(plan.excludedTerms, 2)
  if (exclusionSummary) {
    parts.push(`排除 ${exclusionSummary}`)
  }
  return parts.join(' · ')
}

function parseNaturalDateRange(query: string, now: number): NaturalSearchDateRange | null {
  const text = String(query || '').toLowerCase()
  const current = new Date(now)
  const explicitDateRange = parseExplicitDateRange(text)
  if (explicitDateRange) {
    return explicitDateRange
  }

  if (/上周|上一周|last\s+week/i.test(text)) {
    const thisWeekStart = startOfWeek(current).getTime()
    return rangeFromDates(thisWeekStart - 7 * DAY_MS, thisWeekStart, '上周收藏')
  }

  if (/本周|这周|this\s+week/i.test(text)) {
    const thisWeekStart = startOfWeek(current).getTime()
    return rangeFromDates(thisWeekStart, thisWeekStart + 7 * DAY_MS, '本周收藏')
  }

  if (/昨天|yesterday/i.test(text)) {
    const todayStart = startOfDay(current).getTime()
    return rangeFromDates(todayStart - DAY_MS, todayStart, '昨天收藏')
  }

  if (/前天/i.test(text)) {
    const todayStart = startOfDay(current).getTime()
    return rangeFromDates(todayStart - 2 * DAY_MS, todayStart - DAY_MS, '前天收藏')
  }

  if (/今天|today/i.test(text)) {
    const todayStart = startOfDay(current).getTime()
    return rangeFromDates(todayStart, todayStart + DAY_MS, '今天收藏')
  }

  if (/上个月|last\s+month/i.test(text)) {
    const thisMonthStart = startOfMonth(current).getTime()
    const lastMonthStart = startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)).getTime()
    return rangeFromDates(lastMonthStart, thisMonthStart, '上个月收藏')
  }

  if (/本月|这个月|this\s+month/i.test(text)) {
    const thisMonthStart = startOfMonth(current).getTime()
    const nextMonthStart = startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)).getTime()
    return rangeFromDates(thisMonthStart, nextMonthStart, '本月收藏')
  }

  if (/去年|last\s+year/i.test(text)) {
    const year = current.getFullYear() - 1
    return rangeFromDates(new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime(), '去年收藏')
  }

  if (/前年/i.test(text)) {
    const year = current.getFullYear() - 2
    return rangeFromDates(new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime(), '前年收藏')
  }

  if (/今年|this\s+year/i.test(text)) {
    const year = current.getFullYear()
    return rangeFromDates(new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime(), '今年收藏')
  }

  const recentDaysMatch = text.match(/(?:最近|近|过去)\s*(\d+)\s*天/)
  if (recentDaysMatch) {
    const days = Math.max(1, Math.min(Number(recentDaysMatch[1]) || 1, 365))
    return rangeFromDates(startOfDay(current).getTime() - (days - 1) * DAY_MS, startOfDay(current).getTime() + DAY_MS, `最近 ${days} 天`)
  }

  const recentWeeksMatch = text.match(/(?:最近|近|过去)\s*(\d+)\s*(?:周|星期|礼拜)/)
  if (recentWeeksMatch) {
    const weeks = Math.max(1, Math.min(Number(recentWeeksMatch[1]) || 1, 52))
    return rangeFromDates(
      startOfDay(current).getTime() - (weeks * 7 - 1) * DAY_MS,
      startOfDay(current).getTime() + DAY_MS,
      `最近 ${weeks} 周`
    )
  }

  const recentMonthsMatch = text.match(/(?:最近|近|过去)\s*(\d+)\s*(?:个月|月)/)
  if (recentMonthsMatch) {
    const months = Math.max(1, Math.min(Number(recentMonthsMatch[1]) || 1, 24))
    const fromDate = subtractCalendarMonthsClamped(current, months)
    return rangeFromDates(fromDate.getTime(), startOfDay(current).getTime() + DAY_MS, `最近 ${months} 个月`)
  }

  if (/最近一周|近一周|最近七天|近七天|过去七天/i.test(text)) {
    return rangeFromDates(startOfDay(current).getTime() - 6 * DAY_MS, startOfDay(current).getTime() + DAY_MS, '最近 7 天')
  }

  if (/最近一个月|近一个月|过去一个月/i.test(text)) {
    return rangeFromDates(startOfDay(current).getTime() - 29 * DAY_MS, startOfDay(current).getTime() + DAY_MS, '最近 30 天')
  }

  if (/最近半年|近半年|过去半年/i.test(text)) {
    const fromDate = subtractCalendarMonthsClamped(current, 6)
    return rangeFromDates(fromDate.getTime(), startOfDay(current).getTime() + DAY_MS, '最近 6 个月')
  }

  if (/最近|近期/i.test(text)) {
    return rangeFromDates(startOfDay(current).getTime() - 13 * DAY_MS, startOfDay(current).getTime() + DAY_MS, '最近 14 天')
  }

  return null
}

function cleanNaturalSearchQuery(query: string): string {
  let text = String(query || '')
    .replace(/[，。！？；、,.!?;:：()[\]{}"'“”‘’]/g, ' ')
    .replace(/([a-z0-9])([\u3400-\u9fff])/gi, '$1 $2')
    .replace(/([\u3400-\u9fff])([a-z0-9])/gi, '$1 $2')
    .replace(/(教程|教学|入门|指南|表格|数据表|文档|视频|论文|博客|文章|工具)/g, ' $1 ')

  for (const pattern of DATE_PHRASES) {
    text = text.replace(pattern, ' ')
  }

  for (const pattern of FILLER_PATTERNS) {
    text = text.replace(pattern, ' ')
  }

  const terms = getQueryTerms(normalizeQuery(text)).filter((term) => {
    return !ENGLISH_STOP_WORDS.has(term)
  })

  return terms.join(' ')
}

function parseExplicitDateRange(text: string): NaturalSearchDateRange | null {
  const dayMatch = text.match(/(\d{4})(?:[-/.]|年\s*)(\d{1,2})(?:[-/.]|月\s*)(\d{1,2})(?:日|号)?/)
  if (dayMatch) {
    const year = Number(dayMatch[1])
    const month = Number(dayMatch[2])
    const day = Number(dayMatch[3])
    const date = createValidLocalDate(year, month, day)
    if (date) {
      return rangeFromDates(date.getTime(), date.getTime() + DAY_MS, `${formatDateRangePart(year, month, day)} 收藏`)
    }
  }

  const monthMatch = text.match(/(\d{4})(?:[-/.]|年\s*)(\d{1,2})(?:月)?/)
  if (monthMatch) {
    const year = Number(monthMatch[1])
    const month = Number(monthMatch[2])
    const date = createValidLocalDate(year, month, 1)
    if (date) {
      return rangeFromDates(
        date.getTime(),
        new Date(year, month, 1).getTime(),
        `${formatDateRangePart(year, month)} 收藏`
      )
    }
  }

  return null
}

function collectSynonymTerms(query: string): string[] {
  const terms: string[] = []
  for (const group of SYNONYM_GROUPS) {
    if (group.pattern.test(query)) {
      terms.push(...group.terms)
    }
  }

  return uniqueNormalizedTerms(terms)
}

function extractStructuredSearchOperators(query: string): { query: string; terms: string[] } {
  const terms: string[] = []
  const cleanedQuery = String(query || '').replace(STRUCTURED_SEARCH_OPERATOR_PATTERN, (_match, prefix, operatorTerm) => {
    terms.push(String(operatorTerm || ''))
    return prefix || ' '
  })

  return {
    query: cleanedQuery,
    terms: uniqueNormalizedTerms(terms)
  }
}

function extractNaturalSearchExclusions(query: string): { query: string; terms: string[] } {
  const terms: string[] = []
  let cleanedQuery = String(query || '')

  cleanedQuery = cleanedQuery.replace(CHINESE_EXCLUSION_PATTERN, (_match, value) => {
    terms.push(String(value || ''))
    return ' '
  })

  cleanedQuery = cleanedQuery.replace(ENGLISH_EXCLUSION_PATTERN, (_match, value) => {
    terms.push(String(value || ''))
    return ' '
  })

  cleanedQuery = cleanedQuery.replace(DASH_EXCLUSION_PATTERN, (_match, prefix, value) => {
    terms.push(String(value || ''))
    return prefix || ' '
  })

  return {
    query: cleanedQuery,
    terms: uniqueNormalizedTerms(terms)
  }
}

function normalizeAiDateRange(rawDateRange: unknown, now: number): NaturalSearchDateRange | null {
  if (!rawDateRange || typeof rawDateRange !== 'object') {
    return null
  }

  const source = rawDateRange as Record<string, unknown>
  const label = cleanNaturalText(source.label, 40) || 'AI 时间范围'
  const from = parseAiDate(source.from, { endOfDay: false })
  const to = parseAiDate(source.to, { endOfDay: false })
  const currentYear = new Date(now).getFullYear()
  const earliest = new Date(currentYear - 10, 0, 1).getTime()
  const latest = new Date(currentYear + 1, 11, 31).getTime()

  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || from < earliest || to > latest) {
    return null
  }

  return rangeFromDates(from, to, label)
}

function parseAiDate(value: unknown, { endOfDay }: { endOfDay: boolean }): number {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return NaN
  }

  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (endOfDay) {
    date.setHours(23, 59, 59, 999)
  } else {
    date.setHours(0, 0, 0, 0)
  }
  return date.getTime()
}

function uniqueQueries(values: string[]): string[] {
  const seen = new Set<string>()
  const queries: string[] = []

  for (const value of values) {
    const query = uniqueNormalizedTerms(getQueryTerms(normalizeQuery(value))).join(' ')
    if (!query || seen.has(query)) {
      continue
    }

    seen.add(query)
    queries.push(query)
    if (queries.length >= NATURAL_QUERY_LIMIT) {
      break
    }
  }

  return queries
}

function uniqueNormalizedTerms(values: string[]): string[] {
  const seen = new Set<string>()
  const terms: string[] = []

  for (const value of values) {
    const normalizedTerms = getQueryTerms(normalizeQuery(value))
    for (const term of normalizedTerms) {
      if (!term || seen.has(term)) {
        continue
      }
      seen.add(term)
      terms.push(term)
    }
  }

  return terms
}

function matchesExcludedTerms(bookmark: PopupSearchBookmark, excludedTerms: string[]): boolean {
  if (!excludedTerms.length) {
    return false
  }

  const searchText = bookmark.searchText || `${bookmark.normalizedTitle} ${bookmark.normalizedUrl}`
  return excludedTerms.some((term) => searchText.includes(term))
}

function buildNaturalMatchReasons(
  plan: NaturalSearchPlan,
  reasons: string[],
  matchedQuery: string
): string[] {
  const querySummary = formatNaturalTerms(getQueryTerms(matchedQuery), 4)
  const naturalReasons = [
    querySummary ? `关键词：${querySummary}` : '',
    plan.dateRange?.label ? `时间：${plan.dateRange.label}` : ''
  ].filter(Boolean)

  return mergeReasons(
    mergeReasons(naturalReasons, reasons),
    plan.explanation ? [`解析：${plan.explanation}`] : []
  ).slice(0, 3)
}

function mergeReasons(left: string[], right: string[]): string[] {
  const output: string[] = []
  const seen = new Set<string>()
  for (const reason of [...left, ...right]) {
    const text = cleanNaturalText(reason, 120)
    if (text && !seen.has(text)) {
      output.push(text)
      seen.add(text)
    }
  }

  return output.slice(0, 3)
}

function compareNaturalSearchResults(left: PopupSearchResult, right: PopupSearchResult): number {
  if (right.score !== left.score) {
    return right.score - left.score
  }

  if (left.title.length !== right.title.length) {
    return left.title.length - right.title.length
  }

  return left.path.localeCompare(right.path, 'zh-Hans-CN')
}

function buildLocalExplanation({
  dateRange,
  baseTerms,
  synonymTerms,
  excludedTerms
}: {
  dateRange: NaturalSearchDateRange | null
  baseTerms: string[]
  synonymTerms: string[]
  excludedTerms: string[]
}): string {
  const baseSummary = formatNaturalTerms(baseTerms, 4)
  const synonymSummary = formatNaturalTerms(synonymTerms, 4)
  const exclusionSummary = formatNaturalTerms(excludedTerms, 3)
  const parts = [
    baseSummary ? `关键词 ${baseSummary}` : '',
    synonymSummary ? `扩展 ${synonymSummary}` : '',
    dateRange?.label ? `时间 ${dateRange.label}` : '',
    exclusionSummary ? `排除 ${exclusionSummary}` : ''
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : '已提取关键词并扩展同义词'
}

function getNaturalKeywordSummary(plan: NaturalSearchPlan): string {
  const terms = uniqueNormalizedTerms(getQueryTerms(plan.highlightQuery))
    .filter((term) => !plan.excludedTerms.includes(term))
  return formatNaturalTerms(terms, 3)
}

function formatNaturalTerms(terms: string[], limit: number): string {
  const uniqueTerms = uniqueNormalizedTerms(terms)
  const visibleTerms = uniqueTerms
    .slice(0, Math.max(1, limit)).flatMap(term => { const mappedResult = cleanNaturalText(term, 20); return mappedResult ? [mappedResult] : [] })

  if (!visibleTerms.length) {
    return ''
  }

  const suffix = uniqueTerms.length > visibleTerms.length ? ` 等 ${uniqueTerms.length} 个` : ''
  return `${visibleTerms.join(' / ')}${suffix}`
}

function rangeFromDates(from: number, to: number, label: string): NaturalSearchDateRange {
  return {
    from,
    to,
    label
  }
}

function startOfDay(date: Date): Date {
  const output = new Date(date)
  output.setHours(0, 0, 0, 0)
  return output
}

function startOfWeek(date: Date): Date {
  const output = startOfDay(date)
  const dayOffset = (output.getDay() + 6) % 7
  output.setDate(output.getDate() - dayOffset)
  return output
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function subtractCalendarMonthsClamped(date: Date, months: number): Date {
  const monthOffset = Math.max(0, Math.round(months) || 0)
  const targetFirst = new Date(date.getFullYear(), date.getMonth() - monthOffset, 1)
  const targetYear = targetFirst.getFullYear()
  const targetMonth = targetFirst.getMonth()
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const output = new Date(
    targetYear,
    targetMonth,
    Math.min(date.getDate(), lastDayOfTargetMonth)
  )
  output.setHours(0, 0, 0, 0)
  return output
}

function createValidLocalDate(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateRangePart(year: number, month: number, day?: number): string {
  const normalizedMonth = String(month).padStart(2, '0')
  if (day) {
    return `${year}-${normalizedMonth}-${String(day).padStart(2, '0')}`
  }

  return `${year}-${normalizedMonth}`
}

function cleanNaturalText(value: unknown, limit = 180): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) {
    return text
  }

  return `${text.slice(0, Math.max(1, limit - 1)).trim()}…`
}
