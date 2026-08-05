import {
  getBackgroundMaskBaseColor,
  getBackgroundMaskBackdropFilter,
  getBackgroundMaskOverlayGradient,
  normalizeBackgroundMaskStyle
} from './background-mask-settings.js'

interface InstantWallpaperTargetRecord {
  signature?: string
  imageUrl?: string
  imageDataUrlRef?: string
  previewUrl?: string
  backgroundSize?: string
  backgroundPosition?: string
  placeholderColor?: string
  maskEnabled?: boolean
  maskStyle?: unknown
  maskOverlay?: unknown
  maskBlur?: unknown
  updatedAt?: number
}

interface InstantWallpaperRecord {
  signature?: string
  dataUrl?: string
  dataUrlRef?: string
  imageDataUrl?: string
  imageDataUrlRef?: string
  ready?: boolean
}

interface BackgroundMaskSnapshotRecord {
  maskEnabled?: boolean
  maskStyle?: unknown
  maskOverlay?: unknown
  maskBlur?: unknown
}

interface StartupWallpaperView {
  backgroundColor: string
  booting: boolean
  image: string
  loaderVisible: boolean
  loading: boolean
  pending: boolean
  placeholderColor: string
  position: string
  previewImage: string
  ready: boolean
  remoteReady: boolean
  signature: string
  size: string
}

const thumbnailKey = 'curatorNewTabInstantWallpaper'
const thumbnailDataUrlKey = 'curatorNewTabInstantWallpaperDataUrl'
const imageDataUrlKey = 'curatorNewTabInstantWallpaperImageDataUrl'
const targetKey = 'curatorNewTabInstantWallpaperTarget'
const maskSnapshotKey = 'curatorNewTabBackgroundMaskSnapshot'
const fallbackColor = '#101013'
const bootGlobal = globalThis as Record<string, unknown>
const startupView = createStartupView()

cacheBootView()

try {
  const targetRecord = readRecord<InstantWallpaperTargetRecord>(targetKey)
  const maskSnapshot = readRecord<BackgroundMaskSnapshotRecord>(maskSnapshotKey)
  cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_TARGET__', targetRecord)
  applyStartupMask(targetRecord, maskSnapshot)
  if (!targetRecord?.signature) {
    applyStartupBackground('', '', '', fallbackColor, 'cover', 'center')
    revealWallpaper(false)
  } else {
    const targetPreviewUrl = getTargetPreviewUrl(targetRecord)
    const targetImageUrl = getTargetImageUrl(targetRecord)
    const thumbnailRecord = readRecord<InstantWallpaperRecord>(thumbnailKey)
    const thumbnailDataUrl = getMatchingThumbnailDataUrl(thumbnailRecord, targetRecord.signature)
    const startupImageDataUrl = getMatchingImageDataUrl(thumbnailRecord, targetRecord)
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_RECORD__', createBootRecord(targetRecord, thumbnailDataUrl, startupImageDataUrl))
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_DATA_URL__', thumbnailDataUrl)
    cacheBootRecord('__CURATOR_INSTANT_WALLPAPER_BOOT_IMAGE_DATA_URL__', startupImageDataUrl)

    const startupImageUrl = startupImageDataUrl || targetImageUrl
    const startupPreviewUrl = startupImageUrl || targetPreviewUrl || thumbnailDataUrl
    const startupPreviewFallbackUrl = thumbnailDataUrl && thumbnailDataUrl !== startupPreviewUrl
      ? thumbnailDataUrl
      : ''
    preloadStartupImage(startupImageUrl || startupPreviewUrl)
    const placeholderColor = normalizeColor(targetRecord.placeholderColor)
    applyStartupBackground(
      startupImageUrl,
      startupPreviewUrl,
      startupPreviewFallbackUrl,
      placeholderColor,
      normalizeBackgroundSize(targetRecord.backgroundSize),
      typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition
        ? targetRecord.backgroundPosition
        : 'center',
      targetRecord.signature
    )
    revealWallpaper(Boolean(startupImageUrl || startupPreviewUrl))
  }
} catch {
  applyStartupMask(null, null)
  applyStartupBackground('', '', '', fallbackColor, 'cover', 'center')
  revealWallpaper(false)
}

function readRecord<TRecord>(key: string): TRecord | null {
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as TRecord
  } catch {
    return null
  }
}

function readDataUrl(key: string): string {
  const raw = window.localStorage.getItem(key)
  return typeof raw === 'string' && raw.startsWith('data:image/') ? raw : ''
}

