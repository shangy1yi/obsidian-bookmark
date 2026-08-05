import type { CSSProperties } from 'react'
import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import type { BookmarkIconShellFavicon } from './components/BookmarkIconShell'

export interface SpeedDialDragGhostView {
  customIcon: boolean
  detail: string
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  height: number
  style?: CSSProperties
  title: string
  transform: string
  visible: boolean
  width: number
}

export interface BookmarkDragGhostView {
  customIcon: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  height: number
  showTitles: boolean
  style?: CSSProperties
  title: string
  transform: string
  visible: boolean
  width: number
}

export interface FolderDragGhostView {
  bookmarkCount: number
  height: number
  style?: CSSProperties
  title: string
  transform: string
  width: number
}

export interface NewtabDragLayerView {
  bookmarkGhost: BookmarkDragGhostView | null
  folderGhost: FolderDragGhostView | null
  speedDialGhost: SpeedDialDragGhostView | null
}

const EMPTY_VIEW: NewtabDragLayerView = {
  bookmarkGhost: null,
  folderGhost: null,
  speedDialGhost: null
}

const dragLayerStore = createUiViewStoreSlice('newtab', 'drag-layer', EMPTY_VIEW)

function patchNewtabDragLayerView(
  patcher: (view: NewtabDragLayerView) => NewtabDragLayerView
): void {
  dragLayerStore.setState(patcher)
}

export function dispatchSpeedDialDragGhostView(view: SpeedDialDragGhostView | null): void {
  patchNewtabDragLayerView((current) => ({
    ...current,
    speedDialGhost: view
  }))
}

export function patchSpeedDialDragGhostView(
  patcher: (view: SpeedDialDragGhostView) => SpeedDialDragGhostView
): void {
  patchNewtabDragLayerView((current) => {
    if (!current.speedDialGhost) {
      return current
    }
    return {
      ...current,
      speedDialGhost: patcher(current.speedDialGhost)
    }
  })
}

export function dispatchBookmarkDragGhostView(view: BookmarkDragGhostView | null): void {
  patchNewtabDragLayerView((current) => ({
    ...current,
    bookmarkGhost: view
  }))
}

export function patchBookmarkDragGhostView(
  patcher: (view: BookmarkDragGhostView) => BookmarkDragGhostView
): void {
  patchNewtabDragLayerView((current) => {
    if (!current.bookmarkGhost) {
      return current
    }
    return {
      ...current,
      bookmarkGhost: patcher(current.bookmarkGhost)
    }
  })
}

export function dispatchFolderDragGhostView(view: FolderDragGhostView | null): void {
  patchNewtabDragLayerView((current) => ({
    ...current,
    folderGhost: view
  }))
}

export function patchFolderDragGhostView(
  patcher: (view: FolderDragGhostView) => FolderDragGhostView
): void {
  patchNewtabDragLayerView((current) => {
    if (!current.folderGhost) {
      return current
    }
    return {
      ...current,
      folderGhost: patcher(current.folderGhost)
    }
  })
}

export function useNewtabDragLayerView(): NewtabDragLayerView {
  return useUiViewStoreSlice(dragLayerStore)
}
