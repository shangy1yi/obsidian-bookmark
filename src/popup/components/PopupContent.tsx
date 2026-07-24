import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../ui/base/Button'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { cx } from '../../ui/base/utils'
import { getMotionDurationMs, prefersReducedMotion } from '../../shared/motion'
import { HighlightedText } from './HighlightedText'
import { PopupEmptyState } from './PopupEmptyState'
import { getActiveResultRevealScrollTop } from '../popup-active-result-scroll'
import { getPopupBookmarkReorderTargetIndex } from '../popup-bookmark-reorder'
import { isPopupContentNavigationKey } from '../popup-keyboard-navigation'
import type {
  PopupActionMenuViewModel,
  PopupContentBookmarkRowViewModel,
  PopupContentFolderRowViewModel,
  PopupContentMainRowViewModel,
  PopupContentSearchResultViewModel,
  PopupContentViewModel
} from './PopupViewModels'

export interface PopupContentActionHandlers {
  onBookmarkOpen?: (bookmarkId: string) => void
  onEmptyAction?: (action: string) => void
  onFolderFilter?: (folderId: string) => void
  onFolderFocus?: (index: number) => void
  onKeyboardNavigate?: (key: string) => boolean
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
  onBookmarkReorder?: (bookmarkId: string, index: number) => void
  onReorderModeChange?: (active: boolean) => void
  onRowFocus?: (index: number) => void
  onResultHover?: (index: number) => void
}

export interface PopupActiveResultIndicatorState {
  style: CSSProperties
  visible: boolean
}

const POPUP_CONTENT_SKELETON_FOLDER_ROWS = [
  { depth: 0, width: 0.72, count: 0.34 },
  { depth: 1, width: 0.64, count: 0.26 },
  { depth: 1, width: 0.76, count: 0.22 },
  { depth: 2, width: 0.52, count: 0.3 },
  { depth: 1, width: 0.58, count: 0.24 },
  { depth: 2, width: 0.68, count: 0.2 },
  { depth: 2, width: 0.46, count: 0.28 },
  { depth: 1, width: 0.7, count: 0.18 }
] as const

const POPUP_CONTENT_SKELETON_BOOKMARK_ROWS = [
  { title: '44px', url: '66px', path: '94px' },
  { title: '16px', url: '36px', path: '94px' },
  { title: '62px', url: '72px', path: '94px' },
  { title: '48px', url: '56px', path: '94px' },
  { title: '74px', url: '68px', path: '94px' }
] as const
const POPUP_CONTENT_SKELETON_ACTION_COUNT = 5

const workspaceShellClass =
  't-skel popup-t-skel popup-workspace-reveal relative h-full min-h-0'
const workspaceLayerClass = 'absolute inset-0 min-h-0'
const workspaceSkeletonLayerClass = cx(
  workspaceLayerClass,
  't-skel-skeleton pointer-events-none z-[1] [contain:layout_paint]'
)
const workspaceContentLayerClass = cx(
  workspaceLayerClass,
  't-skel-content z-[2] [contain:layout_paint]'
)
const workspaceContentLoadingClass = 'pointer-events-none'
const workspaceClass =
  'relative grid h-full min-h-0 grid-cols-[221px_minmax(0,1fr)] gap-2.5 max-[620px]:grid-cols-[minmax(0,1fr)] max-[620px]:grid-rows-[minmax(108px,36%)_minmax(0,1fr)]'
const workspacePlaceholderClass = 'pointer-events-none'
const paneClass =
  'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-ds-md border-0 bg-ds-surface-1'
const mainPaneClass = cx(paneClass, 'popup-main-pane bg-ds-surface-1')
const paneHeaderClass =
  'flex min-h-[42px] flex-none items-center justify-between gap-2.5 border-b border-ds-border px-[13px] text-xs font-[760] text-ds-text-primary'
const paneHeaderTitleClass = 'min-w-0 truncate'
const paneTitleMetaClass = 'font-medium text-ds-text-muted'
const paneHeaderActionClass = [
  'inline-flex h-7 flex-none items-center gap-1.5 rounded-ds-sm border border-transparent bg-transparent px-2 text-[11px] font-semibold text-ds-text-secondary outline-none',
  'transition-[border-color,background-color,color,transform,opacity] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98] disabled:cursor-default disabled:opacity-40'
].join(' ')
const folderTreeClass =
  'popup-folder-tree min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-[6px_5px] [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
const mainListClass =
  'popup-main-list relative m-0 min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-[8px_9px] [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
const folderRowClass = 'relative block min-h-[34px]'
const mainRowClass =
  'popup-main-row relative z-[1] grid min-h-[74px] grid-cols-[minmax(0,1fr)] items-center border-t border-[rgba(38,40,46,0.72)] py-1.5 first:border-t-0'
const virtualSpacerClass = 'pointer-events-none block w-full'
const POPUP_BOOKMARK_ROW_HEIGHT = 80
const POPUP_FOLDER_ROW_HEIGHT = 34
const POPUP_VIRTUAL_OVERSCAN = 8
const POPUP_VIRTUALIZATION_THRESHOLD = 24
const activeResultIndicatorClass = 'popup-active-result-indicator'
const folderCardClass = [
  'relative grid min-h-[34px] w-full min-w-0 grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-[7px] rounded-ds-sm border border-transparent bg-transparent py-1.5 pr-2 pl-2 text-left text-ds-text-primary outline-none',
  'transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1 active:scale-[0.993]'
].join(' ')
const folderCardActiveClass =
  'border-ds-border-hover bg-ds-text-primary/[0.055] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[2px] before:rounded-full before:bg-ds-text-primary/70 before:content-[""]'
const folderBranchClass =
  'relative inline-grid h-2.5 w-2.5 flex-none place-items-center justify-self-center rounded-bl-[4px] border-b border-l border-b-white/20 border-l-white/20 bg-transparent text-ds-text-secondary'
const rootFolderBranchClass = 'rounded-full border border-white/30'
const folderMainClass =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[7px]'
const folderTitleClass =
  'min-w-0 truncate text-left text-xs font-bold leading-tight text-ds-text-primary'
const folderCountClass =
  'min-w-0 justify-self-end bg-transparent p-0 text-right text-[11px] font-semibold leading-tight text-ds-text-disabled [font-variant-numeric:tabular-nums]'
