import {
  AVAILABILITY_CONCURRENCY,
  NAVIGATION_RETRY_TIMEOUT_MS,
  NAVIGATION_TIMEOUT_MS
} from '../shared-options/constants.js'
import { AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT } from '../../shared/messages.js'
import { FETCH_TIMEOUT_MS } from './classifier.js'

export type AvailabilitySpeedProfileName = 'balanced'
export type AvailabilityRunnerUserSettings = Partial<Pick<
  AvailabilitySpeedProfile,
  'concurrency' | 'navigationTimeoutMs'
>>

export interface AvailabilitySpeedProfile {
  name: AvailabilitySpeedProfileName
  label: string
  concurrency: number
  domainConcurrency: number
  navigationTimeoutMs: number
  retryNavigationTimeoutMs: number
  probeTimeoutMs: number
  timeoutCooldownMs: number
  throttleCooldownMs: number
  maxCooldownMs: number
  pollIntervalMs: number
}

export interface AvailabilityRunOutcome {
  kind?: 'success' | 'timeout' | 'throttle' | 'http' | 'network' | 'unknown'
  statusCode?: number
  errorCode?: string
  detail?: string
  timedOut?: boolean
}

export interface AvailabilityTimeoutPolicy {
  navigationTimeoutMs: number
  retryNavigationTimeoutMs: number
  probeTimeoutMs: number
}

export interface AvailabilityRunnerSnapshot extends AvailabilityTimeoutPolicy {
  profileName: AvailabilitySpeedProfileName
  profileLabel: string
  concurrency: number
  domainConcurrency: number
  activeCount: number
  slowedDomainCount: number
  lastSlowdownReason: string
}

interface DomainRunState {
  activeCount: number
  cooldownUntil: number
  timeoutSignals: number
  throttleSignals: number
  lastSlowdownReason: string
}

interface AvailabilityRunLease {
  release: () => void
}

export type AvailabilityRunnerWait = (
  ms: number,
  signal?: AbortSignal | null
) => Promise<void>

export interface AvailabilityCooldownWaitOptions {
  signal?: AbortSignal | null
  shouldContinue?: () => boolean | Promise<boolean>
  wait?: AvailabilityRunnerWait
  onWait?: (snapshot: AvailabilityRunnerSnapshot) => void
}

export interface AvailabilityRunScheduler {
  getProfile: () => AvailabilitySpeedProfile
  getConcurrency: () => number
  getTimeoutPolicy: (_url?: unknown) => AvailabilityTimeoutPolicy
  getCooldownDelay: (url: unknown) => number
  getAcquireDelay: (url: unknown) => number
  tryAcquire: (url: unknown) => AvailabilityRunLease | null
  recordOutcome: (url: unknown, outcome?: AvailabilityRunOutcome | null) => void
  waitForCooldown: (
    url: unknown,
    options?: AvailabilityCooldownWaitOptions
  ) => Promise<boolean>
  getSnapshot: () => AvailabilityRunnerSnapshot
}

export interface AvailabilityRunSchedulerOptions {
  profile?: Partial<AvailabilitySpeedProfile> | AvailabilitySpeedProfileName
  now?: () => number
}

export interface AvailabilityQueueOptions<TItem> {
  items: TItem[]
  scheduler: AvailabilityRunScheduler
  getUrl: (item: TItem) => unknown
  processItem: (
    item: TItem,
    context: { index: number; scheduler: AvailabilityRunScheduler }
  ) => Promise<void> | void
  shouldContinue?: () => boolean | Promise<boolean>
  shouldSkip?: (item: TItem) => boolean
  wait?: (ms: number) => Promise<void>
  onWait?: (snapshot: AvailabilityRunnerSnapshot) => void
  onItemSettled?: (item: TItem, index: number) => void
}

const BALANCED_PROFILE: AvailabilitySpeedProfile = {
  name: 'balanced',
  label: '平衡模式',
  concurrency: AVAILABILITY_CONCURRENCY,
  domainConcurrency: 1,
  navigationTimeoutMs: NAVIGATION_TIMEOUT_MS,
  retryNavigationTimeoutMs: NAVIGATION_RETRY_TIMEOUT_MS,
  probeTimeoutMs: FETCH_TIMEOUT_MS,
  timeoutCooldownMs: 3500,
  throttleCooldownMs: 8000,
  maxCooldownMs: 15000,
  pollIntervalMs: 250
}

const AVAILABILITY_SPEED_PROFILES: Record<AvailabilitySpeedProfileName, AvailabilitySpeedProfile> = {
  balanced: BALANCED_PROFILE
}

export function getDefaultAvailabilityRunnerUserSettings(): Required<AvailabilityRunnerUserSettings> {
  return {
    concurrency: BALANCED_PROFILE.concurrency,
    navigationTimeoutMs: BALANCED_PROFILE.navigationTimeoutMs
  }
}

