import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const componentSource = readFileSync(
  resolve(process.cwd(), 'src/popup/components/PopupSmartClassifier.tsx'),
  'utf8'
)
const controllerSource = readFileSync(
  resolve(process.cwd(), 'src/popup/popup-controller.ts'),
  'utf8'
)
const popupCssSource = readFileSync(
  resolve(process.cwd(), 'src/popup/popup.css'),
  'utf8'
)
const smartClassifierSource = readFileSync(
  resolve(process.cwd(), 'src/popup/smart-classifier.ts'),
  'utf8'
)
const globalCssSource = readFileSync(
  resolve(process.cwd(), 'src/styles/globals.css'),
  'utf8'
)
const sheenProgressSource = readFileSync(
  resolve(process.cwd(), 'src/ui/base/sheen-progress.ts'),
  'utf8'
)
const progressClassSource = sheenProgressSource.match(
  /const SHEEN_PROGRESS_BAR_CLASS = \[[\s\S]*?\]\.join\(' '\)/
)?.[0] || ''

assert(progressClassSource.includes('transition-transform'), 'smart progress should animate with transform')
assert(progressClassSource.includes('duration-[320ms] ease-linear'), 'smart progress should use a continuous linear crawl')
assert(progressClassSource.includes('rgba(237,237,237,0.86)'), 'smart progress should use the Geist gray-white fill')
assert(!progressClassSource.includes('--ds-accent'), 'smart progress should not use the blue accent token')
assert(!progressClassSource.includes('--ds-focus'), 'smart progress should not use the blue focus token')
assert(componentSource.includes('<span className="tabular-nums">{loadingPercent}%</span>'), 'smart progress should show its latest percentage without animating replacement text')
assert(
  /prefers-reduced-motion[\s\S]*?\.sheen-progress-track::after[\s\S]*?animation:\s*none\s*!important/.test(globalCssSource),
  'reduced motion should stop the progress sheen'
)
assert(
  /@keyframes sheen-progress-sweep/.test(globalCssSource),
  'the filled track should carry a sheen so a slow AI stage never looks frozen'
)
assert(
  /\.sheen-progress-track::after[\s\S]*?clip-path:\s*inset\(0 calc\(100% - var\(--sheen-progress-fill/.test(globalCssSource),
  'the sheen must be clipped to the completed portion so it never overstates progress'
)
// 三处进度条共用一份样式源：popup 智能分类、可用性检测、批量智能分析。
for (const [label, path] of [
  ['popup smart classifier', 'src/popup/components/PopupSmartClassifier.tsx'],
  ['availability check', 'src/options/components/AvailabilityDecisionPanel.tsx'],
  ['bookmark analysis', 'src/options/components/AiAnalysisProgressPanel.tsx']
] as const) {
  const source = readFileSync(resolve(process.cwd(), path), 'utf8')
  assert(
    source.includes("from '../../ui/base/sheen-progress'"),
    `${label} progress should reuse the shared sheen progress styles`
  )
  assert(
    !/bg-ds-accent|rounded-none|h-\[7px\]|h-2 rounded-full/.test(source),
    `${label} progress should not keep its own pre-sheen track styling`
  )
}
assert(
  popupCssSource.includes('var(--smart-stage-a'),
  'first smart progress divider should follow the stage weights'
)
assert(
  popupCssSource.includes('var(--smart-stage-b'),
  'second smart progress divider should follow the stage weights'
)
assert(
  componentSource.includes("'--smart-stage-a': `${SMART_LOADING_STAGE_STARTS[1]}%`"),
  'stage dividers must be driven by the stage table instead of hardcoded thirds'
)
assert(controllerSource.includes('startSmartProgressTicker(runId)'), 'smart progress should keep creeping while loading')
assert(
  controllerSource.includes('await runSmartProgressFinish(runId)'),
  'the last stage should ease into 100% instead of snapping there'
)
assert(
  !/state\.smartProgressPercent = 100\s*\n\s*stopSmartProgressTicker/.test(controllerSource),
  'results must not teleport the bar to 100% before the finish ramp runs'
)

const contextIndex = controllerSource.indexOf('await smartClassifier.buildCurrentPageContext')
const aiStageIndex = controllerSource.indexOf('advanceSmartProgressStage(runId, 2)')
const aiRequestIndex = controllerSource.indexOf('await smartClassifier.requestSmartClassification')
const matchingStageIndex = controllerSource.indexOf('advanceSmartProgressStage(runId, 3)')
assert(contextIndex >= 0 && contextIndex < aiStageIndex, 'AI stage must begin after page context is ready')
assert(aiStageIndex < aiRequestIndex, 'AI stage must contain the AI request')
assert(aiRequestIndex < matchingStageIndex, 'matching stage must begin after the AI response is ready')

const smartRequestStart = smartClassifierSource.indexOf('export async function requestSmartClassification')
const providerRequestStart = smartClassifierSource.indexOf(
  'const result = await requestStructuredAiOutput',
  smartRequestStart
)
const progressBeforeProviderResponse = smartClassifierSource.slice(smartRequestStart, providerRequestStart)
assert(
  !progressBeforeProviderResponse.includes('reportSmartProgress(onProgress'),
  'AI stage should creep from one third instead of jumping before the provider responds'
)

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

console.log('Popup smart progress style tests passed.')