const folderCountActiveClass = 'text-ds-text-secondary'
const listButtonClass = [
  'popup-list-button flex min-h-[58px] w-full min-w-0 items-start gap-2.5 rounded-md border border-transparent bg-transparent text-left text-ds-text-primary outline-none',
  'transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1 active:scale-[0.993]'
].join(' ')
const listButtonBaseStyle: CSSProperties = {
  padding: '8px var(--popup-row-copy-rest-inset) 8px 13px'
}
const rowMainClass = 'popup-row-copy grid w-full min-w-0 gap-0.5'
const rowTitleClass =
  'min-w-0 truncate text-left text-[13px] font-[760] leading-tight text-ds-text-primary'
const rowSubtitleClass =
  'min-w-0 truncate text-left text-xs font-medium leading-tight text-ds-text-muted'
const rowPathClass = cx(rowSubtitleClass, 'text-ds-text-muted')
const resultCopyClass = 'popup-row-copy grid w-full min-w-0 gap-0.5'
const resultPathShellClass = 'block min-w-0'
const resultMatchReasonsClass = 'mt-0.5 flex flex-wrap gap-1'
const resultMatchTokenClass =
  'inline-flex min-h-[18px] items-center rounded-[5px] border border-ds-border bg-ds-surface-2 px-1.5 text-[10px] font-semibold text-ds-text-secondary'
const rowActionsClass = 'popup-row-actions'
const rowActionRailClass = 'popup-row-actions-menu'
const rowActionButtonClass = [
  'inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border border-ds-border-hover bg-ds-surface-3 text-ds-text-primary outline-none',
  'transition-[border-color,background-color,color,transform,opacity] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-surface-3 focus-visible:border-ds-border-hover focus-visible:bg-ds-surface-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-95 disabled:cursor-default disabled:opacity-45'
].join(' ')
const rowActionTriggerClass = cx(rowActionButtonClass, 'popup-row-actions-trigger')
const rowActionDangerClass =
  'hover:border-[rgba(255,138,130,0.42)] hover:text-ds-danger-text focus-visible:border-[rgba(255,138,130,0.42)] focus-visible:text-ds-danger-text'
const rowReorderHandleClass = [
  'popup-bookmark-reorder-handle absolute right-[7px] top-1/2 z-[3] inline-flex h-10 w-10 -translate-y-1/2 touch-none select-none items-center justify-center rounded-ds-sm border border-transparent bg-transparent text-ds-text-muted outline-none',
  'transition-[border-color,background-color,color,opacity] duration-ds-fast ease-ds-standard',
  'cursor-grab hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:cursor-grabbing disabled:cursor-default disabled:opacity-40'
].join(' ')
const compactStateClass =
  'grid min-h-[90px] place-items-center px-4 py-3 text-center text-xs leading-[1.55] text-ds-text-muted'
const mainStateClass = cx(compactStateClass, 'min-h-full p-[18px]')
const skeletonBarBaseClass =
  'popup-skeleton-pulse rounded-full bg-[rgba(255,255,255,0.065)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.024)]'
const skeletonBarClass = cx(
  skeletonBarBaseClass,
  'block h-[9px] w-[calc(var(--skeleton-width,0.7)*100%)]'
)
const skeletonTextBarClass = cx(skeletonBarBaseClass, 'block max-w-full')
const skeletonDotClass =
  'popup-skeleton-pulse block h-7 w-7 rounded-md bg-[rgba(255,255,255,0.065)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.024)]'
const skeletonFolderTitleClass = cx(skeletonBarClass, 'min-w-[54px]')
const skeletonFolderCountClass =
  cx(skeletonBarClass, 'max-w-[30px] min-w-4 justify-self-end')
const skeletonHeaderMetaClass = cx(skeletonBarBaseClass, 'inline-block h-[7px] w-[68px] align-[1px]')
const skeletonBookmarkTitleClass = cx(skeletonTextBarClass, 'h-2')
const skeletonBookmarkUrlClass = cx(skeletonTextBarClass, 'h-[6px] opacity-75')
const skeletonBookmarkPathClass = cx(skeletonTextBarClass, 'h-[6px] opacity-60')
const skeletonBookmarkTitleLineClass = cx(rowTitleClass, 'flex h-4 items-center')
const skeletonBookmarkSubtitleLineClass = cx(rowSubtitleClass, 'flex h-[15px] items-center')
const skeletonBookmarkPathLineClass = cx(rowPathClass, 'flex h-[15px] items-center')
const skeletonActionButtonClass = skeletonDotClass
const searchSkeletonClass = 'grid w-[min(100%,390px)] gap-3 self-stretch'
const searchSkeletonRowClass = 'grid gap-2 rounded-md bg-ds-text-primary/[0.018] px-[9px] py-2'
const POPUP_REORDER_MOUSE_THRESHOLD_PX = 6
const POPUP_REORDER_TOUCH_CANCEL_THRESHOLD_PX = 10
const POPUP_REORDER_LONG_PRESS_MS = 320
const POPUP_REORDER_AUTO_SCROLL_EDGE_PX = 36
const POPUP_REORDER_AUTO_SCROLL_MAX_PX = 13

function getFolderDepthStyle(depth: number): CSSProperties {
  const normalizedDepth = Math.max(0, Number(depth) || 0)
  return { paddingLeft: `${8 + normalizedDepth * 16}px` }
}

function getBookmarkButtonStyle(): CSSProperties {
  return listButtonBaseStyle
}

interface PopupBookmarkReorderRowProps {
  busy: boolean
  dragging: boolean
  pending: boolean
  shiftY: number
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}

interface PopupBookmarkDragSession {
  bookmarkId: string
  clientX: number
  clientY: number
  displayUrl: string
  handle: HTMLButtonElement
  height: number
  offsetX: number
  offsetY: number
  path: string
  phase: 'pending' | 'dragging'
  pointerId: number
  pointerType: string
  rowLeft: number
  sourceIndex: number
  startX: number
  startY: number
  targetIndex: number
  title: string
  width: number
}

interface PopupBookmarkDragView {
  bookmarkId: string
  displayUrl: string
  height: number
  left: number
  path: string
  phase: 'pending' | 'dragging' | 'settling'
  sourceIndex: number
  targetIndex: number
  title: string
  width: number
  top: number
}

