import { normalizeBookmarkSaveUrl } from '../shared/bookmark-save-url.js'

{ normalizeBookmarkSaveUrl }

export function shouldReuseBookmarkForSave(
  existingUrl: unknown,
  requestedUrl: unknown
): boolean {
  const normalizedExistingUrl = normalizeBookmarkSaveUrl(existingUrl)
  return Boolean(
    normalizedExistingUrl &&
      normalizedExistingUrl === normalizeBookmarkSaveUrl(requestedUrl)
  )
}
