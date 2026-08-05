interface FaviconUrlOptions {
  size?: number
  cacheToken?: number | string
}

export function buildChromeFaviconUrl(
  faviconEndpointUrl: string,
  pageUrl: string,
  { size = 32, cacheToken = '' }: FaviconUrlOptions = {}
): string {
  const url = new URL(faviconEndpointUrl)
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', String(clampInteger(size, 16, 128, 32)))
  url.searchParams.set('cache', '1')
  if (cacheToken) {
    url.searchParams.set('refresh', String(cacheToken))
  }
  return url.toString()
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric)) {
    return fallback
  }
  return Math.max(min, Math.min(max, numeric))
}
