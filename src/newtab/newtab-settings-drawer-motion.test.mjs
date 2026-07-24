import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-interface-quality-'))
const visualCaptureDir = process.env.CURATOR_VISUAL_CAPTURE_DIR
  ? path.resolve(process.env.CURATOR_VISUAL_CAPTURE_DIR)
  : ''
const performanceRecords = []
const bookmarkDropContinuityOnly = process.argv.includes('--bookmark-drop-continuity-only')
const optionsAvailabilityOnly = process.argv.includes('--options-availability-only')
const optionsBordersOnly = process.argv.includes('--options-borders-only')
const optionsRefreshOnly = process.argv.includes('--options-refresh-only')
const optionsScopePickerOnly = process.argv.includes('--options-scope-picker-only')
const optionsReasoningOnly = process.argv.includes('--options-reasoning-only')
const overlayMotionOnly = process.argv.includes('--overlay-motion-only')
const popupReorderOnly = process.argv.includes('--popup-reorder-only')
const collapsibleMotionOnly = process.argv.includes('--collapsible-motion-only')

async function captureVisual(page, name, options = {}) {
  if (!visualCaptureDir) {
    return
  }
  await mkdir(visualCaptureDir, { recursive: true })
  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    path: path.join(visualCaptureDir, `${name}.png`),
    ...options
  })
}

async function captureNewtabWallpaperVariants(page) {
  if (!visualCaptureDir) {
    return
  }
  await captureVisual(page, 'newtab-dark')
  for (const [name, background] of [
    ['newtab-bright', 'linear-gradient(135deg,#f8f3d6 0%,#d6ecff 48%,#f3cfdb 100%)'],
    ['newtab-detailed', 'repeating-linear-gradient(32deg,rgba(255,255,255,.18) 0 2px,transparent 2px 14px),radial-gradient(circle at 18% 22%,#f6c76f 0 12%,transparent 34%),radial-gradient(circle at 78% 28%,#60a5d8 0 14%,transparent 38%),linear-gradient(145deg,#26405d,#6e3755 55%,#152c2f)']
  ]) {
    await page.evaluate((value) => {
      const app = document.querySelector('.newtab-app')
      document.querySelector('#interface-quality-wallpaper-probe')?.remove()
      const probe = document.createElement('div')
      probe.id = 'interface-quality-wallpaper-probe'
      Object.assign(probe.style, {
        background: value,
        inset: '0',
        pointerEvents: 'none',
        position: 'fixed',
        zIndex: '0'
      })
      app?.append(probe)
      app?.setAttribute('data-background-media', 'true')
    }, background)
    await waitForFrames(page)
    await captureVisual(page, name)
  }
  await page.evaluate(() => {
    document.querySelector('#interface-quality-wallpaper-probe')?.remove()
    document.querySelector('.newtab-app')?.removeAttribute('data-background-media')
  })
}

async function verifyNewtabAccessibilityMaterials(page, context) {
  const client = await context.newCDPSession(page)
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
  })
  await page.waitForFunction(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)
  const reducedTransparency = await page.locator('.newtab-speed-dial').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      webkitBackdropFilter: style.webkitBackdropFilter
    }
  })
  assert.ok(
    reducedTransparency.backdropFilter === 'blur(8px)' ||
      reducedTransparency.webkitBackdropFilter === 'blur(8px)',
    `The user-selected New Tab glass should retain its 8px blur when the OS reduces transparency: ${JSON.stringify(reducedTransparency)}`
  )
  assert.equal(
    reducedTransparency.backgroundColor,
    'rgba(0, 0, 0, 0.6)',
    'The user-selected New Tab glass should retain its 60% black fill when the OS reduces transparency'
  )

  await page.locator('.newtab-search').waitFor({ state: 'visible' })
  await page.locator('.newtab-clock').waitFor({ state: 'visible' })
  const utilityGlass = await page.locator('.newtab-search, .newtab-clock').evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element)
    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      className: element.className,
      webkitBackdropFilter: style.webkitBackdropFilter
    }
  }))
  assert.equal(utilityGlass.length, 2, `Search and clock glass surfaces should both be present: ${JSON.stringify(utilityGlass)}`)
  for (const material of utilityGlass) {
    assert.ok(
      material.backdropFilter === 'blur(8px)' || material.webkitBackdropFilter === 'blur(8px)',
      `Primary utility glass should retain blur when the user selected the unified material: ${JSON.stringify(material)}`
    )
    assert.match(material.backgroundColor, /^rgba\(0, 0, 0, 0\.[0-9]+\)$/, `Primary utility glass should remain translucent: ${JSON.stringify(material)}`)
  }
  await captureVisual(page, 'newtab-reduced-transparency')

  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value: 'more' }]
  })
  await page.waitForFunction(() => matchMedia('(prefers-contrast: more)').matches)
  const increasedContrast = await page.locator('.source-navigation-label').evaluate((element) => {
    const style = getComputedStyle(element)
    return { borderColor: style.borderColor, color: style.color }
  })
  assert.equal(increasedContrast.borderColor, 'rgba(255, 255, 255, 0.72)', 'Increased contrast should strengthen wallpaper dividers')
  assert.equal(increasedContrast.color, 'rgba(245, 245, 247, 0.88)', 'Increased contrast should preserve readable primary navigation text')
  await captureVisual(page, 'newtab-high-contrast')

  await client.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-transparency', value: 'no-preference' },
      { name: 'prefers-contrast', value: 'no-preference' }
    ]
  })
  await page.waitForFunction(() => !matchMedia('(prefers-reduced-transparency: reduce)').matches && !matchMedia('(prefers-contrast: more)').matches)
  await client.detach()
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

async function recordAnimationFrames(page, label, durationMs, action) {
  const frameProbe = page.evaluate((duration) => new Promise((resolve) => {
    const startedAt = performance.now()
    let previous = startedAt
    const gaps = []
    const sample = (now) => {
      gaps.push(now - previous)
      previous = now
      if (now - startedAt < duration) {
        requestAnimationFrame(sample)
        return
      }
      const sorted = gaps.slice().sort((left, right) => left - right)
      resolve({
        duration: now - startedAt,
        frames: gaps.length,
        maxGap: Math.max(...gaps),
        p95Gap: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
      })
    }
    requestAnimationFrame(sample)
  }), durationMs)
  const actionResult = await action()
  const frames = await frameProbe
  performanceRecords.push({ label, ...frames })
  assert.ok(
    frames.frames >= 1 && Number.isFinite(frames.maxGap) && Number.isFinite(frames.p95Gap),
    `${label} should produce a valid frame recording: ${JSON.stringify(frames)}`
  )
  return { actionResult, frames }
}

async function seedExtension(worker) {
  return worker.evaluate(async () => {
    const tree = await chrome.bookmarks.getTree()
    const root = tree[0]
    const bookmarksBar = root.children?.find((node) => node.id === '1') || root.children?.[0]
    if (!bookmarksBar?.id) {
      throw new Error('Bookmarks bar is unavailable')
    }

    const stamp = Date.now()
    const folders = []
    const bookmarks = []
    for (let folderIndex = 0; folderIndex < 3; folderIndex += 1) {
      const folder = await chrome.bookmarks.create({
        parentId: bookmarksBar.id,
        title: `Curator Smoke Folder ${folderIndex + 1} ${stamp}`
      })
      folders.push(folder)
      for (let bookmarkIndex = 0; bookmarkIndex < 12; bookmarkIndex += 1) {
        const label = bookmarkIndex === 0
          ? ['Alpha', 'Beta', 'Gamma'][folderIndex]
          : `Item ${folderIndex + 1}-${bookmarkIndex + 1}`
        bookmarks.push(await chrome.bookmarks.create({
          parentId: folder.id,
          title: `Curator Smoke ${label}`,
          url: `https://example.com/curator-smoke/${folderIndex + 1}/${bookmarkIndex + 1}`
        }))
      }
    }

    const now = Date.now()
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: {
        apiKey: 'curator-smoke-key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5',
        reasoningEffort: 'medium'
      },
      curatorBookmarkNewTabFolderSettings: {
        selectedFolderIds: folders.map((folder) => folder.id),
        hideFolderNames: false
      },
      curatorBookmarkNewTabWorkspaceSettings: {
        activeWorkspaceId: 'default',
        workspaces: [{
          id: 'default',
          name: 'Speed Dial',
          pinnedIds: bookmarks.slice(0, 4).map((bookmark) => bookmark.id),
          createdAt: now,
          updatedAt: now
        }]
      }
    })

    return {
      bookmarkIds: bookmarks.map((bookmark) => bookmark.id),
      folderIds: folders.map((folder) => folder.id),
      folderTitles: folders.map((folder) => folder.title)
    }
  })
}

async function waitForDrawerClosed(page) {
  await page.waitForFunction(() => document.querySelector('.settings-drawer-panel')?.hasAttribute('hidden'))
}

async function openDrawer(page) {
  await page.locator('#newtab-settings-trigger').evaluate((element) => element.click())
  await page.waitForFunction(() => !document.querySelector('.settings-drawer-panel')?.hasAttribute('hidden'))
}

async function waitForDrawerSettledOpen(page) {
  await page.waitForFunction(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    if (!panel || panel.hasAttribute('hidden')) return false
    const rect = panel.getBoundingClientRect()
    return Math.abs(rect.right - innerWidth) <= 2 && Number.parseFloat(getComputedStyle(panel).opacity) >= 0.99
  })
}

async function closeDrawer(page, method = 'escape', expectFocusReturn = true) {
  if (method === 'button') {
    await page.locator('#newtab-settings-close').click()
  } else {
    await page.keyboard.press('Escape')
  }
  await waitForDrawerClosed(page)
  if (expectFocusReturn) {
    await page.waitForFunction(() => document.activeElement?.id === 'newtab-settings-trigger')
  }
}

async function verifyDrawerCloseDuringEntrance(page) {
  await waitForDrawerClosed(page)
  await openDrawer(page)
  await page.waitForTimeout(45)

  const beforeClose = await page.locator('.settings-drawer-panel').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left,
      openLeft: innerWidth - rect.width,
      viewportWidth: innerWidth
    }
  })
  assert.ok(
    beforeClose.left > beforeClose.openLeft + 8 && beforeClose.left < beforeClose.viewportWidth - 2,
    `Close-during-entrance probe must catch an intermediate frame: ${JSON.stringify(beforeClose)}`
  )

  await page.evaluate(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    const probe = {
      done: false,
      endingLeft: null,
      frames: [],
      hidden: false,
      sawEndingStyle: false
    }
    window.__curatorDrawerEntranceCloseProbe = probe
    const startedAt = performance.now()
    const observer = new MutationObserver(() => {
      if (panel?.hasAttribute('data-ending-style')) {
        probe.sawEndingStyle = true
        probe.endingLeft ??= panel.getBoundingClientRect().left
      }
    })
    observer.observe(panel, { attributes: true, attributeFilter: ['data-ending-style', 'hidden'] })
    const sample = (now) => {
      if (probe.sawEndingStyle && panel && !panel.hasAttribute('hidden')) {
        probe.frames.push(panel.getBoundingClientRect().left)
      }
      if (panel?.hasAttribute('hidden') || now - startedAt > 720) {
        probe.hidden = panel?.hasAttribute('hidden') || false
        probe.done = true
        observer.disconnect()
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__curatorDrawerEntranceCloseProbe?.done)
  const result = await page.evaluate(() => {
    const probe = window.__curatorDrawerEntranceCloseProbe
    delete window.__curatorDrawerEntranceCloseProbe
    return probe
  })
  assert.ok(result.sawEndingStyle, 'Closing during entrance should enter the Base UI ending state')
  assert.ok(result.hidden, 'Closing during entrance should finish hidden')
  assert.ok(result.frames.length >= 2, 'Closing during entrance should preserve visible exit frames')
  assert.ok(
    result.endingLeft > beforeClose.openLeft + 8 &&
      result.endingLeft < beforeClose.viewportWidth - 8 &&
      result.endingLeft <= beforeClose.left + 12,
    `Interrupted entrance should reverse from its current visual position: ${JSON.stringify({ beforeClose, result })}`
  )
  assert.ok(
    result.frames.some((left) => left > result.endingLeft + 8),
    'Closing during entrance should continue moving toward the right edge'
  )
  await page.waitForFunction(() => document.activeElement?.id === 'newtab-settings-trigger')
}

async function probeDrawerOpening(page) {
  const panel = page.locator('.settings-drawer-panel')
  await panel.waitFor({ state: 'attached' })
  await waitForDrawerClosed(page)

  const probePromise = page.evaluate(() => {
    const target = document.querySelector('.settings-drawer-panel')
    if (!(target instanceof HTMLElement)) {
      throw new Error('Settings drawer panel is missing')
    }

    return new Promise((resolve) => {
      const frames = []
      const transitionProperties = []
      let sawStartingStyle = false
      const startedAt = performance.now()
      const handleTransitionRun = (event) => transitionProperties.push(event.propertyName)
      target.addEventListener('transitionrun', handleTransitionRun)

      const sample = (now) => {
        sawStartingStyle ||= target.hasAttribute('data-starting-style')
        if (!target.hasAttribute('hidden')) {
          const rect = target.getBoundingClientRect()
          frames.push({ left: rect.left, width: rect.width })
        }
        if (now - startedAt < 520) {
          requestAnimationFrame(sample)
          return
        }
        target.removeEventListener('transitionrun', handleTransitionRun)
        resolve({ frames, sawStartingStyle, transitionProperties })
      }
      requestAnimationFrame(sample)
    })
  })

  await page.locator('#newtab-settings-trigger').evaluate((element) => element.click())
  const probe = await probePromise
  const finalFrame = probe.frames.at(-1)
  await page.waitForTimeout(420)
  const settledFrame = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      left: rect.left,
      transform: style.transform,
      swipe: style.getPropertyValue('--drawer-swipe-movement-x'),
      width: rect.width
    }
  })
  const viewport = page.viewportSize()
  const backdropBackground = await page.locator('#newtab-settings-backdrop').evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )

  assert.ok(probe.sawStartingStyle, 'Base UI should expose the drawer opening frame')
  assert.equal(backdropBackground, 'rgba(0, 0, 0, 0)', 'The drawer backdrop must stay visually transparent')
  assert.ok(
    probe.transitionProperties.some((property) => property === 'transform' || property === 'translate'),
    'Opening from hidden should start a horizontal transition'
  )
  assert.ok(finalFrame && finalFrame.width > 0, 'The open drawer should have measurable geometry')
  assert.ok(
    probe.frames.some((frame) => frame.left > finalFrame.left + 8),
    'Opening should include an intermediate horizontal frame'
  )
  assert.ok(
    viewport && Math.abs(settledFrame.left + settledFrame.width - viewport.width) <= 2,
    `The drawer should finish flush with the right edge (left=${settledFrame.left}, width=${settledFrame.width}, viewport=${viewport?.width}, transform=${settledFrame.transform}, swipe=${settledFrame.swipe})`
  )
}

