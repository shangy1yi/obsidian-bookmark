import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { getMotionAwareScrollBehavior } from '../../shared/motion'
import { NumberPop } from '../../ui/motion/NumberPop'
import {
  type BookmarkContentStyleState,
  type BookmarkContentViewModel,
  type BookmarkBreadcrumbItemViewModel,
  type BookmarkFolderCardViewModel,
  type BookmarkFolderGridViewModel,
  type BookmarkFolderSectionViewModel,
  type BookmarkNavigationViewModel,
  type BookmarkTileViewModel,
  type EmptyFolderState,
  type FolderSectionHeaderState,
  type PortalPanelState,
  type QuickAccessPanelState,
  type SourceNavigationState,
  setNewtabBookmarkFolderHeaderNode,
  setNewtabBookmarkFolderSectionNode,
  setNewtabBookmarkGridNode,
  setNewtabBookmarkTileIconNode,
  setNewtabBookmarkTileNode,
  useNewtabBookmarkContentView
} from '../newtab-bookmark-content-store'
import { useNewtabDragUiView, type NewtabDragUiView } from '../newtab-drag-ui-store'
import { useNewtabFolderSourceView } from '../newtab-folder-source-store'
import {
  clearNewtabBookmarkPrebootSnapshot,
  hideNewtabBookmarkPreboot,
  scheduleNewtabBookmarkPrebootHandoff,
  writeNewtabBookmarkPrebootSnapshotFromView
} from '../newtab-bookmark-preboot'
import { BookmarkIconShell } from './BookmarkIconShell'
import { SpeedDialPanelHost } from './NewtabSpeedDialPanel'
import {
  BOOKMARK_DRAG_HANDLE_CLASS,
  BOOKMARK_FOLDER_CARD_COUNT_CLASS,
  BOOKMARK_FOLDER_CARD_GRID_CLASS,
  BOOKMARK_FOLDER_CARD_ICON_CLASS,
  getBookmarkTileClass,
  getBookmarkTitleClass
} from './bookmarkTileClasses'
import {
  FOLDER_SECTION_COUNT_CLASS,
  FOLDER_SECTION_TITLE_CLASS,
  getFolderSectionHeaderRowClass,
  getFolderSectionHeaderClass
} from './folderSectionClasses'
import {
  BOOKMARK_FOLDER_SECTIONS_CLASS,
  getBookmarkGridClass,
  getNewtabContentClass
} from './newtabLayoutClasses'
import { getNewtabButtonClass } from './newtabButtonClass'

