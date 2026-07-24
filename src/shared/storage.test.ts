import assert from 'node:assert/strict'
import test from 'node:test'
import {
  removeLocalStorage,
  setLocalStorage,
  withLocalStorageTransaction
} from './storage.js'

class TestLockManager {
  private queue = Promise.resolve()

  request<T>(
    _name: string,
    _options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>
  ): Promise<T> {
    const result = this.queue.then(() => callback({ name: 'test-lock', mode: 'exclusive' }))
    this.queue = result.then(() => undefined, () => undefined)
    return result
  }
}

const writes: string[] = []
let runtimeError = ''

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    locks: new TestLockManager()
  }
})

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      get lastError() {
        return runtimeError ? { message: runtimeError } : undefined
      }
    },
    storage: {
      local: {
        get(_keys: unknown, callback: (items: Record<string, unknown>) => void) {
          callback({})
        },
        set(payload: Record<string, unknown>, callback: () => void) {
          writes.push(`set:${Object.keys(payload).join(',')}`)
          callback()
        },
        remove(keys: string | string[], callback: () => void) {
          writes.push(`remove:${Array.isArray(keys) ? keys.join(',') : keys}`)
          callback()
        }
      }
    }
  } as unknown as typeof chrome
})

test('holds standalone writes behind a multi-step cross-context transaction', async () => {
  writes.length = 0
  let releaseTransaction: () => void = () => {}
  let markTransactionStarted: () => void = () => {}
  const transactionStarted = new Promise<void>((resolve) => {
    markTransactionStarted = resolve
  })
  const transactionGate = new Promise<void>((resolve) => {
    releaseTransaction = resolve
  })

  const transaction = withLocalStorageTransaction(async (token) => {
    await setLocalStorage({ first: 1 }, { transaction: token })
    markTransactionStarted()
    await transactionGate
    await removeLocalStorage('first', { transaction: token })
  })
  await transactionStarted

  const queuedWrite = setLocalStorage({ second: 2 })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(writes, ['set:first'])

  releaseTransaction()
  await Promise.all([transaction, queuedWrite])
  assert.deepEqual(writes, ['set:first', 'remove:first', 'set:second'])
})

test('a failed transaction does not poison later storage writes', async () => {
  writes.length = 0
  await assert.rejects(
    withLocalStorageTransaction(async () => {
      throw new Error('simulated transaction failure')
    }),
    /simulated transaction failure/
  )

  runtimeError = ''
  await setLocalStorage({ recovered: true })
  assert.deepEqual(writes, ['set:recovered'])
})
