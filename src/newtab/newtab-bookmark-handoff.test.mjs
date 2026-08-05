import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const TITLE_SETTLE_DELAY_MS = 1_600
const EXPECTED_GLASS_BACKGROUND = 'rgba(0, 0, 0, 0.6)'
const EXPECTED_GLASS_FILTER = 'blur(8px)'
const visualCaptureDir = process.env.CURATOR_NEWTAB_HANDOFF_CAPTURE_DIR
const CAPTURE_WALLPAPER_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTAgMGgxNnYxNkgwek0xNiAxNmgxNnYxNkgxNnoiIGZpbGw9IiMwMDAiLz48L3N2Zz4='
const CAPTURE_WALLPAPER_URL = 'https://example.com/curator-handoff-checker.svg'
const CAPTURE_WALLPAPER_SIGNATURE = ['urls', '#101013', '', '', CAPTURE_WALLPAPER_URL, '', '', ''].join('|')
const CAPTURE_REMOTE_WALLPAPER_DELAY_MS = 1_200
const LIFECYCLE_SAMPLE_MS = 5_000
const GLASS_PIXEL_SAMPLE_START_MS = 800
const GLASS_PIXEL_SAMPLE_END_MS = 2_600
const STARTUP_GLASS_SELECTORS = {
  clock: '.newtab-clock',
  onboarding: '.newtab-onboarding-strip',
  search: '.newtab-search',
  settingsTrigger: '.settings-trigger',
  sourceNavigationLabel: '.source-navigation-label',
  sourceNavigationLink: '.source-navigation-link'
}
const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-bookmark-handoff-'))
let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1558, height: 463 },
    recordVideo: visualCaptureDir
      ? { dir: path.resolve(visualCaptureDir), size: { width: 1558, height: 463 } }
      : undefined,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const seeded = await seedBookmarks(worker)
  await worker.evaluate(async ({ wallpaperUrl }) => {
    await chrome.storage.local.set({
      curatorBookmarkNewTabBackgroundSettings: {
        type: 'urls',
        color: '#101013',
        imageName: '',
        videoName: '',
        url: wallpaperUrl,
        featuredId: '',
        maskEnabled: false,
        maskStyle: 'dark',
        maskBlur: 0,
        maskOverlay: 0,
        maskFilterHover: true,
        maskFilterStrength: 50,
        maskFilterSize: 50,
        maskFilterSpacing: 50
      }
    })
  }, { wallpaperUrl: CAPTURE_WALLPAPER_URL })
  const page = await context.newPage()
  const url = 'chrome://newtab/'

  // Simulate a browser/font environment that changes the title baseline while
  // leaving the card geometry untouched, then settles late on refresh.
  await page.addInitScript(({ captureVisual, settleDelayMs, wallpaperFixture }) => {
    if (wallpaperFixture) {
      localStorage.setItem('curatorNewTabInstantWallpaper', JSON.stringify({
        signature: wallpaperFixture.signature,
        dataUrl: wallpaperFixture.dataUrl,
        backgroundSize: '32px 32px',
        backgroundPosition: '0 0',
        placeholderColor: '#101013',
        updatedAt: Date.now(),
        ready: true
      }))
      localStorage.setItem('curatorNewTabInstantWallpaperTarget', JSON.stringify({
        signature: wallpaperFixture.signature,
        imageUrl: wallpaperFixture.wallpaperUrl,
        imageDataUrlRef: '',
        previewUrl: '',
        backgroundSize: '32px 32px',
        backgroundPosition: '0 0',
        placeholderColor: '#101013',
        maskEnabled: false,
        maskStyle: 'dark',
        maskOverlay: 0,
        maskBlur: 0,
        cacheRequired: true,
        cacheReady: true,
        updatedAt: Date.now()
      }))
    }
    document.addEventListener('DOMContentLoaded', () => {
      const hasSnapshot = Boolean(localStorage.getItem('curatorNewTabBookmarkPreboot'))
      const freezeTitleProbe = localStorage.getItem('curatorNewTabFreezeTitleProbe') === 'true'
      const style = document.createElement('style')
      style.dataset.curatorTitleBaselineProbe = 'true'
      style.textContent = `.bookmark-title { transform: translateY(${hasSnapshot ? 8 : 4}px) !important; }`
      document.head.appendChild(style)
      if (captureVisual) {
        const captureStyle = document.createElement('style')
        captureStyle.dataset.curatorGlassCapture = 'true'
        captureStyle.textContent = `
          body::after {
            content: attr(data-curator-glass-capture-state);
            position: fixed;
            top: 4px;
            left: 4px;
            z-index: 2147483647;
            padding: 2px 5px;
            background: #ff2d55;
            color: #ffffff;
            font: 10px/1 monospace;
          }
          body[data-curator-glass-capture-state="guard"]::after { background: #ff9500; }
          body[data-curator-glass-capture-state="handoff"]::after { background: #af52de; }
          body[data-curator-glass-capture-state="live"]::after { background: #007aff; }
        `
        document.head.appendChild(captureStyle)
        const updateCaptureState = () => {
          const root = document.getElementById('newtab-bookmark-preboot')
          document.body.dataset.curatorGlassCaptureState = !root
            ? 'live'
            : root.dataset.surfaceHandoff === 'true'
              ? 'handoff'
              : root.dataset.titleGuard === 'true' ? 'guard' : 'preboot'
        }
        new MutationObserver(updateCaptureState).observe(document.body, {
          attributeFilter: ['data-title-guard'],
          attributes: true,
          childList: true,
          subtree: true
        })
        updateCaptureState()
      }
      if (hasSnapshot && !freezeTitleProbe) {
        window.setTimeout(() => {
          style.textContent = '.bookmark-title { transform: translateY(4px) !important; }'
        }, settleDelayMs)
      }
    }, { once: true })
  }, {
    captureVisual: visualCaptureDir
      ? true
      : false,
    settleDelayMs: TITLE_SETTLE_DELAY_MS,
    wallpaperFixture: {
      dataUrl: CAPTURE_WALLPAPER_DATA_URL,
      signature: CAPTURE_WALLPAPER_SIGNATURE,
      wallpaperUrl: CAPTURE_WALLPAPER_URL
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.locator(bookmarkTileSelector(seeded.bookmarkIds[0])).waitFor({ state: 'visible', timeout: 20_000 })
  const bookmarkRows = await page.locator('.bookmark-tile[data-bookmark-id]').evaluateAll((tiles) =>
    tiles.map((tile) => ({
      bookmarkId: tile.getAttribute('data-bookmark-id') || '',
      top: tile.getBoundingClientRect().top
    }))
  )
  const firstRowTop = bookmarkRows[0]?.top
  const secondRowBookmark = bookmarkRows.find((bookmark) =>
    firstRowTop !== undefined && bookmark.top > firstRowTop + 1
  )
  assert.ok(secondRowBookmark, `Expected a second bookmark row: ${JSON.stringify(bookmarkRows)}`)
  const bookmarkId = secondRowBookmark.bookmarkId
  await page.waitForFunction(() => Boolean(localStorage.getItem('curatorNewTabBookmarkPreboot')))
  const cachedTitleRect = await page.evaluate((bookmarkId) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const item = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
    return {
      titleRect: item?.titleRect ?? null,
      updatedAt: snapshot?.updatedAt ?? null,
      version: snapshot?.version ?? null
    }
  }, bookmarkId)
  assert.equal(cachedTitleRect.version, 4)
  assert.ok(cachedTitleRect.titleRect, `Expected cached title geometry: ${JSON.stringify(cachedTitleRect)}`)
  const initialPerformance = await page.evaluate(() => ({
    firstBookmarksMs: performance.getEntriesByName('newtab.firstBookmarksMs', 'measure').at(-1)?.duration ?? null,
    firstBookmarksRenderedAt: performance.getEntriesByName('newtab.firstBookmarksRendered', 'mark').at(-1)?.startTime ?? null
  }))

  await page.addInitScript(({ bookmarkId, lifecycleSampleMs, startupGlassSelectors }) => {
    window.__curatorBookmarkHandoffFrames = []
    const isPainted = (element) => {
      for (let current = element; current instanceof HTMLElement; current = current.parentElement) {
        const style = getComputedStyle(current)
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.visibility === 'collapse' ||
          Number.parseFloat(style.opacity) <= 0.001
        ) {
          return false
        }
      }
      return true
    }
    const readTitle = (tileSelector, titleSelector) => {
      const tile = document.querySelector(tileSelector)
      const title = document.querySelector(titleSelector)
      if (!(tile instanceof HTMLElement) || !(title instanceof HTMLElement)) return null
      const tileRect = tile.getBoundingClientRect()
      const titleRect = title.getBoundingClientRect()
      return {
        absoluteLeft: titleRect.left,
        absoluteTop: titleRect.top,
        left: titleRect.left - tileRect.left,
        painted: isPainted(title),
        top: titleRect.top - tileRect.top
      }
    }
    const readSurface = (tileSelector) => {
      const tile = document.querySelector(tileSelector)
      if (!(tile instanceof HTMLElement)) return null
      const style = getComputedStyle(tile)
      let effectiveOpacity = 1
      for (let current = tile; current instanceof HTMLElement; current = current.parentElement) {
        effectiveOpacity *= Number.parseFloat(getComputedStyle(current).opacity) || 0
      }
      return {
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
        backgroundColor: style.backgroundColor,
        effectiveOpacity,
        painted: isPainted(tile),
        willChange: style.willChange
      }
    }
    const isLiveTileHitTarget = () => {
      const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
      if (!(tile instanceof HTMLElement)) return false
      const rect = tile.getBoundingClientRect()
      const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2))
      const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2))
      return document.elementFromPoint(x, y)?.closest('.bookmark-tile') === tile
    }
    const sample = (now) => {
      const page = document.querySelector('.newtab-page')
      const primarySlot = document.querySelector('.newtab-primary-slot')
      const prebootRoot = document.getElementById('newtab-bookmark-preboot')
      const persistentNodes = window.__curatorPersistentBackgroundNodes ||= {}
      persistentNodes.dynamicStage ||= document.getElementById('newtab-dynamic-background-stage')
      persistentNodes.mask ||= document.getElementById('newtab-background-mask')
      persistentNodes.video ||= document.querySelector('.newtab-background-video')
      persistentNodes.wallpaper ||= document.getElementById('newtab-wallpaper-stage')
      const titleGuard = prebootRoot?.dataset.titleGuard === 'true'
      const surfaceHandoff = prebootRoot?.dataset.surfaceHandoff === 'true'
      const prebootSurface = readSurface(
        `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"]`
      )
      const liveSurface = readSurface(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
      const preboot = readTitle(
        `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"]`,
        `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"] .newtab-bookmark-preboot-title`
      )
      const live = readTitle(
        `.bookmark-tile[data-bookmark-id="${bookmarkId}"]`,
        `.bookmark-tile[data-bookmark-id="${bookmarkId}"] .bookmark-title`
      )
      window.__curatorBookmarkHandoffFrames.push({
        collisionOffset: page instanceof HTMLElement
          ? getComputedStyle(page).getPropertyValue('--primary-collision-offset-y').trim()
          : '',
        glassSurfaces: Object.fromEntries(
          Object.entries(startupGlassSelectors).map(([name, selector]) => [name, readSurface(selector)])
        ),
        live,
        liveInteractive: isLiveTileHitTarget(),
        liveSurface,
        lifecycle: {
          appClass: document.querySelector('.newtab-app')?.className || '',
          backgroundLayers: [...document.querySelectorAll('.newtab-background-image')].map((layer) => {
            const style = getComputedStyle(layer)
            return {
              opacity: style.opacity,
              state: layer.getAttribute('data-state'),
              transitioning: layer.getAttribute('data-transitioning'),
              willChange: style.willChange
            }
          }),
          glassBooting: document.documentElement.classList.contains('newtab-glass-booting'),
          htmlClass: document.documentElement.className,
          dynamicStageConnected: persistentNodes.dynamicStage?.isConnected === true,
          dynamicStageStable: document.getElementById('newtab-dynamic-background-stage') === persistentNodes.dynamicStage,
          maskConnected: persistentNodes.mask?.isConnected === true,
          maskStable: document.getElementById('newtab-background-mask') === persistentNodes.mask,
          startupStyle: Boolean(document.getElementById('instant-wallpaper-startup-style')),
          videoConnected: persistentNodes.video?.isConnected === true,
          videoStable: document.querySelector('.newtab-background-video') === persistentNodes.video,
          wallpaperConnected: persistentNodes.wallpaper?.isConnected === true,
          wallpaperStable: document.getElementById('newtab-wallpaper-stage') === persistentNodes.wallpaper
        },
        now,
        preboot,
        prebootSurface,
        primaryTransform: primarySlot instanceof HTMLElement ? getComputedStyle(primarySlot).transform : '',
        surface: surfaceHandoff ? liveSurface : (prebootSurface || liveSurface),
        surfaceHandoff,
        titleGuard,
        visible: preboot || live
      })
      if (now < lifecycleSampleMs) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }, {
    bookmarkId,
    lifecycleSampleMs: LIFECYCLE_SAMPLE_MS,
    startupGlassSelectors: STARTUP_GLASS_SELECTORS
  })

  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    if (requestUrl === CAPTURE_WALLPAPER_URL) {
      await new Promise((resolve) => setTimeout(resolve, CAPTURE_REMOTE_WALLPAPER_DELAY_MS))
      await route.fulfill({
        body: Buffer.from(CAPTURE_WALLPAPER_DATA_URL.split(',')[1], 'base64'),
        contentType: 'image/svg+xml',
        status: 200
      })
      return
    }
    if (/\/assets\/newtab\.html-[^/]+\.js$/.test(new URL(requestUrl).pathname)) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    await route.continue()
  })

  await page.goto(url, { waitUntil: 'commit' })
  await page.locator(prebootTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 5_000 })
  const prebootTop = await page.locator(`${prebootTileSelector(bookmarkId)} .newtab-bookmark-preboot-title`).evaluate(
    (element) => element.getBoundingClientRect().top
  )
  const glassPixelDiagnostics = await assertGlassPixelsStable(page, 'first refresh')

  await page.locator(bookmarkTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))
  try {
    await page.waitForFunction(({ expectedTop, selector }) => {
      const title = document.querySelector(selector)
      return title instanceof HTMLElement && Math.abs(title.getBoundingClientRect().top - expectedTop) <= 0.5
    }, {
      expectedTop: prebootTop,
      selector: `${bookmarkTileSelector(bookmarkId)} .bookmark-title`
    }, { timeout: 5_000 })
  } catch (error) {
    const current = await page.evaluate((selector) => {
      const title = document.querySelector(selector)
      const primarySlot = document.querySelector('.newtab-primary-slot')
      const frames = window.__curatorBookmarkHandoffFrames || []
      const layoutSequence = []
      for (const frame of frames) {
        const entry = `${frame.collisionOffset}|${frame.primaryTransform}|${frame.live?.absoluteTop ?? 'none'}`
        if (layoutSequence.at(-1) !== entry) layoutSequence.push(entry)
      }
      return {
        layoutSequence,
        primaryTransform: primarySlot instanceof HTMLElement ? getComputedStyle(primarySlot).transform : '',
        titleTop: title instanceof HTMLElement ? title.getBoundingClientRect().top : null
      }
    }, `${bookmarkTileSelector(bookmarkId)} .bookmark-title`)
    throw new Error(`Live bookmark title did not return to cached position: ${JSON.stringify({ current, prebootTop })}`, { cause: error })
  }

  const finalLiveTop = await page.locator(`${bookmarkTileSelector(bookmarkId)} .bookmark-title`).evaluate(
    (element) => element.getBoundingClientRect().top
  )
  await page.waitForTimeout(LIFECYCLE_SAMPLE_MS)
  const frames = await page.evaluate(() => window.__curatorBookmarkHandoffFrames || [])
  const backgroundLifecycleDiagnostics = assertPersistentBackgroundLifecycle(frames, 'first refresh')
  const startupGlassDiagnostics = assertStableStartupGlass(frames, 'first refresh')
  const refreshFirstBookmarksRenderedAt = await page.evaluate(() =>
    performance.getEntriesByName('newtab.firstBookmarksRendered', 'mark').at(-1)?.startTime ?? null
  )
  const firstInteractiveFrame = frames.find((frame) => frame.liveInteractive)
  const interactionHandoffMs = firstInteractiveFrame && refreshFirstBookmarksRenderedAt !== null
    ? firstInteractiveFrame.now - refreshFirstBookmarksRenderedAt
    : null
  const visibleFrames = frames.filter((frame) => frame.visible)
  const visibleTopValues = visibleFrames.map((frame) => frame.visible.absoluteTop)
  const visibleTopRange = Math.max(...visibleTopValues) - Math.min(...visibleTopValues)
  const visibleRelativeTopValues = visibleFrames.map((frame) => frame.visible.top)
  const visibleRelativeTopRange = Math.max(...visibleRelativeTopValues) - Math.min(...visibleRelativeTopValues)
  const visibleGlassFrames = visibleFrames.filter((frame) => frame.surface?.painted)
  const mismatchedGlassFrames = visibleGlassFrames.filter((frame) =>
    frame.surface.backgroundColor !== EXPECTED_GLASS_BACKGROUND ||
    frame.surface.backdropFilter !== EXPECTED_GLASS_FILTER
  )
  const leakingLiveFrames = frames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live?.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const protectedLiveFrames = frames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live &&
    !frame.live.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const revealedLiveFrames = frames.filter((frame) => !frame.preboot && frame.live?.painted)
  const titleGuardFrames = frames.filter((frame) => frame.titleGuard)
  const diagnostics = {
    bookmarkId,
    cachedTitleRect,
    finalLiveTop,
    firstVisible: visibleFrames[0]?.visible ?? null,
    initialPerformance,
    interactionHandoffMs,
    backgroundLifecycle: backgroundLifecycleDiagnostics,
    glassPixels: glassPixelDiagnostics,
    lifecycle: summarizeLifecycle(frames),
    startupGlass: startupGlassDiagnostics,
    lastVisible: visibleFrames.at(-1)?.visible ?? null,
    mismatchedGlassFrame: mismatchedGlassFrames[0] ?? null,
    mismatchedGlassFrameCount: mismatchedGlassFrames.length,
    leakingLiveFrame: leakingLiveFrames[0] ?? null,
    leakingLiveFrameCount: leakingLiveFrames.length,
    prebootTop,
    protectedLiveFrameCount: protectedLiveFrames.length,
    revealedLiveFrameCount: revealedLiveFrames.length,
    titleGuardFrameCount: titleGuardFrames.length,
    visibleRelativeTopRange,
    visibleGlassFrameCount: visibleGlassFrames.length,
    visibleTopRange
  }

  assert.ok(
    Math.abs(prebootTop - finalLiveTop) <= 0.5,
    `Cached and final bookmark titles should share one position: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    interactionHandoffMs !== null && interactionHandoffMs <= 400,
    `Live bookmark cards should take over pointer interaction within 400ms of rendering: ${JSON.stringify(diagnostics)}`
  )
  assert.equal(
    visibleGlassFrames.length,
    visibleFrames.length,
    `Every visible bookmark frame must have an owning glass surface: ${JSON.stringify(diagnostics)}`
  )
  assert.equal(
    mismatchedGlassFrames.length,
    0,
    `Bookmark cards must keep the final blurred material throughout preboot handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    visibleTopRange <= 0.5,
    `Bookmark title should not move during cached-to-live handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    visibleRelativeTopRange <= 0.5,
    `Bookmark title should not move inside its tile during cached-to-live handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.equal(
    leakingLiveFrames.length,
    0,
    `Misaligned live bookmark titles must not paint through the preboot layer: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    protectedLiveFrames.length > 0,
    `The regression fixture must exercise a hidden misaligned live title: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    revealedLiveFrames.length > 0,
    `Live bookmark titles must become visible after the preboot handoff: ${JSON.stringify(diagnostics)}`
  )
  assert.ok(
    titleGuardFrames.length > 0,
    `The regression fixture must cross the delayed-title guard: ${JSON.stringify(diagnostics)}`
  )

  await page.waitForFunction(({ bookmarkId, previousUpdatedAt }) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const storedTitleRect = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
      ?.titleRect
    const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
    const title = tile?.querySelector('.bookmark-title')
    if (!storedTitleRect || !(tile instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      return false
    }
    const tileRect = tile.getBoundingClientRect()
    const titleRect = title.getBoundingClientRect()
    return (
      Number(snapshot.updatedAt) > Number(previousUpdatedAt) &&
      Math.abs(storedTitleRect.left - (titleRect.left - tileRect.left - tile.clientLeft)) <= 0.5 &&
      Math.abs(storedTitleRect.top - (titleRect.top - tileRect.top - tile.clientTop)) <= 0.5
    )
  }, {
    bookmarkId,
    previousUpdatedAt: cachedTitleRect.updatedAt
  }, { timeout: 5_000 })

  const storedSnapshot = await page.evaluate((bookmarkId) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const titleRect = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
      ?.titleRect ?? null
    return {
      titleRect,
      updatedAt: snapshot?.updatedAt ?? null
    }
  }, bookmarkId)

  await page.goto(url, { waitUntil: 'commit' })
  await page.locator(prebootTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 5_000 })
  const secondGlassPixelDiagnostics = await assertGlassPixelsStable(page, 'consecutive refresh')
  await page.locator(bookmarkTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))
  await page.waitForFunction(
    (minimumTime) => performance.now() >= minimumTime,
    TITLE_SETTLE_DELAY_MS + 300
  )

  const secondFrames = await page.evaluate(() => window.__curatorBookmarkHandoffFrames || [])
  const secondBackgroundLifecycleDiagnostics = assertPersistentBackgroundLifecycle(secondFrames, 'consecutive refresh')
  const secondStartupGlassDiagnostics = assertStableStartupGlass(secondFrames, 'consecutive refresh')
  const secondVisibleFrames = secondFrames.filter((frame) => frame.visible)
  const secondVisibleTopValues = secondVisibleFrames.map((frame) => frame.visible.absoluteTop)
  const secondVisibleTopRange = Math.max(...secondVisibleTopValues) - Math.min(...secondVisibleTopValues)
  const secondVisibleRelativeTopValues = secondVisibleFrames.map((frame) => frame.visible.top)
  const secondVisibleRelativeTopRange = (
    Math.max(...secondVisibleRelativeTopValues) - Math.min(...secondVisibleRelativeTopValues)
  )
  const secondVisibleGlassFrames = secondVisibleFrames.filter((frame) => frame.surface?.painted)
  const secondMismatchedGlassFrames = secondVisibleGlassFrames.filter((frame) =>
    frame.surface.backgroundColor !== EXPECTED_GLASS_BACKGROUND ||
    frame.surface.backdropFilter !== EXPECTED_GLASS_FILTER
  )
  const secondLeakingLiveFrames = secondFrames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live?.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const secondProtectedLiveFrames = secondFrames.filter((frame) =>
    frame.preboot?.painted &&
    frame.live &&
    !frame.live.painted &&
    Math.abs(frame.preboot.absoluteTop - frame.live.absoluteTop) > 0.5
  )
  const secondRevealedLiveFrames = secondFrames.filter((frame) => !frame.preboot && frame.live?.painted)
  const secondTitleGuardFrames = secondFrames.filter((frame) => frame.titleGuard)
  const secondDiagnostics = {
    firstVisible: secondVisibleFrames[0]?.visible ?? null,
    lastVisible: secondVisibleFrames.at(-1)?.visible ?? null,
    leakingLiveFrameCount: secondLeakingLiveFrames.length,
    backgroundLifecycle: secondBackgroundLifecycleDiagnostics,
    glassPixels: secondGlassPixelDiagnostics,
    lifecycle: summarizeLifecycle(secondFrames),
    mismatchedGlassFrame: secondMismatchedGlassFrames[0] ?? null,
    mismatchedGlassFrameCount: secondMismatchedGlassFrames.length,
    protectedLiveFrameCount: secondProtectedLiveFrames.length,
    revealedLiveFrameCount: secondRevealedLiveFrames.length,
    storedSnapshot,
    startupGlass: secondStartupGlassDiagnostics,
    titleGuardFrameCount: secondTitleGuardFrames.length,
    visibleGlassFrameCount: secondVisibleGlassFrames.length,
    visibleRelativeTopRange: secondVisibleRelativeTopRange,
    visibleTopRange: secondVisibleTopRange
  }

  assert.ok(
    secondVisibleTopRange <= 0.5,
    `Bookmark title should remain fixed across consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondVisibleRelativeTopRange <= 0.5,
    `Bookmark title should remain fixed inside its tile across consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.equal(
    secondVisibleGlassFrames.length,
    secondVisibleFrames.length,
    `Every visible bookmark frame must retain a glass surface across consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.equal(
    secondMismatchedGlassFrames.length,
    0,
    `Bookmark glass must not fall back to a transparent or unblurred frame on consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.equal(
    secondLeakingLiveFrames.length,
    0,
    `Misaligned live titles must stay hidden on consecutive refreshes: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondProtectedLiveFrames.length > 0,
    `The consecutive-refresh fixture must preserve the final title geometry: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondRevealedLiveFrames.length > 0,
    `Live titles must be revealed on the consecutive refresh: ${JSON.stringify(secondDiagnostics)}`
  )
  assert.ok(
    secondTitleGuardFrames.length > 0,
    `The consecutive refresh must cross the delayed-title guard: ${JSON.stringify(secondDiagnostics)}`
  )

  const renamedBookmarkTitle = 'Live renamed frozen-title probe'
  await worker.evaluate(async ({ bookmarkId, title }) => {
    await chrome.bookmarks.update(bookmarkId, { title })
  }, { bookmarkId, title: renamedBookmarkTitle })
  await page.waitForFunction(({ bookmarkId, title }) => {
    return document
      .querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"] .bookmark-title`)
      ?.textContent === title
  }, { bookmarkId, title: renamedBookmarkTitle })
  await page.evaluate((bookmarkId) => {
    const rawSnapshot = localStorage.getItem('curatorNewTabBookmarkPreboot')
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null
    const item = snapshot?.sections
      ?.flatMap((section) => section.items || [])
      .find((candidate) => candidate.id === bookmarkId)
    if (item) {
      item.title = 'Cached stale frozen-title probe'
      localStorage.setItem('curatorNewTabBookmarkPreboot', JSON.stringify(snapshot))
    }
    localStorage.setItem('curatorNewTabFreezeTitleProbe', 'true')
  }, bookmarkId)
  await page.goto(url, { waitUntil: 'commit' })
  await page.locator(prebootTileSelector(bookmarkId)).waitFor({ state: 'visible', timeout: 5_000 })
  await page.locator('.newtab-bookmark-frozen-title').first().waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForFunction(() => !document.getElementById('newtab-bookmark-preboot'))

  const frozenBeforeScroll = await page.evaluate((bookmarkId) => {
    const scrollHost = document.querySelector('.newtab-shell')
    const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
    const sourceTitle = tile?.querySelector('.bookmark-title')
    const frozenTitle = tile?.querySelector('.newtab-bookmark-frozen-title')
    if (
      !(scrollHost instanceof HTMLElement) ||
      !(tile instanceof HTMLElement) ||
      !(sourceTitle instanceof HTMLElement) ||
      !(frozenTitle instanceof HTMLElement)
    ) {
      return null
    }
    const tileRect = tile.getBoundingClientRect()
    const frozenRect = frozenTitle.getBoundingClientRect()
    return {
      frozenText: frozenTitle.textContent,
      frozenTop: frozenRect.top,
      maxScroll: scrollHost.scrollHeight - scrollHost.clientHeight,
      relativeTop: frozenRect.top - tileRect.top,
      scrollTop: scrollHost.scrollTop,
      sourceVisibility: getComputedStyle(sourceTitle).visibility,
      sourceText: sourceTitle.textContent,
      tileTop: tileRect.top
    }
  }, bookmarkId)
  assert.ok(frozenBeforeScroll, 'Expected the frozen title transfer to be installed')
  assert.ok(
    frozenBeforeScroll.maxScroll > 40,
    `Expected a scrollable new tab shell: ${JSON.stringify(frozenBeforeScroll)}`
  )
  assert.equal(frozenBeforeScroll.sourceVisibility, 'hidden')
  assert.equal(frozenBeforeScroll.sourceText, renamedBookmarkTitle)
  assert.equal(frozenBeforeScroll.frozenText, renamedBookmarkTitle)

  await page.evaluate(() => {
    const scrollHost = document.querySelector('.newtab-shell')
    if (scrollHost instanceof HTMLElement) {
      scrollHost.scrollTop = Math.min(100, scrollHost.scrollHeight - scrollHost.clientHeight)
    }
  })
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))

  const frozenAfterScroll = await page.evaluate((bookmarkId) => {
    const scrollHost = document.querySelector('.newtab-shell')
    const tile = document.querySelector(`.bookmark-tile[data-bookmark-id="${bookmarkId}"]`)
    const frozenTitle = tile?.querySelector('.newtab-bookmark-frozen-title')
    if (!(scrollHost instanceof HTMLElement) || !(tile instanceof HTMLElement) || !(frozenTitle instanceof HTMLElement)) {
      return null
    }
    const tileRect = tile.getBoundingClientRect()
    const frozenRect = frozenTitle.getBoundingClientRect()
    return {
      frozenTop: frozenRect.top,
      relativeTop: frozenRect.top - tileRect.top,
      scrollTop: scrollHost.scrollTop,
      tileTop: tileRect.top
    }
  }, bookmarkId)
  assert.ok(frozenAfterScroll, 'Expected the transferred title to survive scrolling')
  const frozenTitleDelta = frozenAfterScroll.frozenTop - frozenBeforeScroll.frozenTop
  const frozenTileDelta = frozenAfterScroll.tileTop - frozenBeforeScroll.tileTop
  assert.ok(
    frozenAfterScroll.scrollTop > frozenBeforeScroll.scrollTop + 20,
    `Expected the shell to scroll: ${JSON.stringify({ frozenAfterScroll, frozenBeforeScroll })}`
  )
  assert.ok(
    Math.abs(frozenTitleDelta - frozenTileDelta) <= 0.5,
    `Frozen title must move with its live tile: ${JSON.stringify({ frozenAfterScroll, frozenBeforeScroll })}`
  )
  assert.ok(
    Math.abs(frozenAfterScroll.relativeTop - frozenBeforeScroll.relativeTop) <= 0.5,
    `Frozen title must keep its position inside the live tile: ${JSON.stringify({ frozenAfterScroll, frozenBeforeScroll })}`
  )

  console.log(`Newtab bookmark handoff probe: ${JSON.stringify({
    first: diagnostics,
    frozenScroll: { after: frozenAfterScroll, before: frozenBeforeScroll },
    second: secondDiagnostics
  })}`)
  console.log('Newtab bookmark handoff test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}

async function seedBookmarks(worker) {
  return worker.evaluate(async () => {
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) throw new Error('Bookmarks bar is unavailable')

    const primaryFolder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: 'Curator handoff multi-row probe'
    })
    const secondaryFolder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: 'Curator handoff next-section probe'
    })
    const bookmarks = []
    for (let index = 0; index < 15; index += 1) {
      bookmarks.push(await chrome.bookmarks.create({
        parentId: primaryFolder.id,
        title: index === 7 ? 'Second-row title handoff probe' : `Probe ${index + 1}`,
        url: `https://example.com/curator-handoff-probe/${index + 1}`
      }))
    }
    for (let index = 0; index < 3; index += 1) {
      bookmarks.push(await chrome.bookmarks.create({
        parentId: secondaryFolder.id,
        title: `Next section ${index + 1}`,
        url: `https://example.com/curator-handoff-next-section/${index + 1}`
      }))
    }

    await chrome.storage.local.set({
      curatorBookmarkNewTabFolderSettings: {
        selectedFolderIds: [primaryFolder.id, secondaryFolder.id],
        hideFolderNames: true
      },
      curatorBookmarkNewTabIconSettings: {
        pageWidth: 78,
        columnGap: 10,
        rowGap: 10,
        folderGap: 20,
        tileWidth: 184,
        iconShellSize: 32,
        preset: 'comfortable',
        layoutMode: 'auto',
        columns: 4,
        showTitles: true,
        titleLines: 1,
        verticalCenter: true
      },
      curatorBookmarkNewTabSearchSettings: {
        enabled: true
      }
    })
    return { bookmarkIds: bookmarks.map((bookmark) => bookmark.id) }
  })
}

