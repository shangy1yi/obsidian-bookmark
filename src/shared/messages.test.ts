import assert from 'node:assert/strict'
import {
  AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT,
  AVAILABILITY_NAVIGATION_TIMEOUT_MAX_MS,
  AVAILABILITY_NAVIGATION_TIMEOUT_MIN_MS,
  parseAvailabilityProbeMessage,
  parseBackupRestoreMessage,
  parseNavigationCancelMessage,
  parseNavigationCheckMessage,
  requestAvailabilityProbe
} from './messages.js'

assert.equal(
  AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT,
  6,
  'service worker navigation capacity should match the frontend concurrency ceiling'
)

const validProbe = parseAvailabilityProbeMessage({
  type: 'availability:probe',
  url: 'https://example.com/path',
  method: 'HEAD',
  timeoutMs: 20000,
  deadlineAtMs: Date.now() + 20000,
  checkId: 'probe-1234'
})
assert.equal(validProbe.ok, true)
if (validProbe.ok) {
  assert.equal(validProbe.value.method, 'HEAD')
  assert.equal(validProbe.value.url, 'https://example.com/path')
  assert.equal(typeof validProbe.value.deadlineAtMs, 'number')
}
assert.equal(
  parseAvailabilityProbeMessage({
    type: 'availability:probe',
    url: 'https://user:password@example.com/',
    method: 'GET',
    checkId: 'probe-credentials'
  }).ok,
  false
)
assert.equal(
  parseAvailabilityProbeMessage({
    type: 'availability:probe',
    url: 'https://example.com/',
    method: 'HEAD',
    deadlineAtMs: Number.NaN,
    checkId: 'probe-deadline'
  }).ok,
  false
)
assert.equal(
  parseAvailabilityProbeMessage({
    type: 'availability:probe',
    url: 'https://example.com/',
    method: 'POST',
    checkId: 'probe-method'
  }).ok,
  false
)

const validNavigation = parseNavigationCheckMessage({
  type: 'availability:navigate',
  url: ' https://example.com/path ',
  timeoutMs: 30000,
  checkId: 'nav-1234-abcd'
})
assert.equal(validNavigation.ok, true)
if (validNavigation.ok) {
  assert.equal(validNavigation.value.url, 'https://example.com/path')
  assert.equal(validNavigation.value.timeoutMs, 30000)
  assert.equal(validNavigation.value.checkId, 'nav-1234-abcd')
}

for (const timeoutMs of [
  AVAILABILITY_NAVIGATION_TIMEOUT_MIN_MS,
  AVAILABILITY_NAVIGATION_TIMEOUT_MAX_MS
]) {
  assert.equal(
    parseNavigationCheckMessage({
      type: 'availability:navigate',
      url: 'https://example.com/',
      timeoutMs,
      checkId: `nav-timeout-${timeoutMs}`
    }).ok,
    true,
    `timeout boundary ${timeoutMs} should be accepted`
  )
}

for (const timeoutMs of [
  AVAILABILITY_NAVIGATION_TIMEOUT_MIN_MS - 1,
  AVAILABILITY_NAVIGATION_TIMEOUT_MAX_MS + 1,
  Number.NaN,
  '30000'
]) {
  assert.equal(
    parseNavigationCheckMessage({
      type: 'availability:navigate',
      url: 'https://example.com/',
      timeoutMs,
      checkId: 'nav-invalid-timeout'
    }).ok,
    false,
    `invalid timeout ${String(timeoutMs)} should be rejected`
  )
}

for (const message of [
  {
    type: 'availability:navigate',
    url: 'chrome://extensions',
    timeoutMs: 30000,
    checkId: 'nav-invalid-scheme'
  },
  {
    type: 'availability:navigate',
    url: 'https://user:password@example.com/',
    timeoutMs: 30000,
    checkId: 'nav-url-credentials'
  },
  {
    type: 'availability:navigate',
    url: 'https://example.com/',
    timeoutMs: 30000,
    checkId: ''
  },
  {
    type: 'availability:navigate',
    url: 'https://example.com/',
    timeoutMs: 30000,
    checkId: 'invalid check id'
  }
]) {
  assert.equal(
    parseNavigationCheckMessage(message).ok,
    false,
    'malformed navigation messages should be rejected'
  )
}

assert.deepEqual(
  parseNavigationCancelMessage({
    type: 'availability:cancel',
    checkId: 'nav-1234-abcd'
  }),
  {
    ok: true,
    value: {
      type: 'availability:cancel',
      checkId: 'nav-1234-abcd'
    }
  }
)
assert.equal(
  parseNavigationCancelMessage({
    type: 'availability:cancel',
    checkId: '../other-check'
  }).ok,
  false
)

assert.equal(
  parseBackupRestoreMessage({
    type: 'backup:restore',
    operationId: 'restore-20260723-abc123',
    mode: 'safeFull',
    backup: {}
  }).ok,
  true
)
for (const invalidRestoreMessage of [
  {
    type: 'backup:restore',
    operationId: '../restore',
    mode: 'safeFull',
    backup: {}
  },
  {
    type: 'backup:restore',
    operationId: 'restore-valid',
    mode: 'replaceEverything',
    backup: {}
  },
  {
    type: 'backup:restore',
    operationId: 'restore-valid',
    mode: 'tagsOnly',
    backup: null
  }
]) {
  assert.equal(
    parseBackupRestoreMessage(invalidRestoreMessage).ok,
    false,
    'malformed restore messages must be rejected before reaching the backup engine'
  )
}

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      lastError: undefined,
      sendMessage(
        _message: unknown,
        callback: (response: unknown) => void
      ) {
        callback({
          ok: false,
          error: '网络探测已取消。',
          errorName: 'AbortError',
          errorCode: 'cancelled'
        })
      }
    }
  } as unknown as typeof chrome
})

await assert.rejects(
  requestAvailabilityProbe(
    'https://example.com/',
    'HEAD',
    20000,
    'probe-abort',
    Date.now() + 20000
  ),
  (error: unknown) => {
    assert.equal(error instanceof Error ? error.name : '', 'AbortError')
    assert.equal(
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : '',
      'cancelled'
    )
    return true
  }
)

console.log('Availability runtime message tests passed.')
