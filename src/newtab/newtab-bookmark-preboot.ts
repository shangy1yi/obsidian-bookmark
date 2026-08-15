import {
  markNewtabFaviconNotReady,
  markNewtabFaviconReady
} from './newtab-favicon-readiness.js'

export const NEWTAB_BOOKMARK_PREBOOT_ROOT_ID = 'newtab-bookmark-preboot'
export const NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY = 'curatorNewTabBookmarkPreboot'

const NEWTAB_BOOKMARK_PREBOOT_STYLE_ID = 'newtab-bookmark-preboot-style'
const NEWTAB_BOOKMARK_PREBOOT_VERSION = 4
const NEWTAB_BOOKMARK_PREBOOT_MAX_AGE_MS = 10 * 60 * 1000
const NEWTAB_BOOKMARK_PREBOOT_MAX_SECTIONS = 8
const NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS = 72
const NEWTAB_BOOKMARK_PREBOOT_EAGER_FAVICON_LIMIT = 12
const NEWTAB_BOOKMARK_PREBOOT_HIGH_PRIORITY_FAVICON_LIMIT = 6
const NEWTAB_BOOKMARK_PREBOOT_VIEWPORT_TOLERANCE_PX = 1
const NEWTAB_BOOKMARK_PREBOOT_HANDOFF_TOLERANCE_PX = 0.5
const NEWTAB_BOOKMARK_PREBOOT_HANDOFF_STABLE_FRAMES = 2
const NEWTAB_BOOKMARK_PREBOOT_SURFACE_HANDOFF_FRAMES = 2
const NEWTAB_BOOKMARK_PREBOOT_HANDOFF_MAX_WAIT_MS = 1200
const NEWTAB_BOOKMARK_PREBOOT_TITLE_GUARD_SAMPLE_MS = 100
const NEWTAB_BOOKMARK_PREBOOT_TITLE_GUARD_MAX_WAIT_MS = 5000
// squircle 引擎写入的 inline clip-path 形如 path("M 9.6 0 L 22.4 0 c …")；
// 快照只回放这一格式，其余（url()、多引号等）一律丢弃。
const NEWTAB_BOOKMARK_PREBOOT_CLIP_PATH_PATTERN = /^path\("[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-+eE]{1,4000}"\)$/

export interface NewtabBookmarkPrebootItemView {
  customIcon: boolean
  fallbackLabel: string
  favicon: { src: string }
  id: string
  title: string
  url: string
}

export interface NewtabBookmarkPrebootView {
  content: {
    columnGap: number
    columns: number
    fixedGridWidth: number
    folderGap: number
    iconShellSize: number
    layoutMode: string
    pageWidth: number
    rowGap: number
    showTitles: boolean
    tileWidth: number
    titleLines: number
  }
  sections: Array<{
    folderId: string
    grid: { items: NewtabBookmarkPrebootItemView[] } | null
  }>
}

export interface NewtabBookmarkPrebootClipPaths {
  fallback: string
  favicon: string
  iconShell: string
}

interface NewtabBookmarkPrebootContentStyle {
  clipPaths: NewtabBookmarkPrebootClipPaths
  columnGap: number
  columns: number
  fixedGridWidth: number
  folderGap: number
  iconShellSize: number
  layoutMode: 'fixed' | 'fluid'
  pageWidth: number
  rowGap: number
  showTitles: boolean
  tileWidth: number
  titleLines: number
}

interface NewtabBookmarkPrebootItem {
  fallbackLabel: string
  faviconSrc: string
  height: number
  id: string
  left: number
  title: string
  titleRect: NewtabBookmarkPrebootElementRect | null
  top: number
  width: number
}

interface NewtabBookmarkPrebootElementRect {
  height: number
  left: number
  top: number
  width: number
}

type NewtabBookmarkPrebootMeasuredItem = Pick<
  NewtabBookmarkPrebootItem,
  'height' | 'left' | 'top' | 'width'
> & {
  titleRect: NewtabBookmarkPrebootElementRect | null
}

interface NewtabBookmarkPrebootSection {
  folderId: string
  items: NewtabBookmarkPrebootItem[]
}

interface NewtabBookmarkPrebootRect {
  height: number
  left: number
  top: number
  viewportHeight: number
  viewportWidth: number
  width: number
}

export interface NewtabBookmarkPrebootSnapshot {
  content: NewtabBookmarkPrebootContentStyle
  rect: NewtabBookmarkPrebootRect
  sections: NewtabBookmarkPrebootSection[]
  updatedAt: number
  version: number
}

export interface NewtabBookmarkPrebootSnapshotOptions {
  now?: number
  sectionsElement?: HTMLElement | null
  viewportHeight?: number
  viewportWidth?: number
}

export type NewtabBookmarkPrebootHandoffResult = 'aligned' | 'missing' | 'stale' | 'timeout'

interface NewtabBookmarkPrebootHandoffOptions {
  onFinish?: (result: NewtabBookmarkPrebootHandoffResult) => void
}

export interface NewtabBookmarkPrebootFaviconLoadAttributes {
  fetchPriority: 'high' | 'low'
  loading: 'eager' | 'lazy'
}

type BookmarkPrebootStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>
type BookmarkPrebootWindow = Pick<Window, 'innerHeight' | 'innerWidth'>

export function installNewtabBookmarkPreboot(
  documentRef: Document = document,
  windowRef: Window = window,
  storage: BookmarkPrebootStorage = window.localStorage
): void {
  const snapshot = readNewtabBookmarkPrebootSnapshot(storage)
  if (!snapshot || !isFreshNewtabBookmarkPrebootSnapshot(snapshot)) {
    return
  }
  if (!isRenderableNewtabBookmarkPrebootSnapshot(snapshot, windowRef)) {
    return
  }

  installNewtabBookmarkPrebootStyle(documentRef)
  renderNewtabBookmarkPrebootSnapshot(snapshot, documentRef)
}

export function writeNewtabBookmarkPrebootSnapshotFromView(
  view: NewtabBookmarkPrebootView,
  options: NewtabBookmarkPrebootSnapshotOptions = {},
  storage: BookmarkPrebootStorage = window.localStorage
): NewtabBookmarkPrebootSnapshot | null {
  const snapshot = createNewtabBookmarkPrebootSnapshot(view, options)
  if (!snapshot) {
    clearNewtabBookmarkPrebootSnapshot(storage)
    return null
  }

  try {
    storage.setItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    clearNewtabBookmarkPrebootSnapshot(storage)
    return null
  }
  return snapshot
}