async function verifySettingsTabSwitching(page) {
  await page.getByRole('tab', { name: '来源' }).click()
  await waitForFrames(page)

  const candidatePanel = page.locator('#folder-candidates-panel')
  assert.equal(
    await candidatePanel.count(),
    0,
    'Collapsed folder candidates must stay out of the DOM so hidden folders cannot block tab layout'
  )

  const candidateToggle = page.locator('#folder-candidates-toggle')
  await candidateToggle.click()
  await candidatePanel.waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.activeElement?.id === 'folder-candidate-search')
  const candidateRendering = await page.locator('#folder-candidate-list').evaluate((list) => {
    const card = list.querySelector('.folder-candidate-card')
    return {
      contentVisibility: card ? getComputedStyle(card).contentVisibility : '',
      squircleSubtree: list.getAttribute('data-squircle-subtree')
    }
  })
  assert.equal(candidateRendering.squircleSubtree, 'off', 'Large candidate lists must not register a squircle ResizeObserver per row')
  assert.equal(candidateRendering.contentVisibility, 'auto', 'Offscreen candidate cards should skip layout and paint work')
  const candidateSearch = page.locator('#folder-candidate-search')
  await candidateSearch.fill('Smoke')
  await candidateToggle.click()
  await candidatePanel.waitFor({ state: 'detached' })
  await candidateToggle.click()
  await candidatePanel.waitFor({ state: 'visible' })
  assert.equal(
    await candidateSearch.inputValue(),
    'Smoke',
    'Unmounting hidden candidates must preserve the controlled search query'
  )
  await candidateSearch.fill('')
  await candidateToggle.click()
  await candidatePanel.waitFor({ state: 'detached' })

  await page.getByRole('tab', { name: '外观' }).click()
  await waitForFrames(page)
  const immediateScrollReset = await page.evaluate(async () => {
    const host = document.querySelector('.settings-drawer-scroll')
    const searchTab = document.querySelector('#settings-tab-search')
    if (!(host instanceof HTMLElement) || !(searchTab instanceof HTMLElement)) {
      throw new Error('Settings scroll host or search tab is unavailable')
    }
    host.scrollTop = host.scrollHeight
    const before = host.scrollTop
    searchTab.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return { after: host.scrollTop, before }
  })
  assert.ok(immediateScrollReset.before > 100, 'The appearance page should provide a meaningful scroll-reset test')
  assert.equal(
    immediateScrollReset.after,
    0,
    'Switching settings tabs must reset scroll before the next painted frame instead of animating the whole drawer'
  )

  const rapidSwitch = await page.evaluate(async () => {
    const order = ['appearance', 'search', 'advanced', 'source']
    const samples = []
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    const readSample = () => {
      const panels = [...document.querySelectorAll('.settings-tab-panels > .t-tabs-panel')]
      const rendered = panels.filter((panel) => {
        const style = getComputedStyle(panel)
        return !panel.hidden && style.display !== 'none' && Number.parseFloat(style.opacity) > 0
      })
      samples.push({
        animatedPanels: panels.filter((panel) => panel.getAnimations().length > 0).length,
        endingPanels: panels.filter((panel) => panel.hasAttribute('data-ending-style')).length,
        renderedPanels: rendered.length
      })
    }

    for (let cycle = 0; cycle < 4; cycle += 1) {
      for (const group of order) {
        document.querySelector(`#settings-tab-${group}`)?.click()
        await nextFrame()
        readSample()
      }
    }
    await nextFrame()
    await nextFrame()
    readSample()

    const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]')
    const activePanel = [...document.querySelectorAll('.settings-tab-panels > .t-tabs-panel')]
      .find((panel) => !panel.hidden && getComputedStyle(panel).display !== 'none')
    return {
      activePanelId: activePanel?.id || '',
      maxAnimatedPanels: Math.max(...samples.map((sample) => sample.animatedPanels)),
      maxEndingPanels: Math.max(...samples.map((sample) => sample.endingPanels)),
      maxRenderedPanels: Math.max(...samples.map((sample) => sample.renderedPanels)),
      selectedTabId: selectedTab?.id || ''
    }
  })
  assert.equal(rapidSwitch.maxRenderedPanels, 1, `Rapid switching must paint only one full settings page: ${JSON.stringify(rapidSwitch)}`)
  assert.equal(rapidSwitch.maxAnimatedPanels, 0, `Full settings pages must not create transition layers: ${JSON.stringify(rapidSwitch)}`)
  assert.ok(rapidSwitch.maxEndingPanels <= 1, `Rapid switching must not accumulate outgoing pages: ${JSON.stringify(rapidSwitch)}`)
  assert.equal(rapidSwitch.selectedTabId, 'settings-tab-source', 'Rapid switching should settle on the final selected tab')
  assert.equal(rapidSwitch.activePanelId, 'settings-panel-source', 'Rapid switching should settle on the matching panel')
}

async function verifyDesktopDrawer(page) {
  await page.setViewportSize({ width: 1280, height: 720 })
  await waitForDrawerClosed(page)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await probeDrawerOpening(page)
    await closeDrawer(page, attempt % 2 === 0 ? 'escape' : 'button')
  }

  await verifyDrawerCloseDuringEntrance(page)

  await openDrawer(page)
  const desktopState = await page.evaluate(() => ({
    backdropPointerEvents: getComputedStyle(document.querySelector('#newtab-settings-backdrop')).pointerEvents,
    rootInert: document.querySelector('#newtab-root').inert
  }))
  assert.equal(desktopState.backdropPointerEvents, 'none', 'Desktop drawer must not install a pointer-catching backdrop')
  assert.equal(desktopState.rootInert, false, 'Desktop content must remain interactive while settings are open')
  await waitForDrawerSettledOpen(page)
  const drawerGlass = await page.locator('.settings-drawer-panel').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backdropFilter: style.backdropFilter,
      expectedBackdropFilter: style.getPropertyValue('--newtab-glass-backdrop-filter').trim(),
      filter: style.filter,
      boxShadow: style.boxShadow,
      webkitBackdropFilter: style.webkitBackdropFilter
    }
  })
  assert.ok(
    drawerGlass.expectedBackdropFilter &&
      drawerGlass.expectedBackdropFilter !== 'none' &&
      (
        drawerGlass.backdropFilter === drawerGlass.expectedBackdropFilter ||
        drawerGlass.webkitBackdropFilter === drawerGlass.expectedBackdropFilter
      ),
    `Settings drawer should apply the unified New Tab backdrop blur directly to its visible panel: ${JSON.stringify(drawerGlass)}`
  )
  assert.equal(drawerGlass.filter, 'none', 'The full-height glass drawer must avoid an offscreen CSS filter layer')
  assert.notEqual(drawerGlass.boxShadow, 'none', 'Replacing drop-shadow filter must preserve drawer depth with a native shadow')
  await verifySettingsTabSwitching(page)
  await captureVisual(page, 'settings-drawer-desktop')

  const backgroundSearch = page.locator('.newtab-search-input')
  await backgroundSearch.click({ position: { x: 20, y: 18 } })
  assert.equal(await backgroundSearch.evaluate((element) => document.activeElement === element), true, 'A desktop background control should remain interactive')

  const outsideFocus = await page.evaluate(async () => {
    const trigger = document.querySelector('#newtab-settings-trigger')
    trigger?.focus()
    await new Promise((resolve) => setTimeout(resolve, 40))
    return {
      activeId: document.activeElement?.id,
      insidePanel: Boolean(document.activeElement?.closest('.settings-drawer-panel'))
    }
  })
  assert.equal(outsideFocus.activeId, 'newtab-settings-trigger', 'Desktop drawer must allow focus outside the inspector')
  assert.equal(outsideFocus.insidePanel, false, 'Desktop drawer must not trap focus')
  await closeDrawer(page, 'escape', false)
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'newtab-settings-trigger', 'Closing a non-modal inspector should preserve deliberate outside focus')

  await openDrawer(page)
  await waitForDrawerSettledOpen(page)
  const interruptionProbe = page.evaluate(() => new Promise((resolve) => {
    const panel = document.querySelector('.settings-drawer-panel')
    const trigger = document.querySelector('#newtab-settings-trigger')
    let sawHidden = false
    const events = []
    const observer = new MutationObserver(() => {
      sawHidden ||= panel?.hasAttribute('hidden') || false
      events.push({
        expanded: trigger?.getAttribute('aria-expanded'),
        hidden: panel?.hasAttribute('hidden') || false,
        time: performance.now()
      })
    })
    observer.observe(panel, { attributes: true, attributeFilter: ['hidden', 'data-ending-style', 'data-starting-style'] })
    observer.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] })
    setTimeout(() => {
      observer.disconnect()
      resolve({
        events,
        expanded: trigger?.getAttribute('aria-expanded'),
        sawHidden,
        open: !panel?.hasAttribute('hidden')
      })
    }, 720)
  }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(45)
  await page.locator('#newtab-settings-trigger').evaluate((element) => element.click())
  const interruption = await interruptionProbe
  assert.equal(interruption.sawHidden, false, `Reopening during exit must reverse without hiding the drawer: ${JSON.stringify(interruption)}`)
  assert.equal(interruption.open, true, 'Interrupted close should finish open')

  await page.getByRole('tab', { name: '外观' }).click()
  const { actionResult: scrollProbe } = await recordAnimationFrames(
    page,
    'settings drawer sustained scrolling',
    1_000,
    () => page.evaluate(async () => {
      const host = document.querySelector('.settings-drawer-scroll')
      const root = document.querySelector('.settings-drawer-scrollbar')
      const track = document.querySelector('.settings-drawer-scrollbar-track')
      const thumb = document.querySelector('.settings-drawer-scrollbar-thumb')
      if (!(host instanceof HTMLElement) || !(root instanceof HTMLElement) || !(track instanceof HTMLElement) || !(thumb instanceof HTMLElement)) {
        throw new Error('Settings scrollbar is unavailable')
      }
      const maxScroll = host.scrollHeight - host.clientHeight
      let maxError = 0
      for (let index = 1; index <= 24; index += 1) {
        host.scrollTop = maxScroll * index / 24
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const trackHeight = Math.max(track.clientHeight, 1)
        const thumbHeight = Math.min(100, Math.max((40 / trackHeight) * 100, (host.clientHeight / host.scrollHeight) * 100))
        const expected = (host.scrollTop / Math.max(maxScroll, 1)) * (100 - thumbHeight)
        const trackRect = track.getBoundingClientRect()
        const thumbRect = thumb.getBoundingClientRect()
        const actual = ((thumbRect.top - trackRect.top) / Math.max(trackRect.height, 1)) * 100
        maxError = Math.max(maxError, Math.abs(actual - expected))
      }
      return { maxError, maxScroll, visible: root.dataset.visible }
    })
  )
  assert.ok(scrollProbe.maxScroll > 100, 'Settings content should provide a sustained scrolling surface')
  assert.ok(scrollProbe.maxError < 1.5, `Custom scrollbar thumb lagged by ${scrollProbe.maxError.toFixed(2)} percentage points`)
  assert.equal(scrollProbe.visible, 'true', 'Custom scrollbar should stay visible while content can scroll')
  await closeDrawer(page, 'button')
}

