import { readFileSync } from 'node:fs'

const css = readFileSync('src/popup/popup.css', 'utf8')
const contentHostSource = readFileSync('src/popup/components/PopupContentHost.tsx', 'utf8')

assert(
  !css.includes('#popup-app-shell[data-keyboard-nav="true"] .popup-active-result-indicator[data-visible="true"]'),
  'Active result indicator visibility must not depend on keyboard navigation timing.'
)

const indicatorVisibleRule = getCssRule('.popup-active-result-indicator[data-visible="true"]')
assert(
  /opacity:\s*1\s*;/.test(indicatorVisibleRule),
  'Visible active result indicator should remain opaque while an active row exists.'
)

const indicatorRule = getCssRule('.popup-active-result-indicator')
assert(
  !/transition:\s*[\s\S]*\bwidth\b/.test(indicatorRule) &&
    !/transition:\s*[\s\S]*\bheight\b/.test(indicatorRule) &&
    !/will-change:\s*[^;]*\bwidth\b/.test(indicatorRule) &&
    !/will-change:\s*[^;]*\bheight\b/.test(indicatorRule) &&
    /transform\s+var\(--ds-motion-feedback\)\s+var\(--ease-smooth-out\)/.test(indicatorRule),
  'Active result indicator size should follow active-row resize directly instead of double-easing width or height.'
)

const hiddenIndicatorRule = getCssRule('.popup-active-result-indicator:not([data-visible="true"])')
assert(
  !/\btransform\b/.test(hiddenIndicatorRule),
  'A hidden indicator should snap to its measured destination before fading in.'
)

const activeButtonRule = getCssRule('.popup-list-button[data-active="true"]')
assert(
  /background:\s*transparent\s*;/.test(activeButtonRule) && /box-shadow:\s*none\s*;/.test(activeButtonRule),
  'Active row background should come from the moving indicator layer, not the row button.'
)

assert(
  !css.includes('#popup-app-shell[data-keyboard-nav="true"] .popup-active-result-indicator'),
  'Keyboard navigation should reuse the same short, interruptible indicator translation as pointer input.'
)

assert(
  contentHostSource.includes('new ResizeObserver') &&
    contentHostSource.includes('observer.observe(observedTarget)') &&
    contentHostSource.includes('observer.disconnect()'),
  'Active result indicator should remeasure when the active row target resizes.'
)

function getCssRule(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`)
  }

  return match[1]
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

console.log('Popup active result indicator style tests passed.')
