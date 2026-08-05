import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './popup.css'
import { initSquircleEngine } from '../shared/squircle-engine'
import { PopupApp } from './PopupApp'

const root = document.getElementById('popup-root')

if (!root) {
  throw new Error('Missing popup React root')
}

initSquircleEngine()
createRoot(root).render(<PopupApp portalContainer={root} />)

installPopupCloseSurfaceGuard(root)
void revealPopupWhenStylesAreReady(root)

function installPopupCloseSurfaceGuard(rootElement: HTMLElement): void {
  const hidePopupSurface = () => {
    rootElement.removeAttribute('data-popup-ready')
  }
  const hidePopupSurfaceWhenDocumentIsHidden = () => {
    if (document.visibilityState === 'hidden') {
      hidePopupSurface()
    }
  }

  window.addEventListener('pagehide', hidePopupSurface, { capture: true })
  window.addEventListener('beforeunload', hidePopupSurface, { capture: true })
  document.addEventListener('visibilitychange', hidePopupSurfaceWhenDocumentIsHidden, { capture: true })
}

async function revealPopupWhenStylesAreReady(rootElement: HTMLElement): Promise<void> {
  await waitForPopupStylesheets()
  await waitForInitialPopupCommit(rootElement)
  rootElement.dataset.popupReady = 'true'
}

function waitForInitialPopupCommit(rootElement: HTMLElement): Promise<void> {
  if (rootElement.firstElementChild) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let remainingFrames = 8

    const checkNextFrame = () => {
      if (rootElement.firstElementChild) {
        resolve()
        return
      }

      if (remainingFrames <= 0) {
        resolve()
        return
      }

      remainingFrames -= 1
      window.requestAnimationFrame(checkNextFrame)
    }

    window.requestAnimationFrame(checkNextFrame)
  })
}

async function waitForPopupStylesheets(): Promise<void> {
  const stylesheetLinks = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
  if (!stylesheetLinks.length) {
    return
  }

  await Promise.all(stylesheetLinks.map((link) => waitForStylesheet(link)))
}

function waitForStylesheet(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      link.removeEventListener('load', handleSettled)
      link.removeEventListener('error', handleSettled)
    }
    const handleSettled = () => {
      cleanup()
      resolve()
    }

    link.addEventListener('load', handleSettled, { once: true })
    link.addEventListener('error', handleSettled, { once: true })
  })
}
