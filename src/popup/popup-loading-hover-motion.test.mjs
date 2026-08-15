import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-popup-loading-hover-'))
const capturePath = process.argv.includes('--capture')
  ? path.resolve('output/playwright/popup-cold-open.png')
  : null
const seededFolderCount = 48
const seededItemsPerFolder = 12
const schedulerFrameGapLimitMs = 220
const contentSnapshotSettingsKey = 'curatorBookmarkContentSnapshotSettings'

async function seedBookmarks(worker) {
  await worker.evaluate(async ({ folderCount, itemsPerFolder, snapshotSettingsKey }) => {
    await chrome.storage.local.set({
      [snapshotSettingsKey]: {
        version: 1,
        enabled: false,
        autoCaptureOnBookmarkCreate: false,
        saveFullText: false,
        fullTextSearchEnabled: false,
        localOnlyNoAiUpload: true
      }
    })
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) throw new Error('Bookmarks bar is unavailable')

    const folder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: `Popup motion probe ${Date.now()}`
    })
    for (let folderIndex = 0; folderIndex < folderCount; folderIndex += 1) {
      const childFolder = await chrome.bookmarks.create({
        parentId: folder.id,
        title: `Popup motion folder ${String(folderIndex + 1).padStart(2, '0')}`
      })
      for (let itemIndex = 0; itemIndex < itemsPerFolder; itemIndex += 1) {
        await chrome.bookmarks.create({
          parentId: childFolder.id,
          title: `Popup motion item ${String(folderIndex + 1).padStart(2, '0')}-${String(itemIndex + 1).padStart(2, '0')}`,
          url: `https://example.com/popup-motion/${folderIndex + 1}/${itemIndex + 1}/market/watchlist?symbol=BINANCE%3ABTCUSDT&interval=15m`
        })
      }
    }
  }, {
    folderCount: seededFolderCount,
    itemsPerFolder: seededItemsPerFolder,
    snapshotSettingsKey: contentSnapshotSettingsKey
  })
}

