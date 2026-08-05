import { normalizeText, stripCommonUrlPrefix } from './text.js'

export type SearchChipKind = 'site' | 'folder' | 'type' | 'time' | 'exclude'

type RelativeTimeUnit = 'day' | 'week' | 'month'
type FixedTimeUnit = 'current-month' | 'current-week' | 'last-month' | 'last-week' | 'half-year' | 'today' | 'yesterday' | 'before-yesterday'

export interface SearchDateRange {
  from: number
  to: number
  label: string
}

export interface ParsedSearchQuery {
  rawQuery: string
  textTerms: string[]
  siteFilters: string[]
  folderFilters: string[]
  typeFilters: string[]
  excludedTerms: string[]
  dateRange: SearchDateRange | null
  chips: Array<{ kind: SearchChipKind; label: string; value: string }>
}

const RELATIVE_TIME_PATTERN = /^(?:最近|近|过去)(\d+|一|两|二|三|四|五|六|七|八|九|十)(天|日|周|星期|礼拜|个月|月)$/
const FIXED_TIME_PATTERNS: Array<{ pattern: RegExp; unit: FixedTimeUnit; label: string }> = [
  { pattern: /^(今天|今日)$/, unit: 'today', label: '今天' },
  { pattern: /^(昨天|昨日)$/, unit: 'yesterday', label: '昨天' },
  { pattern: /^(前天)$/, unit: 'before-yesterday', label: '前天' },
  { pattern: /^(本周|这周|这个星期)$/, unit: 'current-week', label: '本周' },
  { pattern: /^(上周|上一周|上星期|上个星期)$/, unit: 'last-week', label: '上周' },
  { pattern: /^(本月|这个月)$/, unit: 'current-month', label: '本月' },
  { pattern: /^(上月|上个月)$/, unit: 'last-month', label: '上个月' },
  { pattern: /^(最近半年|近半年|过去半年)$/, unit: 'half-year', label: '最近 6 个月' }
]

const SEARCH_OPERATOR_KEYS = new Set([
  'site',
  'domain',
  'url',
  '站点',
  '域名',
  'folder',
  'path',
  '文件夹',
  '目录',
  '路径',
  'type',
  'kind',
  '类型',
  '类别'
])

const SAFE_LOCAL_RULE_FILLER_PATTERNS = [
  /帮我/g,
  /帮忙/g,
  /麻烦/g,
  /请/g,
  /找一下/g,
  /找找/g,
  /搜索/g,
  /查找/g,
  /查一下/g,
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
  /资料/g
]

