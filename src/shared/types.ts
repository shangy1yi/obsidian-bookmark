export interface BookmarkRecord {
  id: string
  title: string
  url: string
  displayUrl: string
  normalizedTitle: string
  normalizedUrl: string
  duplicateKey: string
  domain: string
  path: string
  ancestorIds: string[]
  parentId: string
  index: number
  dateAdded: number
}

export interface FolderRecord {
  id: string
  title: string
  path: string
  normalizedTitle: string
  normalizedPath: string
  depth: number
  folderCount: number
  bookmarkCount: number
}

export interface BookmarkCatalogVersionFingerprint {
  bookmarkHash: string
  folderHash: string
}

export interface ExtractedBookmarkData {
  bookmarks: BookmarkRecord[]
  folders: FolderRecord[]
  bookmarkMap: Map<string, BookmarkRecord>
  folderMap: Map<string, FolderRecord>
  catalogVersionFingerprint: BookmarkCatalogVersionFingerprint
}

export type NavigationStatus = 'available' | 'failed'

export interface NavigationAttempt {
  status: NavigationStatus
  finalUrl: string
  detail: string
  errorCode: string
  networkEvidence?: NavigationNetworkEvidence
}

export interface NavigationNetworkRedirect {
  url: string
  redirectUrl: string
  statusCode: number
  elapsedMs?: number
}

export interface NavigationNetworkTiming {
  requestStartMs?: number
  responseStartMs?: number
  completedMs?: number
  failedMs?: number
  responseLatencyMs?: number
  totalMs?: number
}

export interface NavigationNetworkEvidence {
  requestSent: boolean
  requestId?: string
  method?: string
  requestedUrl: string
  finalUrl?: string
  statusUrl?: string
  statusCode?: number
  statusLine?: string
  finalResponseObserved?: boolean
  errorCode?: string
  fromCache?: boolean
  redirects: NavigationNetworkRedirect[]
  timing: NavigationNetworkTiming
}

export type ProbeKind =
  | 'ok'
  | 'restricted'
  | 'temporary'
  | 'missing'
  | 'network'
  | 'unknown'

export interface ProbeResult {
  kind: ProbeKind
  method: string
  label: string
  detail: string
  finalUrl?: string
  redirected?: boolean
  errorCode?: string
}

export interface NavigationEvidence {
  errorCodes: string[]
  strongFailures: number
  repeatedStrongFailure: boolean
  onlyTimeoutErrors: boolean
  hasClientBlockingError: boolean
  onlyAmbiguousErrors: boolean
}

export type AvailabilityStatus = 'available' | 'redirected' | 'review' | 'failed'

export interface AvailabilityResult extends BookmarkRecord {
  status: AvailabilityStatus
  badgeText: string
  finalUrl: string
  detail: string
  errorCode?: string
  historyStatus?: 'new' | 'persistent' | ''
  abnormalStreak?: number
}
