import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'

const CROSS_WORLD_PRELOAD_ERROR = /cross-world extension resource mismatch/i
const extensionPath = path.resolve('dist')
const profilePath = await mkdtemp(path.join(tmpdir(), 'curator-newtab-runtime-'))
let context

try {
  const newtabHtml = await readFile(
    path.join(extensionPath, 'src', 'newtab', 'newtab.html'),
    'utf8'
  )
  assert.doesNotMatch(
    newtabHtml,
    /<link\b[^>]*\brel=(["'])modulepreload\1[^>]*>/i,
    'Built New Tab HTML must not contain modulepreload links'
  )

  context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const worker = context.serviceWorkers()[0]
    ?? await context.waitForEvent('serviceworker', { timeout: 15_000 })
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  const runtimeFailures = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeFailures.push(`console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    runtimeFailures.push(`page: ${error.message}`)
  })

  await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded' })
  await page.locator('#newtab-react-root').waitFor({ state: 'attached', timeout: 15_000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('#newtab-react-root').waitFor({ state: 'attached', timeout: 15_000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('#newtab-react-root').waitFor({ state: 'attached', timeout: 15_000 })
  await page.waitForTimeout(500)

  const errorsPage = await context.newPage()
  await errorsPage.goto(`chrome://extensions/?errors=${extensionId}`, {
    waitUntil: 'domcontentloaded'
  })
  await errorsPage.locator('extensions-manager').waitFor({ state: 'attached', timeout: 10_000 })
  await errorsPage.waitForTimeout(300)
  const extensionErrorText = await errorsPage.evaluate(() => {
    const text = []
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.textContent?.replace(/\s+/g, ' ').trim()
        if (value) text.push(value)
        return
      }
      if (node instanceof Element && node.shadowRoot) {
        visit(node.shadowRoot)
      }
      for (const child of node.childNodes) {
        visit(child)
      }
    }
    visit(document.documentElement)
    return text.join('\n')
  })

  assert.doesNotMatch(
    extensionErrorText,
    CROSS_WORLD_PRELOAD_ERROR,
    `New Tab must not register cross-world modulepreload errors: ${extensionErrorText}`
  )
  assert.deepEqual(
    runtimeFailures,
    [],
    `New Tab must not emit runtime console or page errors: ${JSON.stringify(runtimeFailures)}`
  )

  console.log('New Tab runtime error regression test passed.')
} finally {
  await context?.close()
  await rm(profilePath, { recursive: true, force: true })
}
