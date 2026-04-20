type NavigationStatus = 'available' | 'failed'

export interface NavigationCheckMessage {
  type: 'availability:navigate'
  url: string
  timeoutMs?: number
}

export interface NavigationCheckResult {
  status: NavigationStatus
  finalUrl: string
  detail: string
  errorCode: string
}

interface NavigationCheckResponse {
  ok: boolean
  result?: NavigationCheckResult
  error?: string
}

export function requestNavigationCheck(
  url: string,
  timeoutMs?: number
): Promise<NavigationCheckResult> {
  const message: NavigationCheckMessage = { type: 'availability:navigate', url, timeoutMs }
  return sendRuntimeMessage<NavigationCheckResult>(message)
}

function sendRuntimeMessage<TResult>(message: unknown): Promise<TResult> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: NavigationCheckResponse) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      if (!response?.ok) {
        reject(new Error(response?.error || '后台检测失败。'))
        return
      }

      resolve(response.result as TResult)
    })
  })
}
