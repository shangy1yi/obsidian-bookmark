import assert from 'node:assert/strict'
import test from 'node:test'

let storageFailure = ''
const storageWrites: Record<string, unknown>[] = []

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      get lastError() {
        return storageFailure ? { message: storageFailure } : undefined
      }
    },
    storage: {
      local: {
        set(payload: Record<string, unknown>, callback: () => void) {
          storageWrites.push(payload)
          callback()
        }
      }
    }
  }
})

const { availabilityState, managerState } = await import('../shared-options/state.js')
const {
  getRedirectSectionState,
  mergeRetestedRedirectCache
} = await import('./redirects.js')

function redirectResult(id: string, finalUrl: string, ancestorIds = ['folder-a']) {
  return {
    id,
    title: id,
    url: `https://${id}.example/old`,
    finalUrl,
    path: 'Bookmarks',
    parentId: ancestorIds.at(-1) || '',
    index: 0,
    ancestorIds,
    badgeText: 'Redirected',
    detail: '',
    status: 'redirected'
  }
}

test('merges explicit retest evidence without replacing the prior complete snapshot', async () => {
  storageFailure = ''
  storageWrites.length = 0
  managerState.redirectCache = {
    savedAt: 123,
    scope: {
      key: 'all',
      type: 'all',
      folderId: '',
      label: 'All bookmarks'
    },
    results: [
      redirectResult('kept', 'https://kept.example/new'),
      redirectResult('resolved', 'https://resolved.example/new')
    ]
  }

  await mergeRetestedRedirectCache([
    {
      ...redirectResult('resolved', 'https://resolved.example/old'),
      status: 'available'
    },
    redirectResult('added', 'https://added.example/new')
  ])

  assert.equal(managerState.redirectCache.savedAt, 123)
  assert.deepEqual(
    managerState.redirectCache.results.map((result) => result.id).sort(),
    ['added', 'kept']
  )
  assert.equal(storageWrites.length, 1)
})

test('keeps the in-memory cache unchanged when persistence fails', async () => {
  const previousCache = {
    savedAt: 456,
    scope: {
      key: 'folder:folder-a',
      type: 'folder',
      folderId: 'folder-a',
      label: 'Folder A'
    },
    results: [redirectResult('kept', 'https://kept.example/new')]
  }
  managerState.redirectCache = previousCache
  storageFailure = 'disk full'

  await assert.rejects(
    mergeRetestedRedirectCache([
      redirectResult('added', 'https://added.example/new')
    ]),
    /disk full/
  )

  assert.equal(managerState.redirectCache, previousCache)
  storageFailure = ''
})

test('does not merge a retested redirect outside the cached folder scope', async () => {
  managerState.redirectCache = {
    savedAt: 789,
    scope: {
      key: 'folder:folder-a',
      type: 'folder',
      folderId: 'folder-a',
      label: 'Folder A'
    },
    results: []
  }

  await mergeRetestedRedirectCache([
    redirectResult('outside', 'https://outside.example/new', ['folder-b'])
  ])

  assert.deepEqual(managerState.redirectCache.results, [])
})

test('drops cached evidence when the bookmark URL changed after detection', () => {
  const cachedResult = redirectResult('changed', 'https://changed.example/new')
  managerState.redirectCache = {
    savedAt: 999,
    scope: {
      key: 'all',
      type: 'all',
      folderId: '',
      label: 'All bookmarks'
    },
    results: [cachedResult]
  }
  availabilityState.running = false
  availabilityState.lastCompletedAt = 0
  availabilityState.redirectResults = []
  availabilityState.bookmarkMap = new Map([[
    'changed',
    {
      ...cachedResult,
      url: 'https://changed.example/manually-edited'
    }
  ]])

  const state = getRedirectSectionState({
    getCurrentAvailabilityScopeMeta: () => managerState.redirectCache.scope
  })

  assert.deepEqual(state.results, [])
})
