import assert from 'node:assert/strict'
import {
  NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY,
  createNewtabBookmarkPrebootSnapshot,
  getNewtabBookmarkPrebootFaviconLoadAttributes,
  isRenderableNewtabBookmarkPrebootSnapshot,
  writeNewtabBookmarkPrebootSnapshotFromView,
  type NewtabBookmarkPrebootItemView,
  type NewtabBookmarkPrebootView
} from './newtab-bookmark-preboot.js'
import { readFileSync } from 'node:fs'
import {
  isNewtabFaviconReady,
  markNewtabFaviconNotReady,
  markNewtabFaviconReady
} from './newtab-favicon-readiness.js'

function run(): void {
  testSnapshotKeepsVisibleCardsAndExactCardRect()
  testSnapshotPreservesEachLiveCardOffset()
  testSnapshotSkipsInlineCustomIconPayloads()
  testSnapshotCapturesSquircleClipPaths()
  testSnapshotDropsUntrustedClipPaths()
  testSnapshotWritesToStorage()
  testSnapshotClearsStorageWhenWriteFails()
  testSnapshotClearsStorageWhenNoCardsRemain()
  testSnapshotStopsBeforeMissingTitleGeometry()
  testSnapshotAllowsMissingTitleGeometryWhenTitlesAreHidden()
  testSnapshotRejectsMismatchedViewport()
  testPrebootHandoffIsAtomic()
  testPrebootHandoffGuardsIconClip()
  testFaviconReadinessHandoff()
  testPrebootFaviconLoadingPriorities()
}

function testPrebootFaviconLoadingPriorities(): void {
  assert.deepEqual(
    getNewtabBookmarkPrebootFaviconLoadAttributes(0),
    { fetchPriority: 'high', loading: 'eager' }
  )
  assert.deepEqual(
    getNewtabBookmarkPrebootFaviconLoadAttributes(6),
    { fetchPriority: 'low', loading: 'eager' }
  )
  assert.deepEqual(
    getNewtabBookmarkPrebootFaviconLoadAttributes(12),
    { fetchPriority: 'low', loading: 'lazy' }
  )
}

function testFaviconReadinessHandoff(): void {
  const source = 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=64'
  assert.equal(isNewtabFaviconReady(source), false)
  markNewtabFaviconReady(source)
  assert.equal(isNewtabFaviconReady(source), true)
  markNewtabFaviconNotReady(source)
  assert.equal(isNewtabFaviconReady(source), false)

  const inlineSource = 'data:image/png;base64,large-payload'
  markNewtabFaviconReady(inlineSource)
  assert.equal(isNewtabFaviconReady(inlineSource), false)
}

function testPrebootHandoffIsAtomic(): void {
  const source = readFileSync('src/newtab/newtab-bookmark-preboot.ts', 'utf8')
  assert(source.includes('root.remove()'))
  assert(!source.includes('window.setTimeout(() => {\n    root.remove()'))
  assert(source.includes('transition: none;'))
  assert(
    source.includes('--preboot-card-bg: rgba(0, 0, 0, 0.6);') &&
      source.includes('--preboot-card-filter: blur(8px);') &&
      source.includes('-webkit-backdrop-filter: var(--preboot-card-filter);') &&
      source.includes('backdrop-filter: var(--preboot-card-filter);'),
    'The synchronous snapshot must paint the final bookmark glass material on its first frame.'
  )
  assert(
    source.includes('NEWTAB_BOOKMARK_PREBOOT_SURFACE_HANDOFF_FRAMES = 2') &&
      source.includes("root.dataset.surfaceHandoff = 'true'") &&
      source.includes('[data-surface-handoff="true"] ~ #newtab-react-root .bookmark-tile') &&
      source.includes('transition: none !important;') &&
      source.includes('-webkit-backdrop-filter: blur(0.01px);') &&
      source.includes('backdrop-filter: blur(0.01px);'),
    'The live glass must paint for two frames while the cached compositor layer remains alive before removal.'
  )
  assert(
    source.includes('[data-title-guard="true"]:not([data-surface-handoff="true"]) ~ #newtab-react-root .bookmark-tile'),
    'Delayed titles must keep a single cached glass owner until the live surface handoff begins.'
  )
}