async function verifyNarrowAndReducedMotionDrawer(page) {
  await page.setViewportSize({ width: 390, height: 720 })
  await page.waitForFunction(() => matchMedia('(max-width: 600px)').matches)
  await openDrawer(page)
  await page.waitForFunction(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    if (!panel) return false
    const rect = panel.getBoundingClientRect()
    return Math.abs(rect.left) <= 2 && Math.abs(rect.width - innerWidth) <= 2
  })
  const narrowState = await page.evaluate(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    const rect = panel.getBoundingClientRect()
    const backdrop = document.querySelector('#newtab-settings-backdrop')
    return {
      backdropPointerEvents: getComputedStyle(backdrop).pointerEvents,
      backdropTabIndex: backdrop.tabIndex,
      left: rect.left,
      rootInert: document.querySelector('#newtab-root').inert,
      width: rect.width
    }
  })
  assert.ok(Math.abs(narrowState.left) <= 2 && Math.abs(narrowState.width - 390) <= 2, 'Narrow settings must fill the viewport')
  assert.equal(narrowState.rootInert, true, 'Narrow settings must make the background inert')
  assert.equal(narrowState.backdropPointerEvents, 'none', 'Full-screen narrow settings do not need a pointer backdrop')
  assert.equal(narrowState.backdropTabIndex, -1, 'The decorative backdrop must not join the focus order')
  if (visualCaptureDir) {
    await page.locator('.settings-drawer-scroll').evaluate((element) => { element.scrollTop = 0 })
    await waitForFrames(page)
  }
  await captureVisual(page, 'settings-drawer-narrow')

  await page.evaluate(() => {
    const panel = document.querySelector('.settings-drawer-panel')
    const focusables = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
    focusables.at(-1)?.focus()
  })
  await page.keyboard.press('Tab')
  assert.equal(
    await page.evaluate(() => Boolean(document.activeElement?.closest('.settings-drawer-panel'))),
    true,
    'Narrow settings must trap keyboard focus inside the full-screen surface'
  )
  await closeDrawer(page, 'button')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 720 })
  await openDrawer(page)
  const reducedMotion = await page.locator('.settings-drawer-panel').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      duration: style.transitionDuration,
      property: style.transitionProperty,
      transform: style.transform
    }
  })
  assert.ok(!reducedMotion.property.includes('transform'), 'Reduced motion must remove the drawer translation transition')
  assert.ok(reducedMotion.duration.split(',').every((value) => Number.parseFloat(value) <= 0.1), 'Reduced motion feedback must stay at or below 100ms')
  assert.equal(reducedMotion.transform, 'none', 'Reduced motion must remove the drawer transform')
  await closeDrawer(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
}

async function probePopoverOpening(page, triggerSelector, popupSelector) {
  await page.waitForFunction((selector) => {
    const popup = document.querySelector(selector)
    return !popup || popup.hasAttribute('data-closed')
  }, popupSelector)
  const probePromise = page.evaluate((selector) => {
    return new Promise((resolve) => {
      let sawStartingStyle = false
      const startedAt = performance.now()
      const sample = (now) => {
        const popup = document.querySelector(selector)
        sawStartingStyle ||= popup?.hasAttribute('data-starting-style') || false
        if (now - startedAt < 260) {
          requestAnimationFrame(sample)
          return
        }
        const style = getComputedStyle(popup)
        const origin = style.transformOrigin.split(' ').map(Number.parseFloat)
        resolve({
          hidden: popup?.hasAttribute('data-closed'),
          origin,
          sawStartingStyle,
          side: popup?.getAttribute('data-side')
        })
      }
      requestAnimationFrame(sample)
    })
  }, popupSelector)
  await page.locator(triggerSelector).click()
  return probePromise
}

async function verifyResolvedOverlayDirections(page) {
  const directions = await page.evaluate(() => {
    const sides = ['top', 'bottom', 'left', 'right']
    return sides.map((side) => {
      const popup = document.createElement('div')
      popup.className = 'curator-overlay-panel curator-overlay-panel--popover'
      popup.dataset.side = side
      popup.setAttribute('data-starting-style', '')
      Object.assign(popup.style, {
        height: '20px',
        left: '-1000px',
        position: 'fixed',
        top: '-1000px',
        width: '40px'
      })
      document.body.append(popup)
      const style = getComputedStyle(popup)
      const matrix = new DOMMatrixReadOnly(style.transform)
      const origin = style.transformOrigin.split(' ').map(Number.parseFloat)
      popup.remove()
      return { side, x: matrix.e, y: matrix.f, originX: origin[0], originY: origin[1] }
    })
  })
  const bySide = Object.fromEntries(directions.map((entry) => [entry.side, entry]))
  assert.ok(bySide.top.y > 0 && bySide.top.originY >= 18, 'A top popover should enter toward its bottom trigger edge')
  assert.ok(bySide.bottom.y < 0 && bySide.bottom.originY <= 2, 'A bottom popover should enter from its top trigger edge')
  assert.ok(bySide.left.x > 0 && bySide.left.originX >= 38, 'A left popover should enter toward its right trigger edge')
  assert.ok(bySide.right.x < 0 && bySide.right.originX <= 2, 'A right popover should enter from its left trigger edge')
}

async function readPopupModalViewportProbe(page, modalId, listId) {
  return page.evaluate(({ modalId: targetModalId, listId: targetListId }) => {
    const portal = document.getElementById('modal-backdrop')
    const modal = document.getElementById(targetModalId)
    const list = document.getElementById(targetListId)
    if (!(portal instanceof HTMLElement) || !(modal instanceof HTMLElement) || !(list instanceof HTMLElement)) {
      return null
    }

    const portalRect = portal.getBoundingClientRect()
    const modalRect = modal.getBoundingClientRect()
    return {
      listClientHeight: list.clientHeight,
      listOverflowY: getComputedStyle(list).overflowY,
      modalBottom: modalRect.bottom,
      modalTop: modalRect.top,
      portalBottom: portalRect.bottom,
      portalTop: portalRect.top,
      viewportHeight: window.innerHeight
    }
  }, { modalId, listId })
}

function assertPopupModalWithinViewport(probe, label) {
  assert.ok(probe, `${label} viewport probe should resolve all modal elements`)
  assert.ok(
    probe.portalTop >= -0.5 && probe.portalBottom <= probe.viewportHeight + 0.5,
    `${label} portal must stay inside the visible popup viewport: ${JSON.stringify(probe)}`
  )
  assert.ok(
    probe.modalTop >= 16 && probe.modalBottom <= probe.viewportHeight - 16,
    `${label} card must keep a visible inset on every vertical edge: ${JSON.stringify(probe)}`
  )
  assert.ok(
    probe.listClientHeight > 0 && /^(?:auto|scroll)$/.test(probe.listOverflowY),
    `${label} folder list must scroll inside the bounded card: ${JSON.stringify(probe)}`
  )
}

async function probeCollapsibleClosing(page, rootSelector, triggerSelector) {
  return page.evaluate(({ rootSelector: targetRootSelector, triggerSelector: targetTriggerSelector }) => new Promise((resolve) => {
    const root = document.querySelector(targetRootSelector)
    const trigger = document.querySelector(targetTriggerSelector)
    const panel = root?.querySelector('.t-acc-panel')
    if (!(root instanceof HTMLElement) || !(trigger instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
      throw new Error('Collapsible close probe could not resolve its target elements')
    }

    const samples = []
    const startedAt = performance.now()
    const sample = (now) => {
      samples.push({
        at: now - startedAt,
        hidden: panel.hidden || getComputedStyle(panel).display === 'none',
        panelHeight: panel.getBoundingClientRect().height,
        rootHeight: root.getBoundingClientRect().height
      })
      if (now - startedAt < 420) {
        requestAnimationFrame(sample)
        return
      }

      const hiddenIndex = samples.findIndex((entry) => entry.hidden)
      const beforeHidden = hiddenIndex > 0 ? samples[hiddenIndex - 1] : null
      const hidden = hiddenIndex >= 0 ? samples[hiddenIndex] : null
      const grewWhileClosing = samples.some((entry, index) => (
        index > 0 && entry.rootHeight - samples[index - 1].rootHeight > 0.5
      ))
      resolve({
        beforeHidden,
        finalRootSnap: beforeHidden && hidden ? beforeHidden.rootHeight - hidden.rootHeight : null,
        frameCount: samples.length,
        grewWhileClosing,
        hidden,
        remainingPanelHeight: beforeHidden?.panelHeight ?? null
      })
    }

    trigger.click()
    requestAnimationFrame(sample)
  }), { rootSelector, triggerSelector })
}

function assertSmoothCollapsibleClose(probe, label) {
  assert.ok(probe.frameCount >= 5 && probe.beforeHidden && probe.hidden, `${label} should expose a complete closing transition`)
  assert.equal(probe.grewWhileClosing, false, `${label} height must decrease monotonically while closing`)
  assert.ok(
    probe.remainingPanelHeight <= 0.5,
    `${label} panel must reach zero before Base UI hides it: ${JSON.stringify(probe)}`
  )
  assert.ok(
    Math.abs(probe.finalRootSnap) <= 0.5,
    `${label} must not jump when the closed panel becomes hidden: ${JSON.stringify(probe)}`
  )
}

async function verifyPopup(page, extensionId, seeded) {
  await page.addInitScript(() => {
    const originalQuery = chrome.tabs.query.bind(chrome.tabs)
    const fakeActiveTab = {
      active: true,
      favIconUrl: '',
      id: 77,
      title: 'Curator current-page probe',
      url: 'https://example.com/current-page-probe'
    }
    chrome.tabs.query = (queryInfo, callback) => {
      if (queryInfo?.active && queryInfo?.currentWindow) {
        if (typeof callback === 'function') {
          callback([fakeActiveTab])
          return undefined
        }
        return Promise.resolve([fakeActiveTab])
      }
      return originalQuery(queryInfo, callback)
    }
  })
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('#search-help-toggle').waitFor({ state: 'attached' })
  await page.waitForTimeout(350)
  await verifyResolvedOverlayDirections(page)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const probe = await probePopoverOpening(page, '#search-help-toggle', '#search-help-popover')
    assert.equal(probe.hidden, false, 'Repeated popover opening should leave the panel visible')
    assert.equal(probe.sawStartingStyle, true, 'Repeated popover opening should expose a starting state')
    assert.equal(probe.side, 'bottom', 'Search help should resolve below its trigger')
    assert.ok(probe.origin[1] <= 2, 'A bottom popover should originate from its top edge')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => {
      const popup = document.querySelector('#search-help-popover')
      return !popup || popup.hasAttribute('data-closed')
    })
    await page.waitForFunction(() => document.activeElement?.id === 'search-help-toggle')
  }

  await page.locator('#search-help-toggle').click()
  await page.waitForFunction(() => !document.querySelector('#search-help-popover')?.hasAttribute('data-closed'))
  await page.waitForFunction(() => {
    const popup = document.querySelector('#search-help-popover')
    return popup?.hasAttribute('data-open') && popup.getAnimations().length === 0
  })
  const interruptionProbe = page.evaluate(() => new Promise((resolve) => {
    const popup = document.querySelector('#search-help-popover')
    let sawHidden = false
    const startedAt = performance.now()
    const sample = (now) => {
      sawHidden ||= !popup?.isConnected || popup?.hasAttribute('hidden') || getComputedStyle(popup).display === 'none'
      if (now - startedAt < 420) {
        requestAnimationFrame(sample)
        return
      }
      resolve({ open: !popup?.hasAttribute('data-closed'), sawHidden })
    }
    requestAnimationFrame(sample)
  }))
  await page.evaluate(() => {
    const popup = document.querySelector('#search-help-popover')
    const trigger = document.querySelector('#search-help-toggle')
    const state = { done: false }
    window.__curatorPopoverReopenProbe = state
    const observer = new MutationObserver(() => {
      if (!popup?.hasAttribute('data-ending-style')) {
        return
      }
      trigger?.click()
      state.done = true
      observer.disconnect()
    })
    observer.observe(popup, { attributes: true, attributeFilter: ['data-ending-style'] })
  })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__curatorPopoverReopenProbe?.done)
  await page.evaluate(() => { delete window.__curatorPopoverReopenProbe })
  const interrupted = await interruptionProbe
  assert.equal(interrupted.sawHidden, false, 'Popover reopening during exit should reverse without unmounting')
  assert.equal(interrupted.open, true, 'Interrupted popover exit should finish open')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => {
    const popup = document.querySelector('#search-help-popover')
    return !popup || popup.hasAttribute('data-closed')
  })

  const input = page.locator('#search-input')
  await input.fill(`site:example.com folder:"${seeded.folderTitles[0]}" -beta`)
  await page.waitForFunction(() => document.querySelectorAll('#search-chips > span').length >= 3)
  const chipStyles = await page.locator('#search-chips > span').evaluateAll((chips) => chips.map((chip) => {
    const style = getComputedStyle(chip)
    return { background: style.backgroundColor, border: style.borderColor }
  }))
  assert.ok(chipStyles.every((style) => style.background === chipStyles[0].background && style.border === chipStyles[0].border), 'Ordinary and exclusion query chips should share one neutral surface')
  await captureVisual(page, 'popup-filters')

  await input.fill('Alpha')
  await input.fill('Beta')
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('.popup-main-row')]
      .filter((row) => row.textContent?.trim())
    return rows.length === 1 && rows[0]?.textContent?.includes('Curator Smoke Beta')
  })
  const immediateCount = await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
    const row = [...document.querySelectorAll('.popup-main-row')].find((element) => element.textContent?.includes('Curator Smoke Beta'))
    const section = row?.closest('section')
    resolve(section?.querySelector('header .t-number-value')?.textContent || '')
  })))
  assert.match(immediateCount, /^1(?:\s|$)/, 'The latest result count should be visible on the next frame')

  await input.fill('Curator Smoke')
  await page.waitForFunction(() => [...document.querySelectorAll('.popup-main-row')].filter((row) => row.textContent?.trim()).length >= 3)
  const popupHoverPoints = await page.locator('.popup-main-row').evaluateAll((rows) => rows
    .filter((row) => row.textContent?.trim())
    .slice(0, 5)
    .map((row) => {
      const rect = row.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }))
  await recordAnimationFrames(page, 'Popup result hover actions', 500, async () => {
    for (let repeat = 0; repeat < 3; repeat += 1) {
      for (const point of popupHoverPoints) {
        await page.mouse.move(point.x, point.y, { steps: 2 })
      }
    }
  })
  await input.focus()
  const beforeActive = await page.locator('.popup-main-row[data-active="true"]').textContent()
  await page.keyboard.press('ArrowDown')
  await waitForFrames(page, 1)
  const afterActive = await page.locator('.popup-main-row[data-active="true"]').textContent()
  assert.notEqual(afterActive, beforeActive, 'Arrow-key navigation should update the active result by the next frame')

  await input.fill('')
  await page.waitForFunction(() => [...document.querySelectorAll('.popup-main-row')].filter((row) => row.textContent?.trim()).length >= 3)
  const firstRow = page.locator('.popup-main-row').filter({ has: page.locator('button[aria-expanded]') }).first()
  const actionTrigger = firstRow.locator('button[aria-expanded]')
  await actionTrigger.click()
  const editButton = firstRow.locator('button[aria-label^="编辑书签"]')
  await editButton.click()
  await page.waitForFunction(() => !document.querySelector('#modal-backdrop .curator-overlay-panel')?.hasAttribute('hidden'))
  await page.waitForFunction(() => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    const backdrop = document.querySelector('#modal-backdrop .t-modal-backdrop')
    return panel?.hasAttribute('data-open') &&
      backdrop?.hasAttribute('data-open') &&
      panel.getAnimations().length === 0 &&
      backdrop.getAnimations().length === 0
  })
  await page.locator('#edit-folder-picker-button').click()
  await page.waitForFunction(() => {
    const panel = document.querySelector('#edit-folder-picker')
    return panel?.hasAttribute('data-open') && panel.getAnimations().length === 0
  })
  assertSmoothCollapsibleClose(
    await probeCollapsibleClosing(page, '#edit-modal .t-acc', '#edit-folder-picker-button'),
    'Edit-bookmark folder picker'
  )
  await captureVisual(page, 'popup-modal')
  const exitProbe = page.evaluate(() => new Promise((resolve) => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    const backdrop = document.querySelector('#modal-backdrop .t-modal-backdrop')
    let panelEnding = false
    let backdropEnding = false
    let together = false
    const startedAt = performance.now()
    const sample = (now) => {
      panelEnding ||= panel?.hasAttribute('data-ending-style') || false
      backdropEnding ||= backdrop?.hasAttribute('data-ending-style') || false
      together ||= Boolean(panel?.hasAttribute('data-ending-style') && backdrop?.hasAttribute('data-ending-style'))
      if (now - startedAt < 340) {
        requestAnimationFrame(sample)
        return
      }
      resolve({ backdropEnding, panelEnding, together })
    }
    requestAnimationFrame(sample)
  }))
  await page.locator('#close-edit-modal').click()
  const exit = await exitProbe
  assert.ok(exit.panelEnding && exit.backdropEnding && exit.together, `Modal card and backdrop should exit as one hierarchy: ${JSON.stringify(exit)}`)
  await page.waitForFunction(() => document.querySelector('#modal-backdrop .curator-overlay-panel')?.hasAttribute('hidden'))
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('编辑书签'))

  // Reproduce the Chrome action-popup host-height glitch that used to center
  // wide folder pickers below the visible 600px viewport.
  await page.evaluate(() => {
    const root = document.getElementById('popup-root')
    if (root) {
      root.style.height = '1200px'
      root.style.maxHeight = 'none'
    }
  })

  await page.locator('[data-current-page-action="save"]').click()
  await page.locator('#smart-folder-modal').waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    return panel?.hasAttribute('data-open') && panel.getAnimations().length === 0
  })
  assertPopupModalWithinViewport(
    await readPopupModalViewportProbe(page, 'smart-folder-modal', 'smart-folder-list'),
    'Quick-save folder picker'
  )
  await page.locator('#close-smart-folder-modal').click()
  await page.waitForFunction(() => document.querySelector('#modal-backdrop .curator-overlay-panel')?.hasAttribute('hidden'))

  const moveRow = page.locator('.popup-main-row').filter({ has: page.locator('button[aria-expanded]') }).first()
  await moveRow.locator('button[aria-expanded]').click()
  await moveRow.locator('button[aria-label^="移动书签"]').click()
  await page.locator('#move-modal').waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const panel = document.querySelector('#modal-backdrop .curator-overlay-panel')
    return panel?.hasAttribute('data-open') && panel.getAnimations().length === 0
  })
  assertPopupModalWithinViewport(
    await readPopupModalViewportProbe(page, 'move-modal', 'move-folder-list'),
    'Move-bookmark folder picker'
  )
  await page.locator('#close-move-modal').click()
  await page.waitForFunction(() => document.querySelector('#modal-backdrop .curator-overlay-panel')?.hasAttribute('hidden'))
}

