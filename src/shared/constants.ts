export const BOOKMARKS_BAR_ID = '1'
export const ROOT_ID = '0'

export const STORAGE_KEYS = {
  ignoreRules: 'obsidianBookmarkIgnoreRules',
  detectionHistory: 'obsidianBookmarkDetectionHistory',
  redirectCache: 'obsidianBookmarkRedirectCache',
  recycleBin: 'obsidianBookmarkRecycleBin',
  aiNamingSettings: 'obsidianBookmarkAiNamingSettings'
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

export const RECYCLE_BIN_LIMIT = 200
export const UNDO_WINDOW_MS = 5000
