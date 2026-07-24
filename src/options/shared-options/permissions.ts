import {
  assessSensitiveExternalUrl,
  isExternallyCheckableUrl
} from '../../shared/sensitive-url.js'

export function collectRequestOrigins(bookmarks: Array<{ url?: string }>): string[] {
  const origins = new Set<string>()

  for (const bookmark of bookmarks) {
    try {
      const parsedUrl = new URL(String(bookmark.url || ''))
      if (/^https?:$/i.test(parsedUrl.protocol) && !assessSensitiveExternalUrl(parsedUrl.href).sensitive) {
        origins.add(`${parsedUrl.origin}/*`)
      }
    } catch {
      continue
    }
  }

  return [...origins].sort((left, right) => left.localeCompare(right))
}

export function isCheckableUrl(url: unknown): boolean {
  return isExternallyCheckableUrl(url)
}

export function getOriginPermissionPattern(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return ''
    }

    return `${parsedUrl.origin}/*`
  } catch {
    return ''
  }
}

export function containsPermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}

export function requestPermissions(query: chrome.permissions.Permissions): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.request(query, (granted) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(Boolean(granted))
    })
  })
}