export function normalizeAvailabilityRunnerUserSettings(
  value: unknown
): Required<AvailabilityRunnerUserSettings> {
  const source = value && typeof value === 'object'
    ? value as AvailabilityRunnerUserSettings
    : {}

  return {
    concurrency: clampInteger(
      source.concurrency,
      1,
      AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT,
      BALANCED_PROFILE.concurrency
    ),
    navigationTimeoutMs: clampInteger(
      source.navigationTimeoutMs,
      5000,
      120000,
      BALANCED_PROFILE.navigationTimeoutMs
    )
  }
}

export function buildAvailabilityProfileFromUserSettings(
  value: unknown
): AvailabilitySpeedProfile {
  const settings = normalizeAvailabilityRunnerUserSettings(value)
  const retryNavigationTimeoutMs = Math.max(
    settings.navigationTimeoutMs,
    Math.round(settings.navigationTimeoutMs * 1.5)
  )
  const probeTimeoutMs = Math.max(
    5000,
    Math.min(FETCH_TIMEOUT_MS, settings.navigationTimeoutMs)
  )

  return normalizeAvailabilitySpeedProfile({
    concurrency: settings.concurrency,
    navigationTimeoutMs: settings.navigationTimeoutMs,
    retryNavigationTimeoutMs,
    probeTimeoutMs
  })
}

function normalizeAvailabilitySpeedProfile(
  profile: Partial<AvailabilitySpeedProfile> | AvailabilitySpeedProfileName = 'balanced'
): AvailabilitySpeedProfile {
  const source = typeof profile === 'string'
    ? AVAILABILITY_SPEED_PROFILES[profile] || BALANCED_PROFILE
    : { ...BALANCED_PROFILE, ...profile }

  return {
    name: source.name === 'balanced' ? source.name : 'balanced',
    label: String(source.label || BALANCED_PROFILE.label),
    concurrency: clampInteger(
      source.concurrency,
      1,
      AVAILABILITY_NAVIGATION_CONCURRENCY_LIMIT,
      BALANCED_PROFILE.concurrency
    ),
    domainConcurrency: clampInteger(source.domainConcurrency, 1, 3, BALANCED_PROFILE.domainConcurrency),
    navigationTimeoutMs: clampInteger(source.navigationTimeoutMs, 5000, 120000, BALANCED_PROFILE.navigationTimeoutMs),
    retryNavigationTimeoutMs: clampInteger(
      source.retryNavigationTimeoutMs,
      5000,
      120000,
      BALANCED_PROFILE.retryNavigationTimeoutMs
    ),
    probeTimeoutMs: clampInteger(source.probeTimeoutMs, 5000, 120000, BALANCED_PROFILE.probeTimeoutMs),
    timeoutCooldownMs: clampInteger(source.timeoutCooldownMs, 0, 60000, BALANCED_PROFILE.timeoutCooldownMs),
    throttleCooldownMs: clampInteger(source.throttleCooldownMs, 0, 120000, BALANCED_PROFILE.throttleCooldownMs),
    maxCooldownMs: clampInteger(source.maxCooldownMs, 0, 180000, BALANCED_PROFILE.maxCooldownMs),
    pollIntervalMs: clampInteger(source.pollIntervalMs, 25, 1000, BALANCED_PROFILE.pollIntervalMs)
  }
}

