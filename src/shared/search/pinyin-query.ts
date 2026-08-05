
const PINYIN_LIKE_REGEX = /^[a-z][a-z0-9]*$/i

export function queryLooksLikePinyin(query: string): boolean {
  const trimmed = String(query || '').trim()
  if (trimmed.length < 3) {
    return false
  }
  return PINYIN_LIKE_REGEX.test(trimmed)
}

export function requiresPinyinTokens(query: string): boolean {
  return queryLooksLikePinyin(query)
}
