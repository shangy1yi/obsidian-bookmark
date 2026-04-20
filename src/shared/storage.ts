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

export function setLocalStorage(payload: Record<string, unknown>): Promise<void> {
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