function usePopupBookmarkReorderDrag({
  active,
  busy,
  mainListRef,
  onCommit,
  rowCount
}: {
  active: boolean
  busy: boolean
  mainListRef?: RefObject<HTMLUListElement | null>
  onCommit?: (bookmarkId: string, index: number) => void
  rowCount: number
}) {
  const sessionRef = useRef<PopupBookmarkDragSession | null>(null)
  const longPressTimerRef = useRef(0)
  const autoScrollFrameRef = useRef(0)
  const settleTimerRef = useRef(0)
  const [view, setView] = useState<PopupBookmarkDragView | null>(null)

  const stopAutoScroll = useCallback(() => {
    window.cancelAnimationFrame(autoScrollFrameRef.current)
    autoScrollFrameRef.current = 0
  }, [])

  const releasePointer = useCallback((session: PopupBookmarkDragSession | null) => {
    if (!session) return
    try {
      if (session.handle.hasPointerCapture(session.pointerId)) {
        session.handle.releasePointerCapture(session.pointerId)
      }
    } catch {
      // The pointer may already be released when the popup loses focus.
    }
  }, [])

  const clearSession = useCallback((clearView = true) => {
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = 0
    window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = 0
    stopAutoScroll()
    releasePointer(sessionRef.current)
    sessionRef.current = null
    if (clearView) {
      setView(null)
    }
  }, [releasePointer, stopAutoScroll])

  const resolveTargetIndex = useCallback((pointerY: number, sourceIndex: number): number => {
    const list = mainListRef?.current
    if (!list) return sourceIndex
    const rect = list.getBoundingClientRect()
    const paddingTop = Number.parseFloat(window.getComputedStyle(list).paddingTop) || 0
    return getPopupBookmarkReorderTargetIndex({
      containerTop: rect.top,
      paddingTop,
      pointerY,
      rowCount,
      rowHeight: POPUP_BOOKMARK_ROW_HEIGHT,
      scrollTop: list.scrollTop,
      sourceIndex
    })
  }, [mainListRef, rowCount])

  const toDragView = useCallback((session: PopupBookmarkDragSession): PopupBookmarkDragView => ({
    bookmarkId: session.bookmarkId,
    displayUrl: session.displayUrl,
    height: session.height,
    left: session.clientX - session.offsetX,
    path: session.path,
    phase: session.phase,
    sourceIndex: session.sourceIndex,
    targetIndex: session.targetIndex,
    title: session.title,
    top: session.clientY - session.offsetY,
    width: session.width
  }), [])

  const scheduleAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current) return

    const tick = () => {
      const session = sessionRef.current
      const list = mainListRef?.current
      if (!session || session.phase !== 'dragging' || !list) {
        autoScrollFrameRef.current = 0
        return
      }

      const rect = list.getBoundingClientRect()
      const distanceFromTop = session.clientY - rect.top
      const distanceFromBottom = rect.bottom - session.clientY
      let velocity = 0
      if (distanceFromTop < POPUP_REORDER_AUTO_SCROLL_EDGE_PX) {
        const intensity = 1 - Math.max(0, distanceFromTop) / POPUP_REORDER_AUTO_SCROLL_EDGE_PX
        velocity = -Math.ceil(POPUP_REORDER_AUTO_SCROLL_MAX_PX * intensity)
      } else if (distanceFromBottom < POPUP_REORDER_AUTO_SCROLL_EDGE_PX) {
        const intensity = 1 - Math.max(0, distanceFromBottom) / POPUP_REORDER_AUTO_SCROLL_EDGE_PX
        velocity = Math.ceil(POPUP_REORDER_AUTO_SCROLL_MAX_PX * intensity)
      }

      if (velocity) {
        const previousScrollTop = list.scrollTop
        list.scrollTop = Math.max(0, Math.min(
          previousScrollTop + velocity,
          Math.max(0, list.scrollHeight - list.clientHeight)
        ))
        if (list.scrollTop !== previousScrollTop) {
          session.targetIndex = resolveTargetIndex(session.clientY, session.sourceIndex)
          setView(toDragView(session))
        }
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(tick)
  }, [mainListRef, resolveTargetIndex, toDragView])

  const beginDrag = useCallback(() => {
    const session = sessionRef.current
    if (!session || session.phase === 'dragging') return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = 0
    session.phase = 'dragging'
    session.targetIndex = resolveTargetIndex(session.clientY, session.sourceIndex)
    try {
      session.handle.setPointerCapture(session.pointerId)
    } catch {
      // Synthetic pointers and released touch contacts may not be capturable.
    }
    setView(toDragView(session))
    scheduleAutoScroll()
  }, [resolveTargetIndex, scheduleAutoScroll, toDragView])

  const cancelDrag = useCallback(() => {
    clearSession(true)
  }, [clearSession])

  const settleDrag = useCallback((session: PopupBookmarkDragSession) => {
    const list = mainListRef?.current
    const listRect = list?.getBoundingClientRect()
    const listStyle = list ? window.getComputedStyle(list) : null
    const paddingTop = Number.parseFloat(listStyle?.paddingTop || '') || 0
    const paddingLeft = Number.parseFloat(listStyle?.paddingLeft || '') || 0
    const targetLeft = listRect ? listRect.left + paddingLeft : session.rowLeft
    const targetTop = listRect && list
      ? listRect.top + paddingTop + session.targetIndex * POPUP_BOOKMARK_ROW_HEIGHT - list.scrollTop
      : session.clientY - session.offsetY

    releasePointer(session)
    stopAutoScroll()
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = 0
    sessionRef.current = null
    setView({
      ...toDragView(session),
      left: targetLeft,
      phase: 'settling',
      top: targetTop
    })

    if (session.targetIndex !== session.sourceIndex) {
      onCommit?.(session.bookmarkId, session.targetIndex)
    }

    const settleDuration = prefersReducedMotion()
      ? 1
      : getMotionDurationMs('--drag-settle-dur', 160)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = 0
      setView(null)
    }, settleDuration)
  }, [mainListRef, onCommit, releasePointer, stopAutoScroll, toDragView])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return
      session.clientX = event.clientX
      session.clientY = event.clientY

      if (session.phase === 'pending') {
        const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
        if (session.pointerType === 'mouse') {
          if (distance < POPUP_REORDER_MOUSE_THRESHOLD_PX) return
          beginDrag()
        } else {
          if (distance >= POPUP_REORDER_TOUCH_CANCEL_THRESHOLD_PX) {
            cancelDrag()
          }
          return
        }
      }

      const activeSession = sessionRef.current
      if (!activeSession || activeSession.phase !== 'dragging') return
      event.preventDefault()
      activeSession.targetIndex = resolveTargetIndex(event.clientY, activeSession.sourceIndex)
      setView(toDragView(activeSession))
    }

    const handlePointerUp = (event: PointerEvent) => {
      const session = sessionRef.current
      if (!session || event.pointerId !== session.pointerId) return
      if (session.phase === 'dragging') {
        event.preventDefault()
        session.clientX = event.clientX
        session.clientY = event.clientY
        session.targetIndex = resolveTargetIndex(event.clientY, session.sourceIndex)
        settleDrag(session)
        return
      }
      cancelDrag()
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (sessionRef.current?.pointerId === event.pointerId) {
        cancelDrag()
      }
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && sessionRef.current) {
        event.preventDefault()
        event.stopPropagation()
        cancelDrag()
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp, { passive: false })
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [beginDrag, cancelDrag, resolveTargetIndex, settleDrag, toDragView])

  useEffect(() => {
    if (!active || (busy && sessionRef.current)) {
      cancelDrag()
    }
  }, [active, busy, cancelDrag])

  useEffect(() => {
    return () => {
      window.clearTimeout(longPressTimerRef.current)
      window.clearTimeout(settleTimerRef.current)
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      releasePointer(sessionRef.current)
      sessionRef.current = null
    }
  }, [releasePointer])

  const startDrag = useCallback((
    row: PopupContentBookmarkRowViewModel,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!active || busy || rowCount < 2 || (event.pointerType === 'mouse' && event.button !== 0)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    clearSession(true)

    const rowElement = event.currentTarget.closest<HTMLElement>('.popup-main-row')
    if (!rowElement) return
    const rect = rowElement.getBoundingClientRect()
    event.currentTarget.focus({ preventScroll: true })
    const session: PopupBookmarkDragSession = {
      bookmarkId: row.bookmarkId,
      clientX: event.clientX,
      clientY: event.clientY,
      displayUrl: row.displayUrl,
      handle: event.currentTarget,
      height: rect.height || POPUP_BOOKMARK_ROW_HEIGHT,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      path: row.path || '',
      phase: 'pending',
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      rowLeft: rect.left,
      sourceIndex: row.index,
      startX: event.clientX,
      startY: event.clientY,
      targetIndex: row.index,
      title: row.title,
      width: rect.width
    }
    sessionRef.current = session
    setView(toDragView(session))

    if (event.pointerType !== 'mouse') {
      longPressTimerRef.current = window.setTimeout(() => {
        beginDrag()
      }, POPUP_REORDER_LONG_PRESS_MS)
    }
  }, [active, beginDrag, busy, clearSession, rowCount, toDragView])

  const getRowProps = useCallback((row: PopupContentBookmarkRowViewModel): PopupBookmarkReorderRowProps => {
    let shiftY = 0
    if (view?.phase === 'dragging') {
      if (view.targetIndex < view.sourceIndex && row.index >= view.targetIndex && row.index < view.sourceIndex) {
        shiftY = POPUP_BOOKMARK_ROW_HEIGHT
      } else if (view.targetIndex > view.sourceIndex && row.index > view.sourceIndex && row.index <= view.targetIndex) {
        shiftY = -POPUP_BOOKMARK_ROW_HEIGHT
      }
    }

    return {
      busy,
      dragging: view?.phase === 'dragging' && view.bookmarkId === row.bookmarkId,
      pending: view?.phase === 'pending' && view.bookmarkId === row.bookmarkId,
      shiftY,
      onKeyDown: (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        if (!busy) {
          onCommit?.(row.bookmarkId, row.index + (event.key === 'ArrowUp' ? -1 : 1))
        }
      },
      onPointerDown: (event) => startDrag(row, event)
    }
  }, [busy, onCommit, startDrag, view])

  const ghost = view && view.phase !== 'pending' && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="popup-bookmark-drag-ghost"
          data-settling={view.phase === 'settling' ? 'true' : undefined}
          aria-hidden="true"
          style={{
            height: `${view.height}px`,
            transform: `translate3d(${view.left}px, ${view.top}px, 0)`,
            width: `${view.width}px`
          }}
        >
          <span className={rowMainClass}>
            <span className={rowTitleClass}>{view.title}</span>
            <span className={rowSubtitleClass}>{view.displayUrl}</span>
            {view.path ? <span className={rowPathClass}>{view.path}</span> : null}
          </span>
          <Icon name="GripVertical" size={16} aria-hidden="true" />
        </div>,
        document.body
      )
    : null

  return {
    dragging: view?.phase === 'dragging',
    getRowProps,
    ghost
  }
}

