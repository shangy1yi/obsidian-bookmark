import { useEffect, useState } from 'react'
import { cx } from '../ui/base/utils'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import {
  dispatchPopupModalAction,
  usePopupModalsView,
  usePopupSmartClassifierView
} from './popup-controller-store'
import {
  dispatchPopupDocumentKeyDown,
  dispatchPopupPageHide,
  dispatchPopupStorageChanged
} from './popup-browser-events-store'
import { usePopupController } from './popup-controller'
import { PopupAutoAnalyzeStatus } from './components/PopupAutoAnalyzeStatus'
import { PopupChromeHost } from './components/PopupChromeHost'
import { PopupContentHost } from './components/PopupContentHost'
import { PopupSmartClassifierHost } from './components/PopupSmartClassifierHost'
import { PopupToasts } from './components/PopupToasts'

const appShellBaseClass = [
  'group relative flex h-full flex-col overflow-hidden border border-ds-border bg-ds-app text-ds-text-primary',
  'px-3.5 pb-3.5 pt-0 [font-family:var(--font-sans)] tracking-normal [hanging-punctuation:allow-end] [line-break:strict] [text-autospace:normal] [text-spacing-trim:trim-start] max-[520px]:px-2.5 max-[520px]:pb-2.5'
].join(' ')
const appShellDefaultClass = 'gap-[14px]'
const appShellSmartClass = 'gap-2'
const contentShellClass =
  'relative z-[1] grid min-h-0 flex-[1_1_auto] overflow-hidden border-0 bg-transparent [height:auto]'

type PopupModalLayerComponent = (typeof import('./components/PopupModalLayer'))['PopupModalLayer']

let popupModalLayerComponent: PopupModalLayerComponent | null = null
let popupModalLayerPromise: Promise<PopupModalLayerComponent> | null = null

function loadPopupModalLayer(): Promise<PopupModalLayerComponent> {
  if (popupModalLayerComponent) {
    return Promise.resolve(popupModalLayerComponent)
  }
  popupModalLayerPromise ||= import('./components/PopupModalLayer').then((module) => {
    popupModalLayerComponent = module.PopupModalLayer
    return module.PopupModalLayer
  })
  return popupModalLayerPromise
}

export function PopupApp({ portalContainer }: { portalContainer?: HTMLElement | null }) {
  usePopupController()

  return (
    <ThemeProvider>
      <PopupShell portalContainer={portalContainer} />
    </ThemeProvider>
  )
}

function subscribeToPopupStorageChanges(): () => void {
  const storage = typeof chrome === 'undefined' ? null : chrome.storage
  if (!storage) {
    return () => undefined
  }

  storage.onChanged.addListener(dispatchPopupStorageChanged)
  return () => {
    storage.onChanged.removeListener(dispatchPopupStorageChanged)
  }
}

function PopupShell({ portalContainer }: { portalContainer?: HTMLElement | null }) {
  const modalsView = usePopupModalsView()
  const smartClassifierView = usePopupSmartClassifierView()
  const modalOpen = modalsView.open
  const smartActive = ['loading', 'results', 'error', 'permission'].includes(smartClassifierView.status)
  useEffect(() => {
    const unsubscribeStorageChanges = subscribeToPopupStorageChanges()

    document.addEventListener('keydown', dispatchPopupDocumentKeyDown)
    window.addEventListener('pagehide', dispatchPopupPageHide)
    return () => {
      unsubscribeStorageChanges()
      document.removeEventListener('keydown', dispatchPopupDocumentKeyDown)
      window.removeEventListener('pagehide', dispatchPopupPageHide)
    }
  }, [])

  const appShellClassName = cx(
    appShellBaseClass,
    smartActive ? appShellSmartClass : appShellDefaultClass
  )

  return (
    <>
      <main
        id="popup-app-shell"
        className={appShellClassName}
        aria-hidden={modalOpen ? 'true' : 'false'}
        inert={modalOpen}
      >
        <PopupChromeHost smartActive={smartActive}>
          <PopupSmartClassifierHost />
        </PopupChromeHost>

        <section className={contentShellClass} hidden={smartActive}>
          <PopupContentHost />
        </section>

        <PopupAutoAnalyzeStatus smartActive={smartActive} />
      </main>

      <DeferredPopupModalLayer
        open={modalOpen}
        portalContainer={portalContainer ?? undefined}
      />

      <PopupToasts />
    </>
  )
}

function DeferredPopupModalLayer({
  open,
  portalContainer
}: {
  open: boolean
  portalContainer?: HTMLElement
}) {
  const [Layer, setLayer] = useState<PopupModalLayerComponent | null>(popupModalLayerComponent)

  useEffect(() => {
    if (Layer || !open) {
      return
    }

    let active = true
    void loadPopupModalLayer().then((Component) => {
      if (active) {
        setLayer(() => Component)
      }
    })

    return () => {
      active = false
    }
  }, [Layer, open])

  return Layer ? (
    <Layer
      open={open}
      portalContainer={portalContainer}
      onDismiss={() => dispatchPopupModalAction('close')}
    />
  ) : null
}