const EMPTY_FOLDER_STATE_CLASS = 'bookmark-folder-empty-state grid justify-items-start gap-2.5'
const BOOKMARK_PREBOOT_SNAPSHOT_LOAD_WAIT_MS = 500
const BOOKMARK_NAVIGATION_CLASS = 'bookmark-navigation grid w-full content-start gap-3'
const BOOKMARK_NAVIGATION_EMPTY_CLASS = 'bookmark-navigation-empty justify-self-start m-0 text-xs leading-[1.5] text-[rgba(245,245,247,0.62)]'
const BOOKMARK_BREADCRUMB_CLASS = 'bookmark-breadcrumb inline-flex max-w-full flex-wrap items-center gap-1 justify-self-start'
const BOOKMARK_BREADCRUMB_LABEL_CLASS = 'bookmark-breadcrumb-label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[640] leading-none'
const BOOKMARK_BREADCRUMB_SEP_CLASS = 'text-[rgba(245,245,247,0.34)]'
const BOOKMARK_BREADCRUMB_BUTTON_BASE_CLASS = 'curator-motion-chip bookmark-breadcrumb-item inline-flex h-[26px] max-w-[min(200px,100%)] items-center gap-1 rounded-[var(--ui-radius-control)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] px-2 leading-none text-[rgba(245,245,247,0.78)] shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)] hover:border-[var(--newtab-glass-slider-fill)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--newtab-glass-slider-fill)] focus-visible:text-[var(--ui-text-primary)] focus-visible:[outline:2px_solid_rgba(245,245,247,0.12)] focus-visible:outline-offset-0'
const BOOKMARK_BREADCRUMB_BUTTON_CURRENT_CLASS = 'border-[var(--newtab-glass-slider-fill)] bg-[var(--newtab-glass-slider-fill)] text-[var(--ui-text-primary)] cursor-default'
const EMPTY_FOLDER_COPY_CLASS = 'bookmark-folder-empty justify-self-start mt-1 mb-0 text-xs leading-[1.5] text-[rgba(245,245,247,0.72)]'
const EMPTY_FOLDER_ACTIONS_CLASS = 'bookmark-folder-empty-actions flex flex-wrap gap-2'
const EMPTY_FOLDER_BUTTON_CLASS = getNewtabButtonClass('secondary', '!min-h-[34px] !px-3 !text-xs')
const SOURCE_NAVIGATION_CLASS = 'source-navigation mb-3.5 inline-grid max-w-full grid-cols-[auto_minmax(0,1fr)] items-center justify-self-start gap-2'
const SOURCE_NAVIGATION_LABEL_CLASS = 'source-navigation-label inline-flex h-[26px] items-center whitespace-nowrap rounded-[var(--ui-radius-control)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] px-2 text-[11px] font-[680] leading-none text-[rgba(245,245,247,0.88)] shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)]'
const SOURCE_NAVIGATION_LIST_CLASS = 'source-navigation-list flex min-w-0 max-w-full flex-wrap gap-1.5'
const SOURCE_NAVIGATION_LINK_CLASS = 'curator-motion-chip source-navigation-link inline-flex h-[26px] max-w-[min(180px,100%)] items-center justify-start gap-1.5 rounded-[var(--ui-radius-control)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] px-2 text-left leading-normal text-[rgba(245,245,247,0.72)] no-underline shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)] hover:border-[var(--newtab-glass-slider-fill)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--newtab-glass-slider-fill)] focus-visible:text-[var(--ui-text-primary)] focus-visible:[outline:2px_solid_rgba(245,245,247,0.12)] focus-visible:outline-offset-0'
const SOURCE_NAVIGATION_TITLE_CLASS = 'source-navigation-title min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[650] leading-none'
const SOURCE_NAVIGATION_COUNT_CLASS = 'source-navigation-count inline-grid h-4 min-w-[18px] place-items-center rounded-[var(--ui-radius-pill)] bg-[var(--ui-surface-selected)] text-[10px] font-[760] leading-none text-[var(--ui-accent-text)]'
const FOLDER_SECTION_ADD_CLASS = 'curator-compact-hit-target curator-motion-chip folder-section-add inline-flex h-[22px] min-h-[22px] w-[22px] min-w-[22px] flex-none items-center justify-center gap-0 rounded-md border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] p-0 leading-none text-[rgba(245,245,247,0.78)] cursor-pointer shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)] hover:border-[var(--newtab-glass-slider-fill)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--newtab-glass-slider-fill)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(245,245,247,0.26)]'
const BOOKMARK_GRID_PLACEHOLDER_CLASS = 'bookmark-grid-placeholder grid min-h-[calc(var(--icon-shell-size)+18px)] items-center rounded-[var(--ui-radius-control)] border border-dashed border-[rgba(245,245,247,0.14)] bg-[rgba(10,10,12,0.42)] px-2.5 py-2 text-[11px] font-[620] text-[rgba(245,245,247,0.46)]'
// 曾用 CSS paint containment（content_visibility 占位 + intrinsic-size 估高）做离屏分组
// 优化，但它让离屏分组首帧按 320px 假高占位、下一帧塌缩到真实高度，整页竖向重排——
// 书签卡片被往上拽即"形变"。增量分块渲染（initialVisibleCount/chunkSize/IntersectionObserver）
// 已是真正的虚拟化，那层 containment 是冗余，移除后首帧即真实高度。transform 过渡也一并
// 移除，避免分组位置被动画插值；仅保留 opacity 过渡。
const BOOKMARK_FOLDER_SECTION_CLASS = 'bookmark-folder-section group/bookmark-folder-section grid w-full content-start items-start justify-items-stretch gap-1.5 [scroll-margin-top:clamp(28px,5vh,48px)] [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard)] focus:bg-transparent focus:[box-shadow:none] focus:[outline:0] focus-visible:bg-transparent focus-visible:[box-shadow:none] focus-visible:[outline:0]'
const BOOKMARK_FOLDER_SECTION_DRAGGING_CLASS = 'dragging-folder opacity-[0.54]'
const BOOKMARK_REORDER_STATUS_CLASS = 'bookmark-reorder-status mt-1.5 mb-0 text-xs font-[650] leading-[1.4]'
const BOOKMARK_REORDER_STATUS_WARNING_CLASS = 'text-[rgba(255,214,179,0.88)]'
const BOOKMARK_REORDER_STATUS_SUCCESS_CLASS = 'text-[rgba(132,218,137,0.9)]'
const BOOKMARK_REORDER_STATUS_ERROR_CLASS = 'text-[rgba(255,183,176,0.94)]'
const PORTAL_PANEL_CLASS = 'newtab-portal quick-only [--portal-card-min-height:42px] [--portal-card-gap:6px] mb-[18px] grid w-full grid-cols-1 items-stretch gap-3.5 rounded-lg border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] p-2.5 shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)]'
const QUICK_ACCESS_CLASS = 'newtab-quick-access grid w-full content-stretch gap-[var(--portal-card-gap)]'
const QUICK_GROUP_CLASS = 'newtab-quick-group grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-2.5'
const QUICK_HEADING_CLASS = 'newtab-quick-heading flex [min-height:auto] items-center whitespace-nowrap px-0.5 text-[11px] font-[700] leading-[1.2] text-[rgba(245,245,247,0.8)]'
const QUICK_LIST_CLASS = 'newtab-quick-list grid min-w-0 grid-cols-[repeat(auto-fill,minmax(136px,1fr))] auto-rows-[minmax(var(--portal-card-min-height),1fr)] gap-[var(--portal-card-gap)]'
const QUICK_LINK_CLASS = 'curator-motion-card newtab-quick-link grid min-h-[var(--portal-card-min-height)] min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-[7px] rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[rgba(21,21,22,0.64)] py-1 pr-2 pl-[5px] text-[rgba(245,245,247,0.84)] no-underline shadow-[0_1px_2px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.075)] [transform:none] hover:border-[rgba(245,245,247,0.16)] hover:bg-[rgba(31,32,35,0.72)] hover:text-[var(--ui-text-primary)] hover:no-underline focus-visible:border-[rgba(245,245,247,0.16)] focus-visible:bg-[rgba(31,32,35,0.72)] focus-visible:text-[var(--ui-text-primary)] focus-visible:no-underline focus-visible:outline-none'
const QUICK_MARK_CLASS = 'newtab-quick-mark grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold leading-none'
const QUICK_MARK_DEFAULT_CLASS = 'bg-[rgba(245,245,247,0.08)] text-[rgba(245,245,247,0.72)]'
const QUICK_MARK_PINNED_CLASS = 'bg-[rgba(245,245,247,0.16)] text-[rgba(245,245,247,0.9)]'
const QUICK_COPY_CLASS = 'newtab-quick-copy grid min-w-0 gap-0.5'
const QUICK_COPY_TITLE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[720] leading-[1.15]'
const QUICK_COPY_DETAIL_CLASS = 'newtab-quick-copy-detail min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-[560] leading-[1.25] text-[rgba(245,245,247,0.7)]'