async function waitForFrames(page, count = 2) {
  await page.evaluate((frameCount) => new Promise((resolve) => {
    let remaining = frameCount
    const tick = () => {
      remaining -= 1
      if (remaining <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), count)
}

async function readIndicatorBounds(page, viewportSelector) {
  const indicatorSelector = '.t-skel-content .popup-active-result-indicator[data-visible="true"]'
  return page.evaluate(({ indicatorSelector: targetIndicator, viewportSelector: targetViewport }) => {
    const indicator = document.querySelector(targetIndicator)
    const viewport = document.querySelector(targetViewport)
    if (!(indicator instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
      throw new Error('Active indicator or viewport is unavailable')
    }
    const indicatorRect = indicator.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    return {
      bottomGap: viewportRect.bottom - indicatorRect.bottom,
      indicatorBottom: indicatorRect.bottom,
      indicatorTop: indicatorRect.top,
      topGap: indicatorRect.top - viewportRect.top,
      viewportBottom: viewportRect.bottom,
      viewportTop: viewportRect.top
    }
  }, { indicatorSelector, viewportSelector })
}

async function waitForIndicatorSafeArea(page, viewportSelector, minGap = 7) {
  const selector = '.t-skel-content .popup-active-result-indicator[data-visible="true"]'
  await page.waitForFunction(({ indicatorSelector, viewportSelector: targetViewport, minGap: targetGap }) => {
    const indicator = document.querySelector(indicatorSelector)
    const viewport = document.querySelector(targetViewport)
    if (!(indicator instanceof HTMLElement) || !(viewport instanceof HTMLElement)) return false
    const indicatorRect = indicator.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    return indicatorRect.top >= viewportRect.top + targetGap - 0.75 &&
      indicatorRect.bottom <= viewportRect.bottom - targetGap + 0.75
  }, { indicatorSelector: selector, viewportSelector, minGap }, { timeout: 2_000 })

  return readIndicatorBounds(page, viewportSelector)
}

function maxTransitionMs(value) {
  return Math.max(...value.split(',').map((entry) => {
    const duration = Number.parseFloat(entry)
    return duration * (entry.includes('ms') ? 1 : 1000)
  }))
}

async function measureWheelScrollResponse(page, selector) {
  const container = page.locator(selector).first()
  const metrics = await container.evaluate((element) => {
    element.scrollTop = 0
    window.__popupScrollProbeWheelEvents = 0
    window.__popupScrollProbeFirstResponseAt = 0
    element.addEventListener('wheel', () => {
      window.__popupScrollProbeWheelEvents += 1
    }, { capture: true, once: true })
    element.addEventListener('scroll', () => {
      if (!window.__popupScrollProbeFirstResponseAt) {
        window.__popupScrollProbeFirstResponseAt = performance.now()
      }
    }, { capture: true, once: true })
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }
  })
  if (metrics.scrollHeight <= metrics.clientHeight) return null

  const box = await container.boundingBox()
  if (!box) throw new Error(`Scrollable container is not visible: ${selector}`)
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.bringToFront()
  await page.mouse.move(point.x, point.y)
  await container.evaluate(() => {
    window.__popupScrollProbeStartedAt = performance.now()
  })
  await page.mouse.wheel(0, 360)
  await page.waitForFunction((targetSelector) => {
    const element = document.querySelector(targetSelector)
    return element instanceof HTMLElement && element.scrollTop > 0
  }, selector, { timeout: 1_500 }).catch(() => undefined)
  const response = await container.evaluate((element) => ({
    durationMs: (
      window.__popupScrollProbeFirstResponseAt ||
      performance.now()
    ) - window.__popupScrollProbeStartedAt,
    clientHeight: element.clientHeight,
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    wheelEvents: window.__popupScrollProbeWheelEvents
  }))
  return response
}

async function inspectBottomWindow(page, containerSelector, rowSelector, expectedLastText) {
  const container = page.locator(containerSelector).first()
  await container.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForFunction(({ containerSelector: targetContainer, rowSelector: targetRow, expectedText }) => {
    const element = document.querySelector(targetContainer)
    if (!(element instanceof HTMLElement)) return false
    const rows = [...element.querySelectorAll(targetRow)]
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
    return maxScrollTop - element.scrollTop <= 1 &&
      (rows.at(-1)?.textContent || '').includes(expectedText)
  }, {
    containerSelector,
    expectedText: expectedLastText,
    rowSelector
  }, { timeout: 2_000 })
  return container.evaluate((element, targetRowSelector) => {
    const rows = [...element.querySelectorAll(targetRowSelector)]
    return {
      lastText: rows.at(-1)?.textContent || '',
      maxScrollTop: Math.max(0, element.scrollHeight - element.clientHeight),
      renderedRows: rows.length,
      scrollTop: element.scrollTop
    }
  }, rowSelector)
}

let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    reducedMotion: 'no-preference',
    viewport: { width: 800, height: 600 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })
  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  await seedBookmarks(worker)
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  await page.addInitScript(() => {
    const probe = {
      readyAt: 0,
      firstFrameDelayMs: 0,
      longAnimationFrames: [],
      maxFrameGapMs: 0,
      longTasks: [],
      autoAnalyzeStatusWasVisible: false
    }
    Object.defineProperty(window, '__popupColdOpenProbe', {
      configurable: false,
      enumerable: false,
      value: probe
    })

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          probe.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime
          })
        }
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch {
      // Long Task timing is unavailable in some Chromium extension contexts.
    }

    try {
      const longAnimationFrameObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          probe.longAnimationFrames.push({
            blockingDuration: entry.blockingDuration,
            duration: entry.duration,
            startTime: entry.startTime
          })
        }
      })
      longAnimationFrameObserver.observe({ type: 'long-animation-frame', buffered: true })
    } catch {
      // Long Animation Frame attribution is unavailable in older Chromium builds.
    }

    const readyObserver = new MutationObserver(() => {
      if (probe.readyAt > 0) return
      const readyShell = [...document.querySelectorAll('[data-state="ready"][aria-busy="false"]')]
        .find((element) => element.querySelector('.popup-main-row'))
      if (!readyShell) return

      probe.readyAt = performance.now()
      let previousFrameAt = probe.readyAt
      let frameCount = 0
      const sampleFrame = () => {
        const sampledAt = performance.now()
        const autoAnalyzeStatus = document.getElementById('auto-analyze-status')
        if (autoAnalyzeStatus instanceof HTMLElement && !autoAnalyzeStatus.hidden) {
          probe.autoAnalyzeStatusWasVisible = true
        }
        const frameGap = sampledAt - previousFrameAt
        if (frameCount === 0) probe.firstFrameDelayMs = frameGap
        probe.maxFrameGapMs = Math.max(probe.maxFrameGapMs, frameGap)
        previousFrameAt = sampledAt
        frameCount += 1
        if (sampledAt - probe.readyAt < 1_000) requestAnimationFrame(sampleFrame)
      }
      requestAnimationFrame(sampleFrame)
      readyObserver.disconnect()
    })
    readyObserver.observe(document, { childList: true, subtree: true, attributes: true })
  })
  await page.mouse.move(2, 2)
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => [...document.querySelectorAll('[data-state="ready"][aria-busy="false"]')]
    .some((element) => element.querySelector('.popup-main-row')))
  const readyObservationDelayMs = await page.evaluate(() => {
    const probe = window.__popupColdOpenProbe
    if (!probe?.readyAt) throw new Error('Popup cold-open readiness was not observed')
    return performance.now() - probe.readyAt
  })
  const initiallyMountedQuickActions = await page.locator(
    '.t-skel-content .popup-main-row:not([data-active="true"]) ' +
      '.popup-row-actions-menu button'
  ).count()
  const mainScrollResponse = await measureWheelScrollResponse(page, '.t-skel-content .popup-main-list')
  const folderScrollResponse = await measureWheelScrollResponse(page, '.t-skel-content .popup-folder-tree')
  const mainBottomWindow = await inspectBottomWindow(
    page,
    '.t-skel-content .popup-main-list',
    '.popup-main-row',
    'Popup motion item 48-12'
  )
  const folderBottomWindow = await inspectBottomWindow(
    page,
    '.t-skel-content .popup-folder-tree',
    '[role="treeitem"]',
    'Popup motion folder 48'
  )
  await page.waitForFunction(() => {
    const probe = window.__popupColdOpenProbe
    return probe?.readyAt > 0 && performance.now() - probe.readyAt >= 1_000
  })
  const coldOpenProbe = await page.evaluate(() => {
    const probe = window.__popupColdOpenProbe
    return {
      domRows: {
        bookmarks: document.querySelectorAll('.t-skel-content .popup-main-row').length,
        folders: document.querySelectorAll('.t-skel-content [role="treeitem"]').length
      },
      firstFrameDelayMs: probe.firstFrameDelayMs,
      maxFrameGapMs: probe.maxFrameGapMs,
      autoAnalyzeStatusWasVisible: probe.autoAnalyzeStatusWasVisible,
      longTasksAfterReady: probe.longTasks.filter((entry) => entry.startTime >= probe.readyAt),
      longAnimationFramesAfterReady: probe.longAnimationFrames.filter((entry) => entry.startTime >= probe.readyAt)
    }
  })
  await waitForFrames(page)

  const workspaceShell = page.locator('[data-state="ready"][aria-busy="false"]').filter({
    has: page.locator('.popup-main-row')
  }).first()
  const revealStyles = await workspaceShell.evaluate((shell) => {
    const skeleton = shell.children[0]
    const content = shell.children[1]
    if (!(skeleton instanceof HTMLElement) || !(content instanceof HTMLElement)) {
      throw new Error('Popup skeleton layers are unavailable')
    }
    const skeletonStyle = getComputedStyle(skeleton)
    const contentStyle = getComputedStyle(content)
    const skeletonSurface = skeleton.firstElementChild
    const skeletonBar = skeleton.querySelector('.popup-skeleton-pulse')
    if (!(skeletonSurface instanceof HTMLElement) || !(skeletonBar instanceof HTMLElement)) {
      throw new Error('Popup workspace skeleton surface or placeholder mark is unavailable')
    }
    return {
      contentFilter: contentStyle.filter,
      contentTransitionDuration: contentStyle.transitionDuration,
      contentTransitionProperty: contentStyle.transitionProperty,
      skeletonBarAnimationName: getComputedStyle(skeletonBar).animationName,
      skeletonFilter: skeletonStyle.filter,
      skeletonSurfaceAnimationName: getComputedStyle(skeletonSurface).animationName,
      skeletonTransitionDuration: skeletonStyle.transitionDuration,
      skeletonTransitionProperty: skeletonStyle.transitionProperty
    }
  })
  const liveReveal = await workspaceShell.evaluate((shell) => new Promise((resolve) => {
    const skeleton = shell.children[0]
    const content = shell.children[1]
    if (!(skeleton instanceof HTMLElement) || !(content instanceof HTMLElement)) {
      throw new Error('Popup skeleton layers are unavailable')
    }
    shell.classList.add('is-resetting')
    shell.classList.remove('is-revealed')
    void shell.getBoundingClientRect()
    shell.classList.remove('is-resetting')
    const samples = []
    requestAnimationFrame(() => {
      shell.classList.add('is-revealed')
      const startedAt = performance.now()
      const sample = (now) => {
        const skeletonStyle = getComputedStyle(skeleton)
        const contentStyle = getComputedStyle(content)
        const contentRect = content.getBoundingClientRect()
        samples.push({
          contentFilter: contentStyle.filter,
          contentHeight: contentRect.height,
          contentLeft: contentRect.left,
          contentOpacity: Number.parseFloat(contentStyle.opacity),
          contentTop: contentRect.top,
          contentTransform: contentStyle.transform,
          contentWidth: contentRect.width,
          skeletonFilter: skeletonStyle.filter,
          skeletonOpacity: Number.parseFloat(skeletonStyle.opacity),
          skeletonTransform: skeletonStyle.transform
        })
        if (now - startedAt < 300) {
          requestAnimationFrame(sample)
          return
        }
        resolve({
          final: samples.at(-1),
          geometryDrift: {
            height: Math.max(...samples.map((entry) => entry.contentHeight)) -
              Math.min(...samples.map((entry) => entry.contentHeight)),
            left: Math.max(...samples.map((entry) => entry.contentLeft)) -
              Math.min(...samples.map((entry) => entry.contentLeft)),
            top: Math.max(...samples.map((entry) => entry.contentTop)) -
              Math.min(...samples.map((entry) => entry.contentTop)),
            width: Math.max(...samples.map((entry) => entry.contentWidth)) -
              Math.min(...samples.map((entry) => entry.contentWidth))
          },
          sawAnyBlur: samples.some((entry) =>
            (entry.contentFilter !== 'none' && entry.contentFilter !== 'blur(0px)') ||
            (entry.skeletonFilter !== 'none' && entry.skeletonFilter !== 'blur(0px)')
          ),
          sawCrossFade: samples.some((entry) =>
            entry.contentOpacity > 0.02 && entry.contentOpacity < 0.98 &&
            entry.skeletonOpacity > 0.02 && entry.skeletonOpacity < 0.98
          ),
          sawTranslateReveal: samples.some((entry) => {
            if (entry.contentTransform === 'none') return false
            const matrix = new DOMMatrixReadOnly(entry.contentTransform)
            return matrix.m42 > 0.05
          })
        })
      }
      requestAnimationFrame(sample)
    })
  }))

  await page.locator('.t-skel-content .popup-main-list').evaluate((element) => {
    element.scrollTop = 0
  })
  await waitForFrames(page)
  const targetRow = page.locator('.t-skel-content .popup-main-row:not([data-active="true"])').filter({
    has: page.locator('.popup-row-actions')
  }).nth(1)
  const hoverPoint = await targetRow.evaluate((row) => {
    const rect = row.getBoundingClientRect()
    return { x: rect.left + rect.width * 0.56, y: rect.top + rect.height / 2 }
  })
  const beforeHover = await targetRow.evaluate((row) => {
    const actions = row.querySelector('.popup-row-actions')
    const copy = row.querySelector('.popup-row-copy')
    if (!(actions instanceof HTMLElement)) throw new Error('Popup row actions are unavailable')
    if (!(copy instanceof HTMLElement)) throw new Error('Popup row copy is unavailable')
    const actionsRect = actions.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const copyStyle = getComputedStyle(copy)
    return {
      actionsWidth: actionsRect.width,
      copyMaskImage: copyStyle.maskImage || copyStyle.webkitMaskImage || 'none',
      rowWidth: rowRect.width
    }
  })
  await page.mouse.move(hoverPoint.x, hoverPoint.y)
  await waitForFrames(page)
  const hoveredQuickActions = await targetRow.locator('.popup-row-actions-menu button').count()
  const afterHover = await targetRow.evaluate((row) => {
    const actions = row.querySelector('.popup-row-actions')
    const copy = row.querySelector('.popup-row-copy')
    if (!(actions instanceof HTMLElement)) throw new Error('Popup row actions are unavailable')
    if (!(copy instanceof HTMLElement)) throw new Error('Popup row copy is unavailable')
    const actionsRect = actions.getBoundingClientRect()
    const rowRect = row.getBoundingClientRect()
    const copyStyle = getComputedStyle(copy)
    return {
      actionsWidth: actionsRect.width,
      copyMaskImage: copyStyle.maskImage || copyStyle.webkitMaskImage || 'none',
      rowWidth: rowRect.width
    }
  })

  const result = {
    coldOpenProbe: {
      ...coldOpenProbe,
      folderBottomWindow,
      folderScrollResponse,
      mainBottomWindow,
      mainScrollResponse,
      readyObservationDelayMs
    },
    revealStyles,
    liveReveal,
    beforeHover,
    hoveredQuickActions,
    initiallyMountedQuickActions,
    afterHover,
    contentTransitionMs: maxTransitionMs(revealStyles.contentTransitionDuration),
    skeletonTransitionMs: maxTransitionMs(revealStyles.skeletonTransitionDuration)
  }
  if (capturePath) {
    await mkdir(path.dirname(capturePath), { recursive: true })
    await page.screenshot({ path: capturePath })
  }
  console.log(`Popup loading and lower-hover probe: ${JSON.stringify(result)}`)

  assert.equal(
    coldOpenProbe.autoAnalyzeStatusWasVisible,
    false,
    'Popup motion fixture must not leak unrelated auto-capture status into layout measurements'
  )
  assert.ok(
    coldOpenProbe.domRows.bookmarks <= 40,
    `Cold open must window bookmark DOM rows instead of mounting the full catalog: ${coldOpenProbe.domRows.bookmarks}`
  )
  assert.ok(
    coldOpenProbe.domRows.folders <= 40,
    `Cold open must window folder DOM rows instead of mounting the full tree: ${coldOpenProbe.domRows.folders}`
  )
  assert.ok(
    mainScrollResponse && mainScrollResponse.scrollTop > 0 && mainScrollResponse.durationMs <= 160,
    `Bookmark list must scroll immediately after ready: ${JSON.stringify(mainScrollResponse)}`
  )
  assert.ok(
    folderScrollResponse && folderScrollResponse.scrollTop > 0 && folderScrollResponse.durationMs <= 160,
    `Folder tree must scroll immediately after ready: ${JSON.stringify(folderScrollResponse)}`
  )
  assert.ok(
    mainScrollResponse.scrollHeight >= seededFolderCount * seededItemsPerFolder * 75,
    `Bookmark virtualization must preserve the full scroll range: ${mainScrollResponse.scrollHeight}`
  )
  assert.ok(
    folderScrollResponse.scrollHeight >= seededFolderCount * 30,
    `Folder virtualization must preserve the full scroll range: ${folderScrollResponse.scrollHeight}`
  )
  assert.ok(
    mainBottomWindow.maxScrollTop - mainBottomWindow.scrollTop <= 1 &&
      mainBottomWindow.lastText.includes('Popup motion item 48-12'),
    `Bookmark virtualization must render the final row at the bottom: ${JSON.stringify(mainBottomWindow)}`
  )
  assert.ok(
    folderBottomWindow.maxScrollTop - folderBottomWindow.scrollTop <= 1 &&
      folderBottomWindow.lastText.includes('Popup motion folder 48'),
    `Folder virtualization must render the final row at the bottom: ${JSON.stringify(folderBottomWindow)}`
  )
  assert.ok(
    initiallyMountedQuickActions <= 5,
    `Cold open may mount at most one pointer-intersected quick-action rail: ${initiallyMountedQuickActions}`
  )
  assert.ok(hoveredQuickActions >= 5, 'Hovering a row must mount its complete quick-action rail on demand')
  assert.ok(
    coldOpenProbe.firstFrameDelayMs <= 160,
    `Popup must paint an interactive frame immediately after becoming ready: ${coldOpenProbe.firstFrameDelayMs.toFixed(1)}ms`
  )
  assert.ok(
    coldOpenProbe.maxFrameGapMs <= schedulerFrameGapLimitMs,
    `Popup must not show a prolonged scheduler stall after ready: ${coldOpenProbe.maxFrameGapMs.toFixed(1)}ms`
  )
  assert.equal(
    coldOpenProbe.longTasksAfterReady.filter((entry) => entry.duration > 160).length,
    0,
    `Popup must not run >160ms tasks after loaded content appears: ${JSON.stringify(coldOpenProbe.longTasksAfterReady)}`
  )
  assert.equal(
    coldOpenProbe.longAnimationFramesAfterReady.filter((entry) => entry.blockingDuration > 160).length,
    0,
    `Popup must not produce a blocking post-ready animation frame: ${JSON.stringify(coldOpenProbe.longAnimationFramesAfterReady)}`
  )
  assert.doesNotMatch(revealStyles.skeletonTransitionProperty, /(?:^|,\s*)filter(?:,|$)/, 'Large skeleton layers must not animate filter')
  assert.doesNotMatch(revealStyles.contentTransitionProperty, /(?:^|,\s*)transform(?:,|$)/, 'Dense popup workspace must not translate during reveal')
  assert.doesNotMatch(revealStyles.contentTransitionProperty, /(?:^|,\s*)filter(?:,|$)/, 'Loaded text must never animate blur')
  assert.equal(revealStyles.skeletonSurfaceAnimationName, 'none', 'Workspace pane surfaces must remain visually stable while loading')
  assert.match(revealStyles.skeletonBarAnimationName, /t-skel-pulse/, 'Placeholder marks must retain restrained loading feedback')
  assert.equal(revealStyles.contentFilter, 'none', 'Loaded text must remain crisp before and after reveal')
  assert.equal(revealStyles.skeletonFilter, 'none', 'Large skeleton surfaces must avoid blur rasterization')
  assert.ok(result.contentTransitionMs >= 150 && result.contentTransitionMs <= 200, 'Popup reveal must be perceptible without lingering')
  assert.equal(liveReveal.sawCrossFade, true, 'The popup skeleton and content must visibly cross-fade')
  assert.equal(liveReveal.sawTranslateReveal, false, 'Dense popup content must not move while replacing its skeleton')
  assert.ok(
    Object.values(liveReveal.geometryDrift).every((drift) => drift <= 0.5),
    `Popup workspace geometry must remain stable throughout reveal: ${JSON.stringify(liveReveal.geometryDrift)}`
  )
  assert.equal(liveReveal.sawAnyBlur, false, 'No reveal frame may leave the loaded text blurred')
  assert.ok(liveReveal.final.contentOpacity >= 0.99 && liveReveal.final.skeletonOpacity <= 0.01, 'The popup reveal must settle on crisp content')
  assert.ok(
    Math.abs(afterHover.actionsWidth - beforeHover.actionsWidth) <= 0.5,
    `Lower-row hover must not resize its overlay hit box: ${JSON.stringify({ before: beforeHover.actionsWidth, after: afterHover.actionsWidth })}`
  )
  assert.ok(
    Math.abs(afterHover.rowWidth - beforeHover.rowWidth) <= 0.5,
    'Lower-row hover must not change bookmark row geometry'
  )
  assert.equal(beforeHover.copyMaskImage, 'none', 'Collapsed rows must keep their bookmark copy fully visible')
  assert.match(afterHover.copyMaskImage, /linear-gradient/i, 'Expanded row actions must mask long copy before it reaches the quick actions')

  const firstBookmarkButton = page.locator('.t-skel-content .popup-list-button').first()
  await firstBookmarkButton.focus()
  await waitForFrames(page, 8)
  const keyboardSelectionProbe = page.evaluate(() => new Promise((resolve) => {
    const indicator = document.querySelector('.popup-active-result-indicator[data-visible="true"]')
    if (!(indicator instanceof HTMLElement)) {
      resolve(null)
      return
    }

    const startedAt = performance.now()
    const startTop = indicator.getBoundingClientRect().top
    const samples = []
    const style = getComputedStyle(indicator)
    const sample = (now) => {
      samples.push(indicator.getBoundingClientRect().top)
      if (now - startedAt < 160) {
        requestAnimationFrame(sample)
        return
      }

      const endTop = samples.at(-1) ?? startTop
      resolve({
        endTop,
        samples,
        startTop,
        transitionDuration: style.transitionDuration,
        transitionProperty: style.transitionProperty
      })
    }
    requestAnimationFrame(sample)
  }))
  await page.keyboard.press('ArrowDown')
  const keyboardSelection = await keyboardSelectionProbe
  assert.ok(keyboardSelection, 'Keyboard selection indicator should be visible before navigation')
  const keyboardTravel = Math.abs(keyboardSelection.endTop - keyboardSelection.startTop)
  const sawIntermediateKeyboardFrame = keyboardSelection.samples.some((top) => (
    Math.abs(top - keyboardSelection.startTop) > 0.5 &&
    Math.abs(top - keyboardSelection.endTop) > 0.5
  ))
  assert.ok(
    keyboardSelection.transitionProperty.split(',').map((value) => value.trim()).includes('transform') &&
      keyboardSelection.transitionDuration.split(',').map((value) => value.trim()).includes('0.1s'),
    `Keyboard selection should reuse the 100ms transform transition: ${JSON.stringify(keyboardSelection)}`
  )
  assert.ok(
    keyboardTravel > 20 && sawIntermediateKeyboardFrame,
    `Keyboard selection should visibly translate through intermediate positions: ${JSON.stringify(keyboardSelection)}`
  )
  await page.keyboard.press('ArrowUp')
  await waitForFrames(page, 8)
  await page.keyboard.press('ArrowLeft')
  await waitForFrames(page)
  for (let index = 0; index < 2; index += 1) {
    await page.keyboard.press('ArrowDown')
    await waitForFrames(page)
  }
  const highlightedFolderTitle = await page.locator(
    '.t-skel-content [role="treeitem"][aria-selected="true"]'
  ).getAttribute('title')
  assert.ok(highlightedFolderTitle, 'Folder keyboard navigation must highlight a non-root folder before Enter')
  await page.keyboard.press('Enter')
  await page.waitForFunction((folderTitle) => {
    return [...document.querySelectorAll('.t-skel-content [role="treeitem"][aria-current="page"]')]
      .some((row) => row.getAttribute('title') === folderTitle)
  }, highlightedFolderTitle)

  const filteredFirstBookmark = page.locator('.t-skel-content .popup-list-button').first()
  const filteredBookmarkCount = await page.locator('.t-skel-content .popup-main-row').count()
  assert.ok(
    filteredBookmarkCount > 8 && filteredBookmarkCount <= 24,
    `Held-key regression must run in a non-virtualized folder, got ${filteredBookmarkCount} rows`
  )
  await filteredFirstBookmark.focus()
  const repeatCount = Math.min(10, filteredBookmarkCount - 1)
  const expectedHeldTitle = await page.locator(
    '.t-skel-content .popup-main-row'
  ).nth(repeatCount).locator('.popup-row-copy > span').first().textContent()
  assert.ok(expectedHeldTitle, 'Held-key regression requires an expected destination bookmark')
  await page.evaluate((targetRepeatCount) => {
    const target = document.activeElement
    if (!(target instanceof HTMLElement)) throw new Error('Focused bookmark row is unavailable')
    for (let index = 0; index < targetRepeatCount; index += 1) {
      target.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'ArrowDown',
        key: 'ArrowDown',
        repeat: index > 0
      }))
    }
  }, repeatCount)
  await page.waitForFunction((bookmarkTitle) => {
    return document.querySelector(
      '.t-skel-content .popup-main-row[data-active="true"] .popup-row-copy > span'
    )?.textContent === bookmarkTitle
  }, expectedHeldTitle)
  await waitForFrames(page, 1)
  const heldRepeatIndicatorBounds = await readIndicatorBounds(
    page,
    '.t-skel-content .popup-main-list'
  )
  assert.ok(
    heldRepeatIndicatorBounds.topGap >= 6.25 && heldRepeatIndicatorBounds.bottomGap >= 6.25,
    `Held ArrowDown must keep the highlight inside the filtered-folder viewport: ${JSON.stringify(heldRepeatIndicatorBounds)}`
  )
  if (capturePath) {
    await page.screenshot({
      path: path.join(path.dirname(capturePath), 'popup-held-key-repeat.png')
    })
  }
  await page.evaluate(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      code: 'ArrowDown',
      key: 'ArrowDown'
    }))
  })
  const bookmarkIndicatorBounds = await waitForIndicatorSafeArea(
    page,
    '.t-skel-content .popup-main-list'
  )

  await page.keyboard.press('ArrowLeft')
  await waitForFrames(page)
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('ArrowDown')
    await waitForFrames(page, 1)
  }
  const folderIndicatorBounds = await waitForIndicatorSafeArea(
    page,
    '.t-skel-content .popup-folder-tree'
  )
  if (capturePath) {
    await page.screenshot({
      path: path.join(path.dirname(capturePath), 'popup-keyboard-edge.png')
    })
  }
  console.log(`Popup keyboard edge probe: ${JSON.stringify({
    bookmarkIndicatorBounds,
    filteredBookmarkCount,
    folderIndicatorBounds,
    heldRepeatIndicatorBounds,
    highlightedFolderTitle
  })}`)

  console.log('Popup loading hover motion regression test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