export function createNewtabBookmarkPrebootSnapshot(
  view: NewtabBookmarkPrebootView,
  options: NewtabBookmarkPrebootSnapshotOptions = {}
): NewtabBookmarkPrebootSnapshot | null {
  const rect = createNewtabBookmarkPrebootRect(options)
  if (!rect) {
    return null
  }
  const sections = createNewtabBookmarkPrebootSections(
    view,
    options.sectionsElement ?? null,
    rect
  )
  if (!sections.length) {
    return null
  }

  return {
    content: createNewtabBookmarkPrebootContentStyle(
      view.content,
      collectNewtabBookmarkPrebootClipPaths(options.sectionsElement ?? null)
    ),
    rect,
    sections,
    updatedAt: getFiniteNumber(options.now, Date.now()),
    version: NEWTAB_BOOKMARK_PREBOOT_VERSION
  }
}

export function clearNewtabBookmarkPrebootSnapshot(
  storage: BookmarkPrebootStorage = window.localStorage
): void {
  try {
    storage.removeItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY)
  } catch {
    // Ignore cache cleanup failures.
  }
}

export function hideNewtabBookmarkPreboot({ clearSnapshot = false } = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  if (clearSnapshot) {
    clearNewtabBookmarkPrebootSnapshot()
  }

  const root = document.getElementById(NEWTAB_BOOKMARK_PREBOOT_ROOT_ID)
  if (!root) {
    return
  }
  root.remove()
  document.getElementById(NEWTAB_BOOKMARK_PREBOOT_STYLE_ID)?.remove()
}

export function scheduleNewtabBookmarkPrebootHandoff(
  options: NewtabBookmarkPrebootHandoffOptions = {}
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined
  }

  const root = document.getElementById(NEWTAB_BOOKMARK_PREBOOT_ROOT_ID)
  if (!root) {
    options.onFinish?.('missing')
    return () => undefined
  }

  let frame = 0
  let surfaceHandoffFrame = 0
  let timer = 0
  let alignedFrames = 0
  let tileAlignedFrames = 0
  let finished = false
  let frozenTitleCleanup: (() => void) | null = null
  let guardObserver: MutationObserver | null = null
  let titleGuardActive = false
  let titleGuardFrozen = false
  let titleGuardStartedAt = 0
  const startedAt = performance.now()

  const cancelScheduledSample = () => {
    if (frame) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
    if (timer) {
      window.clearTimeout(timer)
      timer = 0
    }
    if (surfaceHandoffFrame) {
      window.cancelAnimationFrame(surfaceHandoffFrame)
      surfaceHandoffFrame = 0
    }
  }

  const clearFrozenTitleTransfer = () => {
    guardObserver?.disconnect()
    guardObserver = null
    window.removeEventListener('resize', clearFrozenTitleTransfer)
    frozenTitleCleanup?.()
    frozenTitleCleanup = null
  }

  const removePrebootAfterSurfaceHandoff = (
    result: Exclude<NewtabBookmarkPrebootHandoffResult, 'missing'>,
    onRemoved?: () => void
  ) => {
    let paintedFrames = 0
    root.dataset.surfaceHandoff = 'true'

    const commit = () => {
      surfaceHandoffFrame = 0
      paintedFrames += 1
      if (paintedFrames < NEWTAB_BOOKMARK_PREBOOT_SURFACE_HANDOFF_FRAMES) {
        surfaceHandoffFrame = window.requestAnimationFrame(commit)
        return
      }
      clearNewtabBookmarkPrebootTitleGuard(root)
      hideNewtabBookmarkPreboot({ clearSnapshot: result !== 'aligned' })
      onRemoved?.()
      options.onFinish?.(result)
    }

    surfaceHandoffFrame = window.requestAnimationFrame(commit)
  }

  const finish = (result: Exclude<NewtabBookmarkPrebootHandoffResult, 'missing'>) => {
    if (finished) {
      return
    }
    finished = true
    cancelScheduledSample()
    clearFrozenTitleTransfer()
    const hasLiveSurface = Boolean(document.querySelector('.bookmark-tile[data-bookmark-id]'))
    if (!hasLiveSurface) {
      clearNewtabBookmarkPrebootTitleGuard(root)
      hideNewtabBookmarkPreboot({ clearSnapshot: result !== 'aligned' })
      options.onFinish?.(result)
      return
    }
    removePrebootAfterSurfaceHandoff(result)
  }

  const freezeTitleGuard = () => {
    const cleanup = transferNewtabBookmarkPrebootTitles(root)
    if (!cleanup) {
      finish('timeout')
      return
    }
    titleGuardFrozen = true
    finished = true
    cancelScheduledSample()
    frozenTitleCleanup = cleanup
    removePrebootAfterSurfaceHandoff('timeout', () => {
      window.addEventListener('resize', clearFrozenTitleTransfer, { once: true })
      const liveSections = document.querySelector<HTMLElement>('.bookmark-folder-sections')
      if (liveSections) {
        const liveLayoutRoot = liveSections.closest<HTMLElement>('.newtab-primary-slot') ?? liveSections
        guardObserver = new MutationObserver(clearFrozenTitleTransfer)
        guardObserver.observe(liveLayoutRoot, {
          attributeFilter: [
            'class',
            'data-bookmark-id',
            'data-icon-layout-mode',
            'data-icon-show-titles',
            'data-icon-vertical-center',
            'hidden',
            'style'
          ],
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true
        })
      }
    })
  }

  const startTitleGuard = (now: number): boolean => {
    if (!enableNewtabBookmarkPrebootTitleGuard(root)) {
      return false
    }
    titleGuardActive = true
    titleGuardStartedAt = now
    return true
  }

  const scheduleSample = () => {
    if (finished || titleGuardFrozen) {
      return
    }
    if (titleGuardActive) {
      timer = window.setTimeout(() => {
        timer = 0
        frame = window.requestAnimationFrame(sample)
      }, NEWTAB_BOOKMARK_PREBOOT_TITLE_GUARD_SAMPLE_MS)
      return
    }
    frame = window.requestAnimationFrame(sample)
  }

  const sample = (now: number) => {
    frame = 0
    const handoff = measureNewtabBookmarkPrebootHandoff(root)
    if (handoff.state === 'stale') {
      finish('stale')
      return
    }
    if (titleGuardActive && !handoff.tilesAligned) {
      finish('timeout')
      return
    }

    // Pointer input can move to the live grid as soon as its tile geometry
    // matches the snapshot, without waiting for the painted handoff: a click
    // then resolves to exactly the bookmark drawn under the cursor. This is
    // re-evaluated every sample, so a grid that shifts again gives the input
    // layer straight back.
    setNewtabBookmarkPrebootPointerHandoff(root, handoff.tilesAligned)

    alignedFrames = handoff.state === 'aligned' ? alignedFrames + 1 : 0
    tileAlignedFrames = handoff.tilesAligned ? tileAlignedFrames + 1 : 0

    if (alignedFrames >= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_STABLE_FRAMES) {
      finish('aligned')
      return
    }

    // Card bounds and icon clips are already stable, so the live layer can own
    // pointer interaction immediately. Keep only the cached titles while font
    // metrics settle instead of hiding the whole live grid for the timeout.
    if (
      !titleGuardActive &&
      handoff.state === 'pending' &&
      tileAlignedFrames >= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_STABLE_FRAMES
    ) {
      startTitleGuard(now)
    }
    if (!titleGuardActive && now - startedAt >= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_MAX_WAIT_MS) {
      if (!handoff.tilesAligned || !startTitleGuard(now)) {
        finish('timeout')
        return
      }
    }
    if (
      titleGuardActive &&
      now - titleGuardStartedAt >= NEWTAB_BOOKMARK_PREBOOT_TITLE_GUARD_MAX_WAIT_MS
    ) {
      freezeTitleGuard()
      return
    }

    scheduleSample()
  }

  scheduleSample()
  return () => {
    finished = true
    cancelScheduledSample()
    clearFrozenTitleTransfer()
    clearNewtabBookmarkPrebootTitleGuard(root)
    hideNewtabBookmarkPreboot()
  }
}

