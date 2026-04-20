import type {
  NavigationCheckMessage,
  NavigationCheckResult
} from '../shared/messages.js'

interface PendingCheckState {
  tabId: number
  requestedUrl: string
  lastUrl: string
  navigationStarted: boolean
  settled: boolean
  timeoutId: number
  resolve: (result: NavigationCheckResult) => void
}

const pendingChecks = new Map<number, PendingCheckState>()

chrome.runtime.onMessage.addListener((message: NavigationCheckMessage, _sender, sendResponse) => {
  if (message?.type !== 'availability:navigate') {
    return undefined
  }

  performNavigationCheck({
    url: message.url,
    timeoutMs: message.timeoutMs
  })
    .then((result) => {
      sendResponse({ ok: true, result })
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : '后台导航检测失败。'
      })
    })

  return true
})

chrome.webNavigation.onCommitted.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (isAboutBlank(details.url)) {
    return
  }

  state.navigationStarted = true
  state.lastUrl = details.url
})

chrome.webNavigation.onCompleted.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (!state.navigationStarted && isAboutBlank(details.url)) {
    return
  }

  finalizeNavigationCheck(details.tabId, {
    status: 'available',
    finalUrl: details.url || state.lastUrl || state.requestedUrl,
    detail: '后台标签页已完成页面导航。',
    errorCode: ''
  })
})

chrome.webNavigation.onErrorOccurred.addListener((details) => {
  const state = getPendingState(details)
  if (!state) {
    return
  }

  if (!state.navigationStarted && isAboutBlank(details.url)) {
    return
  }

  finalizeNavigationCheck(details.tabId, {
    status: 'failed',
    finalUrl: state.lastUrl || details.url || state.requestedUrl,
    detail: `后台导航失败：${details.error}`,
    errorCode: details.error
  })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  const state = pendingChecks.get(tabId)
  if (!state) {
    return
  }

  finalizeNavigationCheck(
    tabId,
    {
      status: 'failed',
      finalUrl: state.lastUrl || state.requestedUrl,
      detail: '后台检测标签页被关闭。',
      errorCode: 'tab-removed'
    },
    { skipClose: true }
  )
})

async function performNavigationCheck({
  url,
  timeoutMs
}: {
  url: string
  timeoutMs?: number
}): Promise<NavigationCheckResult> {
  if (!/^https?:\/\//i.test(String(url || ''))) {
    throw new Error('仅支持检测 http/https 书签。')
  }

  const effectiveTimeout = normalizeTimeout(timeoutMs)
  const tab = await createTab({
    url: 'about:blank',
    active: false
  })

  if (!tab?.id) {
    throw new Error('后台检测标签页创建失败。')
  }

  return new Promise<NavigationCheckResult>((resolve) => {
    const state: PendingCheckState = {
      tabId: tab.id!,
      requestedUrl: url,
      lastUrl: url,
      navigationStarted: false,
      settled: false,
      timeoutId: 0,
      resolve
    }

    pendingChecks.set(tab.id!, state)

    state.timeoutId = self.setTimeout(() => {
      finalizeNavigationCheck(tab.id!, {
        status: 'failed',
        finalUrl: state.lastUrl || state.requestedUrl,
        detail: `后台导航超时，超过 ${Math.round(effectiveTimeout / 1000)} 秒仍未完成页面加载。`,
        errorCode: 'timeout'
      })
    }, effectiveTimeout)

    updateTab(tab.id!, { url }).catch((error) => {
      finalizeNavigationCheck(tab.id!, {
        status: 'failed',
        finalUrl: url,
        detail: error instanceof Error ? error.message : '后台导航启动失败。',
        errorCode: 'tab-update-failed'
      })
    })
  })
}

function getPendingState(
  details: { frameId: number; tabId: number } | null | undefined
): PendingCheckState | null {
  if (!details || details.frameId !== 0) {
    return null
  }

  return pendingChecks.get(details.tabId) || null
}

function finalizeNavigationCheck(
  tabId: number,
  result: NavigationCheckResult,
  { skipClose = false }: { skipClose?: boolean } = {}
): void {
  const state = pendingChecks.get(tabId)
  if (!state || state.settled) {
    return
  }

  state.settled = true
  pendingChecks.delete(tabId)

  if (state.timeoutId) {
    clearTimeout(state.timeoutId)
  }

  if (!skipClose) {
    closeTab(tabId).catch(() => {})
  }

  state.resolve(result)
}

function isAboutBlank(url: string | undefined): boolean {
  return String(url || '').startsWith('about:blank')
}

function normalizeTimeout(value: unknown): number {
  const timeout = Number(value)
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return 15000
  }

  return Math.max(timeout, 1000)
}

function createTab(properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

function updateTab(
  tabId: number,
  properties: chrome.tabs.UpdateProperties
): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, properties, (tab) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

function closeTab(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}
