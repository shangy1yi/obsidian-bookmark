import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const newtabCss = readFileSync('src/newtab/newtab.css', 'utf8')
const globalsCss = readFileSync('src/styles/globals.css', 'utf8')
const bookmarkContent = readFileSync('src/newtab/components/NewtabBookmarkContent.tsx', 'utf8')
const searchWidget = readFileSync('src/newtab/components/NewtabSearchWidget.tsx', 'utf8')
const searchWidgetClasses = readFileSync('src/newtab/components/searchWidgetClasses.ts', 'utf8')
const clockClasses = readFileSync('src/newtab/components/clockClasses.ts', 'utf8')
const searchSettingsStore = readFileSync('src/newtab/newtab-search-settings-store.ts', 'utf8')
const speedDial = readFileSync('src/newtab/components/NewtabSpeedDialPanel.tsx', 'utf8')
const bookmarkIconShell = readFileSync('src/newtab/components/BookmarkIconShell.tsx', 'utf8')
const bookmarkPreboot = readFileSync('src/newtab/newtab-bookmark-preboot.ts', 'utf8')
const newtabApp = readFileSync('src/newtab/NewtabApp.tsx', 'utf8')
const newtabMain = readFileSync('src/newtab/main.tsx', 'utf8')
const newtabStartupData = readFileSync('src/newtab/newtab-startup-data.ts', 'utf8')
const bookmarkEventStore = readFileSync('src/newtab/newtab-bookmark-events-store.ts', 'utf8')
const controller = readFileSync('src/newtab/newtab-controller.ts', 'utf8')
const settingsDrawer = readFileSync('src/newtab/components/SettingsDrawer.tsx', 'utf8')
const settingsDrawerStore = readFileSync('src/newtab/newtab-settings-drawer-store.ts', 'utf8')
const newtabBodyClasses = readFileSync('src/newtab/components/NewtabBodyClassesHost.tsx', 'utf8')
const wallpaperFilter = readFileSync('src/newtab/components/NewtabWallpaperFilterLayer.tsx', 'utf8')
const paperShaderFilter = readFileSync('src/newtab/components/NewtabPaperShaderLayer.tsx', 'utf8')
const backgroundMaskSettings = readFileSync('src/newtab/background-mask-settings.ts', 'utf8')
const viteConfig = readFileSync('vite.config.ts', 'utf8')
const selectSource = readFileSync('src/ui/base/Select.tsx', 'utf8')
const instantWallpaperBoot = readFileSync('src/newtab/instant-wallpaper-boot.ts', 'utf8')
const instantWallpaper = readFileSync('src/newtab/instant-wallpaper.ts', 'utf8')
const newtabHtml = readFileSync('src/newtab/newtab.html', 'utf8')
const bookmarkTileClasses = readFileSync('src/newtab/components/bookmarkTileClasses.ts', 'utf8')
const speedDialClasses = readFileSync('src/newtab/components/speedDialClasses.ts', 'utf8')
const backgroundLayer = readFileSync('src/newtab/components/NewtabBackgroundLayer.tsx', 'utf8')
const newtabButtonClasses = readFileSync('src/newtab/components/newtabButtonClass.ts', 'utf8')