function transferNewtabBookmarkPrebootTitles(root: HTMLElement): (() => void) | null {
  const liveTilesById = new Map(
    Array.from(
      document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]:not(.bookmark-drag-ghost)')
    ).map((tile) => [String(tile.dataset.bookmarkId || ''), tile])
  )
  const pairs: Array<{
    liveTile: HTMLElement
    liveTitle: HTMLElement
    prebootTitle: HTMLElement
  }> = []

  for (const prebootTile of root.querySelectorAll<HTMLElement>(
    '.newtab-bookmark-preboot-tile[data-bookmark-id]'
  )) {
    const prebootTitle = prebootTile.querySelector<HTMLElement>('.newtab-bookmark-preboot-title')
    if (!prebootTitle) {
      continue
    }
    const liveTile = liveTilesById.get(String(prebootTile.dataset.bookmarkId || ''))
    const liveTitle = liveTile?.querySelector<HTMLElement>('.bookmark-title:not([hidden])')
    if (!liveTile || !liveTitle) {
      return null
    }
    pairs.push({ liveTile, liveTitle, prebootTitle })
  }
  if (!pairs.length) {
    return null
  }

  const copiedProperties = [
    '-webkit-box-orient',
    '-webkit-line-clamp',
    'color',
    'display',
    'font-family',
    'font-feature-settings',
    'font-kerning',
    'font-size',
    'font-stretch',
    'font-style',
    'font-variant',
    'font-weight',
    'hanging-punctuation',
    'letter-spacing',
    'line-break',
    'line-height',
    'overflow',
    'overflow-wrap',
    'text-align',
    'text-autospace',
    'text-decoration',
    'text-shadow',
    'text-spacing-trim',
    'text-transform',
    'white-space',
    'word-break'
  ]
  const clones: HTMLElement[] = []
  const guardedSources: Array<{
    element: HTMLElement
    priority: string
    value: string
  }> = []

  for (const { liveTile, liveTitle, prebootTitle } of pairs) {
    const frozenTitle = document.createElement('span')
    const computedStyle = window.getComputedStyle(prebootTitle)
    frozenTitle.className = 'newtab-bookmark-frozen-title'
    frozenTitle.dataset.newtabBookmarkPrebootFrozenTitle = 'true'
    frozenTitle.setAttribute('aria-hidden', 'true')
    frozenTitle.textContent = liveTitle.textContent
    for (const property of copiedProperties) {
      frozenTitle.style.setProperty(property, computedStyle.getPropertyValue(property))
    }
    frozenTitle.style.boxSizing = 'border-box'
    frozenTitle.style.height = prebootTitle.style.height
    frozenTitle.style.left = prebootTitle.style.left
    frozenTitle.style.margin = '0'
    frozenTitle.style.minWidth = '0'
    frozenTitle.style.pointerEvents = 'none'
    frozenTitle.style.position = 'absolute'
    frozenTitle.style.top = prebootTitle.style.top
    frozenTitle.style.transition = 'none'
    frozenTitle.style.width = prebootTitle.style.width
    frozenTitle.style.zIndex = '2'

    guardedSources.push({
      element: liveTitle,
      priority: liveTitle.style.getPropertyPriority('visibility'),
      value: liveTitle.style.getPropertyValue('visibility')
    })
    liveTitle.dataset.newtabBookmarkPrebootFrozenSource = 'true'
    liveTitle.style.setProperty('visibility', 'hidden', 'important')
    liveTile.appendChild(frozenTitle)
    clones.push(frozenTitle)
  }

  let active = true
  return () => {
    if (!active) {
      return
    }
    active = false
    for (const clone of clones) {
      clone.remove()
    }
    for (const { element, priority, value } of guardedSources) {
      delete element.dataset.newtabBookmarkPrebootFrozenSource
      if (value) {
        element.style.setProperty('visibility', value, priority)
      } else {
        element.style.removeProperty('visibility')
      }
    }
  }
}

function enableNewtabBookmarkPrebootTitleGuard(root: HTMLElement): boolean {
  const prebootTiles = Array.from(
    root.querySelectorAll<HTMLElement>('.newtab-bookmark-preboot-tile[data-bookmark-id]')
  )
  const liveTilesById = new Map(
    Array.from(
      document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]:not(.bookmark-drag-ghost)')
    ).map((tile) => [String(tile.dataset.bookmarkId || ''), tile])
  )
  let guardedTitleCount = 0

  for (const prebootTile of prebootTiles) {
    const bookmarkId = String(prebootTile.dataset.bookmarkId || '')
    const liveTitle = liveTilesById
      .get(bookmarkId)
      ?.querySelector<HTMLElement>('.bookmark-title:not([hidden])')
    if (!liveTitle) {
      continue
    }
    liveTitle.dataset.newtabBookmarkPrebootTitleGuard = 'true'
    guardedTitleCount += 1
  }

  if (!guardedTitleCount) {
    return false
  }
  root.dataset.titleGuard = 'true'
  return true
}

function clearNewtabBookmarkPrebootTitleGuard(root: HTMLElement): void {
  delete root.dataset.titleGuard
  for (const title of document.querySelectorAll<HTMLElement>(
    '.bookmark-title[data-newtab-bookmark-preboot-title-guard="true"]'
  )) {
    delete title.dataset.newtabBookmarkPrebootTitleGuard
  }
}

/**
 * 快照与实况瓦片几何对齐后，实况层立刻接管命中测试（仍不绘制）。
 * 交接前实况网格是 visibility: hidden，命中测试也一并被禁用，用户会看到
 * 一屏可读的书签却点不动；这里把「能点」与「能看见」解耦，撤下快照的
 * 时机、动画与像素完全不变。
 */
function setNewtabBookmarkPrebootPointerHandoff(root: HTMLElement, enabled: boolean): void {
  if (enabled) {
    if (root.dataset.pointerHandoff !== 'true') {
      root.dataset.pointerHandoff = 'true'
    }
    return
  }
  if (root.dataset.pointerHandoff) {
    delete root.dataset.pointerHandoff
  }
}

