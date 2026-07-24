const LOCAL_STORAGE_TRANSACTION_LOCK_NAME = 'curator:local-storage-transaction'

export interface LocalStorageTransaction {
  readonly id: symbol
}

interface LocalStorageWriteOptions {
  transaction?: LocalStorageTransaction | null
}

let fallbackTransactionQueue = Promise.resolve()

export function getLocalStorage<T extends Record<string, unknown> = Record<string, unknown>>(
  keys: string | string[] | Record<string, unknown> | null
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys as never, (items) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve((items || {}) as T)
    })
  })
}

export function withLocalStorageTransaction<T>(
  task: (transaction: LocalStorageTransaction) => Promise<T>
): Promise<T> {
  const lockManager = globalThis.navigator?.locks
  if (lockManager) {
    return lockManager.request(
      LOCAL_STORAGE_TRANSACTION_LOCK_NAME,
      { mode: 'exclusive' },
      () => task(createLocalStorageTransaction())
    )
  }

  const queuedTask = fallbackTransactionQueue
    .catch(() => {})
    .then(() => task(createLocalStorageTransaction()))
  fallbackTransactionQueue = queuedTask.then(() => undefined, () => undefined)
  return queuedTask
}

export function setLocalStorage(
  payload: Record<string, unknown>,
  { transaction = null }: LocalStorageWriteOptions = {}
): Promise<void> {
  if (!transaction) {
    return withLocalStorageTransaction((activeTransaction) => {
      return setLocalStorage(payload, { transaction: activeTransaction })
    })
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(payload, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

export function removeLocalStorage(
  keys: string | string[],
  { transaction = null }: LocalStorageWriteOptions = {}
): Promise<void> {
  if (!transaction) {
    return withLocalStorageTransaction((activeTransaction) => {
      return removeLocalStorage(keys, { transaction: activeTransaction })
    })
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function createLocalStorageTransaction(): LocalStorageTransaction {
  return { id: Symbol(LOCAL_STORAGE_TRANSACTION_LOCK_NAME) }
}
