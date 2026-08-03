import assert from 'node:assert/strict'
import test from 'node:test'
import { createAiAnalysisRunSessionCoordinator } from './ai-analysis-run-session.js'

test('claims an AI analysis run synchronously', () => {
  const coordinator = createAiAnalysisRunSessionCoordinator({
    createId: () => 'run-1'
  })

  assert.deepEqual(coordinator.claim(), {
    id: 'run-1',
    phase: 'authorizing'
  })
  assert.equal(coordinator.claim(), null)
})

test('ignores stale AI run transitions and finalizers', () => {
  const ids = ['run-1', 'run-2']
  const coordinator = createAiAnalysisRunSessionCoordinator({
    createId: () => ids.shift() || 'unexpected'
  })

  assert.equal(coordinator.claim()?.id, 'run-1')
  assert.equal(coordinator.transition('run-1', 'running'), true)
  assert.equal(coordinator.release('run-1'), true)
  assert.equal(coordinator.claim()?.id, 'run-2')

  assert.equal(coordinator.transition('run-1', 'stopping'), false)
  assert.equal(coordinator.release('run-1'), false)
  assert.deepEqual(coordinator.getActive(), {
    id: 'run-2',
    phase: 'authorizing'
  })
})

test('retains ownership through finalization and stopping', () => {
  const coordinator = createAiAnalysisRunSessionCoordinator({
    createId: () => 'run-1'
  })

  coordinator.claim()
  assert.equal(coordinator.transition('run-1', 'finalizing'), true)
  assert.equal(coordinator.claim(), null)
  assert.equal(coordinator.transition('run-1', 'stopping'), true)
  assert.equal(coordinator.release('run-1'), true)
  assert.equal(coordinator.getActive(), null)
})
