import assert from 'node:assert/strict'
import { managerState } from '../shared-options/state.js'
import {
  finalizeAvailabilityHistoryRun,
  finalizeDetectionHistory,
  getHistoricalAbnormalStreak,
  hydrateDetectionHistory,
  syncHistoryComparisonScope
} from './history.js'

function historyEntry(
  id: string,
  {
    status = 'failed',
    streak = 1,
    title = `Bookmark ${id}`,
    url = `https://${id}.example.com`
  }: {
    status?: 'failed' | 'review'
    streak?: number
    title?: string
    url?: string
  } = {}
) {
  return {
    id,
    path: `Folder/${id}`,
    status,
    streak,
    title,
    url
  }
}

function scope(key: string, label: string) {
  if (key === 'all') {
    return {
      folderId: '',
      key: 'all',
      label,
      type: 'all'
    }
  }

  const folderId = key.replace(/^folder:/, '')
  return {
    folderId,
    key: `folder:${folderId}`,
    label,
    type: 'folder'
  }
}

function callbacksForScope(currentScope) {
  return {
    getCurrentAvailabilityScopeMeta: () => currentScope
  }
}

function resetHistoryState() {
  managerState.historyRuns = []
  managerState.previousHistoryMap = new Map()
  managerState.historyLastRunAt = 0
  managerState.historyRecoveredResults = []
  managerState.historyNewCount = 0
  managerState.historyPersistentCount = 0
}

function testPersistentAbnormalWinsOverHealthyEvidence() {
  const run = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarkIds: ['a'],
    completedAt: 100,
    currentEntries: [historyEntry('a', { streak: 2 })],
    previousEntries: [historyEntry('a')],
    scope: scope('all', '全部书签')
  })

  assert.deepEqual(run.results.map((entry) => entry.id), ['a'])
  assert.deepEqual(run.recoveredResults, [])
  assert.equal(run.summary.newCount, 0)
  assert.equal(run.summary.persistentCount, 1)
}

function testAvailableAndRedirectedEvidenceRecoverPreviousAbnormalities() {
  const run = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarkIds: ['available-result', 'redirected-result'],
    completedAt: 200,
    currentEntries: [],
    previousEntries: [
      historyEntry('available-result', { streak: 3 }),
      historyEntry('redirected-result', { status: 'review', streak: 2 })
    ],
    scope: scope('all', '全部书签')
  })

  assert.deepEqual(
    new Set(run.recoveredResults.map((entry) => entry.id)),
    new Set(['available-result', 'redirected-result'])
  )
  assert.equal(run.summary.recoveredCount, 2)
  assert.equal(run.summary.totalAbnormal, 0)
}

function testMissingEntriesAreNotImplicitlyRecovered() {
  const run = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarkIds: [],
    completedAt: 300,
    currentEntries: [],
    previousEntries: [
      historyEntry('not-checked'),
      historyEntry('deleted-during-run'),
      historyEntry('hidden-from-results')
    ],
    scope: scope('all', '全部书签')
  })

  assert.deepEqual(run.recoveredResults, [])
  assert.equal(run.summary.recoveredCount, 0)
}

function testOnlyExplicitHealthyIdsRecover() {
  const run = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarkIds: ['confirmed-healthy', '', 'unknown-id'],
    completedAt: 400,
    currentEntries: [],
    previousEntries: [
      historyEntry('confirmed-healthy'),
      historyEntry('not-observed')
    ],
    scope: scope('all', '全部书签')
  })

  assert.deepEqual(run.recoveredResults.map((entry) => entry.id), ['confirmed-healthy'])
}

function testNewAndPersistentCountsRemainCompatible() {
  const run = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarkIds: [],
    completedAt: 500,
    currentEntries: [
      historyEntry('persistent', { streak: 2 }),
      historyEntry('new')
    ],
    previousEntries: [historyEntry('persistent')],
    scope: scope('folder:10', 'Work')
  })

  assert.deepEqual(run.newResults.map((entry) => entry.id), ['new'])
  assert.equal(run.summary.newCount, 1)
  assert.equal(run.summary.persistentCount, 1)
  assert.equal(run.scope.key, 'folder:10')
}

function testChangedUrlStartsANewHistoryIdentity() {
  const run = finalizeAvailabilityHistoryRun({
    completedAt: 550,
    currentEntries: [
      historyEntry('edited', {
        streak: 1,
        url: 'https://new.example.com'
      })
    ],
    previousEntries: [
      historyEntry('edited', {
        streak: 4,
        url: 'https://old.example.com'
      })
    ],
    scope: scope('all', '全部书签')
  })

  assert.deepEqual(run.newResults.map((entry) => entry.id), ['edited'])
  assert.equal(run.summary.newCount, 1)
  assert.equal(run.summary.persistentCount, 0)
}

