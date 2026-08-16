import { readFileSync } from 'node:fs'

function run(): void {
  const html = readFileSync('src/popup/popup.html', 'utf8')
  const main = readFileSync('src/popup/main.tsx', 'utf8')
  const popupCss = readFileSync('src/popup/popup.css', 'utf8')
  const motionTokens = readFileSync('src/styles/tokens.css', 'utf8')
  const popupChrome = readFileSync('src/popup/components/PopupChromeHost.tsx', 'utf8')
  const popupContent = readFileSync('src/popup/components/PopupContent.tsx', 'utf8')
  const popupController = readFileSync('src/popup/popup-controller.ts', 'utf8')
  const naturalSearchAi = readFileSync('src/popup/natural-search-ai.ts', 'utf8')
  const serviceWorker = readFileSync('src/service-worker/service-worker.ts', 'utf8')
  const popupEmptyState = readFileSync('src/popup/components/PopupEmptyState.tsx', 'utf8')
  const popupSmartClassifier = readFileSync('src/popup/components/PopupSmartClassifier.tsx', 'utf8')
  const pinyinSearch = readFileSync('src/shared/search/pinyin.ts', 'utf8')
  const viteConfig = readFileSync('vite.config.ts', 'utf8')
  const popupSearchRunner = popupController.slice(
    popupController.indexOf('function runSearch()'),
    popupController.indexOf('async function runNaturalSearch')
  )
  const popupNaturalSearchRunner = popupController.slice(
    popupController.indexOf('async function runNaturalSearch'),
    popupController.indexOf('async function resolveCachedNaturalSearchPlan')
  )
  const popupNaturalSearchPlanResolver = popupController.slice(
    popupController.indexOf('async function resolveNaturalSearchPlan'),
    popupController.indexOf('async function searchNaturalQuery')
  )

  assert(html.includes('background: transparent;'), 'critical shell must keep the provisional viewport transparent')
  assert(html.includes('id="popup-preboot-shell"'), 'critical shell must include a preboot search shell')
  assert(html.includes('id="popup-preboot-search-input"'), 'critical shell must include a static search input')
  assert(html.includes('autofocus'), 'preboot search input must accept typing before React mounts')
  assert(viteConfig.includes("const POPUP_PREBOOT_ROUTE = '/popup-preboot.js'"), 'popup preboot script must be emitted as a fixed extension asset')
  assert(viteConfig.includes('html.replace(\'</body>\', `    <script src="${POPUP_PREBOOT_ROUTE}"></script>\\n  </body>`)'), 'preboot input capture must be injected before deferred React modules run')
  assert(html.includes('#popup-root[data-popup-ready="true"]'), 'critical shell must gate popup visibility')
  assert(html.includes('visibility: hidden;'), 'critical shell must hide root before popup styles are ready')
  assert(html.includes('contain: size layout paint;'), 'critical shell must isolate the fixed 800x600 root')
  assert(html.includes('padding: 45px 14px 0;'), 'preboot search must share the React search origin')
  assert(html.includes('height: 40px;') && html.includes('border-radius: 6px;'), 'preboot search must share the React control geometry')
  assert(html.includes('"SF Pro Text"') && html.includes('"Segoe UI Variable Text"') && html.includes('"PingFang SC"'), 'preboot and React must use the same stable platform font fallbacks')
  assert(html.includes('font-family: inherit;') && html.includes('font-weight: 400;') && html.includes('line-height: 1.4;'), 'preboot input must preserve the React font family and text metrics during adoption')
  assert(html.includes('class="popup-preboot-clear-slot"') && html.includes('class="popup-preboot-semantic"'), 'preboot search must reserve the same trailing controls as React')
  assert(/prefers-reduced-transparency:[\s\S]*?\.popup-preboot-search\s*{[\s\S]*?background:\s*#1f1f1f;[\s\S]*?\.popup-preboot-search:focus-within\s*{[\s\S]*?background:\s*#292929;/.test(html), 'reduced-transparency preboot colors must match the React search surface before and during focus')
  assert(popupChrome.includes("'popup-search-shell group/search flex h-10 min-h-10") && popupChrome.includes('text-[14px] font-normal leading-[1.4] tracking-normal'), 'React search must expose fixed first-frame geometry and text metrics')
  assert(popupChrome.includes("data-visible={state.search.clearVisible ? 'true' : 'false'}") && !/\n\s+hidden=\{!state\.search\.clearVisible\}/.test(popupChrome), 'clear-search affordance must reserve its width while hidden')
  assert(popupChrome.includes('w-[76px] min-w-[76px]'), 'semantic-search status labels must not resize the search field')
  assert(!popupCss.includes('--popup-row-actions-open-width') && !popupCss.includes('overflow: hidden;\n  border-radius: var(--ds-radius-sm);'), 'row actions must overlay rather than reflow bookmark titles')
  assert(/\.popup-row-actions\s*\{[^}]*width:\s*var\(--popup-row-actions-width\);/s.test(popupCss) && !/#popup-app-shell\[data-keyboard-nav="true"\] \.popup-row-actions:not\(:focus-within\)\s*\{/.test(popupCss), 'row action hit boxes must keep a fixed overlay width during hover')
  assert(popupContent.includes("'popup-row-copy grid w-full min-w-0 gap-0.5'") && popupContent.includes("padding: '8px var(--popup-row-copy-rest-inset) 8px 13px'"), 'bookmark copy and the collapsed trigger inset must share row-action geometry')
  assert(popupCss.includes('--popup-row-copy-action-overlap: calc(') && /\.popup-main-row:hover:has\([^}]+-webkit-mask-image:\s*linear-gradient\(/s.test(popupCss), 'expanded row actions must fade long bookmark copy before the first quick action')
  assert(popupCss.includes('transform: translate3d(var(--popup-row-actions-slide), 0, 0);') && popupCss.includes('transform: translate3d(0, 0, 0);'), 'row actions must reveal with a compositor-only right-to-left translation')
  assert(/#popup-app-shell\[data-keyboard-nav="true"\][^{]+\.popup-row-copy\s*\{[^}]*mask-image:\s*none;/s.test(popupCss), 'hidden keyboard action rails must not leave bookmark copy masked')
  assert(popupContent.includes('useFixedRowWindow') && popupContent.includes('POPUP_BOOKMARK_ROW_HEIGHT = 80') && popupContent.includes('POPUP_FOLDER_ROW_HEIGHT = 34'), 'large popup trees must window fixed-height rows instead of mounting the full catalog')
  assert(popupContent.includes('mountQuickActions={actionsMounted || row.active}') && popupContent.includes('const quickActions = mountQuickActions'), 'collapsed bookmark rows must defer hidden quick-action controls until interaction')
  assert((popupController.match(/schedulePinyinEnrichment\(/g) || []).length === 2, 'pinyin enrichment must run only from the on-demand query path, not during cold open')
  assert(popupController.includes('batchSize: POPUP_PINYIN_BATCH_SIZE') && popupController.includes('runIdle(startEnrichment'), 'on-demand pinyin enrichment must remain idle-scheduled and cooperatively batched')
  assert(
    popupSearchRunner.indexOf('ensurePinyinEnrichmentForQuery(query)') > 0 &&
      popupSearchRunner.indexOf('ensurePinyinEnrichmentForQuery(query)') < popupSearchRunner.indexOf('state.searchCache.get(cacheKey)'),
    'every search rerun must restore invalidated pinyin enrichment before reading cached results'
  )
  assert(!/runId !== state\.pinyinEnrichmentRunId\) \{\s*state\.pinyinEnrichmentPending = false/.test(popupController), 'stale pinyin jobs must not clear the pending state owned by a newer run')
  assert(
    /changes\[STORAGE_KEYS\.aiProviderSettings\][\s\S]*?state\.searchRunId \+= 1[\s\S]*?abortNaturalSearchRequest\(\)[\s\S]*?clearSearchCaches\(\)[\s\S]*?resetSmartClassification\(\)[\s\S]*?runSearch\(\)/.test(popupController),
    'changing the AI provider or effort must invalidate and rerun popup search and smart-classification state'
  )
  assert(
    /changes\[STORAGE_KEYS\.aiProviderSettings\][\s\S]*?aiProviderSettingsGeneration \+= 1/.test(serviceWorker) &&
      /const requestSettings = await loadCurrentAutoAnalyzeRequestSettings\([\s\S]*?requestAutoClassification\(\{[\s\S]*?settings: requestSettings/.test(serviceWorker),
    'background auto-classification must re-read a stable AI settings generation immediately before its model request'
  )
  const popupPlanRequestIndex = popupNaturalSearchPlanResolver.indexOf('const plan = await naturalSearchAi.requestNaturalSearchAiPlan')
  const popupPlanPostRequestGuardIndex = popupNaturalSearchPlanResolver.indexOf(
    'if (state.searchRunId !== options.runId || options.signal?.aborted)',
    popupPlanRequestIndex
  )
  const popupPlanCacheWriteIndex = popupNaturalSearchPlanResolver.indexOf(
    'state.naturalSearchPlanCache.set(cacheKey, plan)',
    popupPlanRequestIndex
  )
  const popupPlanErrorWriteIndex = popupNaturalSearchPlanResolver.indexOf(
    'state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)',
    popupPlanRequestIndex
  )
  assert(
      popupPlanRequestIndex >= 0 &&
      popupPlanPostRequestGuardIndex > popupPlanRequestIndex &&
      popupPlanPostRequestGuardIndex < popupPlanCacheWriteIndex &&
      popupNaturalSearchPlanResolver.lastIndexOf('options.signal?.aborted', popupPlanErrorWriteIndex) > popupPlanRequestIndex,
    'stale popup AI plans must be rejected before cache or error state can be committed'
  )
  assert(
    popupNaturalSearchRunner.indexOf('const searchRunStillCurrent = state.searchRunId === runId') >
      popupNaturalSearchRunner.indexOf('const resultSets = await Promise.all') &&
      popupNaturalSearchRunner.indexOf('if (!searchRunStillCurrent)') <
        popupNaturalSearchRunner.indexOf('cacheSearchResults(cacheKey, results)'),
    'popup results from a superseded reasoning-settings request must not be cached or rendered'
  )
  assert(
    popupNaturalSearchRunner.includes('controller.signal.aborted') &&
      !popupController.includes('function isAbortError(error)') &&
      !naturalSearchAi.includes('function isNaturalSearchAbortError(error: unknown)'),
    'natural-search cancellation must use its own signal so runtime timeouts remain visible'
  )
  assert(pinyinSearch.includes('Math.max(8, options.batchSize ?? 250)'), 'cooperative pinyin enrichment must honor popup-sized batches below 50 items')
  assert(!popupContent.includes('[will-change:opacity]'), 'initial content layers must not keep permanent compositor hints')
  assert(
    popupContent.includes("'t-skel popup-t-skel popup-workspace-reveal relative h-full min-h-0'") &&
      !popupContent.includes('t-skel-skeleton is-pulsing') &&
      popupContent.includes('popup-skeleton-pulse') &&
      popupContent.includes("isLoading ? '' : 'is-revealed'"),
    'popup workspace loading must keep pane surfaces static while pulsing only placeholder marks'
  )
  assert(popupSmartClassifier.includes('t-skel popup-t-skel popup-page-reveal') && popupSmartClassifier.includes('t-skel-content popup-page-content'), 'current-page loading must use the shared skeleton reveal layers')
  assert(
    motionTokens.includes('--reveal-dur: 180ms') &&
      motionTokens.includes('--reveal-blur: 0px') &&
      popupCss.includes('--reveal-translate-y: var(--distance-micro)') &&
      popupCss.includes('--reveal-dur: 240ms') &&
      popupCss.includes('--reveal-ease: var(--ease-in-out)'),
    'popup skeleton reveal must remain crisp, compositor-only, and token driven'
  )
  assert(/\.t-skel\.popup-t-skel \.t-skel-content\s*\{[^}]*filter:\s*none;[^}]*transform:\s*translate3d/s.test(popupCss), 'popup loaded text must never enter through a large-area blur filter')
  assert(
    /\.t-skel\.popup-workspace-reveal \.t-skel-content,[\s\S]*?transform:\s*none;[\s\S]*?\.t-skel\.popup-workspace-reveal \.t-skel-content\s*\{[^}]*transition:\s*opacity/s.test(popupCss) &&
      /\.popup-workspace-reveal \.popup-skeleton-pulse\s*\{[^}]*animation:\s*t-skel-pulse/s.test(popupCss),
    'dense popup workspace reveal must preserve geometry and limit loading motion to placeholder marks'
  )
  assert(!popupEmptyState.includes('useMotionEntrance') && !popupEmptyState.includes('t-stagger'), 'empty-state meaning must appear immediately without delayed text motion')
  assert(!popupSmartClassifier.includes('<TextSwap animate') && !popupSmartClassifier.includes('<NumberPop'), 'live popup status text must update without replacement motion')
  assert(popupCss.includes('@media (prefers-reduced-transparency: reduce)') && popupCss.includes('@media (prefers-contrast: more)'), 'popup must provide transparency and contrast fallbacks')
  assert(!/#popup-root\s+:where\(\*,\s*\*::before,\s*\*::after\)[\s\S]*?transform:\s*none/.test(popupCss), 'reduced motion must not erase layout or indicator positioning transforms globally')
  assert(main.includes("removeAttribute('data-popup-ready')"), 'popup must hide the last compositor surface before close')
  assert(main.includes("'pagehide'"), 'popup close guard must run before the action popup is discarded')
  assert(main.includes("'visibilitychange'"), 'popup close guard must run when Chrome hides the action popup')
  assert(
    popupController.includes('recycleBin.restoreBookmarkFromRecycleEntry(') &&
      !popupController.includes('await recycleBin.removeRecycleEntry(payload.recycleId)'),
    'popup undo must consume the recycle entry through the shared rollback-safe restore transaction'
  )
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup critical shell tests passed.')