export function isRenderableNewtabBookmarkPrebootSnapshot(
  snapshot: NewtabBookmarkPrebootSnapshot,
  windowRef: BookmarkPrebootWindow
): boolean {
  const viewportWidth = getFiniteNumber(windowRef.innerWidth, 0)
  const viewportHeight = getFiniteNumber(windowRef.innerHeight, 0)
  return Boolean(
    viewportWidth > 0 &&
    viewportHeight > 0 &&
    Math.abs(viewportWidth - snapshot.rect.viewportWidth) <= NEWTAB_BOOKMARK_PREBOOT_VIEWPORT_TOLERANCE_PX &&
    Math.abs(viewportHeight - snapshot.rect.viewportHeight) <= NEWTAB_BOOKMARK_PREBOOT_VIEWPORT_TOLERANCE_PX
  )
}

export function getNewtabBookmarkPrebootFaviconLoadAttributes(
  renderIndex: number
): NewtabBookmarkPrebootFaviconLoadAttributes {
  const normalizedIndex = Math.max(0, Math.floor(Number(renderIndex) || 0))
  return {
    fetchPriority: normalizedIndex < NEWTAB_BOOKMARK_PREBOOT_HIGH_PRIORITY_FAVICON_LIMIT ? 'high' : 'low',
    loading: normalizedIndex < NEWTAB_BOOKMARK_PREBOOT_EAGER_FAVICON_LIMIT ? 'eager' : 'lazy'
  }
}

function readNewtabBookmarkPrebootSnapshot(
  storage: BookmarkPrebootStorage
): NewtabBookmarkPrebootSnapshot | null {
  try {
    const rawSnapshot = storage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY)
    return rawSnapshot ? normalizeNewtabBookmarkPrebootSnapshot(JSON.parse(rawSnapshot)) : null
  } catch {
    return null
  }
}

function isFreshNewtabBookmarkPrebootSnapshot(
  snapshot: NewtabBookmarkPrebootSnapshot,
  now = Date.now()
): boolean {
  const age = now - snapshot.updatedAt
  return Boolean(
    snapshot.version === NEWTAB_BOOKMARK_PREBOOT_VERSION &&
    snapshot.sections.some((section) => section.items.length > 0) &&
    age >= 0 &&
    age <= NEWTAB_BOOKMARK_PREBOOT_MAX_AGE_MS
  )
}

function renderNewtabBookmarkPrebootSnapshot(
  snapshot: NewtabBookmarkPrebootSnapshot,
  documentRef: Document
): void {
  const root = getOrCreateNewtabBookmarkPrebootRoot(documentRef)
  if (!root) {
    return
  }

  root.replaceChildren()
  root.style.setProperty('--preboot-content-left', `${Math.max(0, snapshot.rect.left)}px`)
  root.style.setProperty('--preboot-content-top', `${Math.max(0, snapshot.rect.top)}px`)
  root.style.setProperty('--preboot-content-width', `${Math.max(0, snapshot.rect.width)}px`)
  root.style.setProperty('--preboot-content-height', `${Math.max(0, snapshot.rect.height)}px`)
  root.dataset.showTitles = String(snapshot.content.showTitles)

  const content = documentRef.createElement('section')
  content.className = 'newtab-bookmark-preboot-content'
  content.dataset.layoutMode = snapshot.content.layoutMode
  applyNewtabBookmarkPrebootContentStyle(content, snapshot.content)

  const sections = documentRef.createElement('div')
  sections.className = 'newtab-bookmark-preboot-sections'
  let renderIndex = 0
  for (const section of snapshot.sections) {
    sections.appendChild(createNewtabBookmarkPrebootSection(
      documentRef,
      section,
      snapshot.content,
      renderIndex
    ))
    renderIndex += section.items.length
  }
  content.appendChild(sections)
  root.appendChild(content)
}

function createNewtabBookmarkPrebootSection(
  documentRef: Document,
  section: NewtabBookmarkPrebootSection,
  content: NewtabBookmarkPrebootContentStyle,
  renderIndexOffset: number
): HTMLElement {
  const sectionElement = documentRef.createElement('section')
  sectionElement.className = 'newtab-bookmark-preboot-section'
  sectionElement.dataset.folderId = section.folderId
  for (const [index, item] of section.items.entries()) {
    sectionElement.appendChild(createNewtabBookmarkPrebootTile(
      documentRef,
      item,
      content,
      renderIndexOffset + index
    ))
  }
  return sectionElement
}

function createNewtabBookmarkPrebootTile(
  documentRef: Document,
  item: NewtabBookmarkPrebootItem,
  content: NewtabBookmarkPrebootContentStyle,
  renderIndex: number
): HTMLElement {
  const tile = documentRef.createElement('span')
  tile.className = 'newtab-bookmark-preboot-tile'
  tile.dataset.bookmarkId = item.id
  tile.title = item.title
  tile.style.height = `${item.height}px`
  tile.style.left = `${item.left}px`
  tile.style.top = `${item.top}px`
  tile.style.width = `${item.width}px`
  if (!content.showTitles) {
    tile.dataset.iconOnly = 'true'
  }
  const iconShell = documentRef.createElement('span')
  iconShell.className = 'newtab-bookmark-preboot-icon-shell'
  if (content.clipPaths.iconShell) {
    iconShell.style.clipPath = content.clipPaths.iconShell
  }
  const fallback = documentRef.createElement('span')
  fallback.className = 'newtab-bookmark-preboot-fallback'
  fallback.textContent = item.fallbackLabel
  if (content.clipPaths.fallback) {
    fallback.style.clipPath = content.clipPaths.fallback
  }
  iconShell.appendChild(fallback)

  if (item.faviconSrc) {
    const loadAttributes = getNewtabBookmarkPrebootFaviconLoadAttributes(renderIndex)
    const image = documentRef.createElement('img')
    image.className = 'newtab-bookmark-preboot-favicon'
    image.alt = ''
    image.decoding = 'async'
    image.draggable = false
    image.fetchPriority = loadAttributes.fetchPriority
    image.loading = loadAttributes.loading
    if (content.clipPaths.favicon) {
      image.style.clipPath = content.clipPaths.favicon
    }
    const revealImage = () => {
      markNewtabFaviconReady(image.src)
      image.dataset.ready = 'true'
      fallback.dataset.hidden = 'true'
    }
    const revealImageIfDecoded = () => {
      if (!image.complete || image.naturalWidth <= 0) {
        return false
      }
      revealImage()
      return true
    }
    image.addEventListener('load', revealImage, { once: true })
    image.addEventListener('error', () => {
      markNewtabFaviconNotReady(image.src)
      image.remove()
      delete fallback.dataset.hidden
    }, { once: true })
    image.src = item.faviconSrc
    iconShell.appendChild(image)
    if (!revealImageIfDecoded()) {
      queueMicrotask(revealImageIfDecoded)
    }
  }
  tile.appendChild(iconShell)

  if (content.showTitles) {
    const title = documentRef.createElement('span')
    title.className = 'newtab-bookmark-preboot-title'
    title.textContent = item.title
    if (item.titleRect) {
      title.dataset.measuredRect = 'true'
      title.style.height = `${item.titleRect.height}px`
      title.style.left = `${item.titleRect.left}px`
      title.style.top = `${item.titleRect.top}px`
      title.style.width = `${item.titleRect.width}px`
    }
    tile.appendChild(title)
  }
  return tile
}