function testPrebootHandoffGuardsIconClip(): void {
  const source = readFileSync('src/newtab/newtab-bookmark-preboot.ts', 'utf8')
  assert(
    source.includes('areNewtabBookmarkIconClipsAligned(prebootTile, liveTile)'),
    'Handoff alignment must compare icon shell clip-path so the squircle outline is settled before the snapshot is removed.'
  )
  assert(
    source.includes('content.clipPaths.iconShell') &&
      source.includes('content.clipPaths.favicon') &&
      source.includes('content.clipPaths.fallback'),
    'Preboot tiles must replay the captured squircle clip-paths synchronously on first paint.'
  )
}

function testSnapshotCapturesSquircleClipPaths(): void {
  const clipPaths = {
    fallback: 'path("M 7.4 0 L 16.9 0 c 2 0 3 0 3.7 0.4 Z")',
    favicon: 'path("M 6.5 0 L 15.2 0 c 1.9 0 2.9 0 3.6 0.38 Z")',
    iconShell: 'path("M 9.6 0 L 22.4 0 c 3.36 0 5.04 0 6.32 0.65 a 6 6 0 0 1 2.62 2.62 Z")'
  }
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({
      clipPaths,
      height: 160,
      left: 188,
      top: 286,
      width: 904
    }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.deepEqual(snapshot.content.clipPaths, clipPaths)
}

function testSnapshotDropsUntrustedClipPaths(): void {
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({
      clipPaths: {
        fallback: 'url(#leak)',
        favicon: 'path("M 0 0") url(evil)',
        iconShell: 'inset(50%)'
      },
      height: 160,
      left: 188,
      top: 286,
      width: 904
    }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.deepEqual(snapshot.content.clipPaths, { fallback: '', favicon: '', iconShell: '' })
}

function testSnapshotKeepsVisibleCardsAndExactCardRect(): void {
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    now: 123456,
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.updatedAt, 123456)
  assert.equal(snapshot.content.layoutMode, 'fixed')
  assert.equal(snapshot.content.columns, 4)
  assert.equal(snapshot.rect.left, 188)
  assert.equal(snapshot.rect.top, 286)
  assert.equal(snapshot.rect.width, 904)
  assert.equal(snapshot.sections.length, 1)
  assert.equal(snapshot.sections[0].items.length, 2)
  assert.equal(snapshot.sections[0].items[0].title, 'GitHub')
  assert.equal(snapshot.sections[0].items[0].faviconSrc, 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F&size=32')
  assert.deepEqual(
    pickItemRect(snapshot.sections[0].items[0]),
    { height: 50, left: 0, top: 30, width: 440 }
  )
  assert.deepEqual(
    snapshot.sections[0].items[0].titleRect,
    { height: 15, left: 52, top: 16.5, width: 376 }
  )
}

function testSnapshotPreservesEachLiveCardOffset(): void {
  const view = createBookmarkContentView()
  view.sections.push(
    { folderId: 'empty', grid: null },
    {
      folderId: '2',
      grid: {
        items: [createBookmarkTile({
          fallbackLabel: 'D',
          id: '12',
          src: 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fdeveloper.mozilla.org%2F&size=32',
          title: 'MDN',
          url: 'https://developer.mozilla.org/'
        })]
      }
    }
  )

  const snapshot = createNewtabBookmarkPrebootSnapshot(view, {
    sectionsElement: createMeasuredElement({
      tiles: [
        { height: 50, id: '10', left: 188, top: 316, width: 440 },
        { height: 50, id: '11', left: 652, top: 316, width: 440 },
        { height: 50, id: '12', left: 224, top: 478, width: 832 }
      ],
      height: 242,
      left: 188,
      top: 286,
      width: 904
    }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.sections.length, 2)
  assert.deepEqual(
    snapshot.sections.map(({ folderId, items }) => ({
      folderId,
      rects: items.map(pickItemRect)
    })),
    [
      {
        folderId: '1',
        rects: [
          { height: 50, left: 0, top: 30, width: 440 },
          { height: 50, left: 464, top: 30, width: 440 }
        ]
      },
      {
        folderId: '2',
        rects: [{ height: 50, left: 36, top: 192, width: 832 }]
      }
    ]
  )
}

function testSnapshotSkipsInlineCustomIconPayloads(): void {
  const view = createBookmarkContentView()
  const firstItem = view.sections[0].grid?.items[0]
  assert(firstItem)
  firstItem.customIcon = true
  firstItem.favicon.src = 'data:image/png;base64,large-payload'

  const snapshot = createNewtabBookmarkPrebootSnapshot(view, {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.sections[0].items[0].faviconSrc, '')
}

function testSnapshotWritesToStorage(): void {
  const storage = new MemoryStorage()
  const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(createBookmarkContentView(), {
    now: 789,
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  }, storage)
  const rawSnapshot = storage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY)

  assert(snapshot)
  assert(rawSnapshot)
  const storedSnapshot = JSON.parse(rawSnapshot)
  assert.equal(storedSnapshot.updatedAt, 789)
  assert.equal(storedSnapshot.version, 4)
  assert.deepEqual(
    storedSnapshot.sections[0].items[0].titleRect,
    { height: 15, left: 52, top: 16.5, width: 376 }
  )
}

function testSnapshotClearsStorageWhenWriteFails(): void {
  const backingStorage = new MemoryStorage()
  backingStorage.setItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY, '{"stale":true}')
  const storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> = {
    getItem: (key) => backingStorage.getItem(key),
    removeItem: (key) => backingStorage.removeItem(key),
    setItem: () => {
      throw new Error('quota exceeded')
    }
  }

  const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  }, storage)

  assert.equal(snapshot, null)
  assert.equal(backingStorage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY), null)
}