export function createAvailabilityRunScheduler(
  options: AvailabilityRunSchedulerOptions = {}
): AvailabilityRunScheduler {
  const profile = normalizeAvailabilitySpeedProfile(options.profile)
  const now = typeof options.now === 'function' ? options.now : () => Date.now()
  const domainStates = new Map<string, DomainRunState>()
  let activeCount = 0
  let lastSlowdownReason = ''

  function getOrCreateDomainState(url: unknown): DomainRunState {
    const domain = getAvailabilityDomainKey(url)
    let state = domainStates.get(domain)

    if (!state) {
      state = {
        activeCount: 0,
        cooldownUntil: 0,
        timeoutSignals: 0,
        throttleSignals: 0,
        lastSlowdownReason: ''
      }
      domainStates.set(domain, state)
    }

    return state
  }

  function getAcquireDelay(url: unknown): number {
    const state = getOrCreateDomainState(url)
    if (activeCount >= profile.concurrency || state.activeCount >= profile.domainConcurrency) {
      return profile.pollIntervalMs
    }

    return getCooldownDelay(url)
  }

  function getCooldownDelay(url: unknown): number {
    const state = getOrCreateDomainState(url)
    return Math.max(0, state.cooldownUntil - now())
  }

  function tryAcquire(url: unknown): AvailabilityRunLease | null {
    const state = getOrCreateDomainState(url)
    if (getAcquireDelay(url) > 0) {
      return null
    }

    activeCount += 1
    state.activeCount += 1
    let released = false

    return {
      release() {
        if (released) {
          return
        }

        released = true
        activeCount = Math.max(0, activeCount - 1)
        state.activeCount = Math.max(0, state.activeCount - 1)
      }
    }
  }

  function recordOutcome(url: unknown, outcome: AvailabilityRunOutcome | null = {}): void {
    const state = getOrCreateDomainState(url)
    const normalized = normalizeAvailabilityRunOutcome(outcome)

    if (normalized.kind === 'throttle') {
      state.throttleSignals += 1
      state.timeoutSignals = Math.max(0, state.timeoutSignals - 1)
      state.lastSlowdownReason = 'HTTP 429'
      lastSlowdownReason = 'HTTP 429'
      state.cooldownUntil = Math.max(
        state.cooldownUntil,
        now() + getCooldownMs(profile.throttleCooldownMs, state.throttleSignals, profile.maxCooldownMs)
      )
      return
    }

    if (normalized.kind === 'timeout') {
      state.timeoutSignals += 1
      state.throttleSignals = Math.max(0, state.throttleSignals - 1)
      state.lastSlowdownReason = '超时'
      lastSlowdownReason = '超时'
      state.cooldownUntil = Math.max(
        state.cooldownUntil,
        now() + getCooldownMs(profile.timeoutCooldownMs, state.timeoutSignals, profile.maxCooldownMs)
      )
      return
    }

    if (normalized.kind === 'success') {
      state.timeoutSignals = Math.max(0, state.timeoutSignals - 1)
      state.throttleSignals = Math.max(0, state.throttleSignals - 1)
      if (!state.timeoutSignals && !state.throttleSignals && state.cooldownUntil <= now()) {
        state.lastSlowdownReason = ''
      }
    }
  }

  function getSnapshot(): AvailabilityRunnerSnapshot {
    const timestamp = now()
    const slowedStates = [...domainStates.values()].filter((state) => {
      return state.cooldownUntil > timestamp || state.timeoutSignals > 0 || state.throttleSignals > 0
    })
    const latestSlowdownReason = [...slowedStates]
      .reverse()
      .map((state) => state.lastSlowdownReason)
      .find(Boolean)

    return {
      profileName: profile.name,
      profileLabel: profile.label,
      concurrency: profile.concurrency,
      domainConcurrency: profile.domainConcurrency,
      navigationTimeoutMs: profile.navigationTimeoutMs,
      retryNavigationTimeoutMs: profile.retryNavigationTimeoutMs,
      probeTimeoutMs: profile.probeTimeoutMs,
      activeCount,
      slowedDomainCount: slowedStates.length,
      lastSlowdownReason: latestSlowdownReason || lastSlowdownReason
    }
  }

  async function waitForCooldown(
    url: unknown,
    {
      signal = null,
      shouldContinue,
      wait = waitForAvailabilityRunnerDelay,
      onWait
    }: AvailabilityCooldownWaitOptions = {}
  ): Promise<boolean> {
    while (true) {
      if (signal?.aborted) {
        return false
      }
      if (shouldContinue && !(await shouldContinue())) {
        return false
      }

      const delayMs = getCooldownDelay(url)
      if (delayMs <= 0) {
        return true
      }

      onWait?.(getSnapshot())
      try {
        await wait(delayMs, signal)
      } catch (error) {
        if (signal?.aborted || isAbortError(error)) {
          return false
        }
        throw error
      }
    }
  }

  return {
    getProfile: () => profile,
    getConcurrency: () => profile.concurrency,
    getTimeoutPolicy: () => ({
      navigationTimeoutMs: profile.navigationTimeoutMs,
      retryNavigationTimeoutMs: profile.retryNavigationTimeoutMs,
      probeTimeoutMs: profile.probeTimeoutMs
    }),
    getCooldownDelay,
    getAcquireDelay,
    tryAcquire,
    recordOutcome,
    waitForCooldown,
    getSnapshot
  }
}

