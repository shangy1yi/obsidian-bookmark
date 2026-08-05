declare global {
  // eslint-disable-next-line no-var
  var __CURATOR_PERF__: boolean | undefined
}

const PERF_LOG_PREFIX = '[Curator Perf]'
const perfConsole = console

function readPerfFlag(): boolean {
  try {
    if (globalThis.__CURATOR_PERF__ === true) {
      return true
    }
  } catch {
    // ignore
  }

  try {
    return globalThis.localStorage?.getItem('curator_perf') === '1'
  } catch {
    return false
  }
}

function getPerformance(): Performance | null {
  try {
    return typeof performance !== 'undefined' ? performance : null
  } catch {
    return null
  }
}

export function mark(name: string): void {
  const perf = getPerformance()
  if (!perf?.mark) {
    return
  }

  try {
    perf.mark(name)
  } catch {
    // ignore mark name collisions or invalid input
  }
}

export function measure(name: string, start: string, end?: string): number | undefined {
  const perf = getPerformance()
  if (!perf?.measure) {
    return undefined
  }

  if (end) {
    mark(end)
  }

  let duration: number | undefined
  try {
    const measureResult = perf.measure(name, start, end)
    duration = (measureResult as PerformanceMeasure | undefined)?.duration
    if (!Number.isFinite(duration)) {
      const entries = perf.getEntriesByName?.(name, 'measure')
      duration = entries?.[entries.length - 1]?.duration
    }
  } catch {
    return undefined
  }

  if (Number.isFinite(duration) && readPerfFlag()) {
    perfConsole.log(`${PERF_LOG_PREFIX} ${name} ${duration!.toFixed(1)}ms`)
  }

  return duration
}

export function measureNow<T>(name: string, fn: () => T): T {
  const perf = getPerformance()
  const startedAt = perf?.now?.() ?? Date.now()
  try {
    return fn()
  } finally {
    const endedAt = perf?.now?.() ?? Date.now()
    const duration = endedAt - startedAt
    if (Number.isFinite(duration) && readPerfFlag()) {
      perfConsole.log(`${PERF_LOG_PREFIX} ${name} ${duration.toFixed(1)}ms`)
    }
  }
}

export function logCount(name: string, count: number): void {
  if (!readPerfFlag()) {
    return
  }

  perfConsole.log(`${PERF_LOG_PREFIX} ${name} count=${count}`)
}