function getStoredPreviewDataUrl(record: InstantWallpaperRecord | null, fallbackDataUrlRef: string): string {
  if (!record || record.ready === false) {
    return ''
  }
  const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl : ''
  if (dataUrl.startsWith('data:image/')) {
    return dataUrl
  }
  const dataUrlRef = typeof record.dataUrlRef === 'string' && record.dataUrlRef.trim()
    ? record.dataUrlRef.trim()
    : fallbackDataUrlRef
  return readDataUrl(dataUrlRef)
}

function cacheBootRecord(key: string, record: unknown): void {
  bootGlobal[key] = record
}

function cacheBootView(): void {
  if (bootGlobal.__CURATOR_INSTANT_WALLPAPER_BOOT_VIEW_CONSUMED__ === true) {
    return
  }
  bootGlobal.__CURATOR_INSTANT_WALLPAPER_BOOT_VIEW__ = { ...startupView }
}

function updateBootView(nextView: Partial<StartupWallpaperView>): void {
  Object.assign(startupView, nextView)
  cacheBootView()
}

function createStartupView(): StartupWallpaperView {
  return {
    backgroundColor: fallbackColor,
    booting: true,
    image: '',
    loaderVisible: false,
    loading: true,
    pending: false,
    placeholderColor: fallbackColor,
    position: 'center',
    previewImage: '',
    ready: false,
    remoteReady: false,
    signature: '',
    size: 'cover'
  }
}

function createBootRecord(
  targetRecord: InstantWallpaperTargetRecord,
  thumbnailDataUrl: string,
  imageDataUrl: string
): InstantWallpaperRecord & {
  backgroundSize: string
  backgroundPosition: string
  placeholderColor: string
  updatedAt: number
} {
  const imageDataUrlRef = imageDataUrl ? getTargetImageDataUrlRef(targetRecord) || imageDataUrlKey : ''
  return {
    signature: targetRecord.signature,
    dataUrlRef: thumbnailDataUrl
      ? thumbnailDataUrlKey
      : imageDataUrl
        ? imageDataUrlRef
        : '',
    imageDataUrlRef,
    backgroundSize: normalizeBackgroundSize(targetRecord.backgroundSize),
    backgroundPosition: typeof targetRecord.backgroundPosition === 'string' && targetRecord.backgroundPosition
      ? targetRecord.backgroundPosition
      : 'center',
    placeholderColor: normalizeColor(targetRecord.placeholderColor),
    updatedAt: Number(targetRecord.updatedAt) || 0,
    ready: Boolean(thumbnailDataUrl || imageDataUrl)
  }
}

function applyStartupMask(
  targetRecord: InstantWallpaperTargetRecord | null,
  maskSnapshot: BackgroundMaskSnapshotRecord | null
): void {
  const root = document.documentElement
  // Prefer the dedicated mask snapshot: it is written for every background type
  // (including solid colors, which never produce a wallpaper target), so the mask
  // is painted on the first frame instead of appearing later with React.
  const maskSource: BackgroundMaskSnapshotRecord | InstantWallpaperTargetRecord | null =
    maskSnapshot && typeof maskSnapshot.maskEnabled === 'boolean'
      ? maskSnapshot
      : targetRecord
  const hasExplicitMaskSnapshot = typeof maskSource?.maskEnabled === 'boolean'
  // Targets written before mask snapshots existed should fail dark, not flash a full-bright wallpaper.
  const enabled = hasExplicitMaskSnapshot
    ? maskSource?.maskEnabled === true
    : Boolean(targetRecord?.signature)
  root.dataset.instantWallpaperMask = enabled ? 'true' : 'false'
  if (enabled) {
    const maskStyle = normalizeBackgroundMaskStyle(maskSource?.maskStyle)
    root.style.setProperty('--instant-wallpaper-mask-color', getBackgroundMaskBaseColor(maskStyle))
    root.style.setProperty('--instant-wallpaper-mask-filter', getBackgroundMaskBackdropFilter(maskStyle, maskSource?.maskBlur))
    root.style.setProperty('--instant-wallpaper-mask-image', getBackgroundMaskOverlayGradient(maskSource?.maskOverlay))
  } else {
    root.style.removeProperty('--instant-wallpaper-mask-color')
    root.style.removeProperty('--instant-wallpaper-mask-filter')
    root.style.removeProperty('--instant-wallpaper-mask-image')
  }
}

