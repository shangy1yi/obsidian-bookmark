import { useEffect, useLayoutEffect, useRef } from 'react'
import { Button } from '../../ui/base/Button'
import { CloseButton } from '../../ui/base/CloseButton'
import { DialogBackdrop, DialogClose, DialogOverlay, DialogPanel, DialogTitle } from '../../ui/base/Dialog'
import {
  dispatchNewtabFeaturedBackgroundModalGridScroll,
  dispatchNewtabFeaturedBackgroundModalOpenChange,
  dispatchNewtabFeaturedBackgroundModalReady,
  dispatchNewtabFeaturedBackgroundModalRefreshClick,
  setNewtabFeaturedBackgroundModalNodes,
  useNewtabFeaturedBackgroundModalView
} from '../newtab-featured-background-modal-store'
import {
  getNewtabFeaturedBackgroundPickerNodes,
  useNewtabFeaturedBackgroundPickerFocusRequest,
  useNewtabFeaturedBackgroundPickerView,
  type FeaturedBackgroundPickerView
} from '../newtab-featured-background-picker-store'
import { FeaturedBackgroundHoverPreviewHost } from './FeaturedBackgroundHoverPreview'
import { FeaturedBackgroundPicker } from './FeaturedBackgroundPicker'
import { FEATURED_WALLPAPER_CONTROL_CLASS } from './featuredWallpaperControlClasses'

const featuredWallpaperModalLayoutClass =
  'fixed inset-0 z-[10020] grid place-items-center p-6 pointer-events-none'
const featuredWallpaperBackdropClass =
  'fixed inset-0 bg-[rgba(0,0,0,0.46)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)]'
const featuredWallpaperPanelLayoutClass =
  'pointer-events-auto relative z-[1] grid w-[min(1320px,calc(100vw_-_48px))] max-h-[min(820px,calc(100vh_-_48px))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden'
const featuredWallpaperPanelSurfaceClass =
  'rounded-ds-lg border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] text-ds-text-primary shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)]'
const featuredWallpaperStatusClass =
  'featured-wallpaper-status border border-[rgba(245,245,247,0.12)] bg-[rgba(245,245,247,0.065)] text-ds-text-secondary shadow-none'
const featuredWallpaperActionClass = `featured-wallpaper-action ${FEATURED_WALLPAPER_CONTROL_CLASS}`

export interface FeaturedBackgroundModalProps {
  open: boolean
  refreshing?: boolean
  status?: string
  statusTone?: string
  onOpenChange: (open: boolean, event?: Event) => void
  onGridScroll: () => void
  onRefreshClick: () => void
  pickerView: FeaturedBackgroundPickerView | null
}

function FeaturedBackgroundModal({
  open,
  refreshing = false,
  status = '',
  statusTone = 'info',
  onGridScroll,
  onOpenChange,
  onRefreshClick,
  pickerView
}: FeaturedBackgroundModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLElement | null>(null)
  const focusRequest = useNewtabFeaturedBackgroundPickerFocusRequest()
  const modalClassName = `featured-wallpaper-modal ${featuredWallpaperModalLayoutClass}`
  const panelClassName = `featured-wallpaper-panel ${featuredWallpaperPanelLayoutClass} ${featuredWallpaperPanelSurfaceClass}`

  useEffect(() => {
    if (!open ||
      focusRequest.requestId === 0 ||
      hasFocusableFeaturedBackgroundPickerCard(pickerView)) {
      return
    }
    closeButtonRef.current?.focus()
  }, [focusRequest.requestId, open, pickerView])

  useLayoutEffect(() => {
    setNewtabFeaturedBackgroundModalNodes({
      grid: gridRef.current,
      modal: overlayRef.current
    })
    return () => {
      setNewtabFeaturedBackgroundModalNodes({
        grid: null,
        modal: null
      })
    }
  }, [open])

  return (
    <DialogOverlay
      id="background-featured-modal"
      className={modalClassName}
      ref={overlayRef}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="background-featured-picker"
      modal
      disablePointerDismissal
    >
      <DialogBackdrop
        className={featuredWallpaperBackdropClass}
        onClick={(event) => onOpenChange(false, event.nativeEvent)}
      />
      <DialogPanel
        className={panelClassName}
        ref={panelRef}
        initialFocus={false}
        finalFocus={() => getNewtabFeaturedBackgroundPickerNodes().trigger}
      >
        <header className="featured-wallpaper-head">
          <div>
            <p className="featured-wallpaper-kicker">精选图库</p>
            <DialogTitle as="h3" id="background-featured-modal-title">选择精选图库壁纸</DialogTitle>
          </div>
          <div className="featured-wallpaper-actions">
            <output
              id="background-featured-status"
              className={featuredWallpaperStatusClass}
              aria-live="polite"
              data-tone={statusTone}
              hidden={!status}
            >
              {status}
            </output>
            <Button
              id="background-featured-refresh"
              className={featuredWallpaperActionClass}
              type="button"
              disabled={refreshing}
              focusableWhenDisabled
              onClick={onRefreshClick}
              unstyled
            >
              {refreshing ? '刷新中...' : '刷新图库'}
            </Button>
            <DialogClose
              render={
                <CloseButton
                  ref={closeButtonRef}
                  id="background-featured-modal-close"
                  className={`featured-wallpaper-close ${FEATURED_WALLPAPER_CONTROL_CLASS}`}
                  type="button"
                  label="关闭精选图库"
                  variant="ghost"
                />
              }
            />
          </div>
        </header>
        <div
          id="background-featured-modal-grid"
          className="featured-wallpaper-grid"
          aria-label="精选图库壁纸列表"
          ref={(element) => {
            gridRef.current = element
          }}
          onScroll={onGridScroll}
        >
          {pickerView ? <FeaturedBackgroundPicker previewRootRef={gridRef} state={pickerView} /> : null}
        </div>
        <FeaturedBackgroundHoverPreviewHost />
      </DialogPanel>
    </DialogOverlay>
  )
}

function hasFocusableFeaturedBackgroundPickerCard(view: FeaturedBackgroundPickerView | null): boolean {
  if (!view || view.type !== 'sections') {
    return false
  }

  return view.sections.some((section) => {
    if (section.type === 'grid') {
      return section.section.cards.length > 0
    }

    return section.groups.some((group) => group.cards.length > 0)
  })
}

export function FeaturedBackgroundModalHost() {
  const view = useNewtabFeaturedBackgroundModalView()
  const pickerView = useNewtabFeaturedBackgroundPickerView()

  useEffect(() => {
    dispatchNewtabFeaturedBackgroundModalReady()
  }, [])

  return (
    <FeaturedBackgroundModal
      open={view.open}
      refreshing={view.refreshing}
      status={view.status}
      statusTone={view.statusTone}
      onGridScroll={dispatchNewtabFeaturedBackgroundModalGridScroll}
      onOpenChange={dispatchNewtabFeaturedBackgroundModalOpenChange}
      onRefreshClick={dispatchNewtabFeaturedBackgroundModalRefreshClick}
      pickerView={pickerView}
    />
  )
}