async function verifyPopupBookmarkReorder(page, seeded, context) {
  const folderId = seeded.folderIds[0]
  const folderTitle = seeded.folderTitles[0]
  const folderRow = page.getByRole('treeitem').filter({ hasText: folderTitle }).first()
  await folderRow.click()

  const enterButton = page.getByRole('button', { name: '调整顺序' })
  await enterButton.waitFor({ state: 'visible' })
  assert.equal(await enterButton.isEnabled(), true, 'A folder with multiple direct bookmarks should allow reorder mode')

  const initialOrder = await page.evaluate(async (id) => {
    const children = await chrome.bookmarks.getChildren(id)
    return children.filter((child) => child.url).map((child) => child.id)
  }, folderId)
  await enterButton.click()
  await page.locator('.popup-main-pane[data-reorder-mode="true"]').waitFor({ state: 'visible' })
  assert.equal(
    await page.locator('.popup-bookmark-reorder-handle').count(),
    initialOrder.length,
    'Reorder mode should expose one dedicated handle per direct bookmark'
  )
  assert.equal(
    await page.locator('.popup-main-pane[data-reorder-mode="true"] .popup-row-actions').count(),
    0,
    'Reorder mode should hide normal bookmark action rails'
  )
  await captureVisual(page, 'popup-bookmark-reorder')

  const firstHandle = page.locator('.popup-bookmark-reorder-handle').first()
  const keyboardMovedId = await firstHandle.locator('xpath=..').getAttribute('data-bookmark-id')
  assert.ok(keyboardMovedId, 'The first reorder row should expose its bookmark id')
  await firstHandle.focus()
  await page.keyboard.press('Alt+ArrowDown')
  await page.waitForFunction(async ({ id, bookmarkId }) => {
    const children = await chrome.bookmarks.getChildren(id)
    return children.filter((child) => child.url)[1]?.id === bookmarkId
  }, { id: folderId, bookmarkId: keyboardMovedId })
  await page.locator('.popup-bookmark-reorder-handle').first().waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('.popup-bookmark-reorder-handle')?.disabled)
  assert.match(
    await page.locator('.popup-main-pane [aria-live="polite"]').textContent(),
    /已移动到第 2 位/,
    'Keyboard reorder should announce the saved position'
  )

  const reorderRows = page.locator('.popup-main-pane[data-reorder-mode="true"] .popup-main-row')
  const dragSourceRow = reorderRows.first()
  const dragSourceHandle = dragSourceRow.locator('.popup-bookmark-reorder-handle')
  const dragTargetRow = reorderRows.nth(2)
  const draggedId = await dragSourceRow.getAttribute('data-bookmark-id')
  const [handleBox, targetBox] = await Promise.all([
    dragSourceHandle.boundingBox(),
    dragTargetRow.boundingBox()
  ])
  assert.ok(handleBox && targetBox && draggedId, 'Popup reorder drag geometry should be available')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 5 })
  await page.locator('.popup-bookmark-drag-ghost').waitFor({ state: 'attached' })
  const dragSourceOpacity = await page
    .locator('.popup-main-pane[data-reorder-mode="true"] .popup-main-row[data-reorder-source="true"]')
    .evaluate((element) => getComputedStyle(element).opacity)
  assert.equal(dragSourceOpacity, '0', 'The source row should be fully hidden while its drag preview is visible')
  assert.ok(
    await page.locator('.popup-main-pane[data-reorder-mode="true"] .popup-main-row[data-reorder-shift="true"]').count() >= 1,
    'Dragging should shift intervening rows with transform-based preview motion'
  )
  await captureVisual(page, 'popup-bookmark-reorder-dragging')
  await page.mouse.up()
  await page.locator('.popup-bookmark-drag-ghost').waitFor({ state: 'detached', timeout: 2_000 })
  await page.waitForFunction(async ({ id, bookmarkId }) => {
    const children = await chrome.bookmarks.getChildren(id)
    return children.filter((child) => child.url)[2]?.id === bookmarkId
  }, { id: folderId, bookmarkId: draggedId })

  await page.waitForFunction(() => !document.querySelector('.popup-bookmark-reorder-handle')?.disabled)
  const touchClient = await context.newCDPSession(page)
  const touchSourceRow = page.locator('.popup-main-pane[data-reorder-mode="true"] .popup-main-row').first()
  const touchHandle = touchSourceRow.locator('.popup-bookmark-reorder-handle')
  const touchTargetRow = page.locator('.popup-main-pane[data-reorder-mode="true"] .popup-main-row').nth(1)
  const touchMovedId = await touchSourceRow.getAttribute('data-bookmark-id')
  const [touchHandleBox, touchTargetBox] = await Promise.all([
    touchHandle.boundingBox(),
    touchTargetRow.boundingBox()
  ])
  assert.ok(touchHandleBox && touchTargetBox && touchMovedId, 'Popup touch reorder geometry should be available')
  const touchStart = {
    id: 7,
    x: Math.round(touchHandleBox.x + touchHandleBox.width / 2),
    y: Math.round(touchHandleBox.y + touchHandleBox.height / 2)
  }
  const touchDestination = {
    id: 7,
    x: Math.round(touchTargetBox.x + touchTargetBox.width / 2),
    y: Math.round(touchTargetBox.y + touchTargetBox.height / 2)
  }
  await dispatchTouch(touchClient, 'touchStart', [touchStart])
  await page.waitForTimeout(350)
  await page.locator('.popup-bookmark-drag-ghost').waitFor({ state: 'attached' })
  await dispatchTouch(touchClient, 'touchMove', [touchDestination])
  await waitForFrames(page)
  await dispatchTouch(touchClient, 'touchEnd', [])
  await page.locator('.popup-bookmark-drag-ghost').waitFor({ state: 'detached', timeout: 2_000 })
  await page.waitForFunction(async ({ id, bookmarkId }) => {
    const children = await chrome.bookmarks.getChildren(id)
    return children.filter((child) => child.url)[1]?.id === bookmarkId
  }, { id: folderId, bookmarkId: touchMovedId })
  await touchClient.detach()

  await page.evaluate(async ({ id, order }) => {
    for (let index = order.length - 1; index >= 0; index -= 1) {
      await chrome.bookmarks.move(order[index], { parentId: id, index: 0 })
    }
  }, { id: folderId, order: initialOrder })

  await page.getByRole('button', { name: '完成排序' }).click()
  await page.waitForFunction(() => !document.querySelector('.popup-main-pane')?.hasAttribute('data-reorder-mode'))
  assert.equal(
    await page.locator('.popup-bookmark-reorder-handle').count(),
    0,
    'Leaving reorder mode should restore the normal bookmark list controls'
  )
}

