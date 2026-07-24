import assert from 'node:assert/strict'
import test from 'node:test'
import { createAvailabilityRunSessionCoordinator } from './availability-run-session.js'

test('claims one run synchronously and rejects a competing run', () => {
  const coordinator = createAvailabilityRunSessionCoordinator({
    createId: () => 'run-1'
  })

  assert.deepEqual(coordinator.claim('full'), {
    id: 'run-1',
    kind: 'full',
    phase: 'authorizing'
  })
  assert.equal(coordinator.claim('retest'), null)
})

test('ignores stale transitions and stale finalizers', () => {
  const ids = ['run-1', 'run-2']
  const coordinator = createAvailabilityRunSessionCoordinator({
    createId: () => ids.shift() || 'unexpected'
  })

  assert.equal(coordinator.claim('full')?.id, 'run-1')
  assert.equal(coordinator.transition('run-1', 'running'), true)
  assert.equal(coordinator.release('run-1'), true)
  assert.equal(coordinator.claim('retest')?.id, 'run-2')

  assert.equal(coordinator.transition('run-1', 'stopping'), false)
  assert.equal(coordinator.release('run-1'), false)
  assert.deepEqual(coordinator.getActive(), {
    id: 'run-2',
    kind: 'retest',
    phase: 'authorizing'
  })
})

test('tracks stopping without releasing ownership early', () => {
  const coordinator = createAvailabilityRunSessionCoordinator({
    createId: () => 'run-1'
  })

  coordinator.claim('retest')
  assert.equal(coordinator.transition('run-1', 'stopping'), true)
  assert.equal(coordinator.isOwner('run-1'), true)
  assert.equal(coordinator.claim('full'), null)
  assert.equal(coordinator.release('run-1'), true)
  assert.equal(coordinator.getActive(), null)
})

test('keeps ownership while completed results are being finalized', () => {
  const coordinator = createAvailabilityRunSessionCoordinator({
    createId: () => 'run-1'
  })

  coordinator.claim('full')
  assert.equal(coordinator.transition('run-1', 'running'), true)
  assert.equal(coordinator.transition('run-1', 'finalizing'), true)
  assert.deepEqual(coordinator.getActive(), {
    id: 'run-1',
    kind: 'full',
    phase: 'finalizing'
  })
  assert.equal(coordinator.claim('retest'), null)
})