function createNewtabBookmarkPrebootSections(
  view: NewtabBookmarkPrebootView,
  sectionsElement: HTMLElement | null,
  sectionsRect: NewtabBookmarkPrebootRect
): NewtabBookmarkPrebootSection[] {
  const sections: NewtabBookmarkPrebootSection[] = []
  const itemRects = collectNewtabBookmarkPrebootItemRects(sectionsElement, sectionsRect)
  let remainingItems = NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS
  let reachedMeasurementBoundary = false

  for (const section of view.sections) {
    if (sections.length >= NEWTAB_BOOKMARK_PREBOOT_MAX_SECTIONS || remainingItems <= 0) {
      break
    }
    const sourceItems = (section.grid?.items ?? []).slice(0, remainingItems)
    if (!sourceItems.length) {
      continue
    }
    const measuredItems: NewtabBookmarkPrebootItem[] = []
    for (const item of sourceItems) {
      const measuredItem = createNewtabBookmarkPrebootItem(
        item,
        itemRects.get(String(item.id || '')),
        view.content.showTitles
      )
      if (!measuredItem) {
        reachedMeasurementBoundary = true
        break
      }
      measuredItems.push(measuredItem)
    }
    if (!measuredItems.length) {
      break
    }
    remainingItems -= measuredItems.length
    sections.push({
      folderId: String(section.folderId || ''),
      items: measuredItems
    })
    if (reachedMeasurementBoundary) {
      break
    }
  }
  return sections
}

function collectNewtabBookmarkPrebootItemRects(
  sectionsElement: HTMLElement | null,
  sectionsRect: NewtabBookmarkPrebootRect
): Map<string, NewtabBookmarkPrebootMeasuredItem> {
  const itemRects = new Map<string, NewtabBookmarkPrebootMeasuredItem>()
  if (!sectionsElement) {
    return itemRects
  }

  let measuredItemCount = 0
  for (const tileElement of sectionsElement.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]')) {
    if (measuredItemCount >= NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS) {
      break
    }
    const bookmarkId = String(tileElement.dataset.bookmarkId || '')
    const rect = tileElement.getBoundingClientRect()
    if (!bookmarkId || rect.width <= 0 || rect.height <= 0) {
      continue
    }
    const titleElement = tileElement.querySelector<HTMLElement>('.bookmark-title:not([hidden])')
    const titleRect = titleElement?.getBoundingClientRect()
    itemRects.set(bookmarkId, {
      height: roundPrebootLength(rect.height),
      left: roundPrebootLength(rect.left - sectionsRect.left),
      titleRect: titleRect && titleRect.width > 0 && titleRect.height > 0
        ? {
            height: roundPrebootLength(titleRect.height),
            left: roundPrebootLength(titleRect.left - rect.left - tileElement.clientLeft),
            top: roundPrebootLength(titleRect.top - rect.top - tileElement.clientTop),
            width: roundPrebootLength(titleRect.width)
          }
        : null,
      top: roundPrebootLength(rect.top - sectionsRect.top),
      width: roundPrebootLength(rect.width)
    })
    measuredItemCount += 1
  }
  return itemRects
}

function createNewtabBookmarkPrebootItem(
  item: NewtabBookmarkPrebootItemView,
  rect: NewtabBookmarkPrebootMeasuredItem | undefined,
  showTitles: boolean
): NewtabBookmarkPrebootItem | null {
  const title = String(item.title || item.url || '').trim().slice(0, 512)
  if (!title || !rect || (showTitles && !rect.titleRect)) {
    return null
  }

  return {
    fallbackLabel: String(item.fallbackLabel || Array.from(title)[0] || '*').slice(0, 2).toUpperCase(),
    faviconSrc: normalizeNewtabBookmarkPrebootFavicon(item),
    ...rect,
    id: String(item.id || item.url || title).slice(0, 512),
    title
  }
}

function normalizeNewtabBookmarkPrebootFavicon(item: NewtabBookmarkPrebootItemView): string {
  if (item.customIcon) {
    return ''
  }
  const source = String(item.favicon.src || '').trim().slice(0, 4096)
  return /^(?:chrome-extension|chrome|https?):/i.test(source) ? source : ''
}

function createNewtabBookmarkPrebootContentStyle(
  content: NewtabBookmarkPrebootView['content'],
  clipPaths?: unknown
): NewtabBookmarkPrebootContentStyle {
  return {
    clipPaths: normalizeNewtabBookmarkPrebootClipPaths(clipPaths),
    columnGap: clampInteger(content.columnGap, 0, 96, 24),
    columns: clampInteger(content.columns, 1, 12, 4),
    fixedGridWidth: clampInteger(content.fixedGridWidth, 120, 2400, 832),
    folderGap: clampInteger(content.folderGap, 0, 96, 20),
    iconShellSize: clampInteger(content.iconShellSize, 18, 80, 32),
    layoutMode: content.layoutMode === 'fixed' ? 'fixed' : 'fluid',
    pageWidth: clampInteger(content.pageWidth, 240, 2400, 1229),
    rowGap: clampInteger(content.rowGap, 0, 96, 12),
    showTitles: Boolean(content.showTitles),
    tileWidth: clampInteger(content.tileWidth, 80, 420, 184),
    titleLines: clampInteger(content.titleLines, 1, 3, 1)
  }
}

/**
 * 图标外壳、favicon 与回退块的 squircle 轮廓由运行时引擎异步写入 inline
 * clip-path。快照原样保存这些字符串，preboot 渲染时同步回放，保证刷新
 * 首帧的图标形状与稳定态完全一致（引擎对已有 clip-path 的元素会自动跳过）。
 */
function collectNewtabBookmarkPrebootClipPaths(
  sectionsElement: HTMLElement | null
): NewtabBookmarkPrebootClipPaths {
  const readClip = (selector: string): string => {
    if (!sectionsElement) {
      return ''
    }
    for (const element of sectionsElement.querySelectorAll<HTMLElement>(selector)) {
      const clip = normalizeNewtabBookmarkPrebootClipPath(element.style?.clipPath)
      if (clip) {
        return clip
      }
    }
    return ''
  }

  return {
    fallback: readClip('.bookmark-tile[data-bookmark-id] .bookmark-fallback'),
    favicon: readClip('.bookmark-tile[data-bookmark-id] .bookmark-favicon'),
    iconShell: readClip('.bookmark-tile[data-bookmark-id] .bookmark-icon-shell')
  }
}