const stableNewtabFontStack = '"Geist", "Geist Sans", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif'
const reducedTransparencyMaskRule = newtabCss.match(
  /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?#newtab-background-mask\s*\{([^}]*)\}/
)?.[1] || ''
const startupReducedTransparencyMaskRule = newtabHtml.match(
  /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?#newtab-background-mask\s*\{([^}]*)\}/
)?.[1] || ''
const searchSurfaceRule = newtabCss.match(/\.newtab-search\s*\{([^}]*)\}/s)?.[1] || ''
const bookmarkTileRule = newtabCss.match(/\.bookmark-tile\s*\{([^}]*)\}/s)?.[1] || ''
const reducedTransparencyOpaqueSelectors = [globalsCss, newtabCss]
  .flatMap((source) => [...source.matchAll(/:where\(\s*([^)]*?)\s*\)\s*\{[^}]*background-color:\s*#161616\s*!important;/g)])
  .map((match) => match[1])
  .join('\n')
const unifiedGlassTokens = newtabCss.match(/:root\s*\{([^}]*)\}/s)?.[1] || ''
const activeSettingsGroupSwitch = controller.slice(
  controller.indexOf('function setActiveSettingsGroup'),
  controller.indexOf('function closeSettingsDrawer')
)

assert.ok(
  newtabHtml.includes(`--newtab-font-sans: ${stableNewtabFontStack}`) &&
    newtabCss.includes(`--newtab-font-sans: ${stableNewtabFontStack}`) &&
    bookmarkPreboot.includes(`font-family: ${stableNewtabFontStack}`) &&
    newtabHtml.includes('font-synthesis: none') &&
    newtabCss.includes('font-synthesis: none') &&
    bookmarkPreboot.includes('font-synthesis: none'),
  'Critical HTML, React New Tab, and bookmark preboot must share one stable font stack and disable synthesized faces.'
)

assert.ok(
  newtabHtml.includes('id="newtab-wallpaper-stage"') &&
    newtabHtml.includes('var(--newtab-runtime-wallpaper-image, var(--instant-wallpaper-image, none))') &&
    newtabHtml.includes('transform: translateZ(0)') &&
    backgroundLayer.includes("RUNTIME_WALLPAPER_IMAGE_PROPERTY = '--newtab-runtime-wallpaper-image'") &&
    !backgroundLayer.includes('data-transitioning="true"') &&
    !backgroundLayer.includes('IMAGE_REVEAL_MS') &&
    !newtabHtml.includes('body::before') &&
    !newtabCss.includes('.newtab-app::before') &&
    !/\.newtab-background-image\s*\{[^}]*will-change:/s.test(newtabCss),
  'Wallpaper rendering must keep one persistent first-frame layer instead of cross-fading and replacing compositor nodes after hydration.'
)

assert.ok(
  newtabCss.includes('@media (prefers-reduced-motion: reduce)') &&
    newtabCss.includes('@media (prefers-reduced-transparency: reduce)') &&
    newtabCss.includes('@media (prefers-contrast: more)') &&
    newtabCss.includes('#newtab-settings-drawer button') &&
    newtabCss.includes(':not(:disabled):active') &&
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#newtab-settings-drawer \.settings-drawer-panel\[data-starting-style\][\s\S]*?transform:\s*none !important/.test(newtabCss) &&
    newtabButtonClasses.includes('transition-[background-color,border-color,color,opacity,transform]') &&
    newtabButtonClasses.includes('active:duration-[var(--ds-motion-feedback)]') &&
    newtabButtonClasses.includes('motion-reduce:active:scale-100'),
  'New Tab controls should respond on pointer-down while honoring reduced motion, mask transparency preferences, and increased contrast.'
)

assert.ok(
  reducedTransparencyMaskRule.includes('backdrop-filter: none !important') &&
    startupReducedTransparencyMaskRule.includes('backdrop-filter: none') &&
    !reducedTransparencyMaskRule.includes('background-color') &&
    !reducedTransparencyMaskRule.includes('background-image') &&
    !startupReducedTransparencyMaskRule.includes('background-color') &&
    !startupReducedTransparencyMaskRule.includes('background-image') &&
    !/@media \(prefers-contrast: more\)[\s\S]*?#newtab-startup-background-mask/.test(newtabHtml),
  'Accessibility preferences may remove mask blur, but must never override the user-selected mask strength or startup gradient.'
)

assert.ok(
  newtabCss.includes('--newtab-glass-bg-hero: var(--newtab-glass-bg-fill)') &&
    !newtabCss.includes('.newtab-app[data-background-media="true"]'),
  'Newtab glass surfaces should share one wallpaper-independent material instead of per-background variants.'
)

assert.ok(
  instantWallpaper.includes('maskEnabled: boolean') &&
    instantWallpaper.includes('maskStyle: BackgroundMaskStyle') &&
    instantWallpaper.includes('maskOverlay: number') &&
    instantWallpaper.includes('maskBlur: number') &&
    instantWallpaperBoot.includes('applyStartupMask(targetRecord, maskSnapshot)') &&
    instantWallpaperBoot.includes('Targets written before mask snapshots existed should fail dark') &&
    newtabHtml.includes('id="newtab-startup-background-mask-style"') &&
    instantWallpaperBoot.includes("--instant-wallpaper-mask-image") &&
    newtabHtml.includes('id="newtab-background-mask"') &&
    newtabHtml.includes('background-color: var(--instant-wallpaper-mask-color, transparent)') &&
    newtabHtml.includes('background-image: var(--instant-wallpaper-mask-image, none)') &&
    newtabHtml.includes('backdrop-filter: var(--instant-wallpaper-mask-filter, none)') &&
    controller.includes('let backgroundSettingsHydrated = false') &&
    controller.includes('ready: backgroundSettingsHydrated') &&
    controller.includes('const shouldSyncBackgroundUi = backgroundSettingsHydrated && !backgroundUiAlreadyApplied') &&
    newtabApp.includes('if (!backgroundSettings.ready) return') &&
    newtabApp.includes("getElementById('newtab-background-mask')") &&
    newtabApp.includes('mask.className = getBackgroundMaskClass(backgroundSettings)') &&
    !newtabApp.includes('removeStartupBackgroundMask()'),
  'The saved background mask must remain the same DOM node from synchronous startup through React settings hydration.'
)

assert.ok(
  instantWallpaper.includes('export function saveBackgroundMaskSnapshot') &&
    instantWallpaper.includes('export function readBackgroundMaskSnapshot') &&
    instantWallpaper.includes("BACKGROUND_MASK_SNAPSHOT_KEY = 'curatorNewTabBackgroundMaskSnapshot'") &&
    controller.includes('saveBackgroundMaskSnapshot({') &&
    instantWallpaperBoot.includes('readRecord<BackgroundMaskSnapshotRecord>(maskSnapshotKey)'),
  'A dedicated mask snapshot must be persisted for every background type so the boot script paints the mask on the first frame, even for solid colors that write no wallpaper target.'
)

assert.ok(
  newtabHtml.includes('<div id="newtab-background-mask"') &&
    !newtabApp.includes('id="newtab-background-mask"') &&
    !newtabApp.includes("removeAttribute('data-mask-initial')") &&
    !/newtab-background-mask[^']*transition:/.test(newtabApp),
  'The background mask must be a persistent non-animated HTML layer, not a startup node replaced by React.'
)

assert.ok(
  selectSource.includes("base-select-popup t-dropdown overflow-y-auto overscroll-contain") &&
    selectSource.includes('max-h-64 min-w-[var(--anchor-width)] overflow-y-auto overscroll-contain'),
  'Long select popups should keep their height constraint and expose a wheel-scrollable overflow container.'
)

assert.ok(
  settingsDrawer.includes('data-starting-style:[transform:translateX(100%)]') &&
    settingsDrawer.includes('data-ending-style:[transform:translateX(100%)]') &&
    settingsDrawer.includes('[transform:translateX(var(--drawer-swipe-movement-x))]') &&
    !controller.includes('primeSettingsDrawerOpenTransition') &&
    !controller.includes('panel.getBoundingClientRect()'),
  'The settings drawer should use Base UI starting and ending styles instead of measuring a hidden popup.'
)

assert.ok(
  settingsDrawerStore.includes('useNewtabSettingsDrawerOpen(): boolean') &&
    settingsDrawerStore.includes('useUiViewStoreSlice(settingsDrawerStore, (view) => view.open)') &&
    newtabApp.includes('useNewtabSettingsDrawerOpen') &&
    !newtabApp.includes('useNewtabSettingsDrawerView') &&
    newtabBodyClasses.includes('useNewtabSettingsDrawerOpen') &&
    !newtabBodyClasses.includes('useNewtabSettingsDrawerView') &&
    activeSettingsGroupSwitch.includes("dispatchNewtabSettingsDrawerScrollTop('auto')") &&
    !activeSettingsGroupSwitch.includes('syncActiveSettingsGroupControls') &&
    /id="folder-candidates-panel"[\s\S]*?keepMounted=\{false\}/.test(settingsDrawer) &&
    settingsDrawer.includes('data-squircle-subtree="off"') &&
    /\.folder-candidate-card\s*\{[^}]*content-visibility:\s*auto;[^}]*contain-intrinsic-size:\s*auto 56px;/s.test(newtabCss),
  'Settings tab changes must avoid app-wide subscriptions, repeated control reconstruction, smooth scrolling, and mounted hidden candidates.'
)

assert.ok(
  [
    'dark', 'frosted', 'noise', 'light', 'grain', 'halftone', 'ascii',
    'paper-texture', 'fluted-glass', 'water', 'image-dithering', 'halftone-dots', 'halftone-cmyk'
  ].every((style) =>
    backgroundMaskSettings.includes(`'${style}'`)
  ) &&
    [
      '深色渐变', '磨砂玻璃', '胶片噪点', '柔光渐变', '胶片颗粒', '单色网点',
      'ASCII 字符', '纸张纹理', '条纹玻璃', '水面折射', '图像抖动', '彩色网点', 'CMYK 网点'
    ].every((label) => settingsDrawer.includes(`label: '${label}'`)) &&
    !settingsDrawer.includes("label: 'Paper ·") &&
    !settingsDrawer.includes("label: '颗粒滤镜'") &&
    !settingsDrawer.includes("label: '网点滤镜'") &&
    !settingsDrawer.includes("label: 'ASCII 滤镜'") &&
    settingsDrawer.includes('遮罩效果') &&
    settingsDrawer.includes('悬停效果') &&
    settingsDrawer.includes("ticks={['透明', '默认', '覆盖']}"),
  'The background mask selector should retain every style with concise, consistently structured labels.'
)

assert.ok(
  paperShaderFilter.includes("import('@paper-design/shaders-react')") &&
    paperShaderFilter.includes('<PaperTexture') &&
    paperShaderFilter.includes('<FlutedGlass') &&
    paperShaderFilter.includes('<Water') &&
    paperShaderFilter.includes('<ImageDithering') &&
    paperShaderFilter.includes('<HalftoneDots') &&
    paperShaderFilter.includes('<HalftoneCmyk') &&
    paperShaderFilter.includes("getContext('webgl2')") &&
    paperShaderFilter.includes('useShaderImageSource') &&
    paperShaderFilter.includes("media.kind === 'video'") &&
    paperShaderFilter.includes('originX:') &&
    newtabApp.indexOf('<NewtabPaperShaderLayer />') < newtabApp.indexOf('id="newtab-background-mask-host"') &&
    newtabApp.includes('host.append(mask)'),
  'Paper image shaders should render in the wallpaper filter stack below the readability mask.'
)

assert.ok(
  wallpaperFilter.includes("ASCII_CHARS = '  .,:;irsXA253hMHGS#9B&@'") &&
    wallpaperFilter.includes('drawGrain') &&
    wallpaperFilter.includes('drawHalftone') &&
  wallpaperFilter.includes('drawAscii') &&
    wallpaperFilter.includes("FILTER_BACKGROUND_COLOR = '#101013'") &&
    wallpaperFilter.includes('getHoverInfluence') &&
    wallpaperFilter.includes('hoverRenderFrame = window.requestAnimationFrame') &&
    wallpaperFilter.includes('asciiGlyphMetricsCache') &&
    newtabApp.indexOf('<NewtabWallpaperFilterLayer />') < newtabApp.indexOf('id="newtab-background-mask-host"'),
  'Wallpaper filters should use the sampled Canvas renderer below the existing mask layer.'
)

const focusRingDeclaration = newtabCss.match(/--newtab-focus-ring:[^;]+;/)?.[0] || ''
assert.ok(
  focusRingDeclaration.includes('rgba(245, 245, 247') &&
    !focusRingDeclaration.includes('71, 168, 255'),
  'Newtab focus feedback should stay inside the neutral gray-white palette.'
)

assert.ok(
  searchWidget.includes('data-panel-open') &&
    searchWidget.includes('view.panel.panelVisible && SEARCH_FORM_PANEL_OPEN_CLASS') &&
    searchWidgetClasses.includes("SEARCH_FORM_PANEL_OPEN_CLASS = 'is-panel-open'") &&
    newtabCss.includes('.newtab-search.is-panel-open') &&
    newtabCss.includes('border-bottom-color: transparent') &&
    newtabCss.includes('border-top-color: transparent'),
  'Search suggestions should update the form itself so the squircle outline reconnects to the panel.'
)

assert.ok(
  searchWidgetClasses.includes("SEARCH_SHELL_CLASS = 'newtab-search-shell relative mx-auto w-[var(--search-effective-width)]'") &&
    searchWidgetClasses.includes("SEARCH_FORM_CLASS = 'newtab-search group relative z-[1] flex h-[var(--search-height)] w-full") &&
    searchWidgetClasses.includes("SEARCH_PANEL_CLASS = 'newtab-search-suggestions-panel absolute top-[calc(var(--search-height)+8px)] left-0") &&
    searchWidgetClasses.includes('w-full gap-[3px]') &&
    !searchWidgetClasses.includes('-translate-x-1/2') &&
    !/\.newtab-search-suggestions-panel:not\(\[hidden\]\)\s*\{[^}]*translate:/s.test(newtabCss),
  'Search and suggestions must share one positioned shell instead of centering through an animation-sensitive translate.'
)

assert.ok(
  searchWidgetClasses.includes('[&.active]:bg-[var(--newtab-glass-slider-fill)]') &&
    searchWidgetClasses.includes('[&.active]:shadow-[inset_0_0_0_1px_var(--newtab-glass-slider-fill)]') &&
    searchWidgetClasses.includes('[&.active:hover]:bg-[var(--newtab-glass-slider-fill)]') &&
    searchWidgetClasses.includes('[&_.newtab-search-suggestion-meta]:text-[rgba(245,245,247,0.86)]'),
  'The active search suggestion should reuse the unified 16% slider-fill token for its selected surface and outline.'
)

assert.ok(
  searchWidgetClasses.includes('bg-[rgba(0,0,0,var(--search-bg-alpha))]') &&
    searchWidgetClasses.includes('[--search-bg-alpha:0.6]') &&
    searchWidgetClasses.includes('[-webkit-backdrop-filter:var(--newtab-glass-filter-hero)]') &&
    clockClasses.includes('bg-[var(--newtab-glass-bg-hero)]') &&
    clockClasses.includes('[-webkit-backdrop-filter:var(--newtab-glass-filter-hero)]') &&
    newtabCss.includes('background: var(--newtab-glass-bg-popup') &&
    newtabCss.includes('backdrop-filter: var(--newtab-glass-filter-popup') &&
    !searchSurfaceRule.includes('background:') &&
    !reducedTransparencyOpaqueSelectors.includes('.newtab-search') &&
    !reducedTransparencyOpaqueSelectors.includes('.newtab-search-suggestions-panel') &&
    !reducedTransparencyOpaqueSelectors.includes('.newtab-search-engine-menu') &&
    !reducedTransparencyOpaqueSelectors.includes('.newtab-clock') &&
    !newtabCss.includes('--newtab-glass-bg-fill: #161616') &&
    !globalsCss.includes('--newtab-glass-bg-fill: #161616'),
  'The primary search and clock utilities should retain the explicitly selected glass material instead of being replaced by an OS-level opaque fallback.'
)

assert.ok(
  unifiedGlassTokens.includes('--newtab-glass-bg-fill: rgba(0, 0, 0, 0.6)') &&
    unifiedGlassTokens.includes('--newtab-glass-slider-fill: rgba(255, 255, 255, 0.16)') &&
    unifiedGlassTokens.includes('--newtab-glass-stroke: rgba(255, 255, 255, 0.08)') &&
    unifiedGlassTokens.includes('--newtab-glass-stroke-width: 1.5px') &&
    unifiedGlassTokens.includes('--newtab-glass-background-blur: 8px') &&
    unifiedGlassTokens.includes('--newtab-glass-backdrop-filter: blur(8px)') &&
    unifiedGlassTokens.includes('--newtab-glass-drop-shadow: 0 8px 20px 8px rgba(0, 0, 0, 0.4)') &&
    unifiedGlassTokens.includes('--newtab-glass-bg-popup: var(--newtab-glass-bg-fill)') &&
    unifiedGlassTokens.includes('--newtab-glass-filter-popup: var(--newtab-glass-backdrop-filter)'),
  'Unified New Tab glass must preserve the fill, slider, stroke, blur, and drop-shadow values from the reference material.'
)

assert.ok(
    searchSettingsStore.includes('NEWTAB_SEARCH_BACKGROUND_MIN = 52') &&
    searchSettingsStore.includes('NEWTAB_SEARCH_BACKGROUND_DEFAULT = 60') &&
    searchSettingsStore.includes('NEWTAB_SEARCH_BACKGROUND_MAX = 92') &&
    searchSettingsStore.includes('const background = clampNumber(') &&
    searchWidget.includes('NEWTAB_SEARCH_BACKGROUND_MIN / 100') &&
    settingsDrawer.includes('min={String(NEWTAB_SEARCH_BACKGROUND_MIN)}') &&
    settingsDrawer.includes('defaultValue={String(NEWTAB_SEARCH_BACKGROUND_DEFAULT)}'),
  'Search transparency controls must stay inside the readable range used by the unified glass material.'
)

assert.ok(
  controller.includes('getNewtabSearchFocusIntent') &&
    controller.includes('shouldToggleSearchFocusFromPointerDown'),
  'Typing and blank-surface pointer input should focus newtab search.'
)

assert.ok(
  controller.includes('restoreBookmarkFromRecycleEntryLazy(') &&
    !controller.includes('removeRecycleEntryLazy('),
  'New Tab undo must consume the recycle entry through the shared rollback-safe restore transaction.'
)

assert.ok(
  controller.includes('chrome.storage.onChanged.addListener(handleNewTabStorageChanged)') &&
    /changes\[STORAGE_KEYS\.aiProviderSettings\][\s\S]*?newTabNaturalSearchSettingsGeneration \+= 1[\s\S]*?abortNewTabNaturalSearchRequest\(\)[\s\S]*?naturalSearchSuggestionCache\.clear\(\)[\s\S]*?naturalSearchPlanCache\.clear\(\)[\s\S]*?refreshNewTabSearchSuggestionsAfterAiSettingsChange\?\.\(\)/.test(controller),
  'Changing the AI provider or reasoning effort should invalidate New Tab requests/caches and immediately rerun visible suggestions.'
)

const newtabNaturalSearchSuggestions = controller.slice(
  controller.indexOf('function getNaturalSearchBookmarkSuggestions'),
  controller.indexOf('async function resolveNewTabNaturalSearchPlan')
)
const newtabNaturalSearchPlanResolver = controller.slice(
  controller.indexOf('async function resolveNewTabNaturalSearchPlan'),
  controller.indexOf('function getSearchSuggestionCacheEntry')
)
const newtabPlanRequestIndex = newtabNaturalSearchPlanResolver.indexOf(
  'const plan = await naturalSearchAi.requestNaturalSearchAiPlan'
)
const newtabPlanPostRequestGuardIndex = newtabNaturalSearchPlanResolver.indexOf(
  'throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)',
  newtabPlanRequestIndex
)
const newtabPlanCacheWriteIndex = newtabNaturalSearchPlanResolver.indexOf(
  'state.naturalSearchPlanCache.set(planCacheKey, plan)',
  newtabPlanRequestIndex
)
const newtabPlanErrorWriteIndex = newtabNaturalSearchPlanResolver.indexOf(
  'state.naturalSearchError = naturalSearchAi.normalizeNaturalSearchAiError(error)',
  newtabPlanRequestIndex
)
assert.ok(
  newtabPlanRequestIndex >= 0 &&
    newtabPlanPostRequestGuardIndex > newtabPlanRequestIndex &&
    newtabPlanPostRequestGuardIndex < newtabPlanCacheWriteIndex &&
    newtabNaturalSearchPlanResolver.lastIndexOf(
      'throwIfNewTabNaturalSearchRequestStale(settingsGeneration, controller.signal)',
      newtabPlanErrorWriteIndex
    ) > newtabPlanCacheWriteIndex,
  'A superseded New Tab reasoning-settings request must not commit its plan cache or error state.'
)
assert.ok(
  (newtabNaturalSearchSuggestions.match(/throwIfNewTabNaturalSearchRequestStale\(settingsGeneration\)/g) || []).length >= 2,
  'New Tab natural-search suggestions must verify the reasoning-settings generation before and after result computation.'
)
assert.ok(
  /function isNewTabNaturalSearchAbortError\(error: unknown\)[\s\S]*?name\?: unknown \}\)\.name === 'AbortError'[\s\S]*?kind\?: unknown \}\)\.kind === 'abort'/.test(controller),
  'New Tab cancellation must recognize both DOM AbortError and AiRuntimeError(kind=abort).'
)