function bookmarkTileSelector(bookmarkId) {
  return `.bookmark-tile[data-bookmark-id="${bookmarkId}"]`
}

async function assertGlassPixelsStable(page, label) {
  await page.waitForFunction((selectors) => Object.values(selectors).every((selector) => {
    const element = document.querySelector(selector)
    return element instanceof HTMLElement && element.getClientRects().length > 0
  }), STARTUP_GLASS_SELECTORS)
  await page.waitForFunction(
    (minimumTime) => performance.now() >= minimumTime,
    GLASS_PIXEL_SAMPLE_START_MS
  )

  const samples = []
  while (await page.evaluate((endTime) => performance.now() < endTime, GLASS_PIXEL_SAMPLE_END_MS)) {
    const regions = await page.evaluate((selectors) => Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect()
        return [name, rect
          ? { height: rect.height, left: rect.left, top: rect.top, width: rect.width }
          : null]
      })
    ), STARTUP_GLASS_SELECTORS)
    const screenshot = await page.screenshot({ type: 'png' })
    const stats = await page.evaluate(async ({ encodedPng, regions }) => {
      const image = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${encodedPng}`)).blob()
      )
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Pixel probe could not create a 2D canvas context')
      context.drawImage(image, 0, 0)
      image.close()
      const scaleX = canvas.width / window.innerWidth
      const scaleY = canvas.height / window.innerHeight

      return Object.fromEntries(Object.entries(regions).map(([name, rect]) => {
        if (!rect) return [name, null]
        const inset = Math.max(2, Math.min(6, rect.width / 5, rect.height / 5))
        const left = Math.max(0, Math.floor((rect.left + inset) * scaleX))
        const top = Math.max(0, Math.floor((rect.top + inset) * scaleY))
        const width = Math.max(1, Math.min(
          canvas.width - left,
          Math.floor((rect.width - inset * 2) * scaleX)
        ))
        const height = Math.max(1, Math.min(
          canvas.height - top,
          Math.floor((rect.height - inset * 2) * scaleY)
        ))
        const pixels = context.getImageData(left, top, width, height).data
        let blue = 0
        let green = 0
        let luminance = 0
        let luminanceSquared = 0
        let red = 0
        let count = 0
        for (let index = 0; index < pixels.length; index += 16) {
          const r = pixels[index]
          const g = pixels[index + 1]
          const b = pixels[index + 2]
          const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
          red += r
          green += g
          blue += b
          luminance += y
          luminanceSquared += y * y
          count += 1
        }
        const meanLuminance = luminance / count
        return [name, {
          meanBlue: blue / count,
          meanGreen: green / count,
          meanLuminance,
          meanRed: red / count,
          standardDeviation: Math.sqrt(Math.max(0, luminanceSquared / count - meanLuminance ** 2))
        }]
      }))
    }, {
      encodedPng: screenshot.toString('base64'),
      regions
    })
    samples.push({
      now: await page.evaluate(() => performance.now()),
      stats
    })
    await page.waitForTimeout(24)
  }

  const diagnostics = {}
  for (const name of Object.keys(STARTUP_GLASS_SELECTORS)) {
    const values = samples.map((sample) => sample.stats[name]).filter(Boolean)
    const metricRanges = Object.fromEntries([
      'meanBlue',
      'meanGreen',
      'meanLuminance',
      'meanRed',
      'standardDeviation'
    ].map((metric) => {
      const metricValues = values.map((value) => value[metric])
      return [metric, Math.max(...metricValues) - Math.min(...metricValues)]
    }))
    diagnostics[name] = {
      first: values[0] ?? null,
      ranges: metricRanges,
      sampleCount: values.length
    }
    assert.ok(values.length >= 8, `${label}: ${name} pixel probe needs at least 8 frames`)
    assert.ok(
      metricRanges.meanLuminance <= 2 && metricRanges.standardDeviation <= 2,
      `${label}: ${name} glass pixels changed during delayed wallpaper readiness: ${JSON.stringify(diagnostics[name])}`
    )
  }
  return diagnostics
}

function assertStableStartupGlass(frames, label) {
  const diagnostics = {}
  for (const name of Object.keys(STARTUP_GLASS_SELECTORS)) {
    const visible = frames
      .map((frame) => frame.glassSurfaces?.[name])
      .filter((surface) => surface?.painted)
    const finalBackground = visible.at(-1)?.backgroundColor ?? ''
    const mismatched = visible.filter((surface) =>
      surface.backgroundColor !== finalBackground ||
      getColorAlpha(surface.backgroundColor) <= 0.001 ||
      surface.backdropFilter !== EXPECTED_GLASS_FILTER ||
      Math.abs(surface.effectiveOpacity - 1) > 0.001
    )
    diagnostics[name] = {
      first: visible[0] ?? null,
      mismatchedCount: mismatched.length,
      visibleFrameCount: visible.length
    }
    assert.ok(
      visible.length > 0,
      `${label}: expected startup glass surface ${name}: ${JSON.stringify(diagnostics)}`
    )
    assert.equal(
      mismatched.length,
      0,
      `${label}: ${name} must appear at final opacity with the unified glass material: ${JSON.stringify({
        diagnostics,
        mismatch: mismatched[0] ?? null
      })}`
    )
  }
  return diagnostics
}

function assertPersistentBackgroundLifecycle(frames, label) {
  const lifecycleFrames = frames.filter((frame) =>
    frame.lifecycle?.wallpaperConnected && frame.lifecycle.appClass
  )
  const unstable = lifecycleFrames.filter((frame) => {
    const backgroundLayers = frame.lifecycle.backgroundLayers || []
    return !frame.lifecycle.dynamicStageConnected ||
      !frame.lifecycle.dynamicStageStable ||
      !frame.lifecycle.videoConnected ||
      !frame.lifecycle.videoStable ||
      !frame.lifecycle.wallpaperStable ||
      !frame.lifecycle.maskConnected ||
      !frame.lifecycle.maskStable ||
      !frame.lifecycle.startupStyle ||
      frame.lifecycle.glassBooting ||
      backgroundLayers.length !== 1 ||
      backgroundLayers[0].opacity !== '1' ||
      backgroundLayers[0].transitioning !== null ||
      backgroundLayers[0].willChange !== 'auto'
  })
  const diagnostics = {
    frameCount: lifecycleFrames.length,
    firstUnstable: unstable[0] ?? null
  }
  assert.ok(lifecycleFrames.length > 0, `${label}: persistent wallpaper stage must be sampled`)
  assert.equal(
    unstable.length,
    0,
    `${label}: wallpaper, mask, and glass compositor ownership must remain stable: ${JSON.stringify(diagnostics)}`
  )
  return diagnostics
}

function summarizeLifecycle(frames) {
  const transitions = []
  for (const frame of frames) {
    if (!frame.lifecycle) continue
    const key = JSON.stringify(frame.lifecycle)
    if (transitions.at(-1)?.key === key) continue
    transitions.push({
      key,
      lifecycle: frame.lifecycle,
      now: Math.round(frame.now * 10) / 10,
      searchWillChange: frame.glassSurfaces?.search?.willChange || ''
    })
  }
  return transitions.map(({ key: _key, ...transition }) => transition)
}

function getColorAlpha(color) {
  const match = color.match(/^rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)$/)
  return match ? Number(match[1] ?? 1) : 0
}

function prebootTileSelector(bookmarkId) {
  return `.newtab-bookmark-preboot-tile[data-bookmark-id="${bookmarkId}"]`
}