function testSnapshotClearsStorageWhenNoCardsRemain(): void {
  const storage = new MemoryStorage()
  storage.setItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY, '{"stale":true}')
  const view = createBookmarkContentView()
  view.sections[0].grid = null

  const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(view, {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  }, storage)

  assert.equal(snapshot, null)
  assert.equal(storage.getItem(NEWTAB_BOOKMARK_PREBOOT_STORAGE_KEY), null)
}

function testSnapshotStopsBeforeMissingTitleGeometry(): void {
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({
      height: 160,
      left: 188,
      tiles: [
        { height: 50, id: '10', left: 188, top: 316, width: 440 },
        { height: 50, id: '11', left: 652, titleRect: null, top: 316, width: 440 }
      ],
      top: 286,
      width: 904
    }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.deepEqual(snapshot.sections.map((section) => section.items.map((item) => item.id)), [['10']])
}

function testSnapshotAllowsMissingTitleGeometryWhenTitlesAreHidden(): void {
  const view = createBookmarkContentView()
  view.content.showTitles = false
  const snapshot = createNewtabBookmarkPrebootSnapshot(view, {
    sectionsElement: createMeasuredElement({
      height: 160,
      left: 188,
      tiles: [
        { height: 50, id: '10', left: 188, titleRect: null, top: 316, width: 440 },
        { height: 50, id: '11', left: 652, titleRect: null, top: 316, width: 440 }
      ],
      top: 286,
      width: 904
    }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(snapshot.sections[0].items[0].titleRect, null)
}

function testSnapshotRejectsMismatchedViewport(): void {
  const snapshot = createNewtabBookmarkPrebootSnapshot(createBookmarkContentView(), {
    sectionsElement: createMeasuredElement({ height: 160, left: 188, top: 286, width: 904 }),
    viewportHeight: 900,
    viewportWidth: 1280
  })

  assert(snapshot)
  assert.equal(isRenderableNewtabBookmarkPrebootSnapshot(snapshot, {
    innerHeight: 900,
    innerWidth: 1281
  }), true)
  assert.equal(isRenderableNewtabBookmarkPrebootSnapshot(snapshot, {
    innerHeight: 900,
    innerWidth: 1282
  }), false)
}

function createBookmarkContentView(): NewtabBookmarkPrebootView {
  return {
    content: {
      columnGap: 24,
      columns: 4,
      fixedGridWidth: 832,
      folderGap: 20,
      iconShellSize: 32,
      layoutMode: 'fixed',
      pageWidth: 1229,
      rowGap: 12,
      showTitles: true,
      tileWidth: 184,
      titleLines: 1
    },
    sections: [
      {
        folderId: '1',
        grid: {
          items: [
            createBookmarkTile({
              fallbackLabel: 'G',
              id: '10',
              src: 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2F&size=32',
              title: 'GitHub',
              url: 'https://github.com/'
            }),
            createBookmarkTile({
              fallbackLabel: 'Y',
              id: '11',
              src: 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Fyoutube.com%2F&size=32',
              title: 'YouTube',
              url: 'https://youtube.com/'
            })
          ]
        }
      }
    ]
  }
}

function createBookmarkTile({
  fallbackLabel,
  id,
  src,
  title,
  url
}: {
  fallbackLabel: string
  id: string
  src: string
  title: string
  url: string
}): NewtabBookmarkPrebootItemView {
  return {
    customIcon: false,
    fallbackLabel,
    favicon: {
      src
    },
    id,
    title,
    url
  }
}

function createMeasuredElement({
  clipPaths,
  height,
  left,
  tiles,
  top,
  width
}: {
  clipPaths?: {
    fallback: string
    favicon: string
    iconShell: string
  }
  height: number
  left: number
  tiles?: Array<{
    height: number
    id: string
    left: number
    titleRect?: {
      height: number
      left: number
      top: number
      width: number
    } | null
    top: number
    width: number
  }>
  top: number
  width: number
}): HTMLElement {
  const tileElements = (tiles ?? [
    { height: 50, id: '10', left, top: top + 30, width: 440 },
    { height: 50, id: '11', left: left + 464, top: top + 30, width: 440 }
  ]).map((tile) => {
    const titleRect = tile.titleRect === undefined
      ? {
          height: 15,
          left: tile.left + 53,
          top: tile.top + 17.5,
          width: tile.width - 64
        }
      : tile.titleRect
    return {
      clientLeft: 1,
      clientTop: 1,
      dataset: { bookmarkId: tile.id },
      getBoundingClientRect: () => createDomRect(tile),
      querySelector: (selector: string) => selector === '.bookmark-title:not([hidden])' && titleRect
        ? { getBoundingClientRect: () => createDomRect(titleRect) }
        : null
    }
  }) as unknown as NodeListOf<HTMLElement>
  const createClipElements = (clipPath: string | undefined) =>
    clipPath === undefined ? [] : [{ style: { clipPath } }]

  return {
    getBoundingClientRect: () => createDomRect({ height, left, top, width }),
    querySelectorAll: (selector: string) => {
      if (selector.endsWith('.bookmark-icon-shell')) {
        return createClipElements(clipPaths?.iconShell)
      }
      if (selector.endsWith('.bookmark-favicon')) {
        return createClipElements(clipPaths?.favicon)
      }
      if (selector.endsWith('.bookmark-fallback')) {
        return createClipElements(clipPaths?.fallback)
      }
      return tileElements
    }
  } as unknown as HTMLElement
}

function pickItemRect(item: {
  height: number
  left: number
  top: number
  width: number
}): {
  height: number
  left: number
  top: number
  width: number
} {
  return {
    height: item.height,
    left: item.left,
    top: item.top,
    width: item.width
  }
}

function createDomRect({
  height,
  left,
  top,
  width
}: {
  height: number
  left: number
  top: number
  width: number
}): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect
}

class MemoryStorage implements Pick<Storage, 'getItem' | 'removeItem' | 'setItem'> {
  private readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}

run()
console.log('Newtab bookmark preboot tests passed.')