assert.ok(
    speedDial.includes('固定入口') &&
    speedDial.includes('state.state.detail') &&
    !speedDial.includes('onOpen') &&
    speedDial.includes('data-content-type'),
  'The empty fixed-entry module should provide a compact guidance state.'
)

assert.ok(
    newtabMain.includes("import('./newtab-controller')") &&
    newtabMain.includes("from './newtab-startup-data'") &&
    newtabMain.includes('prefetchNewtabStartupData()') &&
    !newtabMain.includes("from './newtab-controller'") &&
    newtabMain.includes('createRoot(root).render') &&
    // The controller chunk is requested ahead of the React mount so its download
    // and off-thread parse overlap with it, but it is only *started* from a task
    // queued after render(), so the cached shell still paints first.
    newtabMain.indexOf("const newTabControllerModule = import('./newtab-controller')") <
      newtabMain.indexOf('createRoot(root).render') &&
    newtabMain.indexOf('markNewTabStartupBaseline()') < newtabMain.indexOf('createRoot(root).render') &&
    newtabMain.includes("performance.mark('newtab.domContentLoaded')") &&
    newtabMain.indexOf('createRoot(root).render') <
      newtabMain.indexOf('scheduleNewTabControllerStart()') &&
    newtabMain.includes('window.setTimeout(startNewTabController, 0)') &&
    !newtabApp.includes('useNewtabController') &&
    newtabApp.includes("void import('./newtab-controller')") &&
    newtabApp.indexOf('startNewTabController()') < newtabApp.indexOf('dispatchNewtabSettingsDrawerToggleRequest()') &&
    viteConfig.includes('manualChunks(id)') &&
    viteConfig.includes("id.includes('/src/newtab/content-state.ts')") &&
    viteConfig.includes("indexOf('<link rel=\"stylesheet\"')") &&
    viteConfig.includes('stylesheetLineStart') &&
    controller.includes("performance.getEntriesByName('newtab.domContentLoaded', 'mark')") &&
    controller.includes('consumeNewtabStartupData()') &&
    newtabStartupData.includes('STORAGE_KEYS.newTabBackgroundSettings') &&
    newtabStartupData.includes('const prefetchedStartupData = settleStartupData(loadNewtabStartupData())') &&
    controller.includes("from './speed-dial.js'") &&
    !controller.includes("import('./speed-dial.js')"),
  'Newtab should paint its cached shell before loading the full controller, while manual chunk routing preserves the startup boundaries.'
)

