export type SearchEngineId =
  | 'google'
  | 'bing'
  | 'baidu'
  | 'duckduckgo'
  | 'perplexity'
  | 'chatgpt'
  | 'you'
  | 'kagi'
  | 'brave'

export type SearchEngineConfig = {
  id: SearchEngineId
  name: string
  shortName: string
  urlTemplate: string
  defaultEnabled: boolean
}

export type SearchOpenTarget = {
  engineId: SearchEngineId
  engineName: string
  url: string
}

export const SEARCH_MULTI_OPEN_LIMIT = 4

export const SEARCH_ENGINE_CONFIGS: SearchEngineConfig[] = [
  {
    id: 'google',
    name: 'Google',
    shortName: 'G',
    urlTemplate: 'https://www.google.com/search?q={query}',
    defaultEnabled: true
  },
  {
    id: 'bing',
    name: 'Bing',
    shortName: 'Bing',
    urlTemplate: 'https://www.bing.com/search?q={query}',
    defaultEnabled: true
  },
  {
    id: 'baidu',
    name: '百度',
    shortName: '百度',
    urlTemplate: 'https://www.baidu.com/s?wd={query}',
    defaultEnabled: true
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    shortName: 'DDG',
    urlTemplate: 'https://duckduckgo.com/?q={query}',
    defaultEnabled: true
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    shortName: 'PPLX',
    urlTemplate: 'https://www.perplexity.ai/search?q={query}',
    defaultEnabled: false
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    shortName: 'GPT',
    urlTemplate: 'https://chatgpt.com/?q={query}',
    defaultEnabled: false
  },
  {
    id: 'you',
    name: 'You.com',
    shortName: 'You',
    urlTemplate: 'https://you.com/search?q={query}',
    defaultEnabled: false
  },
  {
    id: 'kagi',
    name: 'Kagi',
    shortName: 'Kagi',
    urlTemplate: 'https://kagi.com/search?q={query}',
    defaultEnabled: false
  },
  {
    id: 'brave',
    name: 'Brave',
    shortName: 'Brave',
    urlTemplate: 'https://search.brave.com/search?q={query}',
    defaultEnabled: false
  }
]

export const SEARCH_ENGINE_CONFIG_BY_ID = new Map(
  SEARCH_ENGINE_CONFIGS.map((engine) => [engine.id, engine])
)

const SEARCH_ENGINE_IDS = new Set(SEARCH_ENGINE_CONFIGS.map((engine) => engine.id))

export const DEFAULT_ENABLED_SEARCH_ENGINE_IDS = SEARCH_ENGINE_CONFIGS.flatMap((combineValue, combineIndex, combineArray) => { if (!((engine) => engine.defaultEnabled)(combineValue)) return []; const combinedResult = ((engine) => engine.id)(combineValue); return [combinedResult] })

function isSearchEngineId(value: unknown): value is SearchEngineId {
  return typeof value === 'string' && SEARCH_ENGINE_IDS.has(value as SearchEngineId)
}

export function normalizeSearchEngineId(value: unknown, fallback: SearchEngineId = 'google'): SearchEngineId {
  return isSearchEngineId(value) ? value : fallback
}

export function normalizeEnabledSearchEngineIds(
  rawIds: unknown,
  selectedEngine: SearchEngineId = 'google'
): SearchEngineId[] {
  const ids = Array.isArray(rawIds)
    ? rawIds.filter(isSearchEngineId)
    : DEFAULT_ENABLED_SEARCH_ENGINE_IDS

  const deduped: SearchEngineId[] = []
  const dedupedSet = new Set<SearchEngineId>()
  for (const id of ids) {
    if (isSearchEngineId(id) && !dedupedSet.has(id)) {
      deduped.push(id)
      dedupedSet.add(id)
    }
  }

  if (!dedupedSet.has(selectedEngine)) {
    deduped.unshift(selectedEngine)
  }

  return deduped.length ? deduped : [selectedEngine]
}

function buildSearchEngineUrl(query: string, engineId: SearchEngineId): string {
  const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(engineId) || SEARCH_ENGINE_CONFIG_BY_ID.get('google')
  const encodedQuery = encodeURIComponent(String(query || '').trim())
  return String(engine?.urlTemplate || SEARCH_ENGINE_CONFIGS[0].urlTemplate).replace('{query}', encodedQuery)
}

export function planSearchOpenTargets(
  query: string,
  selectedEngine: SearchEngineId,
  enabledEngineIds: SearchEngineId[],
  openAllEnabled: boolean,
  limit = SEARCH_MULTI_OPEN_LIMIT
): SearchOpenTarget[] {
  const normalizedQuery = String(query || '').trim()
  if (!normalizedQuery) {
    return []
  }

  const engineIds = openAllEnabled
    ? normalizeEnabledSearchEngineIds(enabledEngineIds, selectedEngine).slice(0, Math.max(1, limit))
    : [selectedEngine]

  return engineIds.map((engineId) => {
    const engine = SEARCH_ENGINE_CONFIG_BY_ID.get(engineId) || SEARCH_ENGINE_CONFIG_BY_ID.get('google')!
    return {
      engineId,
      engineName: engine.name,
      url: buildSearchEngineUrl(normalizedQuery, engineId)
    }
  })
}