function normalizeNewtabBookmarkPrebootClipPaths(rawClipPaths: unknown): NewtabBookmarkPrebootClipPaths {
  const clipPaths = rawClipPaths && typeof rawClipPaths === 'object' && !Array.isArray(rawClipPaths)
    ? rawClipPaths as Record<string, unknown>
    : {}
  return {
    fallback: normalizeNewtabBookmarkPrebootClipPath(clipPaths.fallback),
    favicon: normalizeNewtabBookmarkPrebootClipPath(clipPaths.favicon),
    iconShell: normalizeNewtabBookmarkPrebootClipPath(clipPaths.iconShell)
  }
}

function normalizeNewtabBookmarkPrebootClipPath(value: unknown): string {
  const clip = String(value ?? '').trim()
  return NEWTAB_BOOKMARK_PREBOOT_CLIP_PATH_PATTERN.test(clip) ? clip : ''
}

function createNewtabBookmarkPrebootRect(
  options: NewtabBookmarkPrebootSnapshotOptions
): NewtabBookmarkPrebootRect | null {
  const element = options.sectionsElement ?? null
  if (!element) {
    return null
  }
  const rect = element.getBoundingClientRect()
  const viewportWidth = getFiniteNumber(options.viewportWidth, getWindowDimension('innerWidth', 0))
  const viewportHeight = getFiniteNumber(options.viewportHeight, getWindowDimension('innerHeight', 0))
  if (rect.width <= 0 || rect.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null
  }

  return {
    height: roundPrebootLength(rect.height),
    left: roundPrebootLength(rect.left),
    top: roundPrebootLength(rect.top),
    viewportHeight: Math.round(viewportHeight),
    viewportWidth: Math.round(viewportWidth),
    width: roundPrebootLength(rect.width)
  }
}

function normalizeNewtabBookmarkPrebootSnapshot(rawSnapshot: unknown): NewtabBookmarkPrebootSnapshot | null {
  if (!rawSnapshot || typeof rawSnapshot !== 'object' || Array.isArray(rawSnapshot)) {
    return null
  }
  const snapshot = rawSnapshot as Record<string, unknown>
  const content = normalizeNewtabBookmarkPrebootContent(snapshot.content)
  const rect = normalizeNewtabBookmarkPrebootRect(snapshot.rect)
  const sections = normalizeNewtabBookmarkPrebootSections(snapshot.sections)
  if (
    !content ||
    !rect ||
    !sections.length ||
    (content.showTitles && sections.some((section) => section.items.some((item) => !item.titleRect)))
  ) {
    return null
  }

  return {
    content,
    rect,
    sections,
    updatedAt: getFiniteNumber(snapshot.updatedAt, 0),
    version: snapshot.version === NEWTAB_BOOKMARK_PREBOOT_VERSION
      ? NEWTAB_BOOKMARK_PREBOOT_VERSION
      : 0
  }
}

function normalizeNewtabBookmarkPrebootContent(rawContent: unknown): NewtabBookmarkPrebootContentStyle | null {
  if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) {
    return null
  }
  const content = rawContent as Record<string, unknown>
  return createNewtabBookmarkPrebootContentStyle(
    content as unknown as NewtabBookmarkPrebootView['content'],
    content.clipPaths
  )
}

function normalizeNewtabBookmarkPrebootSections(rawSections: unknown): NewtabBookmarkPrebootSection[] {
  if (!Array.isArray(rawSections)) {
    return []
  }
  const sections: NewtabBookmarkPrebootSection[] = []
  let remainingItems = NEWTAB_BOOKMARK_PREBOOT_MAX_ITEMS
  for (const rawSection of rawSections.slice(0, NEWTAB_BOOKMARK_PREBOOT_MAX_SECTIONS)) {
    if (remainingItems <= 0) {
      break
    }
    const section = normalizeNewtabBookmarkPrebootSection(rawSection, remainingItems)
    if (!section) {
      continue
    }
    remainingItems -= section.items.length
    sections.push(section)
  }
  return sections
}

function normalizeNewtabBookmarkPrebootSection(
  rawSection: unknown,
  itemLimit: number
): NewtabBookmarkPrebootSection | null {
  if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) {
    return null
  }
  const section = rawSection as Record<string, unknown>
  const items = Array.isArray(section.items)
    ? section.items
      .slice(0, itemLimit)
      .map((item) => normalizeNewtabBookmarkPrebootItem(item))
      .filter((item): item is NewtabBookmarkPrebootItem => Boolean(item))
    : []
  return items.length
    ? { folderId: String(section.folderId || ''), items }
    : null
}

function normalizeNewtabBookmarkPrebootItem(rawItem: unknown): NewtabBookmarkPrebootItem | null {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return null
  }
  const item = rawItem as Record<string, unknown>
  const title = String(item.title || '').trim().slice(0, 512)
  if (!title) {
    return null
  }
  const height = clampPrebootLength(item.height, 1, 600, 0)
  const width = clampPrebootLength(item.width, 1, 2400, 0)
  if (!height || !width) {
    return null
  }
  const titleRect = normalizeNewtabBookmarkPrebootElementRect(item.titleRect)
  return {
    fallbackLabel: String(item.fallbackLabel || Array.from(title)[0] || '*').slice(0, 2).toUpperCase(),
    faviconSrc: /^(?:chrome-extension|chrome|https?):/i.test(String(item.faviconSrc || ''))
      ? String(item.faviconSrc)
      : '',
    height,
    id: String(item.id || title).slice(0, 512),
    left: clampPrebootLength(item.left, -2400, 2400, 0),
    title,
    titleRect,
    top: clampPrebootLength(item.top, -2400, 5000, 0),
    width
  }
}

function normalizeNewtabBookmarkPrebootElementRect(rawRect: unknown): NewtabBookmarkPrebootElementRect | null {
  if (!rawRect || typeof rawRect !== 'object' || Array.isArray(rawRect)) {
    return null
  }
  const rect = rawRect as Record<string, unknown>
  const height = clampPrebootLength(rect.height, 1, 600, 0)
  const width = clampPrebootLength(rect.width, 1, 2400, 0)
  if (!height || !width) {
    return null
  }
  return {
    height,
    left: clampPrebootLength(rect.left, -2400, 2400, 0),
    top: clampPrebootLength(rect.top, -600, 600, 0),
    width
  }
}

