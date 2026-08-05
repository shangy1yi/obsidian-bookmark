export interface RunIdleOptions {
  timeout?: number
}

export function runIdle(callback: () => void, options: RunIdleOptions = {}): void {
  const requestIdle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number })
    .requestIdleCallback
  if (typeof requestIdle === 'function') {
    requestIdle(callback, options.timeout != null ? { timeout: options.timeout } : undefined)
    return
  }
  setTimeout(callback, 50)
}