const CHINESE_SEARCH_EXCLUSION_PATTERN = /(?:不要|不看|排除|过滤掉|过滤|不是|别给我|剔除|去掉)\s*([a-z0-9][a-z0-9+.#/_-]*|[\u3400-\u9fff]{1,12})/gi
const ENGLISH_SEARCH_EXCLUSION_PATTERN = /\b(?:without|exclude|excluding|not|no)\s+([a-z0-9][a-z0-9+.#/_-]*)/gi
const DASH_SEARCH_EXCLUSION_PATTERN = /(^|\s)-([a-z0-9][a-z0-9+.#/_-]*|[\u3400-\u9fff]{1,12})/gi
const SAFE_LOCAL_STRUCTURED_OPERATOR_PATTERN = /(^|\s)((?:site|domain|url|folder|path|type|kind|站点|域名|文件夹|目录|路径|类型|类别)[:：]\s*(?:"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’|[^\s，。！？；、,!?;()[\]{}"'“”‘’]+))/gi
const SAFE_LOCAL_PLACEHOLDER_START = 0xe000
const SAFE_LOCAL_PLACEHOLDER_PATTERN = /[\ue000-\uf8ff]/g

export function parseSearchQuery(query: unknown, now = Date.now()): ParsedSearchQuery {
  const rawQuery = normalizeRawSearchQuery(query)
  const safeRules = applySafeLocalSearchRules(rawQuery)
  const tokens = tokenizeSearchQuery(safeRules.query)
  const textTerms: string[] = []
  const siteFilters: string[] = []
  const folderFilters: string[] = []
  const typeFilters: string[] = []
  const excludedTerms: string[] = []
  const chips: ParsedSearchQuery['chips'] = []
  let dateRange: SearchDateRange | null = null

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const mergedTime = parseTimeExpression(tokens, index, now)
    if (mergedTime) {
      dateRange = mergedTime.range
      chips.push({ kind: 'time', label: `时间：${mergedTime.range.label}`, value: mergedTime.range.label })
      index += mergedTime.consumed - 1
      continue
    }

    const operator = parseSearchOperatorTokens(tokens, index)
    if (operator) {
      if (operator.kind === 'site') {
        siteFilters.push(operator.value)
        chips.push({ kind: 'site', label: `站点：${operator.value}`, value: operator.value })
      } else if (operator.kind === 'folder') {
        folderFilters.push(operator.value)
        chips.push({ kind: 'folder', label: `文件夹：${operator.value}`, value: operator.value })
      } else {
        typeFilters.push(operator.value)
        chips.push({ kind: 'type', label: `类型：${operator.value}`, value: operator.value })
      }
      index += operator.consumed - 1
      continue
    }

    if (token.startsWith('-') && token.length > 1) {
      const value = normalizeFilterValue(token.slice(1))
      if (value) {
        excludedTerms.push(value)
        chips.push({ kind: 'exclude', label: `排除：${value}`, value })
      }
      continue
    }

    textTerms.push(token)
  }

  return {
    rawQuery,
    textTerms: uniqueTerms(textTerms),
    siteFilters: uniqueTerms(siteFilters),
    folderFilters: uniqueTerms(folderFilters),
    typeFilters: uniqueTerms(typeFilters),
    excludedTerms: uniqueTerms([...excludedTerms, ...safeRules.excludedTerms]),
    dateRange,
    chips: dedupeChips(chips)
  }
}

function applySafeLocalSearchRules(query: unknown): { query: string; excludedTerms: string[] } {
  const rawQuery = normalizeRawSearchQuery(query)
  const protectedParts: string[] = []
  const protectedQuery = protectSafeLocalStructuredSearch(rawQuery, protectedParts)
  const exclusion = extractSafeLocalSearchExclusions(protectedQuery)
  const cleanedQuery = restoreSafeLocalStructuredSearch(
    cleanSafeLocalSearchQuery(exclusion.query),
    protectedParts
  )
  const excludedTerms = uniqueTerms(exclusion.terms)
  const negativeTerms = excludedTerms.flatMap(term => { const mappedResult = `-${formatSafeLocalRuleTerm(term)}`; return mappedResult ? [mappedResult] : [] })

  return {
    query: [cleanedQuery, ...negativeTerms].filter(Boolean).join(' ') || rawQuery,
    excludedTerms
  }
}

export function buildSearchTextQuery(parsed: ParsedSearchQuery): string {
  return parsed.textTerms.join(' ')
}

export function matchesParsedSearchQuery(
  parsed: ParsedSearchQuery,
  target: {
    searchText: string
    domain?: string
    url?: string
    path?: string
    type?: string
    dateAdded?: number
  }
): boolean {
  const searchText = normalizeSearchValue(target.searchText)
  const domain = normalizeSearchValue(target.domain)
  const url = normalizeSearchValue(target.url)
  const path = normalizeSearchValue(target.path)
  const type = normalizeSearchValue(target.type)

  if (parsed.siteFilters.length && !parsed.siteFilters.some((filter) => domain.includes(filter) || url.includes(filter))) {
    return false
  }

  if (parsed.folderFilters.length && !parsed.folderFilters.some((filter) => path.includes(filter))) {
    return false
  }

  if (parsed.typeFilters.length && !parsed.typeFilters.some((filter) => type.includes(filter))) {
    return false
  }

  if (parsed.excludedTerms.length && parsed.excludedTerms.some((term) => searchText.includes(term))) {
    return false
  }

  if (parsed.dateRange) {
    const dateAdded = Number(target.dateAdded)
    if (!Number.isFinite(dateAdded) || dateAdded < parsed.dateRange.from || dateAdded > parsed.dateRange.to) {
      return false
    }
  }

  return true
}

function parseSearchOperatorTerm(term: string): { kind: 'site' | 'folder' | 'type'; value: string } | null {
  const match = String(term || '').match(/^([^:：]+)[:：](.+)$/)
  if (!match) {
    return null
  }

  const key = normalizeSearchValue(match[1])
  const value = normalizeFilterValue(match[2])
  if (!value) {
    return null
  }

  if (key === 'site' || key === 'domain' || key === 'url' || key === '站点' || key === '域名') {
    return { kind: 'site', value }
  }
  if (key === 'folder' || key === 'path' || key === '文件夹' || key === '目录' || key === '路径') {
    return { kind: 'folder', value }
  }
  if (key === 'type' || key === 'kind' || key === '类型' || key === '类别') {
    return { kind: 'type', value }
  }

  return null
}

function parseSearchOperatorTokens(
  tokens: string[],
  index: number
): { kind: 'site' | 'folder' | 'type'; value: string; consumed: number } | null {
  const current = String(tokens[index] || '')
  const direct = parseSearchOperatorTerm(current)
  if (direct) {
    return { ...direct, consumed: 1 }
  }

  const keyOnly = current.match(/^([^:：]+)[:：]$/)
  if (!keyOnly || index + 1 >= tokens.length) {
    return null
  }

  const key = normalizeSearchValue(keyOnly[1])
  if (!SEARCH_OPERATOR_KEYS.has(key)) {
    return null
  }

  const nextValue = normalizeFilterValue(tokens[index + 1])
  if (!nextValue) {
    return null
  }

  const merged = parseSearchOperatorTerm(`${key}:${nextValue}`)
  return merged ? { ...merged, consumed: 2 } : null
}

function parseTimeExpression(tokens: string[], index: number, now: number): { range: SearchDateRange; consumed: number } | null {
  const candidates = [
    index + 2 < tokens.length
      ? { value: `${tokens[index] || ''}${tokens[index + 1] || ''}${tokens[index + 2] || ''}`, consumed: 3 }
      : null,
    index + 1 < tokens.length
      ? { value: `${tokens[index] || ''}${tokens[index + 1] || ''}`, consumed: 2 }
      : null,
    { value: tokens[index], consumed: 1 }
  ].filter(Boolean) as Array<{ value: string; consumed: number }>

  for (const candidate of candidates) {
    const range = parseTimeToken(candidate.value, now)
    if (range) {
      return { range, consumed: candidate.consumed }
    }
  }

  return null
}

function parseTimeToken(token: string, now: number): SearchDateRange | null {
  const value = normalizeSearchValue(token)
  const relative = parseRelativeTimeToken(value)
  if (relative) {
    return buildRelativeDateRange(relative.amount, relative.unit, relative.label, now)
  }

  for (const item of FIXED_TIME_PATTERNS) {
    if (item.pattern.test(value)) {
      return buildFixedDateRange(item.unit, item.label, now)
    }
  }
  return null
}

function parseRelativeTimeToken(value: string): { amount: number; unit: RelativeTimeUnit; label: string } | null {
  const match = value.match(RELATIVE_TIME_PATTERN)
  if (!match) {
    return null
  }

  const amount = parseTimeAmount(match[1])
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  const unit = normalizeTimeUnit(match[2])
  const label = `最近 ${amount} ${getTimeUnitLabel(unit)}`
  return { amount, unit, label }
}

function buildRelativeDateRange(amount: number, unit: RelativeTimeUnit, label: string, now: number): SearchDateRange {
  const end = endOfDay(now)
  if (unit === 'week') {
    return { from: startOfDay(now - (amount * 7 - 1) * 24 * 60 * 60 * 1000), to: end, label }
  }
  if (unit === 'month') {
    const date = new Date(now)
    date.setMonth(date.getMonth() - amount)
    return { from: startOfDay(date.getTime()), to: end, label }
  }
  return { from: startOfDay(now - (amount - 1) * 24 * 60 * 60 * 1000), to: end, label }
}

function buildFixedDateRange(unit: FixedTimeUnit, label: string, now: number): SearchDateRange {
  const end = endOfDay(now)
  if (unit === 'current-month') {
    const date = new Date(now)
    return { from: new Date(date.getFullYear(), date.getMonth(), 1).getTime(), to: end, label }
  }
  if (unit === 'last-month') {
    const date = new Date(now)
    return {
      from: new Date(date.getFullYear(), date.getMonth() - 1, 1).getTime(),
      to: new Date(date.getFullYear(), date.getMonth(), 1).getTime() - 1,
      label
    }
  }
  if (unit === 'half-year') {
    const date = new Date(now)
    date.setMonth(date.getMonth() - 6)
    return { from: startOfDay(date.getTime()), to: end, label }
  }
  if (unit === 'current-week') {
    const date = new Date(now)
    const day = date.getDay() || 7
    return { from: startOfDay(now - (day - 1) * 24 * 60 * 60 * 1000), to: end, label }
  }
  if (unit === 'last-week') {
    const date = new Date(now)
    const day = date.getDay() || 7
    const currentWeekStart = startOfDay(now - (day - 1) * 24 * 60 * 60 * 1000)
    return {
      from: currentWeekStart - 7 * 24 * 60 * 60 * 1000,
      to: currentWeekStart - 1,
      label
    }
  }
  if (unit === 'yesterday') {
    const todayStart = startOfDay(now)
    return { from: todayStart - 24 * 60 * 60 * 1000, to: todayStart - 1, label }
  }
  if (unit === 'before-yesterday') {
    const todayStart = startOfDay(now)
    return { from: todayStart - 2 * 24 * 60 * 60 * 1000, to: todayStart - 24 * 60 * 60 * 1000 - 1, label }
  }
  return { from: startOfDay(now), to: end, label }
}

function parseTimeAmount(value: string): number {
  if (/^\d+$/.test(value)) {
    return Number(value)
  }

  const digits: Record<string, number> = {
    一: 1,
    两: 2,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  }
  return digits[value] || 0
}

function normalizeTimeUnit(value: string): RelativeTimeUnit {
  if (value === '周' || value === '星期' || value === '礼拜') {
    return 'week'
  }
  if (value === '个月' || value === '月') {
    return 'month'
  }
  return 'day'
}

function getTimeUnitLabel(unit: RelativeTimeUnit): string {
  if (unit === 'week') {
    return '周'
  }
  if (unit === 'month') {
    return '个月'
  }
  return '天'
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function endOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

function normalizeRawSearchQuery(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value)).trim()
}

function cleanSafeLocalSearchQuery(query: string): string {
  let text = String(query || '')
    .replace(/[，。！？；、]/g, ' ')
    .replace(/([a-z0-9])([\u3400-\u9fff])/gi, '$1 $2')
    .replace(/([\u3400-\u9fff])([a-z0-9])/gi, '$1 $2')

  for (const pattern of SAFE_LOCAL_RULE_FILLER_PATTERNS) {
    text = text.replace(pattern, ' ')
  }

  return text
    .replace(/\s+/g, ' ')
    .trim()
}

function protectSafeLocalStructuredSearch(query: string, protectedParts: string[]): string {
  return String(query || '').replace(SAFE_LOCAL_STRUCTURED_OPERATOR_PATTERN, (_match, prefix, operatorTerm) => {
    const index = protectedParts.push(String(operatorTerm || '')) - 1
    return `${prefix || ''}${String.fromCharCode(SAFE_LOCAL_PLACEHOLDER_START + index)}`
  })
}

function restoreSafeLocalStructuredSearch(query: string, protectedParts: string[]): string {
  return String(query || '').replace(SAFE_LOCAL_PLACEHOLDER_PATTERN, (placeholder) => {
    const index = placeholder.charCodeAt(0) - SAFE_LOCAL_PLACEHOLDER_START
    return protectedParts[index] || placeholder
  })
}

function extractSafeLocalSearchExclusions(query: string): { query: string; terms: string[] } {
  const terms: string[] = []
  let cleanedQuery = String(query || '')

  cleanedQuery = cleanedQuery.replace(CHINESE_SEARCH_EXCLUSION_PATTERN, (_match, value) => {
    terms.push(String(value || ''))
    return ' '
  })

  cleanedQuery = cleanedQuery.replace(ENGLISH_SEARCH_EXCLUSION_PATTERN, (_match, value) => {
    terms.push(String(value || ''))
    return ' '
  })

  cleanedQuery = cleanedQuery.replace(DASH_SEARCH_EXCLUSION_PATTERN, (_match, prefix, value) => {
    terms.push(String(value || ''))
    return prefix || ' '
  })

  return {
    query: cleanedQuery,
    terms: uniqueTerms(terms)
  }
}

function formatSafeLocalRuleTerm(term: string): string {
  const normalized = normalizeSearchValue(term)
  if (!normalized) {
    return ''
  }

  return /\s/.test(normalized) ? `"${normalized.replace(/"/g, '')}"` : normalized
}

function normalizeSearchValue(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim()
}

function normalizeFilterValue(value: unknown): string {
  return normalizeSearchValue(value)
}

function uniqueTerms(values: string[]): string[] {
  return [...new Set(values.flatMap(value => { const mappedResult = normalizeFilterValue(value); return mappedResult ? [mappedResult] : [] }))]
}

function tokenizeSearchQuery(query: string): string[] {
  const tokens: string[] = []
  const source = String(query || '')
  let current = ''
  let quote = ''

  const pushCurrent = () => {
    const value = current.trim()
    if (value) {
      tokens.push(value)
    }
    current = ''
  }

  for (const char of source) {
    if (quote) {
      if (isMatchingSearchQuote(char, quote)) {
        quote = ''
        continue
      }
      current += char
      continue
    }

    if (isSearchQuote(char)) {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      pushCurrent()
      continue
    }

    current += char
  }

  pushCurrent()
  return tokens
}

function isSearchQuote(char: string): boolean {
  return char === '"' || char === "'" || char === '“' || char === '‘'
}

function isMatchingSearchQuote(char: string, quote: string): boolean {
  if (quote === '“') {
    return char === '”'
  }
  if (quote === '‘') {
    return char === '’'
  }
  return char === quote
}

function dedupeChips(chips: ParsedSearchQuery['chips']): ParsedSearchQuery['chips'] {
  const seen = new Set<string>()
  return chips.filter((chip) => {
    const key = `${chip.kind}:${chip.value}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