export function NewtabBookmarkContent({ hasSearch = false }: { hasSearch?: boolean }) {
  const state = useNewtabBookmarkContentView()
  if (!state) {
    return null
  }

  return <BookmarkContent hasSearch={hasSearch} state={state} />
}

function BookmarkContent({
  hasSearch,
  state
}: {
  hasSearch: boolean
  state: BookmarkContentViewModel
}) {
  const dragUi = useNewtabDragUiView()
  const folderSource = useNewtabFolderSourceView()
  const [prebootHandoffStatus, setPrebootHandoffStatus] = useState<'checking' | 'ready' | 'timeout'>('checking')
  const sectionsRootRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const setSectionElement = useCallback((anchorId: string, element: HTMLElement | null) => {
    if (element) {
      sectionRefs.current.set(anchorId, element)
      return
    }
    sectionRefs.current.delete(anchorId)
  }, [])
  const focusSource = useCallback((anchorId: string) => {
    const section = sectionRefs.current.get(anchorId)
    if (!section) {
      return
    }
    section.scrollIntoView({ block: 'start', behavior: getMotionAwareScrollBehavior('smooth') })
    section.focus({ preventScroll: true })
  }, [])

  useLayoutEffect(() => {
    return scheduleNewtabBookmarkPrebootHandoff({
      onFinish: (result) => {
        setPrebootHandoffStatus(result === 'timeout' ? 'timeout' : 'ready')
      }
    })
  }, [])

  useEffect(() => {
    if (prebootHandoffStatus !== 'ready') {
      return
    }

    let cancelled = false
    let loadWaitTimer = 0
    let pageReadyHandled = false
    let revealFrame = 0
    let settleFrame = 0
    const writeSnapshot = () => {
      if (cancelled) {
        return
      }
      // 导航模式的根层是文件夹卡片、层级可变，与快照的「展开网格」结构不兼容。
      // 此模式不写快照并清空旧快照，避免切换模式后刷新回放陈旧的展开结构（=形变）。
      // 阶段1 已保证导航视图 React 首帧稳定，无需 preboot 遮盖。
      if (state.browseMode === 'navigation') {
        clearNewtabBookmarkPrebootSnapshot()
        hideNewtabBookmarkPreboot({ clearSnapshot: true })
        return
      }
      revealFrame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(() => {
          const snapshot = writeNewtabBookmarkPrebootSnapshotFromView(state, {
            sectionsElement: sectionsRootRef.current,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth
          })
          if (!snapshot) {
            hideNewtabBookmarkPreboot({ clearSnapshot: true })
          }
        })
      })
    }
    const writeAfterFontsReady = () => {
      if (pageReadyHandled) {
        return
      }
      pageReadyHandled = true
      window.clearTimeout(loadWaitTimer)
      loadWaitTimer = 0
      window.removeEventListener('load', writeAfterFontsReady)
      void document.fonts.ready.then(writeSnapshot, writeSnapshot)
    }

    if (document.readyState === 'complete') {
      writeAfterFontsReady()
    } else {
      window.addEventListener('load', writeAfterFontsReady, { once: true })
      loadWaitTimer = window.setTimeout(
        writeAfterFontsReady,
        BOOKMARK_PREBOOT_SNAPSHOT_LOAD_WAIT_MS
      )
    }

    return () => {
      cancelled = true
      window.clearTimeout(loadWaitTimer)
      window.removeEventListener('load', writeAfterFontsReady)
      window.cancelAnimationFrame(revealFrame)
      window.cancelAnimationFrame(settleFrame)
    }
  }, [prebootHandoffStatus, state])

  return (
    <section
      className={getNewtabContentClass({ hasSearch, layoutMode: state.content.layoutMode })}
      style={createBookmarkContentStyle(state.content)}
      data-icon-layout-mode={state.content.layoutMode}
      data-icon-show-titles={String(state.content.showTitles)}
      data-icon-vertical-center={String(state.content.verticalCenter)}
      data-browse-mode={state.browseMode}
      aria-busy={state.content.reordering ? 'true' : 'false'}
    >
      {state.speedDial ? <SpeedDialPanelHost /> : null}
      {state.portal ? <PortalPanel state={state.portal} /> : null}
      {state.browseMode === 'navigation' && state.navigation ? (
        <BookmarkNavigationView
          dragUi={dragUi}
          fixedLayout={state.content.layoutMode === 'fixed'}
          navigation={state.navigation}
          showTitles={state.content.showTitles}
        />
      ) : (
        <>
          {state.sourceNavigation ? (
            <nav className={SOURCE_NAVIGATION_CLASS} aria-label="书签来源导航">
              <SourceNavigation onFocusSource={focusSource} state={state.sourceNavigation} />
            </nav>
          ) : null}
          <div className={BOOKMARK_FOLDER_SECTIONS_CLASS} ref={sectionsRootRef}>
            {state.sections.map((section) => (
              <BookmarkFolderSection
                dragUi={dragUi}
                fixedLayout={state.content.layoutMode === 'fixed'}
                hideFolderNames={folderSource.hideFolderNames}
                section={section}
                showTitles={state.content.showTitles}
                onSectionRef={setSectionElement}
                key={section.folderId}
              />
            ))}
            {state.reorderStatus ? (
              <p
                className={getBookmarkReorderStatusClass(state.reorderStatus.tone)}
                data-tone={state.reorderStatus.tone}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {state.reorderStatus.message}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

function getBookmarkBreadcrumbButtonClass(isLast: boolean): string {
  return isLast
    ? `${BOOKMARK_BREADCRUMB_BUTTON_BASE_CLASS} ${BOOKMARK_BREADCRUMB_BUTTON_CURRENT_CLASS}`
    : BOOKMARK_BREADCRUMB_BUTTON_BASE_CLASS
}

function getBookmarkReorderStatusClass(tone: string): string {
  if (tone === 'success') {
    return `${BOOKMARK_REORDER_STATUS_CLASS} ${BOOKMARK_REORDER_STATUS_SUCCESS_CLASS}`
  }
  if (tone === 'error') {
    return `${BOOKMARK_REORDER_STATUS_CLASS} ${BOOKMARK_REORDER_STATUS_ERROR_CLASS}`
  }
  return `${BOOKMARK_REORDER_STATUS_CLASS} ${BOOKMARK_REORDER_STATUS_WARNING_CLASS}`
}

function createBookmarkContentStyle(state: BookmarkContentStyleState): CSSProperties {
  return {
    '--icon-page-width': `${state.pageWidth}px`,
    '--icon-column-gap': `${state.columnGap}px`,
    '--icon-row-gap': `${state.rowGap}px`,
    '--icon-folder-gap': `${state.folderGap}px`,
    '--icon-tile-width': `${state.tileWidth}px`,
    '--icon-shell-size': `${state.iconShellSize}px`,
    '--icon-fixed-grid-width': `${state.fixedGridWidth}px`,
    '--icon-columns': String(state.columns),
    '--icon-title-lines': String(state.titleLines)
  } as CSSProperties
}

function BookmarkFolderSection({
  dragUi,
  fixedLayout,
  hideFolderNames,
  onSectionRef,
  section,
  showTitles,
}: {
  dragUi: NewtabDragUiView
  fixedLayout: boolean
  hideFolderNames: boolean
  onSectionRef: (anchorId: string, element: HTMLElement | null) => void
  section: BookmarkFolderSectionViewModel
  showTitles: boolean
}) {
  const className = section.dragging
    ? `${BOOKMARK_FOLDER_SECTION_CLASS} ${BOOKMARK_FOLDER_SECTION_DRAGGING_CLASS}`
    : BOOKMARK_FOLDER_SECTION_CLASS
  const sectionRef = useCallback((element: HTMLElement | null) => {
    onSectionRef(section.anchorId, element)
    setNewtabBookmarkFolderSectionNode(section.folderId, element)
  }, [onSectionRef, section.anchorId, section.folderId])

  return (
    <section
      className={className}
      id={section.anchorId}
      data-folder-section-id={section.folderId}
      ref={sectionRef}
      tabIndex={-1}
    >
      <div className={getFolderSectionHeaderRowClass({
        forceVisible: dragUi.folderOrderDragging,
        hideNames: hideFolderNames
      })}>
        <FolderSectionHeader pending={dragUi.folderPendingId === section.folderId} state={{
          bookmarkCount: section.bookmarkCount,
          dragging: section.dragging,
          folderId: section.folderId,
          path: section.path,
          onAddBookmark: section.onAddBookmark,
          onClick: section.onClick,
          onDragPointerDown: section.onDragPointerDown,
          onReorderKeyDown: section.onReorderKeyDown,
          title: section.title
        }} />
      </div>
      {section.grid ? (
        <BookmarkFolderGrid dragUi={dragUi} fixedLayout={fixedLayout} grid={section.grid} showTitles={showTitles} title={section.title} />
      ) : (
        <div className={EMPTY_FOLDER_STATE_CLASS}>
          <EmptyFolder state={{
            folderId: section.folderId,
            onAddBookmark: section.onAddBookmark,
            onOpenFolderSettings: section.onOpenFolderSettings
          }} />
        </div>
      )}
    </section>
  )
}

function BookmarkFolderGrid({
  dragUi,
  fixedLayout,
  grid,
  showTitles,
  title
}: {
  dragUi: NewtabDragUiView
  fixedLayout: boolean
  grid: BookmarkFolderGridViewModel
  showTitles: boolean
  title: string
}) {
  const setGridRef = useCallback((element: HTMLElement | null) => {
    setNewtabBookmarkGridNode(grid.folderId, element)
  }, [grid.folderId])
  const totalCount = grid.items.length
  const initialVisibleCount = getInitialVisibleCount(grid)
  const [visibleCountState, setVisibleCountState] = useState(initialVisibleCount)
  const visibleCount = normalizeVisibleCount(visibleCountState, initialVisibleCount, totalCount)
  const expandFrameRef = useRef(0)
  const placeholderRef = useRef<HTMLOutputElement | null>(null)
  const visibleCountRef = useRef(visibleCount)

  useLayoutEffect(() => {
    visibleCountRef.current = visibleCount
  }, [visibleCount])

  const cancelExpandFrame = useCallback(() => {
    if (!expandFrameRef.current) {
      return
    }
    window.cancelAnimationFrame(expandFrameRef.current)
    expandFrameRef.current = 0
  }, [])

  const expandVisibleItems = useCallback(() => {
    if (expandFrameRef.current || visibleCountRef.current >= grid.items.length) {
      return
    }

    const runFrame = () => {
      expandFrameRef.current = window.requestAnimationFrame(() => {
        expandFrameRef.current = 0
        const nextVisibleCount = Math.min(
          grid.items.length,
          Math.max(visibleCountRef.current, initialVisibleCount) + grid.chunkSize
        )
        visibleCountRef.current = nextVisibleCount
        setVisibleCountState((current) => {
          const visibleCount = Math.max(current, nextVisibleCount)
          if (current === visibleCount) {
            return current
          }
          return visibleCount
        })

        if (nextVisibleCount < grid.items.length) {
          runFrame()
        }
      })
    }

    runFrame()
  }, [grid.chunkSize, grid.items.length, initialVisibleCount])

  useEffect(() => {
    return () => {
      setNewtabBookmarkGridNode(grid.folderId, null)
      cancelExpandFrame()
    }
  }, [cancelExpandFrame, grid.folderId])

  useEffect(() => {
    if (visibleCount >= grid.items.length) {
      cancelExpandFrame()
      return
    }

    const placeholder = placeholderRef.current
    if (!placeholder) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      window.queueMicrotask(() => {
        expandVisibleItems()
      })
      return
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        expandVisibleItems()
      }
    }, { rootMargin: '360px 0px' })
    observer.observe(placeholder)
    return () => {
      observer.disconnect()
    }
  }, [cancelExpandFrame, expandVisibleItems, grid.items.length, visibleCount])

  const visibleItems = useMemo(
    () => grid.items.slice(0, visibleCount),
    [grid.items, visibleCount]
  )
  const remainingCount = Math.max(0, totalCount - visibleCount)
  const busy = grid.busy || remainingCount > 0

  return (
    <nav
      className={getBookmarkGridClass({ fixedLayout })}
      data-bookmark-grid-folder-id={grid.folderId}
      data-incremental-render={remainingCount > 0 ? 'true' : undefined}
      aria-label={grid.ariaLabel}
      aria-busy={busy ? 'true' : 'false'}
      ref={setGridRef}
    >
      {visibleItems.map((item) => (
        <BookmarkTile dragUi={dragUi} state={item} showTitles={showTitles} key={item.id} />
      ))}
      {remainingCount > 0 ? (
        <BookmarkGridPlaceholder
          folderTitle={title}
          remainingCount={remainingCount}
          refNode={placeholderRef}
        />
      ) : null}
    </nav>
  )
}

function getInitialVisibleCount(grid: BookmarkFolderGridViewModel): number {
  return Math.min(grid.items.length, Math.max(0, grid.initialVisibleCount))
}

function normalizeVisibleCount(
  visibleCount: number,
  initialVisibleCount: number,
  totalCount: number
): number {
  return Math.min(totalCount, Math.max(visibleCount, initialVisibleCount))
}

function BookmarkGridPlaceholder({
  folderTitle,
  refNode,
  remainingCount
}: {
  folderTitle: string
  refNode: React.RefObject<HTMLOutputElement | null>
  remainingCount: number
}) {
  const title = `${folderTitle || '文件夹'}还有 ${remainingCount} 个书签将在滚动到此处时载入`
  return (
    <output
      className={BOOKMARK_GRID_PLACEHOLDER_CLASS}
      data-pending-bookmarks={String(remainingCount)}
      aria-live="polite"
      title={title}
      ref={refNode}
    >
      继续载入 <NumberPop text={remainingCount} /> 个书签
    </output>
  )
}

function BookmarkTile({
  dragUi,
  state,
  showTitles
}: {
  dragUi: NewtabDragUiView
  state: BookmarkTileViewModel
  showTitles: boolean
}) {
  const setTileRef = useCallback((element: HTMLAnchorElement | null) => {
    setNewtabBookmarkTileNode(state.id, element)
  }, [state.id])
  const setIconRef = useCallback((element: HTMLSpanElement | null) => {
    setNewtabBookmarkTileIconNode(state.id, element)
  }, [state.id])
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType === 'mouse') {
      state.onDragPointerDown(event)
    }
  }, [state])

  useEffect(() => {
    return () => {
      setNewtabBookmarkTileNode(state.id, null)
      setNewtabBookmarkTileIconNode(state.id, null)
    }
  }, [state.id])

  return (
    <a
      className={getBookmarkTileClass({
        dragActive: dragUi.bookmarkDragging,
        dragging: state.dragging,
        previewInitializing: dragUi.previewInitializing,
        showTitles
      })}
      href={state.url}
      title={state.title}
      draggable={false}
      data-bookmark-id={state.id}
      data-folder-id={state.folderId}
      aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight"
      aria-label={`${state.title}。按 Alt 加方向键调整顺序，按 Alt+Shift 加左右方向键移动到相邻来源文件夹`}
      onClick={state.onNavigate}
      onContextMenu={state.onContextMenu}
      onKeyDown={state.onReorderKeyDown}
      onPointerDown={handlePointerDown}
      ref={setTileRef}
      style={state.style}
    >
      <BookmarkIconShell
        customIcon={state.customIcon}
        fallbackLabel={state.fallbackLabel}
        favicon={state.favicon}
        ref={setIconRef}
      />
      <span className={getBookmarkTitleClass()} hidden={!showTitles}>{state.title}</span>
      <span
        className={BOOKMARK_DRAG_HANDLE_CLASS}
        data-bookmark-drag-handle=""
        data-drag-pending={dragUi.bookmarkPendingId === state.id ? 'true' : undefined}
        aria-hidden="true"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          state.onDragPointerDown(event)
        }}
      >
        <Icon name="Move" size={15} aria-hidden="true" />
      </span>
    </a>
  )
}

