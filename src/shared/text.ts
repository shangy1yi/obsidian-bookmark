export function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripCommonUrlPrefix(value: unknown): string {
  return String(value || '').replace(/^\s*(https?:\/\/)?(www\.)?/i, '')
}

export function normalizeUrl(url: unknown): string {
  return normalizeText(stripCommonUrlPrefix(url))
}

export function displayUrl(url: unknown): string {
  return String(url || '')
    .replace(/^(https?:\/\/)?(www\.)?/i, '')
    .replace(/\/$/, '')
}

export function extractDomain(url: unknown): string {
  try {
    return new URL(String(url || ''))
      .hostname.replace(/^www\./i, '')
      .toLowerCase()
  } catch {
    return ''
  }
}

export function buildDuplicateKey(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || ''))
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/'
    return `${parsedUrl.hostname.replace(/^www\./i, '').toLowerCase()}${pathname}${parsedUrl.search}`.toLowerCase()
  } catch {
    return normalizeText(String(url || '').replace(/#.*$/, '').replace(/\/+$/, ''))
  }
}