async function verifyOptions(page, extensionId) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('#general').waitFor({ state: 'attached' })
  await page.waitForFunction(() => !document.querySelector('#general')?.hasAttribute('hidden'))
  const navLabels = await page.locator('aside nav a').allTextContents()
  assert.ok(navLabels.every((label) => !label.trim().startsWith('-')), 'Options navigation should not use decorative terminal prefixes')
  await captureVisual(page, 'options-general', { fullPage: true })

  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#general`, { waitUntil: 'domcontentloaded' })
  const advancedSettings = page.locator('#ai-advanced-settings')
  await advancedSettings.waitFor({ state: 'visible', timeout: 20_000 })
  const advancedTrigger = advancedSettings.locator('.t-acc-head')
  const [advancedSettingsBox, advancedTriggerBox] = await Promise.all([
    advancedSettings.boundingBox(),
    advancedTrigger.boundingBox()
  ])
  assert.ok(advancedSettingsBox && advancedTriggerBox, 'AI provider advanced settings should be measurable')
  assert.ok(
    advancedTriggerBox.width < advancedSettingsBox.width * 0.5,
    `Advanced-settings highlight should stay content-sized: ${JSON.stringify({ advancedSettingsBox, advancedTriggerBox })}`
  )
  await advancedTrigger.focus()
  await waitForFrames(page, 10)
  const advancedFocusFeedback = await advancedTrigger.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    focusVisible: element.matches(':focus-visible')
  }))
  assert.ok(
    advancedFocusFeedback.focusVisible && advancedFocusFeedback.background !== 'rgba(0, 0, 0, 0)',
    `Advanced-settings keyboard focus should retain a compact visible highlight: ${JSON.stringify(advancedFocusFeedback)}`
  )
  await captureVisual(page, 'options-advanced-trigger-compact')
  await advancedTrigger.click()
  await page.waitForFunction(() => {
    const panel = document.querySelector('#ai-advanced-settings .t-acc-panel')
    return panel?.hasAttribute('data-open') && panel.getAnimations().length === 0
  })
  assertSmoothCollapsibleClose(
    await probeCollapsibleClosing(page, '#ai-advanced-settings', '#ai-advanced-settings .t-acc-head'),
    'AI provider advanced settings'
  )
  const reasoningTrigger = page.getByRole('button', { name: /^推理强度：/ })
  await reasoningTrigger.waitFor({ state: 'visible', timeout: 20_000 })
  const modelRow = page.locator('.ai-provider-model-row')
  const modelLayoutBefore = await modelRow.evaluate((row) => {
    const controls = [...row.children].map((child) => {
      const rect = child.getBoundingClientRect()
      return { left: rect.left, width: rect.width }
    })
    return { height: row.getBoundingClientRect().height, controls }
  })
  const modelGroupBox = await page.locator('.ai-provider-model-group').boundingBox()
  const modelSelectorBox = await page.locator('.ai-provider-model-select-host').boundingBox()
  const effortHostBox = await page.locator('.ai-provider-effort-host').boundingBox()
  assert.ok(modelGroupBox && modelSelectorBox && effortHostBox, 'Model and reasoning controls should be measurable')
  assert.ok(
    modelLayoutBefore.controls[0].width > modelLayoutBefore.controls[1].width,
    `Model field should have more row space than reasoning effort: ${JSON.stringify(modelLayoutBefore.controls)}`
  )
  assert.ok(
    Math.abs(modelGroupBox.x - modelLayoutBefore.controls[0].left) <= 1 &&
      Math.abs(modelGroupBox.width - modelLayoutBefore.controls[0].width) <= 1,
    `Model controls should fill the complete model field without a trailing gap: ${JSON.stringify({ modelGroupBox, modelField: modelLayoutBefore.controls[0] })}`
  )
  assert.ok(
    modelSelectorBox.width >= 310,
    `Model selector should absorb the model field's remaining width: ${modelSelectorBox.width}`
  )
  assert.ok(
    effortHostBox.width < 560,
    `Reasoning effort should not consume the full remaining settings row: ${effortHostBox.width}`
  )
  const modelNameMetrics = await page.locator('.model-selector-name').first().evaluate((name) => {
    const style = getComputedStyle(name)
    const rect = name.getBoundingClientRect()
    return { height: rect.height, lineHeight: Number.parseFloat(style.lineHeight) }
  })
  assert.ok(
    modelNameMetrics.height >= 20 && modelNameMetrics.lineHeight >= 20,
    `Model name line box should preserve letter descenders: ${JSON.stringify(modelNameMetrics)}`
  )
  const reasoningTriggerBox = await reasoningTrigger.boundingBox()
  assert.ok(reasoningTriggerBox, 'Reasoning effort trigger should be measurable')
  await reasoningTrigger.click()
  const advancedReasoningButton = page.getByRole('button', { name: '高级设置' })
  await advancedReasoningButton.waitFor({ state: 'visible' })
  const reasoningPopover = page.locator('.reasoning-effort-popover')
  await page.waitForFunction(() => document.querySelector('.reasoning-effort-popover')?.getAnimations().length === 0)
  const reasoningPopoverBox = await reasoningPopover.boundingBox()
  assert.ok(reasoningPopoverBox, 'Reasoning effort popover should be measurable')
  assert.ok(
    Math.abs(reasoningPopoverBox.x - reasoningTriggerBox.x) <= 1 &&
      Math.abs(reasoningPopoverBox.width - reasoningTriggerBox.width) <= 1,
    `Reasoning effort popover should align to and match its trigger: ${JSON.stringify({ reasoningPopoverBox, reasoningTriggerBox })}`
  )
  await captureVisual(page, 'options-reasoning-menu')
  await advancedReasoningButton.click()
  const reasoningSlider = page.getByRole('slider', { name: '推理强度' })
  await reasoningSlider.waitFor({ state: 'visible' })
  await page.waitForFunction(() => [...document.querySelectorAll('.reasoning-selector-view-track')]
    .every((track) => track.getAnimations().length === 0))
  const reasoningTrackGeometry = await page.locator('.reasoning-effort-track').boundingBox()
  const reasoningKnobGeometry = await page.locator('.reasoning-effort-knob').boundingBox()
  assert.ok(reasoningTrackGeometry && reasoningKnobGeometry, 'Reasoning effort track and knob should be measurable')
  const trackCenterY = reasoningTrackGeometry.y + reasoningTrackGeometry.height / 2
  const knobCenterY = reasoningKnobGeometry.y + reasoningKnobGeometry.height / 2
  assert.ok(
    Math.abs(trackCenterY - knobCenterY) <= 1,
    `Reasoning effort knob should be vertically centered on its track: ${JSON.stringify({ knobCenterY, trackCenterY })}`
  )
  assert.equal(
    await reasoningSlider.locator('canvas').count(),
    0,
    'Reasoning effort feedback should avoid decorative looping canvases'
  )
  await captureVisual(page, 'options-reasoning-advanced')
  const reasoningTrackBox = await reasoningSlider.boundingBox()
  assert.ok(reasoningTrackBox, 'Reasoning effort track should be measurable')
  const reasoningBefore = await reasoningSlider.getAttribute('aria-valuenow')
  await recordAnimationFrames(page, 'reasoning effort drag and spring settle', 800, async () => {
    const startX = reasoningTrackBox.x + 28
    const endX = reasoningTrackBox.x + reasoningTrackBox.width - 34
    const y = reasoningTrackBox.y + reasoningTrackBox.height / 2
    await page.mouse.move(startX, y)
    await page.mouse.down()
    await page.mouse.move(endX, y, { steps: 8 })
    await page.mouse.up()
  })
  await page.waitForFunction((previous) => document.querySelector('[role="slider"][aria-label="推理强度"]')?.getAttribute('aria-valuenow') !== previous, reasoningBefore)
  await captureVisual(page, 'options-reasoning-highest')
  const modelLayoutAfter = await modelRow.evaluate((row) => {
    const controls = [...row.children].map((child) => {
      const rect = child.getBoundingClientRect()
      return { left: rect.left, width: rect.width }
    })
    return { height: row.getBoundingClientRect().height, controls }
  })
  assert.deepEqual(modelLayoutAfter, modelLayoutBefore, 'Changing reasoning effort should not reflow the model controls')
  await page.keyboard.press('Escape')
  await verifyAvailabilitySettingsPopover(page, extensionId)
  await verifyOptionsScopePickers(page, extensionId)
  if (visualCaptureDir) {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html#ai`, { waitUntil: 'domcontentloaded' })
    await page.locator('button[aria-label="按结果筛选书签智能分析结果"]')
      .waitFor({ state: 'visible' })
    await captureVisual(page, 'options-ai-analysis-desktop', { fullPage: true })
    await page.setViewportSize({ width: 430, height: 900 })
    await waitForFrames(page)
    await captureVisual(page, 'options-ai-analysis-narrow', { fullPage: true })
    await page.locator('button[aria-label="按结果筛选书签智能分析结果"]')
      .scrollIntoViewIfNeeded()
    await waitForFrames(page)
    await captureVisual(page, 'options-ai-analysis-narrow-results')
  }
}

async function verifyOptionsRefreshStability(page, worker, extensionId) {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      curatorBookmarkAiNamingSettings: {
        apiKey: 'curat...ey',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5',
        reasoningEffort: 'medium',
        autoAnalyzeBookmarks: true,
        allowRemoteParsing: false
      },
      curatorBookmarkInboxSettings: {
        version: 1,
        enabled: true,
        folderTitle: 'Inbox / 待整理',
        autoMoveToRecommendedFolder: false,
        tagOnlyNoAutoMove: true,
        minAutoMoveConfidence: 0.72,
        notifyOnClassified: true
      },
      curatorBookmarkContentSnapshotSettings: {
        enabled: true,
        saveFullText: true,
        fullTextSearchEnabled: true
      }
    })
  })

  await page.setViewportSize({ width: 1456, height: 1000 })
  await page.addInitScript(() => {
    const samples = []
    window.__curatorOptionsRefreshSamples = samples
    const findCard = (title) => {
      const heading = [...document.querySelectorAll('h2')]
        .find((element) => element.textContent?.trim() === title)
      let current = heading?.parentElement || null
      while (current && current.id !== 'general') {
        const style = getComputedStyle(current)
        const rect = current.getBoundingClientRect()
        if (
          rect.width > 500 &&
          Number.parseFloat(style.borderTopWidth) > 0 &&
          Number.parseFloat(style.borderRadius) >= 6
        ) {
          return current
        }
        current = current.parentElement
      }
      return null
    }
    const sample = (now) => {
      const feature = findCard('功能设置')
      const content = findCard('网页内容索引')
      const shortcuts = findCard('快捷键')
      const switches = (element) => element
        ? [...element.querySelectorAll('[role="switch"]')].map((item) => item.getAttribute('aria-checked'))
        : []
      samples.push({
        now,
        feature: feature ? {
          ariaBusy: feature.getAttribute('aria-busy'),
          height: feature.getBoundingClientRect().height,
          switches: switches(feature)
        } : null,
        content: content ? {
          ariaBusy: content.getAttribute('aria-busy'),
          height: content.getBoundingClientRect().height,
          switches: switches(content)
        } : null,
        shortcuts: shortcuts ? {
          ariaBusy: shortcuts.getAttribute('aria-busy'),
          commandRows: shortcuts.querySelectorAll('strong').length,
          height: shortcuts.getBoundingClientRect().height
        } : null
      })
      if (now < 1800) {
        requestAnimationFrame(sample)
      }
    }
    requestAnimationFrame(sample)
  })

  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#general`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => {
    const autoAnalyze = document.querySelector('[role="switch"][aria-label="自动分析"]')
    const tagOnly = document.querySelector('[role="switch"][aria-label="只打标签，不自动移动"]')
    const contentIndex = document.querySelector('[role="switch"][aria-label="保存网页内容索引"]')
    const fullText = document.querySelector('[role="switch"][aria-label="保存完整正文"]')
    const shortcutHeading = [...document.querySelectorAll('h2')]
      .find((element) => element.textContent?.trim() === '快捷键')
    let shortcutCard = shortcutHeading?.parentElement || null
    while (shortcutCard && shortcutCard.id !== 'general') {
      const style = getComputedStyle(shortcutCard)
      if (
        shortcutCard.getBoundingClientRect().width > 500 &&
        Number.parseFloat(style.borderTopWidth) > 0 &&
        Number.parseFloat(style.borderRadius) >= 6
      ) {
        break
      }
      shortcutCard = shortcutCard.parentElement
    }
    return autoAnalyze?.getAttribute('aria-checked') === 'true' &&
      tagOnly?.getAttribute('aria-checked') === 'true' &&
      contentIndex?.getAttribute('aria-checked') === 'true' &&
      fullText?.getAttribute('aria-checked') === 'true' &&
      (shortcutCard?.querySelectorAll('strong').length || 0) >= 4
  }, undefined, { timeout: 20_000 })
  await page.waitForTimeout(360)
  await captureVisual(page, 'options-general-refresh-settled', { fullPage: true })

  const samples = await page.evaluate(() => window.__curatorOptionsRefreshSamples || [])
  const visibleSamples = samples.filter((sample) => sample.feature && sample.content && sample.shortcuts)
  assert.ok(visibleSamples.length > 1, 'Options refresh stability probe should capture multiple visible frames')
  const finalSample = visibleSamples.at(-1)
  const heightRange = (key) => {
    const heights = visibleSamples.map((sample) => sample[key]?.height || 0).filter((height) => height > 0)
    return Math.max(...heights) - Math.min(...heights)
  }
  const prematureFeatureStates = visibleSamples
    .map((sample) => sample.feature.switches)
    .filter((switches) => switches.length > 0 && JSON.stringify(switches) !== JSON.stringify(finalSample.feature.switches))
  const prematureContentStates = visibleSamples
    .map((sample) => sample.content.switches)
    .filter((switches) => switches.length > 0 && JSON.stringify(switches) !== JSON.stringify(finalSample.content.switches))

  assert.ok(
    heightRange('feature') <= 2,
    `Feature settings must reserve their settled height during refresh: ${JSON.stringify(visibleSamples)}`
  )
  assert.ok(
    heightRange('shortcuts') <= 2,
    `Shortcut settings must reserve their settled height during refresh: ${JSON.stringify(visibleSamples)}`
  )
  assert.deepEqual(
    prematureFeatureStates,
    [],
    'Feature switches must not expose temporary defaults before persisted settings are ready'
  )
  assert.deepEqual(
    prematureContentStates,
    [],
    'Content-index switches must not expose temporary defaults before persisted settings are ready'
  )
}