function normalizeNewtabBookmarkPrebootRect(rawRect: unknown): NewtabBookmarkPrebootRect | null {
  if (!rawRect || typeof rawRect !== 'object' || Array.isArray(rawRect)) {
    return null
  }
  const rect = rawRect as Record<string, unknown>
  const width = clampPrebootLength(rect.width, 1, 2400, 0)
  const height = clampPrebootLength(rect.height, 1, 2400, 0)
  const viewportWidth = clampInteger(rect.viewportWidth, 1, 5000, 0)
  const viewportHeight = clampInteger(rect.viewportHeight, 1, 5000, 0)
  if (!width || !height || !viewportWidth || !viewportHeight) {
    return null
  }
  return {
    height,
    left: clampPrebootLength(rect.left, -5000, 5000, 0),
    top: clampPrebootLength(rect.top, -5000, 5000, 0),
    viewportHeight,
    viewportWidth,
    width
  }
}

function applyNewtabBookmarkPrebootContentStyle(
  element: HTMLElement,
  content: NewtabBookmarkPrebootContentStyle
): void {
  element.style.setProperty('--icon-page-width', `${content.pageWidth}px`)
  element.style.setProperty('--icon-column-gap', `${content.columnGap}px`)
  element.style.setProperty('--icon-row-gap', `${content.rowGap}px`)
  element.style.setProperty('--icon-folder-gap', `${content.folderGap}px`)
  element.style.setProperty('--icon-tile-width', `${content.tileWidth}px`)
  element.style.setProperty('--icon-shell-size', `${content.iconShellSize}px`)
  element.style.setProperty('--icon-fixed-grid-width', `${content.fixedGridWidth}px`)
  element.style.setProperty('--icon-columns', String(content.columns))
  element.style.setProperty('--icon-title-lines', String(content.titleLines))
}

function measureNewtabBookmarkPrebootHandoff(
  root: HTMLElement
): {
  state: 'aligned' | 'pending' | 'stale'
  tilesAligned: boolean
} {
  const prebootTiles = Array.from(
    root.querySelectorAll<HTMLElement>('.newtab-bookmark-preboot-tile[data-bookmark-id]')
  )
  const liveTiles = Array.from(
    document.querySelectorAll<HTMLElement>('.bookmark-tile[data-bookmark-id]:not(.bookmark-drag-ghost)')
  )
  if (!prebootTiles.length) {
    return { state: 'stale', tilesAligned: false }
  }
  if (!liveTiles.length) {
    return { state: 'pending', tilesAligned: false }
  }

  const prebootIds = prebootTiles.map((tile) => String(tile.dataset.bookmarkId || ''))
  const comparableCount = Math.min(prebootIds.length, liveTiles.length)
  for (let index = 0; index < comparableCount; index += 1) {
    if (String(liveTiles[index].dataset.bookmarkId || '') !== prebootIds[index]) {
      return { state: 'stale', tilesAligned: false }
    }
  }
  if (liveTiles.length < prebootIds.length) {
    return { state: 'pending', tilesAligned: false }
  }

  const liveTilesById = new Map(
    liveTiles.map((tile) => [String(tile.dataset.bookmarkId || ''), tile])
  )
  const visiblePrebootTiles = prebootTiles.filter((tile) => isNewtabBookmarkPrebootTileVisible(tile))
  if (!visiblePrebootTiles.length) {
    return { state: 'stale', tilesAligned: false }
  }

  let tilesAligned = true
  let titlesAligned = true
  for (const prebootTile of visiblePrebootTiles) {
    const liveTile = liveTilesById.get(String(prebootTile.dataset.bookmarkId || ''))
    if (!liveTile || !areNewtabBookmarkRectsAligned(
      prebootTile.getBoundingClientRect(),
      liveTile.getBoundingClientRect()
    ) || !areNewtabBookmarkIconClipsAligned(prebootTile, liveTile)) {
      tilesAligned = false
      titlesAligned = false
      break
    }

    const prebootTitle = prebootTile.querySelector<HTMLElement>('.newtab-bookmark-preboot-title')
    const liveTitle = liveTile.querySelector<HTMLElement>('.bookmark-title:not([hidden])')
    if (!prebootTitle && !liveTitle) {
      continue
    }
    if (!(
      prebootTitle &&
      liveTitle &&
      areNewtabBookmarkRectsAligned(
        prebootTitle.getBoundingClientRect(),
        liveTitle.getBoundingClientRect()
      )
    )) {
      titlesAligned = false
    }
  }

  return {
    state: tilesAligned && titlesAligned ? 'aligned' : 'pending',
    tilesAligned
  }
}

function isNewtabBookmarkPrebootTileVisible(tile: HTMLElement): boolean {
  const rect = tile.getBoundingClientRect()
  return Boolean(
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  )
}

function areNewtabBookmarkRectsAligned(left: DOMRect, right: DOMRect): boolean {
  return Boolean(
    Math.abs(left.left - right.left) <= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_TOLERANCE_PX &&
    Math.abs(left.top - right.top) <= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_TOLERANCE_PX &&
    Math.abs(left.width - right.width) <= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_TOLERANCE_PX &&
    Math.abs(left.height - right.height) <= NEWTAB_BOOKMARK_PREBOOT_HANDOFF_TOLERANCE_PX
  )
}

/**
 * clip-path 不影响布局盒，矩形比对察觉不到 squircle 轮廓是否就位。
 * 交接必须等 live 图标外壳的 clip 与快照回放的一致，否则撤下快照的
 * 瞬间图标会从 squircle 跳回普通圆角，再被引擎裁一次。
 */
function areNewtabBookmarkIconClipsAligned(prebootTile: HTMLElement, liveTile: HTMLElement): boolean {
  const prebootShell = prebootTile.querySelector<HTMLElement>('.newtab-bookmark-preboot-icon-shell')
  const liveShell = liveTile.querySelector<HTMLElement>('.bookmark-icon-shell')
  if (!prebootShell || !liveShell) {
    return true
  }
  return window.getComputedStyle(prebootShell).clipPath === window.getComputedStyle(liveShell).clipPath
}

function getOrCreateNewtabBookmarkPrebootRoot(documentRef: Document): HTMLElement | null {
  const existingRoot = documentRef.getElementById(NEWTAB_BOOKMARK_PREBOOT_ROOT_ID)
  if (existingRoot instanceof HTMLElement) {
    return existingRoot
  }
  if (!documentRef.body) {
    return null
  }
  const root = documentRef.createElement('div')
  root.id = NEWTAB_BOOKMARK_PREBOOT_ROOT_ID
  root.dataset.squircleSubtree = 'off'
  root.setAttribute('aria-hidden', 'true')
  const reactRoot = documentRef.getElementById('newtab-react-root')
  documentRef.body.insertBefore(root, reactRoot || documentRef.body.firstChild)
  return root
}

function installNewtabBookmarkPrebootStyle(documentRef: Document): void {
  if (documentRef.getElementById(NEWTAB_BOOKMARK_PREBOOT_STYLE_ID)) {
    return
  }
  const style = documentRef.createElement('style')
  style.id = NEWTAB_BOOKMARK_PREBOOT_STYLE_ID
  style.textContent = NEWTAB_BOOKMARK_PREBOOT_CSS
  documentRef.head.appendChild(style)
}