export async function runAvailabilityQueue<TItem>({
  items,
  scheduler,
  getUrl,
  processItem,
  shouldContinue,
  shouldSkip,
  wait = waitForAvailabilityRunnerDelay,
  onWait,
  onItemSettled
}: AvailabilityQueueOptions<TItem>): Promise<void> {
  const pendingEntries = items.map((item, index) => ({ item, index }))
  const workerCount = Math.min(scheduler.getConcurrency(), pendingEntries.length)

  async function worker(): Promise<void> {
    while (pendingEntries.length) {
      if (shouldContinue && !(await shouldContinue())) {
        return
      }

      const nextEntry = takeNextQueueEntry(pendingEntries, scheduler, getUrl, shouldSkip)
      if (!nextEntry) {
        if (!pendingEntries.length) {
          return
        }
        onWait?.(scheduler.getSnapshot())
        await wait(getNextQueueDelay(pendingEntries, scheduler, getUrl))
        continue
      }

      const { item, index, lease } = nextEntry
      try {
        await processItem(item, { index, scheduler })
      } finally {
        lease.release()
        onItemSettled?.(item, index)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

export function formatAvailabilityRunnerStatus(snapshot: AvailabilityRunnerSnapshot): string {
  const base = `${snapshot.profileLabel} · 并发 ${snapshot.concurrency} · 单域名 ${snapshot.domainConcurrency} · 导航 ${formatSeconds(snapshot.navigationTimeoutMs)}/${formatSeconds(snapshot.retryNavigationTimeoutMs)} · 探测 ${formatSeconds(snapshot.probeTimeoutMs)}`

  if (snapshot.slowedDomainCount > 0) {
    const reason = snapshot.lastSlowdownReason ? `，最近因 ${snapshot.lastSlowdownReason}` : ''
    return `${base}；已对 ${snapshot.slowedDomainCount} 个域名自动降速${reason}。`
  }

  return `${base}；遇到超时或 HTTP 429 会自动降速。`
}

function getAvailabilityDomainKey(url: unknown): string {
  try {
    return new URL(String(url || '')).hostname.replace(/^www\./i, '').toLowerCase() || '__unknown__'
  } catch {
    return '__unknown__'
  }
}

function takeNextQueueEntry<TItem>(
  pendingEntries: Array<{ item: TItem; index: number }>,
  scheduler: AvailabilityRunScheduler,
  getUrl: (item: TItem) => unknown,
  shouldSkip?: (item: TItem) => boolean
): { item: TItem; index: number; lease: AvailabilityRunLease } | null {
  for (let index = 0; index < pendingEntries.length; index += 1) {
    const entry = pendingEntries[index]
    if (shouldSkip?.(entry.item)) {
      pendingEntries.splice(index, 1)
      index -= 1
      continue
    }

    const lease = scheduler.tryAcquire(getUrl(entry.item))
    if (!lease) {
      continue
    }

    pendingEntries.splice(index, 1)
    return { ...entry, lease }
  }

  return null
}

function getNextQueueDelay<TItem>(
  pendingEntries: Array<{ item: TItem; index: number }>,
  scheduler: AvailabilityRunScheduler,
  getUrl: (item: TItem) => unknown
): number {
  const delays = pendingEntries.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((entry) => scheduler.getAcquireDelay(getUrl(entry.item)))(combineValue); return ((delay) => Number.isFinite(delay) && delay > 0)(combinedResult) ? [combinedResult] : [] })

  const nextDelay = delays.length ? Math.min(...delays) : scheduler.getProfile().pollIntervalMs
  return Math.max(1, Math.min(nextDelay, scheduler.getProfile().pollIntervalMs))
}

function normalizeAvailabilityRunOutcome(outcome: AvailabilityRunOutcome | null = {}): AvailabilityRunOutcome {
  const statusCode = Number(outcome?.statusCode) || 0
  const errorCode = String(outcome?.errorCode || '').trim()
  const detail = String(outcome?.detail || '').trim()

  if (outcome?.kind === 'throttle' || statusCode === 429) {
    return { ...outcome, kind: 'throttle' }
  }

  if (
    outcome?.kind === 'timeout' ||
    outcome?.timedOut ||
    ['timeout', 'net::ERR_TIMED_OUT', 'net::ERR_CONNECTION_TIMED_OUT'].includes(errorCode) ||
    /timeout|超时/i.test(detail)
  ) {
    return { ...outcome, kind: 'timeout' }
  }

  if (outcome?.kind === 'success' || (statusCode >= 200 && statusCode < 400)) {
    return { ...outcome, kind: 'success' }
  }

  return { ...outcome, kind: outcome?.kind || 'unknown' }
}

function getCooldownMs(baseCooldownMs: number, signalCount: number, maxCooldownMs: number): number {
  if (!baseCooldownMs || !maxCooldownMs) {
    return 0
  }

  const multiplier = Math.max(1, Math.min(signalCount, 3))
  return Math.min(maxCooldownMs, baseCooldownMs * multiplier)
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.round(numericValue)))
}

function formatSeconds(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))}s`
}

function waitForAvailabilityRunnerDelay(
  ms: number,
  signal: AbortSignal | null = null
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError())
      return
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, Math.max(1, Math.round(ms)))
    const handleAbort = () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
      reject(createAbortError())
    }
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

function createAbortError(): Error | DOMException {
  if (typeof DOMException === 'function') {
    return new DOMException('操作已取消。', 'AbortError')
  }

  const error = new Error('操作已取消。')
  error.name = 'AbortError'
  return error
}
