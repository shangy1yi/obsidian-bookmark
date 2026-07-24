import assert from 'node:assert/strict'
import { createAvailabilityRunScheduler } from './availability-runner.js'

const url = 'https://example.com/path'
let now = 1_000
const scheduler = createAvailabilityRunScheduler({
  now: () => now,
  profile: {
    concurrency: 2,
    domainConcurrency: 1,
    timeoutCooldownMs: 3_500,
    throttleCooldownMs: 8_000,
    maxCooldownMs: 15_000,
    pollIntervalMs: 250
  }
})

const heldLease = scheduler.tryAcquire(url)
assert.ok(heldLease, 'the test should hold the same-domain item lease')
scheduler.recordOutcome(url, { kind: 'timeout', timedOut: true })
assert.equal(
  scheduler.getCooldownDelay(url),
  3_500,
  'timeout outcomes should expose the full domain cooldown'
)

const cooldownWaits: number[] = []
assert.equal(
  await scheduler.waitForCooldown(url, {
    wait: async (ms) => {
      cooldownWaits.push(ms)
      now += ms
    }
  }),
  true,
  'cooldown should complete when the domain becomes eligible'
)
assert.deepEqual(
  cooldownWaits,
  [3_500],
  'same-item cooldown waits should sleep to the deadline instead of polling'
)
heldLease.release()

scheduler.recordOutcome(url, { kind: 'throttle', statusCode: 429 })
const aborted = new AbortController()
aborted.abort()
let abortedWaitCalled = false
assert.equal(
  await scheduler.waitForCooldown(url, {
    signal: aborted.signal,
    wait: async () => {
      abortedWaitCalled = true
    }
  }),
  false,
  'an aborted cooldown wait should stop before another request stage'
)
assert.equal(abortedWaitCalled, false, 'pre-aborted waits must not schedule a timer')

const activeAbortScheduler = createAvailabilityRunScheduler({
  profile: {
    timeoutCooldownMs: 5_000
  }
})
activeAbortScheduler.recordOutcome(url, { kind: 'timeout' })
const activeAbort = new AbortController()
const activeAbortWait = activeAbortScheduler.waitForCooldown(url, {
  signal: activeAbort.signal
})
activeAbort.abort()
assert.equal(
  await activeAbortWait,
  false,
  'an in-flight cooldown timer should resolve as cancelled when its signal aborts'
)

assert.equal(
  await scheduler.waitForCooldown(url, {
    shouldContinue: () => false,
    wait: async () => {
      throw new Error('should not wait after cancellation')
    }
  }),
  false,
  'cooperative cancellation should stop a cooldown wait'
)

console.log('Availability runner tests passed.')