function BookmarkNavigationView({
  dragUi,
  fixedLayout,
  navigation,
  showTitles
}: {
  dragUi: NewtabDragUiView
  fixedLayout: boolean
  navigation: BookmarkNavigationViewModel
  showTitles: boolean
}) {
  const totalBookmarks = navigation.items.length
  const initialVisibleCount = Math.min(totalBookmarks, Math.max(0, navigation.initialVisibleCount))
  const [visibleCountState, setVisibleCountState] = useState(initialVisibleCount)
  const visibleCount = normalizeVisibleCount(visibleCountState, initialVisibleCount, totalBookmarks)
  const expandFrameRef = useRef(0)
  const placeholderRef = useRef<HTMLOutputElement | null>(null)
  const visibleCountRef = useRef(visibleCount)

  useLayoutEffect(() => {
    visibleCountRef.current = visibleCount
  }, [visibleCount])

  const cancelExpandFrame = useCallback(() => {
    if (!expandFrameRef.current) {
      return
    }
    window.cancelAnimationFrame(expandFrameRef.current)
    expandFrameRef.current = 0
  }, [])

  const expandVisibleItems = useCallback(() => {
    if (expandFrameRef.current || visibleCountRef.current >= navigation.items.length) {
      return
    }
    const runFrame = () => {
      expandFrameRef.current = window.requestAnimationFrame(() => {
        expandFrameRef.current = 0
        const nextVisibleCount = Math.min(
          navigation.items.length,
          Math.max(visibleCountRef.current, initialVisibleCount) + navigation.chunkSize
        )
        visibleCountRef.current = nextVisibleCount
        setVisibleCountState((current) => Math.max(current, nextVisibleCount))
        if (nextVisibleCount < navigation.items.length) {
          runFrame()
        }
      })
    }
    runFrame()
  }, [initialVisibleCount, navigation.chunkSize, navigation.items.length])

  useEffect(() => {
    return () => {
      cancelExpandFrame()
    }
  }, [cancelExpandFrame])

  useEffect(() => {
    if (visibleCount >= navigation.items.length) {
      cancelExpandFrame()
      return
    }
    const placeholder = placeholderRef.current
    if (!placeholder) {
      return
    }
    if (typeof IntersectionObserver === 'undefined') {
      window.queueMicrotask(() => {
        expandVisibleItems()
      })
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        expandVisibleItems()
      }
    }, { rootMargin: '360px 0px' })
    observer.observe(placeholder)
    return () => {
      observer.disconnect()
    }
  }, [cancelExpandFrame, expandVisibleItems, navigation.items.length, visibleCount])

  const visibleItems = useMemo(
    () => navigation.items.slice(0, visibleCount),
    [navigation.items, visibleCount]
  )
  const remainingCount = Math.max(0, totalBookmarks - visibleCount)
  const isEmpty = navigation.folderCards.length === 0 && totalBookmarks === 0

  return (
    <div className={BOOKMARK_NAVIGATION_CLASS}>
      {navigation.breadcrumb.length > 1 ? (
        <nav className={BOOKMARK_BREADCRUMB_CLASS} aria-label="书签导航路径">
          {navigation.breadcrumb.map((crumb, index) => (
            <BookmarkBreadcrumbItem
              crumb={crumb}
              isLast={index === navigation.breadcrumb.length - 1}
              key={crumb.folderId || 'root'}
            />
          ))}
        </nav>
      ) : null}
      {isEmpty ? (
        <p className={BOOKMARK_NAVIGATION_EMPTY_CLASS}>此文件夹为空。</p>
      ) : (
        <nav
          className={getBookmarkGridClass({ fixedLayout })}
          aria-label={navigation.ariaLabel}
          aria-busy={remainingCount > 0 ? 'true' : 'false'}
          data-incremental-render={remainingCount > 0 ? 'true' : undefined}
        >
          {navigation.folderCards.map((folder) => (
            <BookmarkFolderCard folder={folder} showTitles={showTitles} key={`folder-${folder.folderId}`} />
          ))}
          {visibleItems.map((item) => (
            <BookmarkTile dragUi={dragUi} state={item} showTitles={showTitles} key={item.id} />
          ))}
          {remainingCount > 0 ? (
            <BookmarkGridPlaceholder
              folderTitle={navigation.ariaLabel}
              remainingCount={remainingCount}
              refNode={placeholderRef}
            />
          ) : null}
        </nav>
      )}
    </div>
  )
}