function applyStartupBackground(
  imageUrl: string,
  previewUrl: string,
  previewFallbackUrl: string,
  placeholderColor: string,
  backgroundSize: string,
  backgroundPosition: string,
  signature = ''
): void {
  const root = document.documentElement
  root.style.setProperty('--bg', placeholderColor)
  root.style.setProperty('--wallpaper-placeholder-bg', placeholderColor)
  root.style.setProperty('--instant-wallpaper-size', backgroundSize)
  root.style.setProperty('--instant-wallpaper-position', backgroundPosition)
  if (imageUrl) {
    root.style.setProperty('--instant-wallpaper-image', `url("${escapeCssUrl(imageUrl)}")`)
  } else {
    root.style.removeProperty('--instant-wallpaper-image')
  }
  const previewImage = createPreviewImageValue(previewUrl, previewFallbackUrl)
  root.style.setProperty('--instant-wallpaper-preview-image', previewImage)
  if (signature) {
    root.dataset.instantWallpaperSignature = signature
  }
  root.classList.remove('instant-wallpaper-remote-ready')
  delete root.dataset.instantWallpaperRemoteReady
  if (imageUrl && previewUrl && imageUrl === previewUrl) {
    root.dataset.instantWallpaperPreviewOnly = 'true'
  } else {
    delete root.dataset.instantWallpaperPreviewOnly
  }
  updateBootView({
    backgroundColor: placeholderColor,
    image: imageUrl ? `url("${escapeCssUrl(imageUrl)}")` : '',
    placeholderColor,
    position: backgroundPosition,
    previewImage,
    ready: false,
    remoteReady: false,
    signature,
    size: backgroundSize
  })
}

function createPreviewImageValue(previewUrl: string, previewFallbackUrl: string): string {
  const urls = [previewUrl, previewFallbackUrl]
    .map((url) => String(url || '').trim())
    .filter(Boolean)
    .filter((url, index, source) => source.indexOf(url) === index)
  if (!urls.length) {
    return 'none'
  }
  return urls.map((url) => `url("${escapeCssUrl(url)}")`).join(', ')
}

function revealWallpaper(hasPreview: boolean): void {
  const root = document.documentElement
  root.classList.add('instant-wallpaper-ready')
  root.classList.toggle('instant-wallpaper-startup-preview', hasPreview)
  root.classList.remove('loading-wallpaper', 'newtab-booting')
  delete root.dataset.instantWallpaperPending
  updateBootView({
    booting: false,
    loaderVisible: false,
    loading: false,
    pending: false,
    ready: hasPreview,
    remoteReady: false
  })
}

function getTargetPreviewUrl(targetRecord: InstantWallpaperTargetRecord): string {
  return typeof targetRecord.previewUrl === 'string' ? targetRecord.previewUrl.trim() : ''
}

function getTargetImageUrl(targetRecord: InstantWallpaperTargetRecord): string {
  return typeof targetRecord.imageUrl === 'string' ? targetRecord.imageUrl.trim() : ''
}

function getTargetImageDataUrlRef(targetRecord: InstantWallpaperTargetRecord): string {
  return typeof targetRecord.imageDataUrlRef === 'string' && targetRecord.imageDataUrlRef.trim()
    ? targetRecord.imageDataUrlRef.trim()
    : ''
}

function preloadStartupImage(imageUrl: string): void {
  if (!imageUrl || imageUrl.startsWith('data:image/')) {
    return
  }
  try {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = imageUrl
    link.setAttribute('fetchpriority', 'high')
    document.head.appendChild(link)
  } catch {
    // Preload only narrows the no-cache window; CSS still owns rendering.
  }
}

function getMatchingThumbnailDataUrl(
  thumbnailRecord: InstantWallpaperRecord | null,
  targetKey: string
): string {
  const thumbnailKey = thumbnailRecord?.signature || ''
  if (thumbnailKey !== targetKey || thumbnailRecord?.ready === false) {
    return ''
  }
  return getStoredPreviewDataUrl(thumbnailRecord, thumbnailDataUrlKey)
}

function getMatchingImageDataUrl(
  thumbnailRecord: InstantWallpaperRecord | null,
  targetRecord: InstantWallpaperTargetRecord
): string {
  const recordKey = thumbnailRecord?.signature || ''
  const targetSignature = targetRecord.signature || ''
  if (recordKey !== targetSignature || thumbnailRecord?.ready === false) {
    return ''
  }

  const inlineDataUrl = typeof thumbnailRecord.imageDataUrl === 'string' ? thumbnailRecord.imageDataUrl : ''
  if (inlineDataUrl.startsWith('data:image/')) {
    return inlineDataUrl
  }
  const dataUrlRef = getTargetImageDataUrlRef(targetRecord) ||
    (typeof thumbnailRecord.imageDataUrlRef === 'string' && thumbnailRecord.imageDataUrlRef.trim()
      ? thumbnailRecord.imageDataUrlRef.trim()
      : imageDataUrlKey)
  return readDataUrl(dataUrlRef)
}

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function normalizeBackgroundSize(value: unknown): string {
  const backgroundSize = typeof value === 'string' ? value.trim() : ''
  return /^\d+(?:\.\d+)?%\s+auto$/i.test(backgroundSize)
    ? 'cover'
    : backgroundSize || 'cover'
}

function normalizeColor(value: unknown): string {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return fallbackColor
}
