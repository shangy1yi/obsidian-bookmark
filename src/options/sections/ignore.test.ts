import assert from 'node:assert/strict'
import test from 'node:test'
import { managerState } from '../shared-options/state.js'
import {
  normalizeIgnoreRules,
  removeIgnoreRule,
  saveIgnoreRules
} from './ignore.js'

let storageError = ''

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      get lastError() {
        return storageError ? { message: storageError } : undefined
      }
    },
    storage: {
      local: {
        set(_payload: Record<string, unknown>, callback: () => void) {
          callback()
        }
      }
    }
  } as unknown as typeof chrome
})

test('keeps the committed ignore state when persistence fails', async () => {
  const committed = normalizeIgnoreRules({
    domains: [{ domain: 'kept.example', createdAt: 1 }]
  })
  managerState.ignoreRules = committed
  const next = normalizeIgnoreRules({
    domains: [
      { domain: 'kept.example', createdAt: 1 },
      { domain: 'new.example', createdAt: 2 }
    ]
  })

  storageError = 'quota exceeded'
  await assert.rejects(saveIgnoreRules(next), /quota exceeded/)
  storageError = ''

  assert.equal(managerState.ignoreRules, committed)
  assert.deepEqual(
    managerState.ignoreRules.domains.map((rule) => rule.domain),
    ['kept.example']
  )
})

test('reports a failed removal without mutating memory or leaking the lock', async () => {
  managerState.ignoreRules = normalizeIgnoreRules({
    bookmarks: [{
      bookmarkId: 'bookmark-1',
      title: 'Kept bookmark',
      url: 'https://example.com/',
      createdAt: 1
    }]
  })
  let released = 0
  let changed = 0
  let reportedError = ''

  storageError = 'storage offline'
  await removeIgnoreRule('bookmark', 'bookmark-1', {
    async claimAvailabilityMutationLock() {
      return () => {
        released += 1
      }
    },
    onIgnoreRulesChanged() {
      changed += 1
    },
    onIgnoreRulesError(error: unknown) {
      reportedError = error instanceof Error ? error.message : String(error)
    }
  })
  storageError = ''

  assert.equal(released, 1)
  assert.equal(changed, 0)
  assert.match(reportedError, /storage offline/)
  assert.deepEqual(
    managerState.ignoreRules.bookmarks.map((rule) => rule.bookmarkId),
    ['bookmark-1']
  )
})