async function verifyOptionsBorderIntegrity(page, extensionId) {
  const sectionHashes = [
    'general',
    'backup',
    'availability',
    'history',
    'redirects',
    'ignore',
    'duplicates',
    'folder-cleanup',
    'recycle',
    'ai',
    'bookmark-history'
  ]
  const clippedBorderedSurfaces = []
  let borderedSurfaceCount = 0

  await page.setViewportSize({ width: 1456, height: 1188 })
  for (const sectionHash of sectionHashes) {
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html#${sectionHash}`, { waitUntil: 'domcontentloaded' })
    const section = page.locator(`#${sectionHash}`)
    await section.waitFor({ state: 'attached' })
    await page.waitForFunction((sectionId) => !document.getElementById(sectionId)?.hasAttribute('hidden'), sectionHash)
    await waitForFrames(page)

    const sectionProbe = await section.evaluate((element) => {
      const bordered = [...element.querySelectorAll('[data-sq="on"]')]
        .filter((candidate) => {
          if (!(candidate instanceof HTMLElement)) return false
          const rect = candidate.getBoundingClientRect()
          const style = getComputedStyle(candidate)
          const borderWidths = [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth
          ].map((value) => Number.parseFloat(value) || 0)
          return rect.width > 2 && rect.height > 2 && borderWidths.some((width) => width > 0)
        })
        .map((candidate) => ({
          className: candidate.getAttribute('class') || '',
          tagName: candidate.tagName,
          text: candidate.textContent?.trim().slice(0, 80) || candidate.getAttribute('aria-label') || ''
        }))
      const visibleBorderedSurfaceCount = [...element.querySelectorAll('*')]
        .filter((candidate) => {
          if (!(candidate instanceof HTMLElement)) return false
          const rect = candidate.getBoundingClientRect()
          const style = getComputedStyle(candidate)
          const borderWidths = [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth
          ].map((value) => Number.parseFloat(value) || 0)
          return rect.width > 2 && rect.height > 2 && borderWidths.some((width) => width > 0)
        }).length
      return { bordered, visibleBorderedSurfaceCount }
    })

    borderedSurfaceCount += sectionProbe.visibleBorderedSurfaceCount
    clippedBorderedSurfaces.push(...sectionProbe.bordered.map((surface) => ({ sectionHash, ...surface })))
  }

  assert.ok(borderedSurfaceCount > 0, 'Options border integrity probe should inspect visible bordered surfaces')
  assert.equal(
    clippedBorderedSurfaces.length,
    0,
    `Options bordered surfaces must use native radii instead of a clip-path that attenuates 1px edges. Found ${clippedBorderedSurfaces.length}: ${JSON.stringify(clippedBorderedSurfaces.slice(0, 12))}`
  )

  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#ai`, { waitUntil: 'domcontentloaded' })
  await page.locator('#ai').waitFor({ state: 'visible' })
  const aiToolbarButtonHeights = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('#ai button')]
    const apiKeyButton = buttons.find((button) => button.textContent?.trim() === '已配置 API Key')
    const startButton = buttons.find((button) => button.textContent?.trim() === '开始分析并生成建议')
    return {
      apiKey: apiKeyButton?.getBoundingClientRect().height ?? 0,
      start: startButton?.getBoundingClientRect().height ?? 0
    }
  })
  assert.ok(
    aiToolbarButtonHeights.apiKey > 0 &&
      Math.abs(aiToolbarButtonHeights.apiKey - aiToolbarButtonHeights.start) <= 0.1,
    `AI configuration status and primary action should share one 40px control height: ${JSON.stringify(aiToolbarButtonHeights)}`
  )

  const aiResultFilter = page.locator('button[aria-label="按结果筛选书签智能分析结果"]')
  await aiResultFilter.waitFor({ state: 'visible' })
  assert.equal(
    await page.locator('button[aria-label="按置信度筛选书签智能分析结果"]').count(),
    0,
    'AI results should use one result filter instead of separate status and confidence filters'
  )
  await aiResultFilter.click()
  const aiResultFilterOptions = (await page.locator('[role="option"]').allTextContents())
    .map((label) => label.trim())
    .filter(Boolean)
  assert.deepEqual(
    aiResultFilterOptions,
    ['全部结果', '建议改名', '待人工确认', '无需改名', '失败'],
    'AI result filter should expose only the five actionable result categories'
  )
  await page.keyboard.press('Escape')

  const scopeTriggerCases = [
    { hash: 'availability', label: '选择检测范围' },
    { hash: 'history', label: '选择历史范围' },
    { hash: 'ai', label: '选择书签智能分析范围' }
  ]
  for (const scopeCase of scopeTriggerCases) {
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html#${scopeCase.hash}`, { waitUntil: 'domcontentloaded' })
    const trigger = page.getByRole('button', { name: scopeCase.label, exact: true })
    await trigger.waitFor({ state: 'visible' })
    const affordance = await trigger.evaluate((element) => ({
      iconCount: element.querySelectorAll('svg').length,
      trailingElement: element.lastElementChild?.tagName || ''
    }))
    assert.deepEqual(
      affordance,
      { iconCount: 1, trailingElement: 'svg' },
      `${scopeCase.label} should use one trailing chevron so every scope selector reads as an interactive picker`
    )
  }

  const disabledFilterStyle = await page.getByRole('button', { name: '清空书签智能分析筛选条件' }).evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      borderWidths: [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth
      ],
      opacity: style.opacity
    }
  })
  assert.deepEqual(
    disabledFilterStyle,
    { borderWidths: ['1px', '1px', '1px', '1px'], opacity: '1' },
    'Disabled options actions should keep a complete neutral outline instead of fading the whole control'
  )
}

async function verifyAvailabilitySettingsPopover(page, extensionId) {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#availability`, { waitUntil: 'domcontentloaded' })
  await page.locator('#availability').waitFor({ state: 'attached' })
  await page.waitForFunction(() => !document.querySelector('#availability')?.hasAttribute('hidden'))

  const settingsTrigger = page.getByRole('button', { name: '检测设置', exact: true })
  await settingsTrigger.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const trigger = [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.trim() === '检测设置')
    return trigger instanceof HTMLButtonElement && !trigger.disabled
  })
  await settingsTrigger.click()

  const settingsPopover = page.locator('#availability-settings-popover')
  await settingsPopover.waitFor({ state: 'visible' })
  await page.getByLabel('并发数').waitFor({ state: 'visible' })
  await page.getByLabel('超时时长（秒）').waitFor({ state: 'visible' })
  assert.equal(await settingsPopover.getByRole('button', { name: '恢复默认' }).isVisible(), true, 'Availability settings reset action should remain visible')
  assert.equal(await settingsPopover.getByRole('button', { name: '保存设置' }).isVisible(), true, 'Availability settings save action should remain visible')

  const placement = await settingsPopover.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const samplePoints = [
      [rect.left + rect.width / 2, rect.top + 16],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.bottom - 16]
    ]
    return {
      bottom: rect.bottom,
      height: rect.height,
      insideAvailabilityPanel: Boolean(element.closest('#availability')),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      topmostAtAllSamples: samplePoints.every(([x, y]) => {
        const topmost = document.elementFromPoint(x, y)
        return Boolean(topmost && element.contains(topmost))
      }),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    }
  })
  assert.equal(placement.insideAvailabilityPanel, false, `Availability settings should render in the top-level portal: ${JSON.stringify(placement)}`)
  assert.equal(placement.topmostAtAllSamples, true, `Availability settings should not be covered by following cards: ${JSON.stringify(placement)}`)
  assert.ok(placement.height >= 220, `Availability settings should expose its complete content: ${JSON.stringify(placement)}`)
  assert.ok(placement.left >= 12 && placement.right <= placement.viewportWidth - 12, `Availability settings should stay inside horizontal viewport bounds: ${JSON.stringify(placement)}`)
  assert.ok(placement.top >= 12 && placement.bottom <= placement.viewportHeight - 12, `Availability settings should stay inside vertical viewport bounds: ${JSON.stringify(placement)}`)
  await captureVisual(page, 'options-availability-settings')
  await page.keyboard.press('Escape')
  await settingsPopover.waitFor({ state: 'hidden' })
}