function getWindowDimension(key: 'innerHeight' | 'innerWidth', fallback: number): number {
  return typeof window === 'undefined' ? fallback : window[key]
}

function getFiniteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Math.round(Number(value))
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback
}

function roundPrebootLength(value: number): number {
  // Keep sub-pixel geometry so the frozen snapshot lands exactly where the grid
  // renders live tiles; integer rounding leaves a visible half-pixel jump on handoff.
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

function clampPrebootLength(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? roundPrebootLength(Math.max(min, Math.min(max, numeric))) : fallback
}

const NEWTAB_BOOKMARK_PREBOOT_CSS = `
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} {
  /* This script paints before the app stylesheet is available, so mirror the
     resting bookmark material here instead of letting hydration add the blur. */
  --preboot-card-bg: rgba(0, 0, 0, 0.6);
  --preboot-card-border: rgba(255, 255, 255, 0.08);
  --preboot-card-filter: blur(8px);
  position: fixed;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  contain: strict;
  color: rgba(245, 245, 247, 0.88);
  font-family: "Geist", "Geist Sans", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif;
  font-optical-sizing: auto;
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  /* Match .newtab-shell CJK typography exactly; a differing text-autospace or
     spacing-trim shifts mixed CJK/Latin glyph advances at the live handoff. */
  line-break: strict;
  hanging-punctuation: allow-end;
  text-spacing-trim: trim-start;
  text-autospace: normal;
  opacity: 1;
  pointer-events: none;
  transition: none;
}

/* The cached cards use the final glass material, so an unsettled live grid would
   otherwise remain visible underneath and make its titles appear to jump.
   Visibility preserves layout and geometry measurements for the handoff. */
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} ~ #newtab-react-root .bookmark-folder-sections {
  visibility: hidden !important;
}

/* If title metrics take unusually long to settle, reveal the interactive live
   cards while keeping only their unstable titles covered by the cached titles. */
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-title-guard="true"] ~ #newtab-react-root .bookmark-folder-sections {
  visibility: visible !important;
}

/* Tile geometry already matches the snapshot, so the live grid can own pointer
   input while the cached layer keeps owning the pixels. Transparent rather than
   hidden: visibility would keep hit-testing off and leave a readable but dead
   grid on screen. Nothing paints here, so the handoff frame is unchanged. */
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-pointer-handoff="true"]:not([data-title-guard="true"]):not([data-surface-handoff="true"]) ~ #newtab-react-root .bookmark-folder-sections {
  visibility: visible !important;
  opacity: 0 !important;
  transition: none !important;
}

/* A fully transparent grid must not also pay for 72 backdrop blurs it cannot
   show; the snapshot tiles carry the glass until the painted handoff. */
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-pointer-handoff="true"]:not([data-title-guard="true"]):not([data-surface-handoff="true"]) ~ #newtab-react-root .bookmark-tile {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  transition: none !important;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-surface-handoff="true"] ~ #newtab-react-root .bookmark-folder-sections {
  visibility: visible !important;
  transition: none !important;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-title-guard="true"] ~ #newtab-react-root .bookmark-title[data-newtab-bookmark-preboot-title-guard="true"] {
  visibility: hidden !important;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-content {
  position: absolute;
  top: var(--preboot-content-top);
  left: var(--preboot-content-left);
  display: grid;
  width: min(var(--preboot-content-width), calc(100vw - 28px));
  height: var(--preboot-content-height);
  max-width: 100%;
  align-content: start;
  justify-items: stretch;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-sections {
  position: relative;
  width: 100%;
  height: 100%;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-section {
  position: absolute;
  inset: 0;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-tile {
  box-sizing: border-box;
  position: absolute;
  display: grid;
  grid-template-columns: var(--icon-shell-size) minmax(0, 1fr);
  align-items: center;
  justify-self: stretch;
  gap: 8px;
  padding: 8px 10px;
  overflow: hidden;
  border: 1px solid var(--preboot-card-border);
  border-radius: 8px;
  background: var(--preboot-card-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.052);
  -webkit-backdrop-filter: var(--preboot-card-filter);
  backdrop-filter: var(--preboot-card-filter);
  transition: none;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-title-guard="true"]:not([data-surface-handoff="true"]) ~ #newtab-react-root .bookmark-tile {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-surface-handoff="true"] ~ #newtab-react-root .bookmark-tile {
  transition: none !important;
}

/* Keep the cached card as the only glass owner while delayed font metrics are
   guarded. During removal, retain its compositor layer at a visually neutral
   blur until the live card has painted for two animation frames. */
#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-surface-handoff="true"] .newtab-bookmark-preboot-tile {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: blur(0.01px);
  backdrop-filter: blur(0.01px);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-title-guard="true"] .newtab-bookmark-preboot-tile > :not(.newtab-bookmark-preboot-title) {
  visibility: hidden;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID}[data-surface-handoff="true"]:not([data-title-guard="true"]) .newtab-bookmark-preboot-tile > * {
  visibility: hidden;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-tile[data-icon-only="true"] {
  grid-template-columns: var(--icon-shell-size);
  justify-content: center;
  gap: 0;
  padding: 8px;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-icon-shell {
  position: relative;
  display: grid;
  width: var(--icon-shell-size);
  height: var(--icon-shell-size);
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(245, 245, 247, 0.14);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.32);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-favicon {
  position: relative;
  z-index: 1;
  width: calc(var(--icon-shell-size) * 0.68);
  height: calc(var(--icon-shell-size) * 0.68);
  border-radius: 5px;
  object-fit: contain;
  opacity: 0;
  transition: opacity var(--icon-swap-dur, 130ms) var(--icon-swap-ease, ease-in-out);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-favicon[data-ready="true"] {
  opacity: 1;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-fallback {
  position: absolute;
  display: grid;
  width: calc(var(--icon-shell-size) * 0.76);
  height: calc(var(--icon-shell-size) * 0.76);
  place-items: center;
  border-radius: 7px;
  background: rgba(245, 245, 247, 0.09);
  color: rgba(245, 245, 247, 0.88);
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  opacity: 1;
  transition: opacity var(--icon-swap-dur, 130ms) var(--icon-swap-ease, ease-in-out);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-fallback[data-hidden="true"] {
  opacity: 0;
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-title {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  color: rgba(245, 245, 247, 0.8);
  font-size: 13px;
  font-weight: 520;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--icon-title-lines);
}

#${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-title[data-measured-rect="true"] {
  box-sizing: border-box;
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID},
  #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-favicon,
  #${NEWTAB_BOOKMARK_PREBOOT_ROOT_ID} .newtab-bookmark-preboot-fallback {
    transition: none;
  }
}
`
