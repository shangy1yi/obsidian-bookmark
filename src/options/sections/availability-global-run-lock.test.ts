import assert from 'node:assert/strict'
import test from 'node:test'
import { createAvailabilityGlobalRunLockCoordinator } from './availability-global-run-lock.js'

function createMockLockManager() {
  let locked = false

  return {
    async request(_name, options, callback) {
      if (locked && options.ifAvailable) {
        await callback(null)
        return
      }

      locked = true
      try {
        await callback({ name: 'curator:availability-run' })
      } finally {
        locked = false
      }
    }
  }
}

test('allows only one options document to own the availability run lease', async () => {
  const lockManager = createMockLockManager()
  const firstDocument = createAvailabilityGlobalRunLockCoordinator({ lockManager })
  const secondDocument = createAvailabilityGlobalRunLockCoordinator({ lockManager })

  assert.equal(await firstDocument.acquire('first-run'), true)
  assert.equal(await secondDocument.acquire('second-run'), false)
  assert.equal(firstDocument.isOwner('first-run'), true)
  assert.equal(firstDocument.release('first-run'), true)

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(await secondDocument.acquire('second-run'), true)
  assert.equal(secondDocument.release('second-run'), true)
})

test('fails closed when the browser lock manager is unavailable', async () => {
  const coordinator = createAvailabilityGlobalRunLockCoordinator()
  assert.equal(await coordinator.acquire('run'), false)
})

test('lets a later document refresh before committing under the lease', async () => {
  const lockManager = createMockLockManager()
  const firstDocument = createAvailabilityGlobalRunLockCoordinator({ lockManager })
  const secondDocument = createAvailabilityGlobalRunLockCoordinator({ lockManager })
  let storedRuns = ['old']
  let firstLocalRuns = storedRuns.slice()
  let secondLocalRuns = storedRuns.slice()

  assert.equal(await firstDocument.acquire('first-run'), true)
  firstLocalRuns = storedRuns.slice()
  storedRuns = ['run-a', ...firstLocalRuns]
  firstDocument.release('first-run')
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(await secondDocument.acquire('second-run'), true)
  secondLocalRuns = storedRuns.slice()
  storedRuns = ['run-b', ...secondLocalRuns]
  secondDocument.release('second-run')

  assert.deepEqual(storedRuns, ['run-b', 'run-a', 'old'])
})