export function PopupContent({
  activeResultIndicator,
  activeResultRef,
  activeFolderRef,
  folderTreeRef,
  workspaceRef,
  handlers,
  mainListRef,
  state
}: {
  activeResultIndicator?: PopupActiveResultIndicatorState
  activeResultRef?: RefObject<HTMLLIElement | null>
  activeFolderRef?: RefObject<HTMLDivElement | null>
  folderTreeRef?: RefObject<HTMLDivElement | null>
  workspaceRef?: RefObject<HTMLDivElement | null>
  handlers?: PopupContentActionHandlers
  mainListRef?: RefObject<HTMLUListElement | null>
  state: PopupContentViewModel
}) {
  const sidebarRows = state.sidebarRows || state.rows.filter((row): row is PopupContentFolderRowViewModel => row.kind === 'folder')
  const mainRows = state.mainRows || state.rows.filter((row): row is PopupContentMainRowViewModel => row.kind !== 'folder')
  const mode = state.mode || (mainRows.some((row) => row.kind === 'result') ? 'search' : 'tree')
  const title = state.title || (mode === 'search' ? '搜索结果' : '全部书签')
  const meta = state.meta || `${mainRows.length} 条`
  const isLoading = Boolean(state.loading)
  const reorderActive = Boolean(state.reorder?.active && mode === 'tree')
  const reorderDrag = usePopupBookmarkReorderDrag({
    active: reorderActive,
    busy: Boolean(state.reorder?.busy),
    mainListRef,
    onCommit: handlers?.onBookmarkReorder,
    rowCount: mainRows.length
  })
  const activeMainIndex = mainRows.findIndex((row) => row.active)
  const activeFolderIndex = sidebarRows.findIndex((row) => row.keyboardActive)
  const mainWindow = useFixedRowWindow({
    activeIndex: activeMainIndex,
    containerRef: mainListRef,
    enabled: mode === 'tree' && !state.mainState && mainRows.length > POPUP_VIRTUALIZATION_THRESHOLD,
    rowCount: mainRows.length,
    rowHeight: POPUP_BOOKMARK_ROW_HEIGHT
  })
  const folderWindow = useFixedRowWindow({
    activeIndex: activeFolderIndex,
    containerRef: folderTreeRef,
    enabled: sidebarRows.length > POPUP_VIRTUALIZATION_THRESHOLD,
    rowCount: sidebarRows.length,
    rowHeight: POPUP_FOLDER_ROW_HEIGHT
  })
  const visibleSidebarRows = sidebarRows.slice(folderWindow.start, folderWindow.end)
  const visibleMainRows = mainRows.slice(mainWindow.start, mainWindow.end)

  return (
    <div
      className={cx(workspaceShellClass, isLoading ? '' : 'is-revealed')}
      data-state={isLoading ? 'loading' : 'ready'}
      aria-busy={isLoading ? 'true' : 'false'}
    >
      <div className={workspaceSkeletonLayerClass} aria-hidden="true">
        <PopupContentSkeleton mode={mode} title={title} />
      </div>
      <div className={cx(workspaceContentLayerClass, isLoading ? workspaceContentLoadingClass : '')}>
        <div className={workspaceClass} ref={workspaceRef}>
          <aside className={paneClass} aria-label="文件夹树">
            <header className={paneHeaderClass}>
              <span>全部文件夹</span>
            </header>
            <div className={folderTreeClass} role="tree" ref={folderTreeRef}>
              {folderWindow.before > 0 ? (
                <div
                  className={virtualSpacerClass}
                  style={{ height: `${folderWindow.before}px` }}
                  role="presentation"
                  aria-hidden="true"
                />
              ) : null}
              {visibleSidebarRows.map((row) => (
                <PopupFolderRow
                  activeFolderRef={row.keyboardActive ? activeFolderRef : undefined}
                  handlers={handlers}
                  onFolderFilter={handlers?.onFolderFilter}
                  row={row}
                  key={`folder:${row.folderId}`}
                />
              ))}
              {folderWindow.after > 0 ? (
                <div
                  className={virtualSpacerClass}
                  style={{ height: `${folderWindow.after}px` }}
                  role="presentation"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          </aside>
          <section
            className={mainPaneClass}
            aria-label={title}
            data-reorder-mode={reorderActive ? 'true' : undefined}
            data-reorder-dragging={reorderDrag.dragging ? 'true' : undefined}
          >
            <header className={paneHeaderClass}>
              <span className={paneHeaderTitleClass} title={`${title} · ${meta}`}>
                {title} <span className={paneTitleMetaClass}>· <span className="t-number-value">{meta}</span></span>
              </span>
              {mode === 'tree' && state.reorder ? (
                <Button
                  className={paneHeaderActionClass}
                  type="button"
                  aria-pressed={state.reorder.active}
                  disabled={state.reorder.busy || (!state.reorder.active && !state.reorder.canEnter)}
                  title={state.reorder.active
                    ? '完成书签排序'
                    : state.reorder.canEnter
                      ? `调整「${state.reorder.folderTitle}」中的直属书签顺序`
                      : '当前文件夹至少需要 2 个直属书签'}
                  onClick={() => handlers?.onReorderModeChange?.(!state.reorder?.active)}
                  unstyled
                >
                  <Icon name={state.reorder.active ? 'Check' : 'GripVertical'} size={14} aria-hidden="true" />
                  <span>{state.reorder.active ? '完成排序' : '调整顺序'}</span>
                </Button>
              ) : null}
            </header>
            <ul
              className={mainListClass}
              ref={mainListRef}
              aria-label={reorderActive ? `${state.reorder?.folderTitle || '当前文件夹'}直属书签排序` : undefined}
            >
              {state.mainState ? (
                <PopupMainStatePanel onEmptyAction={handlers?.onEmptyAction} state={state.mainState} />
              ) : mainRows.length ? (
                <>
                  {mainWindow.before > 0 ? (
                    <li
                      className={virtualSpacerClass}
                      style={{ height: `${mainWindow.before}px` }}
                      role="presentation"
                      aria-hidden="true"
                    />
                  ) : null}
                  {visibleMainRows.map((row) => {
                    if (row.kind === 'bookmark') {
                      return (
                        <MemoPopupBookmarkRow
                          activeResultRef={activeResultRef}
                          handlers={handlers}
                          reorder={reorderActive ? reorderDrag.getRowProps(row) : undefined}
                          row={row}
                          key={`bookmark:${row.bookmarkId}`}
                        />
                      )
                    }
                    return <MemoPopupSearchResultRow activeResultRef={activeResultRef} handlers={handlers} row={row} key={`result:${row.bookmarkId}:${row.index}`} />
                  })}
                  {mainWindow.after > 0 ? (
                    <li
                      className={virtualSpacerClass}
                      style={{ height: `${mainWindow.after}px` }}
                      role="presentation"
                      aria-hidden="true"
                    />
                  ) : null}
                </>
              ) : (
                <li className={compactStateClass}>{state.emptyLabel || '暂无可展示书签'}</li>
              )}
            </ul>
            {reorderActive ? (
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {state.reorder?.announcement}
              </p>
            ) : null}
          </section>
          {/* Workspace-level indicator — slides freely across both panes */}
          <div
            className={activeResultIndicatorClass}
            aria-hidden="true"
            data-visible={activeResultIndicator?.visible ? 'true' : undefined}
            role="presentation"
            style={activeResultIndicator?.style}
          ></div>
          {reorderDrag.ghost}
        </div>
      </div>
    </div>
  )
}

interface FixedRowWindow {
  after: number
  before: number
  end: number
  start: number
}

function useFixedRowWindow({
  activeIndex,
  containerRef,
  enabled,
  rowCount,
  rowHeight
}: {
  activeIndex: number
  containerRef?: RefObject<HTMLElement | null>
  enabled: boolean
  rowCount: number
  rowHeight: number
}): FixedRowWindow {
  const [viewport, setViewport] = useState({ height: 0, scrollTop: 0 })
  const measureViewport = useCallback(() => {
    const container = containerRef?.current
    if (!container) return
    const next = {
      height: container.clientHeight,
      scrollTop: container.scrollTop
    }
    setViewport((current) => (
      current.height === next.height && current.scrollTop === next.scrollTop
        ? current
        : next
    ))
  }, [containerRef])

  useLayoutEffect(() => {
    if (!enabled) return
    const container = containerRef?.current
    if (!container) return

    measureViewport()
    container.addEventListener('scroll', measureViewport, { passive: true })
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measureViewport)
    observer?.observe(container)
    return () => {
      container.removeEventListener('scroll', measureViewport)
      observer?.disconnect()
    }
  }, [containerRef, enabled, measureViewport, rowCount])

  useLayoutEffect(() => {
    if (!enabled || activeIndex < 0) return
    const container = containerRef?.current
    if (!container) return
    const paddingTop = Number.parseFloat(window.getComputedStyle(container).paddingTop) || 0
    const viewportStart = container.scrollTop
    const nextScrollTop = getActiveResultRevealScrollTop({
      itemHeight: rowHeight,
      itemTop: paddingTop + activeIndex * rowHeight,
      maxScrollTop: Math.max(0, container.scrollHeight - container.clientHeight),
      viewportHeight: container.clientHeight,
      viewportTop: viewportStart
    })
    if (nextScrollTop !== null && nextScrollTop !== viewportStart) {
      container.scrollTop = nextScrollTop
      measureViewport()
    }
  }, [activeIndex, containerRef, enabled, measureViewport, rowHeight])

  if (!enabled) {
    return { after: 0, before: 0, end: rowCount, start: 0 }
  }

  const viewportHeight = viewport.height || rowHeight * 8
  const start = Math.max(
    0,
    Math.floor(viewport.scrollTop / rowHeight) - POPUP_VIRTUAL_OVERSCAN
  )
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + POPUP_VIRTUAL_OVERSCAN * 2
  const end = Math.min(rowCount, start + visibleCount)
  return {
    after: Math.max(0, (rowCount - end) * rowHeight),
    before: start * rowHeight,
    end,
    start
  }
}

function PopupContentSkeleton({
  mode,
  title
}: {
  mode: 'search' | 'tree'
  title: string
}) {
  return (
    <div className={cx(workspaceClass, workspacePlaceholderClass)}>
      <aside className={paneClass} aria-label="文件夹树加载占位">
        <header className={paneHeaderClass}>
          <span>全部文件夹</span>
        </header>
        <div className={folderTreeClass} role="presentation">
          {POPUP_CONTENT_SKELETON_FOLDER_ROWS.map((row, index) => (
            <div
              className={folderRowClass}
              style={{ '--depth': row.depth } as CSSProperties}
              key={`folder-skeleton:${index}`}
            >
              <div className={cx(folderCardClass, 'cursor-default')} style={getFolderDepthStyle(row.depth)}>
                <span className={folderBranchClass} aria-hidden="true"></span>
                <span className={folderMainClass}>
                  <span className={skeletonFolderTitleClass} style={{ '--skeleton-width': row.width } as CSSProperties}></span>
                  <span className={skeletonFolderCountClass} style={{ '--skeleton-width': row.count } as CSSProperties}></span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className={mainPaneClass} aria-label={`${title}加载占位`}>
        <header className={paneHeaderClass}>
          <span>
            {title}{' '}
            <span className={paneTitleMetaClass}>
              · <span className={skeletonHeaderMetaClass}></span>
            </span>
          </span>
        </header>
        <ul className={mainListClass} role="presentation">
          {POPUP_CONTENT_SKELETON_BOOKMARK_ROWS.map((row) => (
            <li
              className={mainRowClass}
              key={`bookmark-skeleton:${row.title}:${row.url}:${row.path}`}
            >
              <div className={cx(listButtonClass, 'cursor-default')} style={getBookmarkButtonStyle()}>
                <span className={rowMainClass}>
                  <span className={skeletonBookmarkTitleLineClass}>
                    <span className={skeletonBookmarkTitleClass} style={{ width: row.title }}></span>
                  </span>
                  <span className={skeletonBookmarkSubtitleLineClass}>
                    <span className={skeletonBookmarkUrlClass} style={{ width: row.url }}></span>
                  </span>
                  <span className={skeletonBookmarkPathLineClass}>
                    <span className={skeletonBookmarkPathClass} style={{ width: row.path }}></span>
                  </span>
                </span>
              </div>
              <PopupSkeletonRowActions expanded={false} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PopupSkeletonRowActions({ expanded }: { expanded: boolean }) {
  return (
    <div
      className={cx(rowActionsClass, 'opacity-80')}
      data-active={expanded ? 'true' : undefined}
      data-open={expanded ? 'true' : 'false'}
    >
      <div className={rowActionRailClass}>
        {Array.from({ length: POPUP_CONTENT_SKELETON_ACTION_COUNT }, (_, index) => (
          <span className={skeletonActionButtonClass} key={`bookmark-skeleton-action:${index}`}></span>
        ))}
      </div>
      <span className={cx(skeletonActionButtonClass, 'popup-row-actions-trigger')}></span>
    </div>
  )
}

function PopupMainStatePanel({
  onEmptyAction,
  state
}: {
  onEmptyAction?: (action: string) => void
  state: NonNullable<PopupContentViewModel['mainState']>
}) {
  if (state.kind === 'loading') {
    return (
      <li className={mainStateClass} aria-live="polite">
        <PopupMainLoadingSkeleton label={state.label || '正在搜索书签…'} />
      </li>
    )
  }

  if (state.kind === 'natural-setup' || state.kind === 'search-empty') {
    return (
      <li className={mainStateClass}>
        <PopupEmptyState onAction={onEmptyAction} state={state.state || { kind: 'none' }} />
      </li>
    )
  }

  return (
    <li className={mainStateClass}>
      {state.label || '暂无可展示书签'}
    </li>
  )
}

function PopupMainLoadingSkeleton({ label }: { label: string }) {
  return (
    <div className={searchSkeletonClass} aria-label={label}>
      {[0.82, 0.66, 0.74].map((width, index) => (
        <div className={searchSkeletonRowClass} key={`search-skeleton:${index}`}>
          <span className={skeletonBookmarkTitleClass} style={{ '--skeleton-width': width } as CSSProperties}></span>
          <span className={skeletonBookmarkUrlClass} style={{ '--skeleton-width': 0.46 + index * 0.08 } as CSSProperties}></span>
        </div>
      ))}
    </div>
  )
}

function PopupFolderRow({
  activeFolderRef,
  handlers,
  onFolderFilter,
  row
}: {
  activeFolderRef?: RefObject<HTMLDivElement | null>
  handlers?: PopupContentActionHandlers
  onFolderFilter?: (folderId: string) => void
  row: PopupContentFolderRowViewModel
}) {
  const style = { '--depth': row.depth } as CSSProperties

  return (
    <div className={folderRowClass} style={style} ref={activeFolderRef}>
      <Button
        className={cx(folderCardClass, row.active ? folderCardActiveClass : '')}
        type="button"
        role="treeitem"
        aria-expanded={row.expanded}
        aria-level={row.depth + 1}
        aria-selected={row.keyboardActive ? 'true' : 'false'}
        style={getFolderDepthStyle(row.depth)}
        aria-current={row.active ? 'page' : undefined}
        title={row.subtitle}
        onFocus={() => handlers?.onFolderFocus?.(row.index)}
        onKeyDown={(event) => {
          handleContentNavigationKeyDown(event, handlers)
        }}
        onClick={() => onFolderFilter?.(row.root ? 'all' : row.folderId)}
        unstyled
      >
        <span className={cx(folderBranchClass, row.root ? rootFolderBranchClass : '')} aria-hidden="true"></span>
        <span className={folderMainClass}>
          <span className={folderTitleClass}>{row.title}</span>
          <span className={cx(folderCountClass, row.active ? folderCountActiveClass : '')} title={`${row.countLabel} 个书签`}>
            {row.countLabel}
          </span>
        </span>
      </Button>
    </div>
  )
}

function PopupBookmarkRow({
  activeResultRef,
  handlers,
  reorder,
  row
}: {
  activeResultRef?: RefObject<HTMLLIElement | null>
  handlers?: PopupContentActionHandlers
  reorder?: PopupBookmarkReorderRowProps
  row: PopupContentBookmarkRowViewModel
}) {
  const style = {
    '--depth': row.depth,
    height: `${POPUP_BOOKMARK_ROW_HEIGHT}px`,
    transform: reorder?.shiftY ? `translate3d(0, ${reorder.shiftY}px, 0)` : undefined
  } as CSSProperties
  const [actionsMounted, setActionsMounted] = useState(false)

  return (
    <li
      className={mainRowClass}
      data-active={row.active ? 'true' : undefined}
      data-bookmark-id={row.bookmarkId}
      data-reorder-source={reorder?.dragging ? 'true' : undefined}
      data-reorder-shift={reorder?.shiftY ? 'true' : undefined}
      onFocusCapture={() => setActionsMounted(true)}
      onPointerEnter={() => setActionsMounted(true)}
      ref={row.active ? activeResultRef : undefined}
      style={style}
    >
      <Button
        className={cx(listButtonClass, reorder ? 'popup-reorder-row-content' : '')}
        type="button"
        data-active={row.active ? 'true' : undefined}
        disabled={Boolean(reorder)}
        style={getBookmarkButtonStyle()}
        onFocus={() => {
          if (!reorder) handlers?.onRowFocus?.(row.index)
        }}
        onKeyDown={(event) => {
          if (!reorder) handleContentNavigationKeyDown(event, handlers)
        }}
        onClick={() => {
          if (!reorder) handlers?.onBookmarkOpen?.(row.bookmarkId)
        }}
        unstyled
      >
        <span className={rowMainClass}>
          <span className={rowTitleClass}>{row.title}</span>
          <span className={rowSubtitleClass} title={row.url}>{row.displayUrl}</span>
          {row.path ? <span className={rowPathClass} title={row.path}>{row.path}</span> : null}
        </span>
      </Button>
      {reorder ? (
        <Button
          className={rowReorderHandleClass}
          type="button"
          aria-label={`调整 ${row.title} 的顺序，当前第 ${row.index + 1} 位`}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          data-drag-pending={reorder.pending ? 'true' : undefined}
          data-dragging={reorder.dragging ? 'true' : undefined}
          disabled={reorder.busy}
          title="按住拖动；也可按 Alt 加上下方向键调整"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onKeyDown={reorder.onKeyDown}
          onPointerDown={reorder.onPointerDown}
          unstyled
        >
          <Icon name="GripVertical" size={16} aria-hidden="true" />
        </Button>
      ) : (
        <PopupRowActions
          active={row.active}
          bookmarkId={row.bookmarkId}
          label={row.menuLabel}
          mountQuickActions={actionsMounted || row.active}
          menu={row.menu}
          onMenuAction={handlers?.onMenuAction}
        />
      )}
    </li>
  )
}

function PopupSearchResultRow({
  activeResultRef,
  handlers,
  row
}: {
  activeResultRef?: RefObject<HTMLLIElement | null>
  handlers?: PopupContentActionHandlers
  row: PopupContentSearchResultViewModel
}) {
  const [actionsMounted, setActionsMounted] = useState(false)

  return (
    <li
      className={mainRowClass}
      data-active={row.active ? 'true' : undefined}
      onFocusCapture={() => setActionsMounted(true)}
      onPointerEnter={() => setActionsMounted(true)}
      ref={row.active ? activeResultRef : undefined}
    >
      <Button
        className={listButtonClass}
        type="button"
        data-active={row.active ? 'true' : undefined}
        style={getBookmarkButtonStyle()}
        onFocus={() => handlers?.onRowFocus?.(row.index)}
        onKeyDown={(event) => {
          handleContentNavigationKeyDown(event, handlers)
        }}
        onClick={() => handlers?.onBookmarkOpen?.(row.bookmarkId)}
        onPointerOver={() => handlers?.onResultHover?.(row.index)}
        unstyled
      >
        <span className={resultCopyClass}>
          <span className={rowTitleClass}>
            <HighlightedText text={row.title} query={row.highlightQuery} />
          </span>
          <span className={rowSubtitleClass} title={row.url}>
            <HighlightedText text={row.displayUrl} query={row.highlightQuery} />
          </span>
          <span className={resultPathShellClass}>
            <span className={rowPathClass} title={row.path}>{row.path}</span>
          </span>
          {row.reasonTokens.length ? (
            <span className={resultMatchReasonsClass} title={row.reasonTitle} aria-label={row.reasonLabel}>
              {row.reasonTokens.map((token) => (
                <span className={resultMatchTokenClass} key={token}>{token}</span>
              ))}
            </span>
          ) : null}
        </span>
      </Button>
      <PopupRowActions
        active={row.active}
        bookmarkId={row.bookmarkId}
        label={row.menuLabel}
        mountQuickActions={actionsMounted || row.active}
        menu={row.menu}
        onMenuAction={handlers?.onMenuAction}
        title="操作菜单"
      />
    </li>
  )
}

const MemoPopupBookmarkRow = memo(PopupBookmarkRow, arePopupBookmarkRowPropsEqual)
const MemoPopupSearchResultRow = memo(PopupSearchResultRow, arePopupSearchResultRowPropsEqual)

function arePopupBookmarkRowPropsEqual(
  previous: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    reorder?: PopupBookmarkReorderRowProps
    row: PopupContentBookmarkRowViewModel
  },
  next: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    reorder?: PopupBookmarkReorderRowProps
    row: PopupContentBookmarkRowViewModel
  }
) {
  return previous.activeResultRef === next.activeResultRef &&
    previous.handlers === next.handlers &&
    previous.reorder === next.reorder &&
    areBookmarkRowsEqual(previous.row, next.row)
}

function arePopupSearchResultRowPropsEqual(
  previous: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    row: PopupContentSearchResultViewModel
  },
  next: {
    activeResultRef?: RefObject<HTMLLIElement | null>
    handlers?: PopupContentActionHandlers
    row: PopupContentSearchResultViewModel
  }
) {
  return previous.activeResultRef === next.activeResultRef &&
    previous.handlers === next.handlers &&
    areSearchResultRowsEqual(previous.row, next.row)
}

function areBookmarkRowsEqual(
  previous: PopupContentBookmarkRowViewModel,
  next: PopupContentBookmarkRowViewModel
) {
  return Boolean(previous.active) === Boolean(next.active) &&
    previous.bookmarkId === next.bookmarkId &&
    previous.depth === next.depth &&
    previous.displayUrl === next.displayUrl &&
    previous.index === next.index &&
    previous.menuLabel === next.menuLabel &&
    previous.parentId === next.parentId &&
    previous.path === next.path &&
    previous.title === next.title &&
    previous.url === next.url &&
    areActionMenusEqual(previous.menu, next.menu)
}

function areSearchResultRowsEqual(
  previous: PopupContentSearchResultViewModel,
  next: PopupContentSearchResultViewModel
) {
  return previous.active === next.active &&
    previous.bookmarkId === next.bookmarkId &&
    previous.depth === next.depth &&
    previous.displayUrl === next.displayUrl &&
    previous.highlightQuery === next.highlightQuery &&
    previous.index === next.index &&
    previous.menuLabel === next.menuLabel &&
    previous.path === next.path &&
    previous.reasonLabel === next.reasonLabel &&
    previous.reasonTitle === next.reasonTitle &&
    previous.title === next.title &&
    previous.url === next.url &&
    areStringArraysEqual(previous.reasonTokens, next.reasonTokens) &&
    areActionMenusEqual(previous.menu, next.menu)
}

function areActionMenusEqual(
  previous: PopupActionMenuViewModel,
  next: PopupActionMenuViewModel
) {
  return previous.items.length === next.items.length && previous.items.every((item, index) => {
    const nextItem = next.items[index]
    return item.action === nextItem.action &&
      item.ariaLabel === nextItem.ariaLabel &&
      item.bookmarkId === nextItem.bookmarkId &&
      item.danger === nextItem.danger &&
      item.disabled === nextItem.disabled &&
      item.label === nextItem.label
  })
}

function areStringArraysEqual(previous: string[], next: string[]) {
  return previous.length === next.length && previous.every((item, index) => item === next[index])
}

function handleContentNavigationKeyDown(
  event: KeyboardEvent<HTMLElement>,
  handlers?: PopupContentActionHandlers
): void {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return
  }

  if (!isPopupContentNavigationKey(event.key)) {
    return
  }

  if (handlers?.onKeyboardNavigate?.(event.key)) {
    event.preventDefault()
  }
}

function PopupRowActions({
  active = false,
  bookmarkId,
  label,
  mountQuickActions,
  menu,
  onMenuAction,
  title
}: {
  active?: boolean
  bookmarkId: string
  label: string
  mountQuickActions: boolean
  menu: PopupActionMenuViewModel
  onMenuAction?: (bookmarkId: string, action: string, returnFocusElement?: HTMLElement | null) => void
  title?: string
}) {
  const [focusExpanded, setFocusExpanded] = useState(false)
  const [pinnedExpanded, setPinnedExpanded] = useState(false)
  const [forcedCollapsed, setForcedCollapsed] = useState(false)
  const quickActions = mountQuickActions
    ? menu.items.filter((item) => {
        return ['edit', 'copy-url', 'open-current-tab', 'move', 'delete'].includes(item.action)
      })
    : []
  const expanded = (active || focusExpanded || pinnedExpanded) && !forcedCollapsed
  const triggerLabel = title || label || '显示书签快捷操作'

  return (
    <div
      className={rowActionsClass}
      aria-label="书签快捷操作"
      data-active={active ? 'true' : undefined}
      data-collapsed={forcedCollapsed ? 'true' : undefined}
      data-open={expanded ? 'true' : 'false'}
      data-pinned={pinnedExpanded && !forcedCollapsed ? 'true' : undefined}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setFocusExpanded(false)
        }
      }}
      onFocus={() => {
        if (!forcedCollapsed) {
          setFocusExpanded(true)
        }
      }}
      onPointerLeave={() => setForcedCollapsed(false)}
    >
      <div className={rowActionRailClass}>
        {quickActions.map((item) => (
          <Button
            className={cx(rowActionButtonClass, item.danger ? rowActionDangerClass : '')}
            type="button"
            aria-label={item.ariaLabel}
            title={item.label}
            disabled={item.disabled}
            tabIndex={expanded ? undefined : -1}
            onClick={(event) => {
              onMenuAction?.(item.bookmarkId, item.action, event.currentTarget)
              setFocusExpanded(false)
            }}
            key={`${item.bookmarkId}:${item.action}`}
            unstyled
          >
            <Icon name={getPopupActionIconName(item.action)} size={14} aria-hidden="true" />
          </Button>
        ))}
      </div>
      <Button
        className={rowActionTriggerClass}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={expanded}
        aria-pressed={pinnedExpanded && !forcedCollapsed}
        title={triggerLabel}
        onClick={(event) => {
          if (pinnedExpanded && !forcedCollapsed) {
            setPinnedExpanded(false)
            setFocusExpanded(false)
            setForcedCollapsed(true)
            event.currentTarget.blur()
            return
          }

          setPinnedExpanded(true)
          setForcedCollapsed(false)
        }}
        unstyled
      >
        <Icon name="MoreHorizontal" size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

function getPopupActionIconName(action: string): IconName {
  if (action === 'edit') {
    return 'Pencil'
  }
  if (action === 'copy-url') {
    return 'Copy'
  }
  if (action === 'move') {
    return 'Move'
  }
  if (action === 'delete') {
    return 'Trash2'
  }
  return 'ExternalLink'
}
