import { useLayoutEffect } from 'react'
import { useNewtabInstantWallpaperView } from '../newtab-instant-wallpaper-store'

const STARTUP_PREVIEW_CLASS = 'instant-wallpaper-startup-preview'

export function NewtabInstantWallpaperHost() {
  const view = useNewtabInstantWallpaperView()

  useLayoutEffect(() => {
    const root = document.documentElement
    syncPersistentWallpaperProperties(root, view)
    syncWallpaperState(root, view)
    root.classList.toggle(
      STARTUP_PREVIEW_CLASS,
      hasUsableStartupPreview(view.previewImage) && !view.remoteReady
    )
  }, [view])

  return null
}

function hasUsableStartupPreview(previewImage: string): boolean {
  const normalizedPreviewImage = String(previewImage || '').trim()
  return Boolean(normalizedPreviewImage && normalizedPreviewImage !== 'none')
}

function syncPersistentWallpaperProperties(
  root: HTMLElement,
  view: ReturnType<typeof useNewtabInstantWallpaperView>
): void {
  setOrRemoveProperty(root, '--bg', view.backgroundColor)
  setOrRemoveProperty(root, '--wallpaper-placeholder-bg', view.placeholderColor)
  setOrRemoveProperty(root, '--instant-wallpaper-image', view.image)
  setOrRemoveProperty(root, '--instant-wallpaper-preview-image', view.previewImage)
  setOrRemoveProperty(root, '--instant-wallpaper-size', view.size)
  setOrRemoveProperty(root, '--instant-wallpaper-position', view.position)
}

function syncWallpaperState(
  root: HTMLElement,
  view: ReturnType<typeof useNewtabInstantWallpaperView>
): void {
  root.classList.toggle('loading-wallpaper', view.loading)
  root.classList.toggle('newtab-booting', view.booting)
  root.classList.toggle('instant-wallpaper-ready', view.ready)
  root.classList.toggle('instant-wallpaper-remote-ready', view.remoteReady)
  setOrDeleteDataset(root, 'instantWallpaperPending', view.pending ? 'true' : '')
  setOrDeleteDataset(root, 'instantWallpaperRemoteReady', view.remoteReady ? 'true' : '')
  setOrDeleteDataset(root, 'instantWallpaperSignature', view.signature)
}

function setOrRemoveProperty(root: HTMLElement, property: string, value: string): void {
  if (value) {
    root.style.setProperty(property, value)
  } else {
    root.style.removeProperty(property)
  }
}

function setOrDeleteDataset(root: HTMLElement, key: string, value: string): void {
  if (value) {
    root.dataset[key] = value
  } else {
    delete root.dataset[key]
  }
}