assert.ok(
  controller.includes('void refreshNewTab().finally') &&
    controller.includes('bindBookmarkEvents()') &&
    controller.includes('const alreadyInTree = existingChildren.some') &&
    controller.includes('if (alreadyInSection)') &&
    controller.includes('alreadyInTree ? section.totalBookmarkCount : section.totalBookmarkCount + 1') &&
    bookmarkEventStore.includes('pendingNewtabBookmarkEvents') &&
    bookmarkEventStore.includes('dispatchPendingNewtabBookmarkEvent(actions, event)'),
  'Bookmark events that arrive while startup data is prefetched should replay only after hydration and remain idempotent when the tree already contains the change.'
)

assert.ok(
  controller.includes('const { tree, stored } = await consumeNewtabStartupData()') &&
    controller.includes('preloadBackgroundSettings(stored[STORAGE_KEYS.newTabBackgroundSettings])') &&
    /useLayoutEffect\(\(\) => \{\s*return scheduleNewtabBookmarkPrebootHandoff\(\{[\s\S]+?onFinish:/.test(bookmarkContent) &&
    bookmarkPreboot.includes('measureNewtabBookmarkPrebootHandoff') &&
    bookmarkContent.includes("prebootHandoffStatus !== 'ready'") &&
    /useEffect\(\(\) => \{[\s\S]+?writeNewtabBookmarkPrebootSnapshotFromView/.test(bookmarkContent),
  'The final newtab surface should wait for the saved background and keep bookmark preboot until live geometry is stable.'
)

assert.ok(
  newtabApp.includes("import('./components/SettingsDrawer')") &&
    !newtabApp.includes("from './components/SettingsDrawer'") &&
    newtabApp.includes('SETTINGS_DRAWER_IDLE_LOAD_DELAY_MS'),
  'The closed settings drawer should stay outside the bookmark first-paint bundle and warm after the critical path.'
)

assert.ok(
  newtabApp.includes("import('./components/NewtabDeferredHosts')") &&
    !newtabApp.includes("from './components/BookmarkMenusHost'") &&
    !newtabApp.includes("from './components/FeaturedBackgroundModal'") &&
    !newtabApp.includes("from './components/NewtabDeleteToastHost'") &&
    !newtabApp.includes("from './components/NewtabDragLayerHost'") &&
    newtabApp.includes('<DeferredNewtabHosts />'),
  'Closed menus, drag ghosts, featured wallpaper modal, and delete toast should stay outside the first-paint bundle.'
)

const autoCenteredLayoutReadyAssignments = [
  ...controller.matchAll(/layoutReady:\s*([^,\r\n]+)/g)
].map((match) => match[1]?.trim())
assert.ok(
  autoCenteredLayoutReadyAssignments.includes('!settings.autoVerticalCenter || cachedAutoOffsetY !== null') &&
    controller.includes('return `${AUTO_SEARCH_OFFSET_CACHE_KEY}:${window.innerWidth}x${window.innerHeight}`'),
  'Auto-centered search should trust a viewport-keyed cached offset for first paint instead of hiding behind the measurement gate.'
)
assert.ok(
  controller.includes('const AUTO_SEARCH_LAYOUT_STABLE_FRAME_COUNT = 0'),
  'Auto-centered search should reveal after the first current-layout measurement instead of waiting through extra frames.'
)
assert.ok(
  controller.includes("const AUTO_SEARCH_LAYOUT_PENDING_ATTRIBUTE = 'data-newtab-search-layout-pending'") &&
    controller.includes('getRevealedAutoSearchShell() === null && readCachedAutoSearchOffsetYValue() === null') &&
    controller.includes('scheduleAutoSearchLayoutReveal()') &&
    newtabCss.includes('html[data-newtab-search-layout-pending] .newtab-search-slot'),
  'The document should keep only uncached auto-centered search hidden until the measured shell state has reached the DOM.'
)
const autoCenterSlotTransition = newtabCss.match(
  /\.newtab-search-slot\[data-search-auto-vertical-center="true"\]\s*\{([^}]*)\}/
)?.[1] || ''
assert.ok(
  !autoCenterSlotTransition.includes('opacity') &&
    !autoCenterSlotTransition.includes('margin'),
  'Auto-centered search must reveal at final opacity and must not animate its offset; either transition produces a visible startup flash or wandering measurements.'
)
assert.ok(
  controller.includes('nodes.slot === lastMeasuredSearchSlot') &&
    controller.includes('settledVerticalCenterContent !== primaryContent'),
  'Search layout must re-measure only for a new slot element and only after the vertically centered content block has painted once.'
)

assert.ok(
  !newtabCss.includes('--newtab-wallpaper-focus-duration') &&
    !newtabHtml.includes('transition: opacity 280ms') &&
    !newtabCss.includes('.newtab-background-image[data-transitioning="true"]'),
  'The persistent wallpaper source must not run an opacity handoff underneath backdrop-filter surfaces.'
)

assert.ok(
  bookmarkPreboot.includes('line-break: strict;') &&
    bookmarkPreboot.includes('text-spacing-trim: trim-start;') &&
    bookmarkPreboot.includes('text-autospace: normal;') &&
    bookmarkPreboot.includes('hanging-punctuation: allow-end;') &&
    bookmarkPreboot.includes('roundPrebootLength'),
  'The bookmark preboot snapshot must match live shell CJK typography and keep sub-pixel geometry so the handoff does not shift text.'
)

assert.ok(
  bookmarkPreboot.includes('collectNewtabBookmarkPrebootClipPaths') &&
    bookmarkPreboot.includes('content.clipPaths.iconShell') &&
    bookmarkPreboot.includes('content.clipPaths.favicon') &&
    bookmarkPreboot.includes('content.clipPaths.fallback') &&
    bookmarkPreboot.includes('areNewtabBookmarkIconClipsAligned(prebootTile, liveTile)'),
  'The bookmark preboot snapshot must replay the squircle clip-paths on first paint and hold the handoff until the live icon outline matches.'
)

const squircleEngine = readFileSync('src/shared/squircle-engine.ts', 'utf8')
assert.ok(
  squircleEngine.includes('export function applySquircleClipBeforePaint') &&
    squircleEngine.includes("el.dataset.sq !== 'on') return") &&
    squircleEngine.includes("dataset.squircleSubtree === 'off'") &&
    bookmarkPreboot.includes("root.dataset.squircleSubtree = 'off'") &&
    bookmarkIconShell.includes('applySquircleClipBeforePaint'),
  'Live bookmark icons must receive their squircle clip-path before first paint, while the disposable preboot tree stays outside the global measurement scan.'
)

const cachedAutoOffsetWrites = [...controller.matchAll(/writeCachedAutoSearchOffsetY\(/g)].length
assert.ok(
  controller.includes('writeCachedAutoSearchOffsetY(view.shell.offsetY)') &&
    cachedAutoOffsetWrites === 2,
  'The first-paint offset cache should only record DOM-confirmed positions (single write in the reveal path plus its definition).'
)

assert.ok(
  !newtabHtml.includes('newtab-glass-booting') &&
    !newtabCss.includes('html.newtab-glass-booting :where(') &&
    !newtabCss.includes('will-change: backdrop-filter') &&
    !newtabCss.includes('newtab-utility-module-enter') &&
    !/\.newtab-search-slot\[data-search-auto-vertical-center="true"\]\s*\{[^}]*transition:\s*opacity/s.test(newtabCss) &&
    !newtabApp.includes("STARTUP_GLASS_BOOT_CLASS = 'newtab-glass-booting'") &&
    !newtabApp.includes('STARTUP_GLASS_SURFACE_SELECTOR'),
  'First-viewport glass must mount at final opacity without adding and later removing per-surface compositor hints.'
)

assert.ok(
  !bookmarkTileClasses.includes('backdrop-filter:blur') &&
    !speedDialClasses.includes('speed-dial-card-filter') &&
    bookmarkTileRule.includes('-webkit-backdrop-filter: var(--newtab-glass-filter)') &&
    bookmarkTileRule.includes('backdrop-filter: var(--newtab-glass-filter)'),
  'Bookmark cards should use the unified glass blur in their resting state instead of appearing only translucent.'
)

assert.ok(
  bookmarkTileClasses.includes("const BOOKMARK_TILE_PREVIEW_INITIALIZING_CLASS = '[--bookmark-tile-transition:none]'") &&
    !/\.bookmark-tile\s*\{[^}]*--bookmark-tile-transition\s*:/s.test(newtabCss),
  'Bookmark drag commits must be able to disable transform transitions without a later .bookmark-tile rule overriding the drag-state custom property.'
)

assert.ok(
  viteConfig.includes('NEWTAB_BOOKMARK_PREBOOT_ROUTE') &&
    viteConfig.includes('NEWTAB_BOOKMARK_PREBOOT_ENTRY') &&
    viteConfig.includes('removeCrossWorldNewtabModulePreloads(transformedHtml)') &&
    viteConfig.includes('NEWTAB_MODULE_PRELOAD_TAG_PATTERN') &&
    viteConfig.includes('`    <script src="${INSTANT_WALLPAPER_BOOT_ROUTE}"></script>\\n  </head>`') &&
    viteConfig.includes('`<body>\\n    <script src="${NEWTAB_BOOKMARK_PREBOOT_ROUTE}"></script>`'),
  'Newtab should discard cross-world module preloads, restore the wallpaper synchronously, then install its stable bookmark snapshot before the React root is parsed.'
)

assert.ok(
  bookmarkContent.includes('writeNewtabBookmarkPrebootSnapshotFromView') &&
    bookmarkContent.includes('hideNewtabBookmarkPreboot('),
  'Live bookmark content should hand off from the snapshot and keep an icon fallback until favicons load.'
)

assert.ok(
  bookmarkIconShell.includes('onLoad=') &&
    bookmarkIconShell.includes('data-favicon-ready') &&
    bookmarkIconShell.includes('data-[favicon-ready=true]:opacity-100') &&
    bookmarkIconShell.includes('data-[favicon-ready=true]:opacity-0') &&
    !bookmarkIconShell.includes('BOOKMARK_FALLBACK_HIDDEN_CLASS'),
  'A loaded favicon should hide its fallback through a state selector that wins the CSS cascade.'
)

assert.ok(
  bookmarkPreboot.includes('markNewtabFaviconReady(image.src)') &&
    bookmarkIconShell.includes('isNewtabFaviconReady(favicon.src)') &&
    bookmarkIconShell.includes('markNewtabFaviconReady(favicon.src)'),
  'The preboot snapshot should transfer favicon readiness to the live bookmark icon without showing the fallback again.'
)

const backgroundMaskTransition = newtabApp.match(/const BACKGROUND_MASK_BASE_CLASS = '([^']+)'/)?.[1] || ''
assert.ok(
  !backgroundMaskTransition.includes('transition:') &&
    !backgroundMaskTransition.includes('backdrop-filter_var'),
  'The persistent background mask must not animate or rebuild its compositor layer during startup.'
)

assert.ok(
  newtabCss.includes('@media (max-height: 800px)') &&
    newtabCss.includes('@media (max-height: 680px)') &&
    newtabCss.includes('@media (max-width: 520px) and (max-height: 800px)'),
  'Newtab should adapt density for short desktop viewports.'
)

const bookmarkHoverRule = newtabCss.match(
  /\.bookmark-tile:not\(\.curator-motion-disabled\):not\(\.dragging\):hover\s*\{([^}]*)\}/s
)?.[1] || ''
const bookmarkFocusRule = newtabCss.match(/\.bookmark-tile:focus-visible[^{]*\{([^}]*)\}/s)?.[1] || ''
const bookmarkSectionVisibilityToggle = /\.bookmark-folder-section:(?:hover|focus-within)[^{]*\{[^}]*content-visibility\s*:/s

assert.ok(
  !bookmarkContent.includes('content-visibility:auto') &&
    !bookmarkContent.includes('contain-intrinsic-size') &&
    !bookmarkSectionVisibilityToggle.test(newtabCss),
  'Bookmark sections must not use content-visibility/contain-intrinsic-size: the placeholder height collapses on the frame after paint and reflows the whole page, deforming cards. Incremental chunk rendering is the virtualization layer.'
)

assert.ok(
  bookmarkHoverRule.includes('transform: translateY(var(--newtab-bookmark-hover-lift))') &&
    bookmarkHoverRule.includes('box-shadow: var(--newtab-bookmark-hover-shadow)') &&
    !bookmarkHoverRule.replace(/-?\bbackdrop-filter:/g, '').includes('filter:') &&
    newtabCss.includes('.bookmark-tile:not(.curator-motion-disabled):not(.dragging):hover::before'),
  'Bookmark hover should use the Lumno-inspired lift, layered shadow, and glass-tinted overlay; only backdrop-filter is allowed (a clip-path-clipped drop-shadow filter is not).'
)

assert.ok(
  !bookmarkTileClasses.includes('--bookmark-card-rgb') &&
    !speedDialClasses.includes('--bookmark-card-rgb') &&
    !bookmarkIconShell.includes('--bookmark-card-rgb') &&
    !bookmarkPreboot.includes('--bookmark-card-rgb') &&
    !newtabCss.includes('--bookmark-card-rgb') &&
    !controller.includes('newTabFaviconAccentCache') &&
    !controller.includes('getHostnameAccentColor') &&
    !controller.includes('getCachedFaviconAccentCssRgb'),
  'New Tab bookmark and Speed Dial cards should use one neutral glass treatment without website-derived theme colors.'
)

assert.ok(
  bookmarkContent.includes("state.browseMode === 'navigation'") &&
    bookmarkContent.includes('BookmarkNavigationView') &&
    bookmarkContent.includes('BookmarkFolderCard') &&
    controller.includes('createBookmarkNavigationModule') &&
    controller.includes("browseMode === 'navigation'"),
  'The bookmark surface must dispatch between the expanded (grouped) and navigation (flat + folder cards) browse modes.'
)

assert.ok(
  /function BookmarkFolderCard[\s\S]+?getBookmarkTileClass\(/.test(bookmarkContent),
  'Navigation-mode folder cards must reuse the shared glass bookmark tile treatment for a unified look.'
)

assert.ok(
  bookmarkContent.includes("state.browseMode === 'navigation'") &&
    bookmarkContent.includes('clearNewtabBookmarkPrebootSnapshot()') &&
    controller.includes('clearNewtabBookmarkPrebootSnapshot()'),
  'Navigation mode must not persist an expanded-grid preboot snapshot, and switching modes must clear it so a refresh does not replay a stale structure.'
)

assert.ok(
  !bookmarkIconShell.includes('filter:blur') &&
    bookmarkIconShell.includes('var(--icon-swap-dur)') &&
    bookmarkIconShell.includes('data-[favicon-ready=true]:[transform:scale(1)]'),
  'Bookmark favicons should cross-fade on compositor properties without a per-card blur rasterization.'
)

assert.ok(
  bookmarkPreboot.includes('image.complete') &&
    bookmarkPreboot.includes('image.naturalWidth') &&
    bookmarkPreboot.includes('queueMicrotask(revealImageIfDecoded)'),
  'Cached preboot favicons should commit before the first painted refresh frame instead of cross-fading from fallback content.'
)

assert.ok(
  bookmarkFocusRule.includes('transform: none') &&
    newtabCss.includes('.bookmark-tile:focus-visible::before') &&
    newtabCss.includes('--newtab-bookmark-focus-inset'),
  'Bookmark keyboard focus should use an unclipped inset treatment without moving the card.'
)

console.log('newtab UI contract tests passed')