function testChangedUrlDoesNotCreateFalseRecoveryOrStreak() {
  resetHistoryState()
  managerState.historyRuns = [
    finalizeAvailabilityHistoryRun({
      completedAt: 650,
      currentEntries: [
        historyEntry('edited', {
          streak: 3,
          url: 'https://old.example.com'
        })
      ],
      scope: scope('all', '全部书签')
    })
  ]

  const run = finalizeAvailabilityHistoryRun({
    checkedHealthyBookmarks: new Map([
      ['edited', 'https://new.example.com']
    ]),
    completedAt: 700,
    currentEntries: [],
    previousEntries: [
      historyEntry('edited', {
        streak: 3,
        url: 'https://old.example.com'
      })
    ],
    scope: scope('all', '全部书签')
  })

  assert.deepEqual(run.recoveredResults, [])
  assert.equal(
    getHistoricalAbnormalStreak(
      'edited',
      'https://new.example.com',
      callbacksForScope(scope('all', '全部书签'))
    ),
    0
  )
}

function testHistoryComparisonDoesNotCrossScopes() {
  resetHistoryState()
  managerState.historyRuns = [
    finalizeAvailabilityHistoryRun({
      completedAt: 700,
      currentEntries: [historyEntry('folder-b')],
      scope: scope('folder:20', 'Folder B')
    }),
    finalizeAvailabilityHistoryRun({
      completedAt: 600,
      currentEntries: [historyEntry('folder-a')],
      scope: scope('folder:10', 'Folder A')
    }),
    finalizeAvailabilityHistoryRun({
      completedAt: 500,
      currentEntries: [historyEntry('all-scope')],
      scope: scope('all', '全部书签')
    })
  ]

  syncHistoryComparisonScope(callbacksForScope(scope('folder:10', 'Folder A')))

  assert.deepEqual([...managerState.previousHistoryMap.keys()], ['folder-a'])
  assert.equal(managerState.historyLastRunAt, 600)
}

function testLegacyHistoryStillHydratesIntoAllScope() {
  resetHistoryState()
  hydrateDetectionHistory({
    lastRunAt: 800,
    results: [
      historyEntry('legacy-review', { status: 'review' }),
      historyEntry('legacy-failed')
    ]
  }, callbacksForScope(scope('all', '全部书签')))

  assert.equal(managerState.historyRuns.length, 1)
  assert.equal(managerState.historyRuns[0].scope.key, 'all')
  assert.equal(managerState.historyRuns[0].summary.totalAbnormal, 2)
  assert.deepEqual(
    new Set(managerState.previousHistoryMap.keys()),
    new Set(['legacy-review', 'legacy-failed'])
  )
}

async function testFinalizeDetectionHistoryCommitsExplicitRecoveryEvidence() {
  resetHistoryState()
  const storageWrites: Array<Record<string, unknown>> = []
  const previousChrome = (globalThis as any).chrome
  ;(globalThis as any).chrome = {
    runtime: {
      lastError: null
    },
    storage: {
      local: {
        set(payload, callback) {
          storageWrites.push(payload)
          callback()
        }
      }
    }
  }

  try {
    managerState.previousHistoryMap = new Map([
      ['confirmed-healthy', historyEntry('confirmed-healthy', { streak: 2 })],
      ['not-observed', historyEntry('not-observed', { streak: 2 })]
    ])
    managerState.currentHistoryEntries = []

    await finalizeDetectionHistory(
      callbacksForScope(scope('all', '全部书签')),
      {
        checkedHealthyBookmarkIds: new Set(['confirmed-healthy'])
      }
    )

    assert.deepEqual(
      managerState.historyRecoveredResults.map((entry) => entry.id),
      ['confirmed-healthy']
    )
    assert.equal(managerState.historyRuns[0].summary.recoveredCount, 1)
    assert.equal(storageWrites.length, 1)
  } finally {
    if (previousChrome === undefined) {
      delete (globalThis as any).chrome
    } else {
      ;(globalThis as any).chrome = previousChrome
    }
  }
}

testPersistentAbnormalWinsOverHealthyEvidence()
testAvailableAndRedirectedEvidenceRecoverPreviousAbnormalities()
testMissingEntriesAreNotImplicitlyRecovered()
testOnlyExplicitHealthyIdsRecover()
testNewAndPersistentCountsRemainCompatible()
testChangedUrlStartsANewHistoryIdentity()
testChangedUrlDoesNotCreateFalseRecoveryOrStreak()
testHistoryComparisonDoesNotCrossScopes()
testLegacyHistoryStillHydratesIntoAllScope()
await testFinalizeDetectionHistoryCommitsExplicitRecoveryEvidence()
resetHistoryState()

console.log('Availability history behavior tests passed.')