function BookmarkBreadcrumbItem({
  crumb,
  isLast
}: {
  crumb: BookmarkBreadcrumbItemViewModel
  isLast: boolean
}) {
  return (
    <>
      <Button
        className={getBookmarkBreadcrumbButtonClass(isLast)}
        type="button"
        aria-current={isLast ? 'page' : undefined}
        onClick={crumb.onNavigate}
        unstyled
      >
        {crumb.folderId ? null : <Icon name="Bookmark" size={13} aria-hidden="true" />}
        <span className={BOOKMARK_BREADCRUMB_LABEL_CLASS}>{crumb.title}</span>
      </Button>
      {isLast ? null : <span className={BOOKMARK_BREADCRUMB_SEP_CLASS} aria-hidden="true">/</span>}
    </>
  )
}

function BookmarkFolderCard({
  folder,
  showTitles
}: {
  folder: BookmarkFolderCardViewModel
  showTitles: boolean
}) {
  return (
    <button
      className={showTitles
        ? `${getBookmarkTileClass({ showTitles })} ${BOOKMARK_FOLDER_CARD_GRID_CLASS}`
        : getBookmarkTileClass({ showTitles })}
      type="button"
      title={folder.title}
      data-folder-card-id={folder.folderId}
      aria-label={`进入文件夹「${folder.title}」，${folder.bookmarkCount} 个书签`}
      onClick={folder.onOpen}
    >
      <span className={BOOKMARK_FOLDER_CARD_ICON_CLASS} aria-hidden="true">
        <Icon name="Folder" size={20} />
      </span>
      <span className={getBookmarkTitleClass()} hidden={!showTitles}>{folder.title}</span>
      <span className={BOOKMARK_FOLDER_CARD_COUNT_CLASS} aria-hidden="true">
        <NumberPop text={folder.bookmarkCount} />
      </span>
    </button>
  )
}

