import { useEffect, useLayoutEffect } from 'react'
import {
  getNewtabBackgroundMediaView,
  useNewtabBackgroundMediaView
} from '../newtab-background-media-store'
import { dispatchNewtabInstantWallpaperView } from '../newtab-instant-wallpaper-store'

const BACKGROUND_VIDEO_CLASS = 'fixed inset-0 z-0 h-full w-full object-cover pointer-events-none newtab-background-video'
const BACKGROUND_VIDEO_LOADING_CLASS = 'opacity-0'
const BACKGROUND_VIDEO_READY_CLASS = 'opacity-100'
const RUNTIME_WALLPAPER_IMAGE_PROPERTY = '--newtab-runtime-wallpaper-image'

interface NewtabBackgroundLayerProps {
  loadingWallpaper: boolean
}

export function NewtabBackgroundLayer({ loadingWallpaper }: NewtabBackgroundLayerProps) {
  const media = useNewtabBackgroundMediaView()

  useLayoutEffect(() => {
    const root = document.documentElement
    if (media.kind === 'image' && media.src) {
      root.style.setProperty(
        RUNTIME_WALLPAPER_IMAGE_PROPERTY,
        `url("${escapeStyleUrl(media.src)}")`
      )
    } else {
      root.style.removeProperty(RUNTIME_WALLPAPER_IMAGE_PROPERTY)
    }
  }, [media.kind, media.src])

  useEffect(() => {
    if (media.kind !== 'image' || !media.src) {
      return
    }

    const src = media.src
    const image = new Image()
    let cancelled = false
    void waitForImageDecode(image, src).then((ready) => {
      if (!cancelled && ready) {
        markImageLayerReady(src)
      }
    })

    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [media.kind, media.src])

  const videoSrc = media.kind === 'video' ? media.src : ''
  const videoClassName = [
    BACKGROUND_VIDEO_CLASS,
    !videoSrc || loadingWallpaper ? BACKGROUND_VIDEO_LOADING_CLASS : BACKGROUND_VIDEO_READY_CLASS
  ].join(' ')

  return (
    <video
      className={videoClassName}
      src={videoSrc || undefined}
      poster={videoSrc && media.poster ? media.poster : undefined}
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      onLoadedData={() => markVideoLayerReady(videoSrc)}
      onCanPlay={() => markVideoLayerReady(videoSrc)}
      onPlaying={() => markVideoLayerReady(videoSrc)}
    />
  )
}

function waitForImageDecode(image: HTMLImageElement, src: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      image.onload = null
      image.onerror = null
      if (!ready || typeof image.decode !== 'function') {
        resolve(ready)
        return
      }
      image.decode()
        .then(() => resolve(true))
        .catch(() => resolve(true))
    }

    image.decoding = 'async'
    image.onload = () => settle(true)
    image.onerror = () => settle(false)
    image.src = src
    if (image.complete) {
      settle(Boolean(image.naturalWidth || image.width))
    }
  })
}

function markImageLayerReady(src: string): void {
  const media = getNewtabBackgroundMediaView()
  if (media.kind !== 'image' || media.src !== src) {
    return
  }

  dispatchNewtabInstantWallpaperView({
    booting: false,
    loaderVisible: false,
    loading: false,
    pending: false,
    remoteReady: true
  })
}

function markVideoLayerReady(src: string): void {
  const media = getNewtabBackgroundMediaView()
  if (media.kind !== 'video' || media.src !== src) {
    return
  }

  dispatchNewtabInstantWallpaperView({
    booting: false,
    loaderVisible: false,
    loading: false,
    pending: false,
    remoteReady: true
  })
}

function escapeStyleUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