async function verifyOptionsScopePickers(page, extensionId) {
  const entries = [
    {
      copy: '选择当前检测范围。',
      hash: 'availability',
      screenshot: 'options-availability-folder-scope',
      trigger: '选择检测范围'
    },
    {
      copy: '选择当前历史范围。',
      hash: 'history',
      screenshot: 'options-history-folder-scope',
      trigger: '选择历史范围'
    }
  ]

  for (const entry of entries) {
    await page.setViewportSize({ width: 980, height: 760 })
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html#${entry.hash}`, { waitUntil: 'domcontentloaded' })
    await page.locator(`#${entry.hash}`).waitFor({ state: 'attached' })
    await page.waitForFunction((sectionId) => !document.getElementById(sectionId)?.hasAttribute('hidden'), entry.hash)

    const trigger = page.getByRole('button', { name: entry.trigger, exact: true })
    await trigger.waitFor({ state: 'visible' })
    await page.waitForFunction((label) => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.getAttribute('aria-label') === label)
      return button instanceof HTMLButtonElement && !button.disabled
    }, entry.trigger)
    const triggerBox = await trigger.boundingBox()
    assert.ok(triggerBox, `${entry.trigger} should be measurable before press feedback`)
    const pressBefore = await trigger.evaluate((button) => {
      const row = button.parentElement
      const group = row?.parentElement
      const read = (element) => {
        if (!(element instanceof HTMLElement)) return null
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          height: rect.height,
          scale: style.scale,
          transform: style.transform,
          width: rect.width
        }
      }
      return { button: read(button), group: read(group), row: read(row) }
    })
    await page.mouse.move(
      triggerBox.x + triggerBox.width / 2,
      triggerBox.y + triggerBox.height / 2
    )
    await page.mouse.down()
    await waitForFrames(page)
    const pressDuring = await trigger.evaluate((button) => {
      const row = button.parentElement
      const group = row?.parentElement
      const read = (element) => {
        if (!(element instanceof HTMLElement)) return null
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          height: rect.height,
          scale: style.scale,
          transform: style.transform,
          width: rect.width
        }
      }
      return { button: read(button), group: read(group), row: read(row) }
    })
    for (const [label, before, during] of [
      ['full option row', pressBefore.row, pressDuring.row],
      ['surrounding range block', pressBefore.group, pressDuring.group]
    ]) {
      assert.equal(
        during?.transform,
        before?.transform,
        `${entry.trigger} press feedback must not transform the ${label}`
      )
      assert.equal(
        during?.scale,
        before?.scale,
        `${entry.trigger} press feedback must not scale the ${label}`
      )
      assert.ok(
        Math.abs(Number(during?.width) - Number(before?.width)) < 0.1 &&
          Math.abs(Number(during?.height) - Number(before?.height)) < 0.1,
        `${entry.trigger} press feedback must not resize the ${label}`
      )
    }
    assert.ok(
      pressDuring.button?.transform !== pressBefore.button?.transform ||
        pressDuring.button?.scale !== pressBefore.button?.scale,
      `${entry.trigger} should keep direct button press feedback`
    )
    await page.mouse.up()

    const modal = page.getByRole('dialog', { name: '选择筛选文件夹' })
    const searchSurface = page.locator('label[for="scope-search-input"]')
    const results = page.locator('#scope-folder-results')
    await modal.waitFor({ state: 'visible' })
    await page.getByText(entry.copy, { exact: true }).waitFor({ state: 'visible' })
    await results.getByRole('treeitem').first().waitFor({ state: 'visible' })

    const visualHierarchy = await page.evaluate(() => {
      const search = document.querySelector('label[for="scope-search-input"]')
      const searchInput = document.getElementById('scope-search-input')
      const tree = document.getElementById('scope-folder-results')
      const modal = document.querySelector('.options-modal-wide-panel')
      if (
        !(search instanceof HTMLElement) ||
        !(searchInput instanceof HTMLElement) ||
        !(tree instanceof HTMLElement) ||
        !(modal instanceof HTMLElement)
      ) {
        return null
      }
      const modalStyle = getComputedStyle(modal)
      const searchStyle = getComputedStyle(search)
      const searchInputStyle = getComputedStyle(searchInput)
      const treeStyle = getComputedStyle(tree)
      const rowBackgrounds = [...tree.querySelectorAll('[role="treeitem"]')]
        .map((row) => getComputedStyle(row).backgroundColor)
        .filter((color) => color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')
      return {
        folderIcons: tree.querySelectorAll('.folder-picker-card > svg').length,
        modalBackground: modalStyle.backgroundColor,
        raisedRows: rowBackgrounds.length,
        resultsBackground: treeStyle.backgroundColor,
        resultsBorderBottom: treeStyle.borderBottomWidth,
        resultsBorderLeft: treeStyle.borderLeftWidth,
        resultsBorderRight: treeStyle.borderRightWidth,
        resultsBorderTop: treeStyle.borderTopWidth,
        searchBackground: searchStyle.backgroundColor,
        searchBorderTop: searchStyle.borderTopWidth,
        searchInputBackground: searchInputStyle.backgroundColor,
        searchInputBorderTop: searchInputStyle.borderTopWidth,
        searchInputBoxShadow: searchInputStyle.boxShadow
      }
    })
    assert.ok(visualHierarchy, 'Folder scope picker surfaces should be measurable')
    assert.equal(visualHierarchy.searchBackground, 'rgba(0, 0, 0, 0)', `Folder search should not add a nested card surface: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.searchBorderTop, '0px', `Folder search wrapper should not add a card border: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.modalBackground, 'rgb(31, 31, 31)', `Folder modal should use the softer charcoal surface: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.searchInputBackground, 'rgb(41, 41, 41)', `Folder search should sit one tone above the modal: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.searchInputBoxShadow, 'none', `Folder search should use one focus indicator instead of a double ring: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.searchInputBorderTop, '1px', `Folder search should retain a single focus border: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.resultsBackground, 'rgba(0, 0, 0, 0)', `Folder tree should share the modal surface: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.resultsBorderLeft, '0px', `Folder tree should not look like an inset card: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.resultsBorderRight, '0px', `Folder tree should not look like an inset card: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.resultsBorderTop, '1px', `Folder tree should retain a top separator: ${JSON.stringify(visualHierarchy)}`)
    assert.equal(visualHierarchy.resultsBorderBottom, '1px', `Folder tree should retain a bottom separator: ${JSON.stringify(visualHierarchy)}`)
    assert.ok(visualHierarchy.folderIcons >= 1, `Folder rows should use familiar folder icons: ${JSON.stringify(visualHierarchy)}`)
    assert.ok(visualHierarchy.raisedRows <= 1, `Only the current folder may use a selected surface: ${JSON.stringify(visualHierarchy)}`)
    await captureVisual(page, entry.screenshot)
    await page.keyboard.press('Escape')
    await modal.waitFor({ state: 'hidden' })
  }
}

async function verifySharedOverlayMotion(page, extensionId) {
  await page.setViewportSize({ width: 1180, height: 780 })
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html#general`, { waitUntil: 'domcontentloaded' })
  const trigger = page.getByRole('button', { name: '选择 AI 模型', exact: true })
  await trigger.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="选择 AI 模型"]')
    return button instanceof HTMLButtonElement && !button.disabled
  })

  const openRecording = await recordAnimationFrames(page, 'Shared model selector open', 320, async () => {
    await trigger.click()
    await page.locator('.model-selector-content').waitFor({ state: 'visible' })
  })
  assert.ok(openRecording.frames.frames >= 10, `Model selector open should span observable compositor frames: ${JSON.stringify(openRecording.frames)}`)
  await page.waitForFunction(() => {
    const panel = document.querySelector('.model-selector-content')
    const backdrop = document.querySelector('.model-selector-backdrop')
    return panel?.hasAttribute('data-open') &&
      backdrop?.hasAttribute('data-open') &&
      panel.getAnimations().length === 0 &&
      backdrop.getAnimations().length === 0
  })

  const openState = await page.evaluate(() => {
    const panel = document.querySelector('.model-selector-content')
    const backdrop = document.querySelector('.model-selector-backdrop')
    if (!(panel instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) return null
    const panelStyle = getComputedStyle(panel)
    return {
      backdropShared: backdrop.classList.contains('t-modal-backdrop'),
      panelShared: panel.classList.contains('curator-overlay-panel--dialog'),
      transitionProperty: panelStyle.transitionProperty,
      transform: panelStyle.transform
    }
  })
  assert.ok(openState?.backdropShared && openState.panelShared, `Model selector should use shared dialog presence: ${JSON.stringify(openState)}`)
  assert.match(openState.transitionProperty, /opacity/, 'Shared model selector should fade on the compositor')
  assert.match(openState.transitionProperty, /transform/, 'Shared model selector should scale on the compositor')

  const listStartGeometry = await page.evaluate(() => {
    const list = document.querySelector('.model-selector-list')
    const empty = document.querySelector('.model-selector-empty')
    const firstGroup = document.querySelector('.model-selector-group')
    if (!(list instanceof HTMLElement) || !(empty instanceof HTMLElement) || !(firstGroup instanceof HTMLElement)) {
      return null
    }
    const listRect = list.getBoundingClientRect()
    const emptyRect = empty.getBoundingClientRect()
    const firstGroupRect = firstGroup.getBoundingClientRect()
    return {
      emptyHeight: emptyRect.height,
      firstGroupOffset: firstGroupRect.top - listRect.top,
      listPaddingTop: Number.parseFloat(getComputedStyle(list).paddingTop)
    }
  })
  assert.ok(listStartGeometry, 'Model selector list start should be measurable')
  assert.ok(
    listStartGeometry.emptyHeight <= 0.5,
    `Populated model selector should collapse its empty-state live region: ${JSON.stringify(listStartGeometry)}`
  )
  assert.ok(
    Math.abs(listStartGeometry.firstGroupOffset - listStartGeometry.listPaddingTop) <= 1,
    `First model group should start directly after the list padding: ${JSON.stringify(listStartGeometry)}`
  )
  await captureVisual(page, 'options-model-selector')

  const modelSearchInput = page.getByPlaceholder('Search models…')
  await modelSearchInput.fill('__curator_missing_model__')
  await page.getByText('没有匹配的模型。', { exact: true }).waitFor({ state: 'visible' })
  const visibleEmptyHeight = await page.locator('.model-selector-empty').evaluate((element) =>
    element.getBoundingClientRect().height
  )
  assert.ok(visibleEmptyHeight >= 56, `Model selector empty result should retain readable padding: ${visibleEmptyHeight}`)
  await modelSearchInput.fill('')
  await page.locator('.model-selector-group').first().waitFor({ state: 'visible' })

  const exitProbe = page.evaluate(() => new Promise((resolve) => {
    const panel = document.querySelector('.model-selector-content')
    const backdrop = document.querySelector('.model-selector-backdrop')
    let panelEnding = false
    let backdropEnding = false
    let together = false
    const startedAt = performance.now()
    const sample = (now) => {
      panelEnding ||= panel?.hasAttribute('data-ending-style') || false
      backdropEnding ||= backdrop?.hasAttribute('data-ending-style') || false
      together ||= Boolean(panel?.hasAttribute('data-ending-style') && backdrop?.hasAttribute('data-ending-style'))
      if (now - startedAt < 240) {
        requestAnimationFrame(sample)
        return
      }
      resolve({ backdropEnding, panelEnding, together })
    }
    requestAnimationFrame(sample)
  }))
  await page.keyboard.press('Escape')
  const exit = await exitProbe
  assert.ok(exit.panelEnding && exit.backdropEnding && exit.together, `Shared model selector panel and backdrop should exit together: ${JSON.stringify(exit)}`)
  await page.locator('.model-selector-content').waitFor({ state: 'detached' })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  const reducedPanel = page.locator('.model-selector-content')
  await reducedPanel.waitFor({ state: 'visible' })
  const reducedState = await reducedPanel.evaluate((element) => {
    const style = getComputedStyle(element)
    const durationMs = style.transitionDuration
      .split(',')
      .map((value) => value.trim())
      .reduce((maximum, value) => {
        const parsed = Number.parseFloat(value)
        const milliseconds = value.endsWith('ms') ? parsed : parsed * 1000
        return Math.max(maximum, milliseconds)
      }, 0)
    return { durationMs, transform: style.transform }
  })
  assert.equal(reducedState.transform, 'none', `Reduced motion should remove model selector scale: ${JSON.stringify(reducedState)}`)
  assert.ok(reducedState.durationMs <= 80.5, `Reduced motion should cap model selector feedback at 80ms: ${JSON.stringify(reducedState)}`)
  await page.keyboard.press('Escape')
  await reducedPanel.waitFor({ state: 'detached' })
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const aiSettingsStorageKey = 'curatorBookmarkAiNamingSettings'
  const originalAiSettings = await page.evaluate(async (storageKey) => {
    const stored = await chrome.storage.local.get(storageKey)
    return stored[storageKey]
  }, aiSettingsStorageKey)
  const openModelCatalog = async (fetchedModels) => {
    await page.evaluate(async ({ fetchedModels: nextFetchedModels, storageKey }) => {
      const stored = await chrome.storage.local.get(storageKey)
      await chrome.storage.local.set({
        [storageKey]: {
          ...(stored[storageKey] || {}),
          customModels: ['custom-only-model'],
          fetchedModels: nextFetchedModels,
          model: 'gpt-5'
        }
      })
    }, { fetchedModels, storageKey: aiSettingsStorageKey })
    await page.reload({ waitUntil: 'domcontentloaded' })
    const catalogTrigger = page.getByRole('button', { name: '选择 AI 模型', exact: true })
    await catalogTrigger.waitFor({ state: 'visible' })
    await page.waitForFunction(() => {
      const button = document.querySelector('button[aria-label="选择 AI 模型"]')
      return button instanceof HTMLButtonElement && !button.disabled
    })
    await catalogTrigger.click()
    await page.locator('.model-selector-content').waitFor({ state: 'visible' })
    return page.locator('.model-selector-content [data-ai-model-id]').allTextContents()
  }

  try {
    const fetchedCatalogLabels = await openModelCatalog(['remote-model-alpha', 'remote-model-beta'])
    assert.deepEqual(
      fetchedCatalogLabels.map((label) => label.replace('已拉取', '').trim()),
      ['remote-model-alpha', 'remote-model-beta'],
      `Successful model fetch should replace presets and custom fallbacks: ${JSON.stringify(fetchedCatalogLabels)}`
    )
    assert.ok(
      fetchedCatalogLabels.every((label) => label.includes('已拉取') && !label.includes('预设')),
      `Fetched catalog items should only use fetched-source metadata: ${JSON.stringify(fetchedCatalogLabels)}`
    )
    await captureVisual(page, 'options-model-selector-fetched-only')

    const fallbackCatalogLabels = await openModelCatalog([])
    assert.ok(
      fallbackCatalogLabels.some((label) => label.includes('gpt-5.6-sol') && label.includes('预设')),
      `Empty model fetch should retain preset fallbacks: ${JSON.stringify(fallbackCatalogLabels)}`
    )
    assert.ok(
      fallbackCatalogLabels.every((label) => !label.includes('remote-model-')),
      `Empty model fetch should not retain stale fetched candidates: ${JSON.stringify(fallbackCatalogLabels)}`
    )
  } finally {
    await page.evaluate(async ({ originalSettings, storageKey }) => {
      if (originalSettings === undefined) {
        await chrome.storage.local.remove(storageKey)
        return
      }
      await chrome.storage.local.set({ [storageKey]: originalSettings })
    }, { originalSettings: originalAiSettings, storageKey: aiSettingsStorageKey })
  }
}

async function dispatchTouch(client, type, points) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      id: point.id ?? 1,
      x: Math.round(point.x),
      y: Math.round(point.y),
      radiusX: 2,
      radiusY: 2,
      force: 1
    }))
  })
}

async function observeGhostSettle(page, selector) {
  return page.evaluate((ghostSelector) => new Promise((resolve) => {
    const startedAt = performance.now()
    let frames = 0
    let sawGhost = false
    const sample = (now) => {
      const ghost = document.querySelector(ghostSelector)
      if (ghost) {
        sawGhost = true
        frames += 1
      } else if (sawGhost) {
        resolve({ elapsed: now - startedAt, frames })
        return
      }
      if (now - startedAt > 900) {
        resolve({ elapsed: now - startedAt, frames })
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }), selector)
}

async function observeBookmarkDropContinuity(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const getLiveTiles = () => [...document.querySelectorAll('.bookmark-tile[data-bookmark-id]:not(.bookmark-drag-ghost)')]
    const baselineRects = new Map(getLiveTiles().map((element) => {
      const rect = element.getBoundingClientRect()
      return [element.getAttribute('data-bookmark-id'), {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      }]
    }))
    const startedAt = performance.now()
    let maxDisplacement = 0
    let maxDisplacementBookmarkId = ''
    let maxDisplacementFrame = null

    const sample = (now) => {
      for (const element of getLiveTiles()) {
        const bookmarkId = element.getAttribute('data-bookmark-id') || ''
        if (!bookmarkId) {
          continue
        }
        const baseline = baselineRects.get(bookmarkId)
        if (!baseline) {
          continue
        }
        const rect = element.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const displacement = Math.hypot(centerX - baseline.centerX, centerY - baseline.centerY)
        if (displacement > maxDisplacement) {
          maxDisplacement = displacement
          maxDisplacementBookmarkId = bookmarkId
          const style = getComputedStyle(element)
          maxDisplacementFrame = {
            baseline,
            className: element.className,
            computedTransform: style.transform,
            centerX,
            centerY,
            inlineTransform: element.style.transform,
            transition: style.transition,
            elapsed: now - startedAt
          }
        }
      }

      if (now - startedAt < 480) {
        requestAnimationFrame(sample)
        return
      }
      resolve({ maxDisplacement, maxDisplacementBookmarkId, maxDisplacementFrame })
    }

    requestAnimationFrame(sample)
  }))
}

async function verifyTouchDrag(page, client, {
  container,
  ghost,
  handle,
  target,
  verifyDropContinuity = false
}) {
  await page.locator(container).first().scrollIntoViewIfNeeded()
  await waitForFrames(page)
  const source = page.locator(container).first()
  const sourceHandle = page.locator(handle).first()
  const targetItem = page.locator(target).nth(1)
  const [sourceBox, handleBox, targetBox] = await Promise.all([
    source.boundingBox(),
    sourceHandle.boundingBox(),
    targetItem.boundingBox()
  ])
  assert.ok(sourceBox && handleBox && targetBox, `Touch drag geometry should exist for ${container}`)
  const start = { x: Math.round(handleBox.x + Math.min(8, handleBox.width / 2)), y: Math.round(handleBox.y + handleBox.height / 2), id: 1 }
  const destination = { x: Math.round(targetBox.x + targetBox.width / 2), y: Math.round(targetBox.y + targetBox.height / 2), id: 1 }
  const grabOffset = { x: start.x - sourceBox.x, y: start.y - sourceBox.y }

  await dispatchTouch(client, 'touchStart', [start])
  await page.waitForTimeout(350)
  await page.locator(ghost).waitFor({ state: 'attached', timeout: 2_000 })
  await dispatchTouch(client, 'touchMove', [destination])
  await waitForFrames(page)
  const ghostBox = await page.locator(ghost).boundingBox()
  assert.ok(ghostBox, `Drag preview should remain visible for ${container}`)
  const expectedGhost = { x: destination.x - grabOffset.x, y: destination.y - grabOffset.y }
  const ghostDiagnostics = await page.locator(ghost).evaluate((element) => ({
    computedTransform: getComputedStyle(element).transform,
    devicePixelRatio: window.devicePixelRatio,
    inlineTransform: element.style.transform,
    rootScrollLeft: document.getElementById('newtab-root')?.scrollLeft || 0,
    rootScrollTop: document.getElementById('newtab-root')?.scrollTop || 0,
    viewportOffsetLeft: window.visualViewport?.offsetLeft || 0,
    viewportScale: window.visualViewport?.scale || 1
  }))
  assert.ok(
    Math.abs(ghostBox.x - expectedGhost.x) <= 2,
    `Drag preview should preserve horizontal grab offset for ${container}: ${JSON.stringify({ actual: ghostBox.x, expected: expectedGhost.x, grabOffset, sourceBox, handleBox, destination, ghostDiagnostics })}`
  )
  assert.ok(
    Math.abs(ghostBox.y - expectedGhost.y) <= 2,
    `Drag preview should preserve vertical grab offset for ${container}: ${JSON.stringify({ actual: ghostBox.y, expected: expectedGhost.y, grabOffset })}`
  )

  if (verifyDropContinuity) {
    await page.waitForTimeout(180)
  }

  const settleProbe = observeGhostSettle(page, ghost)
  const continuityProbe = verifyDropContinuity
    ? observeBookmarkDropContinuity(page)
    : null
  await dispatchTouch(client, 'touchEnd', [])
  const settle = await settleProbe
  assert.ok(settle.frames >= 3 && settle.elapsed >= 80 && settle.elapsed < 900, `Drop preview should visibly settle before removal for ${container}`)
  if (continuityProbe) {
    const continuity = await continuityProbe
    assert.ok(
      continuity.maxDisplacement <= 2,
      `Bookmark drop should not replay preview offsets after DOM reorder: ${JSON.stringify(continuity)}`
    )
  }
  await page.waitForTimeout(100)
}