function PortalPanel({ state }: { state: PortalPanelState }) {
  return (
    <section className={PORTAL_PANEL_CLASS} aria-label="Curator 常用和新近添加书签">
      <section className={QUICK_ACCESS_CLASS} aria-label="Curator 常用和新近添加书签">
        <QuickAccessPanel state={state.quickAccess} />
      </section>
    </section>
  )
}

function QuickAccessPanel({ state }: { state: QuickAccessPanelState }) {
  return (
    <>
      {state.groups.map((group) => (
        <section className={QUICK_GROUP_CLASS} aria-label={`${group.label}书签`} key={group.label}>
          <div className={QUICK_HEADING_CLASS}>{group.label}</div>
          <div className={QUICK_LIST_CLASS}>
            {group.items.map((item) => (
              <a
                className={QUICK_LINK_CLASS}
                href={item.url}
                title={`${item.title} · ${item.detail}`}
                draggable={false}
                data-bookmark-id={item.id}
                data-quick-reason={item.reason}
                onClick={item.onNavigate}
                onContextMenu={item.onContextMenu}
                key={item.id}
              >
                <span className={getQuickAccessMarkClass(item.reason)} aria-hidden="true">{item.badge}</span>
                <span className={QUICK_COPY_CLASS}>
                  <strong className={QUICK_COPY_TITLE_CLASS}>{item.title}</strong>
                  <span className={QUICK_COPY_DETAIL_CLASS}>{item.detail}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function getQuickAccessMarkClass(reason: string): string {
  return reason === 'pinned'
    ? `${QUICK_MARK_CLASS} ${QUICK_MARK_PINNED_CLASS}`
    : `${QUICK_MARK_CLASS} ${QUICK_MARK_DEFAULT_CLASS}`
}

function EmptyFolder({ state }: { state: EmptyFolderState }) {
  return (
    <>
      <p className={EMPTY_FOLDER_COPY_CLASS}>
        此文件夹还没有书签。你可以先添加一个书签，或改用已有的非空来源；选择来源只改变展示，不会移动或删除书签。
      </p>
      <div className={EMPTY_FOLDER_ACTIONS_CLASS}>
        <Button
          className={EMPTY_FOLDER_BUTTON_CLASS}
          type="button"
          data-add-bookmark-folder-id={state.folderId}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            state.onAddBookmark(event.currentTarget, state.folderId)
          }}
          unstyled
        >
          添加书签到这里
        </Button>
        <Button
          className={EMPTY_FOLDER_BUTTON_CLASS}
          type="button"
          title="打开来源设置并选择已有文件夹"
          onClick={state.onOpenFolderSettings}
          unstyled
        >
          选择现有来源
        </Button>
      </div>
    </>
  )
}

function FolderSectionHeader({ pending, state }: { pending: boolean; state: FolderSectionHeaderState }) {
  const displayTitle = state.title || '未命名文件夹'
  const addTitle = `添加书签到「${displayTitle}」`
  const setHeaderRef = useCallback((element: HTMLButtonElement | null) => {
    setNewtabBookmarkFolderHeaderNode(state.folderId, element)
  }, [state.folderId])
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    state.onDragPointerDown(event)
  }, [state])

  useEffect(() => {
    return () => {
      setNewtabBookmarkFolderHeaderNode(state.folderId, null)
    }
  }, [state.folderId])

  return (
    <>
      <Button
        className={getFolderSectionHeaderClass({ dragging: state.dragging, pending })}
        type="button"
        data-folder-drag-handle={state.folderId}
        title={state.path || state.title}
        aria-label={`${state.title}，长按拖拽调整文件夹顺序`}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onClick={state.onClick}
        onKeyDown={state.onReorderKeyDown}
        onPointerDown={handlePointerDown}
        ref={setHeaderRef}
        unstyled
      >
        <span className={FOLDER_SECTION_TITLE_CLASS}>{displayTitle}</span>
        <span className={FOLDER_SECTION_COUNT_CLASS}>
          <NumberPop text={state.bookmarkCount} />
        </span>
      </Button>
      <Button
        className={FOLDER_SECTION_ADD_CLASS}
        type="button"
        data-add-bookmark-folder-id={state.folderId}
        title={addTitle}
        aria-label={addTitle}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          state.onAddBookmark(event.currentTarget, state.folderId)
        }}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        unstyled
      >
        <Icon name="Plus" size={12} strokeWidth={2} aria-hidden="true" />
      </Button>
    </>
  )
}

function SourceNavigation({
  onFocusSource,
  state
}: {
  onFocusSource: (anchorId: string) => void
  state: SourceNavigationState
}) {
  return (
    <>
      <span className={SOURCE_NAVIGATION_LABEL_CLASS}>来源</span>
      <div className={SOURCE_NAVIGATION_LIST_CLASS}>
        {state.items.map((item) => (
          <Button
            className={SOURCE_NAVIGATION_LINK_CLASS}
            data-source-navigation-target={item.anchorId}
            title={item.path}
            draggable={false}
            aria-label={`跳转到「${item.title}」，${item.bookmarkCount} 个书签`}
            type="button"
            onClick={() => {
              onFocusSource(item.anchorId)
            }}
            unstyled
            key={item.id}
          >
            <span className={SOURCE_NAVIGATION_TITLE_CLASS}>{item.title}</span>
            <span className={SOURCE_NAVIGATION_COUNT_CLASS}>
              <NumberPop text={item.bookmarkCount} />
            </span>
          </Button>
        ))}
      </div>
    </>
  )
}