async function verifyTouchAndKeyboard(page, context, extensionId) {
  await page.setViewportSize({ width: 1000, height: 720 })
  await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded' })
  await page.locator('.bookmark-tile').first().waitFor({ state: 'visible', timeout: 20_000 })
  await page.locator('.newtab-speed-dial-card').first().waitFor({ state: 'visible' })
  await page.locator('[data-folder-drag-handle]').first().waitFor({ state: 'visible' })
  assert.equal(
    await page.locator('.newtab-content').getAttribute('data-browse-mode'),
    'expanded',
    'Bookmark drop continuity regression must run against expanded browse mode'
  )
  const client = await context.newCDPSession(page)

  await verifyTouchDrag(page, client, {
    container: '.bookmark-tile',
    ghost: '.bookmark-drag-ghost',
    handle: '[data-bookmark-drag-handle]',
    target: '.bookmark-tile',
    verifyDropContinuity: true
  })

  if (bookmarkDropContinuityOnly) {
    await client.detach()
    return
  }

  const shell = page.locator('#newtab-root')
  await shell.evaluate((element) => { element.scrollTop = 0 })
  const card = page.locator('.bookmark-tile').first()
  await card.scrollIntoViewIfNeeded()
  const cardBox = await card.boundingBox()
  assert.ok(cardBox, 'A bookmark card should be available for the touch scroll probe')
  const dragHandleBox = await card.locator('[data-bookmark-drag-handle]').boundingBox()
  assert.ok(dragHandleBox, 'The bookmark drag handle should be measurable for the touch scroll probe')
  assert.ok(
    dragHandleBox.x >= cardBox.x + cardBox.width - dragHandleBox.width - 4,
    `The bookmark drag handle should stay on the card's trailing edge: ${JSON.stringify({ cardBox, dragHandleBox })}`
  )
  const scrollStart = { x: cardBox.x + 18, y: cardBox.y + cardBox.height / 2, id: 1 }
  await dispatchTouch(client, 'touchStart', [scrollStart])
  for (let step = 1; step <= 5; step += 1) {
    await dispatchTouch(client, 'touchMove', [{ ...scrollStart, y: scrollStart.y - step * 18 }])
    await page.waitForTimeout(18)
  }
  await dispatchTouch(client, 'touchEnd', [])
  await page.waitForTimeout(120)
  assert.ok(await shell.evaluate((element) => element.scrollTop) > 12, 'Vertical touch movement on a bookmark body should scroll instead of starting drag')

  await page.locator('.bookmark-tile').first().scrollIntoViewIfNeeded()
  const cancelHandle = page.locator('[data-bookmark-drag-handle]').first()
  const cancelBox = await cancelHandle.boundingBox()
  assert.ok(cancelBox, 'The coarse-pointer bookmark drag handle should be visible')
  const cancelStart = { x: cancelBox.x + cancelBox.width / 2, y: cancelBox.y + cancelBox.height / 2, id: 1 }
  const beforeFeedback = await cancelHandle.evaluate((element) => getComputedStyle(element).backgroundColor)
  await dispatchTouch(client, 'touchStart', [cancelStart])
  await page.waitForTimeout(70)
  const pendingFeedback = await cancelHandle.evaluate((element) => getComputedStyle(element).backgroundColor)
  assert.notEqual(pendingFeedback, beforeFeedback, 'Long-press pending state should provide feedback within 100ms')
  await dispatchTouch(client, 'touchMove', [{ ...cancelStart, y: cancelStart.y + 16 }])
  await page.waitForTimeout(340)
  assert.equal(await page.locator('.bookmark-drag-ghost').count(), 0, 'Movement before long press should cancel bookmark drag')
  await dispatchTouch(client, 'touchEnd', [])

  await verifyTouchDrag(page, client, {
    container: '.newtab-speed-dial-card',
    ghost: '.speed-dial-drag-ghost',
    handle: '[data-speed-dial-drag-handle]',
    target: '.newtab-speed-dial-card'
  })
  await verifyTouchDrag(page, client, {
    container: '[data-folder-drag-handle]',
    ghost: '.folder-drag-ghost',
    handle: '[data-folder-drag-handle]',
    target: '[data-folder-drag-handle]'
  })

  const keyboardCases = [
    { selector: '.newtab-speed-dial-card', key: 'Alt+ArrowRight' },
    { selector: '.bookmark-tile', key: 'Alt+ArrowRight' },
    { selector: '[data-folder-drag-handle]', key: 'Alt+ArrowDown' }
  ]
  for (const keyboardCase of keyboardCases) {
    const item = page.locator(keyboardCase.selector).first()
    await item.scrollIntoViewIfNeeded()
    const identity = await item.evaluate((element) => element.getAttribute('data-bookmark-id') || element.getAttribute('data-folder-drag-handle'))
    await item.focus()
    await page.keyboard.press(keyboardCase.key)
    await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((element) => element.textContent?.includes('移动')))
    const focusedIdentity = await page.evaluate(() => document.activeElement?.getAttribute('data-bookmark-id') || document.activeElement?.getAttribute('data-folder-drag-handle'))
    assert.equal(focusedIdentity, identity, `Keyboard reorder should keep focus on ${keyboardCase.selector}`)
  }

  const newtabSearch = page.locator('.newtab-search-input')
  const newtabSearchForm = page.locator('.newtab-search')
  const closedSearchClipPath = await newtabSearchForm.evaluate((element) => getComputedStyle(element).clipPath)
  await newtabSearch.fill('Curator Smoke')
  await page.waitForFunction(() => document.querySelectorAll('#newtab-search-suggestions .newtab-search-suggestion').length >= 3)
  await waitForFrames(page)
  const openSearchShape = await newtabSearchForm.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      bottomLeftRadius: style.borderBottomLeftRadius,
      bottomRightRadius: style.borderBottomRightRadius,
      className: element.className,
      clipPath: style.clipPath
    }
  })
  assert.ok(openSearchShape.className.includes('is-panel-open'), 'The visible suggestions panel should mark the search form itself as open')
  assert.equal(openSearchShape.bottomLeftRadius, '0px', 'The open search form should flatten its bottom-left corner')
  assert.equal(openSearchShape.bottomRightRadius, '0px', 'The open search form should flatten its bottom-right corner')
  assert.notEqual(openSearchShape.clipPath, closedSearchClipPath, 'The squircle engine should recompute the search outline when suggestions open')
  const searchGeometry = await page.evaluate(() => {
    const form = document.querySelector('.newtab-search')?.getBoundingClientRect()
    const panel = document.querySelector('.newtab-search-suggestions-panel:not([hidden])')?.getBoundingClientRect()
    return form && panel
      ? {
          formLeft: form.left,
          formWidth: form.width,
          panelLeft: panel.left,
          panelWidth: panel.width
        }
      : null
  })
  assert.ok(searchGeometry, 'The visible search form and suggestions panel should expose measurable geometry')
  assert.ok(
    Math.abs(searchGeometry.formLeft - searchGeometry.panelLeft) <= 1 &&
      Math.abs(searchGeometry.formWidth - searchGeometry.panelWidth) <= 1,
    `Search suggestions should align with the search form: ${JSON.stringify(searchGeometry)}`
  )
  const activeSuggestionBefore = await newtabSearch.getAttribute('aria-activedescendant')
  await recordAnimationFrames(page, 'New Tab search suggestion navigation', 500, async () => {
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(18)
    }
  })
  const activeSuggestionAfter = await newtabSearch.getAttribute('aria-activedescendant')
  assert.notEqual(activeSuggestionAfter, activeSuggestionBefore, 'New Tab suggestion navigation should update the active option immediately')
  assert.ok(activeSuggestionAfter, 'New Tab suggestion navigation should expose an active option id')
  const activeSuggestionStyle = await page.locator(`#${activeSuggestionAfter}`).evaluate((element) => {
    const style = getComputedStyle(element)
    const meta = element.querySelector('.newtab-search-suggestion-meta')
    const mark = element.querySelector('.newtab-search-suggestion-mark')
    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      markBackgroundColor: mark ? getComputedStyle(mark).backgroundColor : '',
      metaColor: meta ? getComputedStyle(meta).color : ''
    }
  })
  assert.equal(
    activeSuggestionStyle.backgroundColor,
    'rgba(255, 255, 255, 0.16)',
    `The active New Tab suggestion should use a clearly differentiated selected surface: ${JSON.stringify(activeSuggestionStyle)}`
  )
  assert.match(activeSuggestionStyle.boxShadow, /inset/, 'The active New Tab suggestion should have a full inset selection outline')
  assert.equal(activeSuggestionStyle.markBackgroundColor, 'rgba(245, 245, 247, 0.14)', 'The active suggestion mark should be visibly elevated')
  assert.equal(activeSuggestionStyle.metaColor, 'rgba(245, 245, 247, 0.86)', 'The active suggestion metadata should remain readable')
  await page.locator(`#${activeSuggestionAfter}`).hover()
  await page.waitForFunction(
    (id) => {
      const element = document.getElementById(id)
      return element && getComputedStyle(element).backgroundColor === 'rgba(255, 255, 255, 0.16)'
    },
    activeSuggestionAfter
  )
  assert.equal(
    await page.locator(`#${activeSuggestionAfter}`).evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgba(255, 255, 255, 0.16)',
    'The active suggestion should stay more prominent when the pointer also hovers it'
  )
  await page.keyboard.press('Escape')
}

let context

try {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    hasTouch: true,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  const seeded = await seedExtension(worker)
  const page = await context.newPage()

  if (bookmarkDropContinuityOnly) {
    await verifyTouchAndKeyboard(page, context, extensionId)
    console.log('Expanded bookmark drop continuity test passed.')
  } else if (optionsAvailabilityOnly) {
    await verifyAvailabilitySettingsPopover(page, extensionId)
    console.log('Options availability settings popover test passed.')
  } else if (optionsBordersOnly) {
    await verifyOptionsBorderIntegrity(page, extensionId)
    console.log('Options border integrity tests passed.')
  } else if (optionsRefreshOnly) {
    await verifyOptionsRefreshStability(page, worker, extensionId)
    console.log('Options refresh stability tests passed.')
  } else if (optionsScopePickerOnly) {
    await verifyOptionsScopePickers(page, extensionId)
    console.log('Options folder scope picker tests passed.')
  } else if (optionsReasoningOnly) {
    await verifyOptions(page, extensionId)
    console.log('Options reasoning selector test passed.')
  } else if (overlayMotionOnly) {
    await verifySharedOverlayMotion(page, extensionId)
    console.log('Shared overlay motion tests passed.')
  } else if (popupReorderOnly) {
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, { waitUntil: 'domcontentloaded' })
    await page.locator('#search-help-toggle').waitFor({ state: 'attached' })
    await page.waitForTimeout(350)
    await verifyPopupBookmarkReorder(page, seeded, context)
    console.log('Popup bookmark reorder browser test passed.')
  } else if (collapsibleMotionOnly) {
    await verifyPopup(page, extensionId, seeded)
    await verifyOptions(page, extensionId)
    console.log('Popup and Options collapsible motion tests passed.')
  } else {
    await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { waitUntil: 'domcontentloaded' })
    await page.locator('#newtab-settings-trigger').waitFor({ state: 'attached' })
    await page.waitForTimeout(400)
    await captureNewtabWallpaperVariants(page)
    await verifyNewtabAccessibilityMaterials(page, context)
    await verifyDesktopDrawer(page)
    await verifyNarrowAndReducedMotionDrawer(page)
    await verifyPopup(page, extensionId, seeded)
    await verifyOptions(page, extensionId)
    await verifyTouchAndKeyboard(page, context, extensionId)

    console.log(`Interface performance frame probes: ${JSON.stringify(performanceRecords)}`)
    console.log('Curator interface quality extension smoke tests passed.')
  }
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
