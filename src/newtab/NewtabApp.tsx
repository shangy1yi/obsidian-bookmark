import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '../ui/base/Button'
import { cx } from '../ui/base/utils'
import { Icon } from '../ui/icons/Icon'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { runIdle } from '../shared/idle'
import { NewtabBackgroundLayer } from './components/NewtabBackgroundLayer'
import { useNewtabAppChromeAttributes } from './components/NewtabBodyClassesHost'
import { NewtabContentHost } from './components/NewtabContentHost'
import { NewtabInstantWallpaperHost } from './components/NewtabInstantWallpaperHost'
import {
  dispatchNewtabBookmarkChanged,
  dispatchNewtabBookmarkCreated,
  dispatchNewtabBookmarkMoved,
  dispatchNewtabBookmarkRemoved
} from './newtab-bookmark-events-store'
import {
  dispatchNewtabContentShellContextMenu,
  dispatchNewtabContentShellPointerDownCapture,
  setNewtabContentShellNode
} from './newtab-content-store'
import { dispatchNewtabDocumentKeyDown } from './newtab-keyboard-store'
import {
  dispatchNewtabPageHide,
  dispatchNewtabVisibilityChange
} from './newtab-lifecycle-store'
import {
  dispatchNewtabWindowPointerCancel,
  dispatchNewtabWindowPointerMove,
  dispatchNewtabWindowPointerUp,
  dispatchNewtabWindowResize
} from './newtab-window-store'
import {
  dispatchNewtabSettingsDrawerOpenChange,
  dispatchNewtabSettingsDrawerToggleRequest,
  setNewtabSettingsDrawerNodes,
  useNewtabSettingsDrawerOpen
} from './newtab-settings-drawer-store'
import { useSettingsDrawerModalMode } from './settings-drawer-mode'
import {
  useNewtabPaperShaderActive,
  useNewtabBackgroundSettingsView,
  useNewtabWallpaperFilterActive,
  type NewtabBackgroundSettingsView
} from './newtab-background-settings-store'
import { useNewtabInstantWallpaperView } from './newtab-instant-wallpaper-store'
import { useNewtabFolderSourceView } from './newtab-folder-source-store'
import {
  getBackgroundMaskBaseColor,
  getBackgroundMaskBackdropFilter,
  getBackgroundMaskOverlayGradient,
  isLegacyBackgroundMaskStyle
} from './background-mask-settings'

const BACKGROUND_MASK_BASE_CLASS = 'newtab-background-mask fixed inset-0 z-0 pointer-events-none opacity-0 before:absolute before:inset-0 before:pointer-events-none before:opacity-0 before:mix-blend-overlay'
const BACKGROUND_MASK_ENABLED_CLASS = 'opacity-100'
const BACKGROUND_MASK_STYLE_CLASS_BY_STYLE = {
  dark: '',
  frosted: '',
  light: '',
  noise: 'before:opacity-[0.16] before:[background-image:radial-gradient(rgba(255,255,255,0.18)_0.65px,transparent_0.9px),radial-gradient(rgba(0,0,0,0.24)_0.7px,transparent_1px)] before:[background-position:0_0,12px_14px] before:[background-size:4px_4px,5px_5px]'
} as const
const SOLID_BACKGROUND_NOISE_CLASS = 'newtab-solid-background-noise fixed inset-0 z-0 pointer-events-none overflow-hidden'
const DYNAMIC_BACKGROUND_STAGE_CLASS = 'newtab-dynamic-background-stage fixed inset-0 z-0 h-full w-full overflow-hidden pointer-events-none isolate [contain:strict] [transform:translateZ(0)]'
const NEWTAB_REDUCED_MOTION_DESCENDANTS_CLASS = [
  'motion-reduce:[&_*]:![animation:none]',
  'motion-reduce:[&_*::before]:![animation:none]',
  'motion-reduce:[&_*::after]:![animation:none]',
  'motion-reduce:[&_*]:![transform:none]',
  'motion-reduce:[&_*::before]:![transform:none]',
  'motion-reduce:[&_*::after]:![transform:none]'
].join(' ')
const NEWTAB_REDUCED_MOTION_SELF_CLASS =
  'motion-reduce:![animation:none] motion-reduce:![transform:none]'
const SETTINGS_DRAWER_IDLE_LOAD_DELAY_MS = 450
const DEFERRED_HOSTS_IDLE_LOAD_DELAY_MS = 250
const LOADING_VISIBILITY_CLASS = 'opacity-100 visible [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),visibility_0s_linear_0s]'
const SETTINGS_TRIGGER_ZONE_BASE_CLASS = `settings-trigger-zone group/settings-trigger-zone fixed top-0 right-0 z-30 h-24 w-[min(360px,calc(100vw-18px))] ${LOADING_VISIBILITY_CLASS} ${NEWTAB_REDUCED_MOTION_SELF_CLASS}`
const SETTINGS_TRIGGER_ZONE_VISIBLE_CLASS = 'pointer-events-none'
const SETTINGS_TRIGGER_ZONE_AUTO_HIDE_CLASS = 'pointer-events-auto'
const SETTINGS_TRIGGER_BUTTON_BASE_CLASS = `settings-trigger absolute top-[18px] right-[18px] inline-flex h-10 min-h-[34px] w-10 min-w-10 cursor-pointer items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] p-0 text-center leading-none text-[var(--ui-text-secondary)] shadow-none outline-none pointer-events-auto [filter:var(--newtab-glass-drop)] [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),border-color_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)] hover:border-[var(--newtab-glass-slider-fill)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--newtab-glass-slider-fill)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(245,245,247,0.34)] aria-expanded:border-[var(--newtab-glass-slider-fill)] aria-expanded:text-[var(--ui-text-primary)] active:[transform:scale(var(--ui-press-scale))] motion-reduce:transition-none motion-reduce:transform-none [&_svg]:h-5 [&_svg]:w-5 [&_svg]:flex-none [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] ${NEWTAB_REDUCED_MOTION_SELF_CLASS}`
const SETTINGS_TRIGGER_BUTTON_VISIBLE_CLASS = 'opacity-100'
const SETTINGS_TRIGGER_BUTTON_AUTO_HIDE_CLASS = 'translate-x-2 -translate-y-2 scale-[0.98] opacity-0 group-hover/settings-trigger-zone:translate-x-0 group-hover/settings-trigger-zone:translate-y-0 group-hover/settings-trigger-zone:scale-100 group-hover/settings-trigger-zone:opacity-100 group-focus-within/settings-trigger-zone:translate-x-0 group-focus-within/settings-trigger-zone:translate-y-0 group-focus-within/settings-trigger-zone:scale-100 group-focus-within/settings-trigger-zone:opacity-100 aria-expanded:translate-x-0 aria-expanded:translate-y-0 aria-expanded:scale-100 aria-expanded:opacity-100 [@media(hover:none)]:translate-x-0 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100'
const SETTINGS_BACKDROP_BASE_CLASS = 'settings-backdrop fixed inset-0 z-[10015] bg-transparent pointer-events-none'
const WALLPAPER_LOADING_INDICATOR_CLASS = 'wallpaper-loading-indicator fixed inset-0 z-[2] grid place-items-center p-6 pointer-events-none'
const WALLPAPER_LOADING_INDICATOR_HIDDEN_CLASS = 'opacity-0 invisible translate-y-1 scale-[0.98] [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard),visibility_0s_linear_var(--ui-motion-standard)]'
const WALLPAPER_LOADING_INDICATOR_VISIBLE_CLASS = 'opacity-100 visible translate-y-0 scale-100 [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard),visibility_0s_linear_0s]'
const WALLPAPER_LOADING_CARD_CLASS = 'wallpaper-loading-card grid h-12 w-12 place-items-center rounded-ds-sm border border-[rgba(245,245,247,0.14)] bg-[rgba(18,18,19,0.9)] text-[rgba(245,245,247,0.78)]'
const WALLPAPER_LOADING_LOADER_CLASS = 'wallpaper-loading-loader inline-flex h-3.5 w-[30px] items-center gap-1'
const WALLPAPER_LOADING_DOT_CLASS = 'block h-1.5 w-1.5 rounded-full bg-current opacity-[0.32] animate-[wallpaper-loading-loader-pulse_900ms_var(--ui-ease-standard)_infinite_both] motion-reduce:animate-none'
const NEWTAB_SHELL_CLASS = `newtab-shell relative z-[1] grid h-screen h-dvh items-start justify-items-center overflow-x-hidden overflow-y-auto px-[clamp(14px,5vw,72px)] pt-[clamp(18px,5vh,46px)] pb-[clamp(24px,6vh,64px)] select-none [-webkit-user-select:none] [scrollbar-color:rgba(245,245,247,0.18)_transparent] [scrollbar-width:thin] [line-break:strict] [hanging-punctuation:allow-end] [text-spacing-trim:trim-start] [text-autospace:normal] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[line-break:auto] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[hanging-punctuation:none] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[text-spacing-trim:space-all] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[text-autospace:no-autospace] [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[rgba(245,245,247,0.18)] [&::-webkit-scrollbar-thumb]:bg-clip-padding ${LOADING_VISIBILITY_CLASS} ${NEWTAB_REDUCED_MOTION_DESCENDANTS_CLASS}`

type SettingsDrawerHostComponent = (typeof import('./components/SettingsDrawer'))['SettingsDrawerHost']
type NewtabDeferredHostsComponent = (typeof import('./components/NewtabDeferredHosts'))['NewtabDeferredHosts']
type NewtabWallpaperFilterLayerComponent = (typeof import('./components/NewtabWallpaperFilterLayer'))['NewtabWallpaperFilterLayer']
type NewtabPaperShaderLayerComponent = (typeof import('./components/NewtabPaperShaderLayer'))['NewtabPaperShaderLayer']

let settingsDrawerHostComponent: SettingsDrawerHostComponent | null = null
let settingsDrawerHostPromise: Promise<SettingsDrawerHostComponent> | null = null
let newtabDeferredHostsComponent: NewtabDeferredHostsComponent | null = null
let newtabDeferredHostsPromise: Promise<NewtabDeferredHostsComponent> | null = null
let newtabWallpaperFilterLayerComponent: NewtabWallpaperFilterLayerComponent | null = null
let newtabWallpaperFilterLayerPromise: Promise<NewtabWallpaperFilterLayerComponent> | null = null
let newtabPaperShaderLayerComponent: NewtabPaperShaderLayerComponent | null = null
let newtabPaperShaderLayerPromise: Promise<NewtabPaperShaderLayerComponent> | null = null

function loadSettingsDrawerHost(): Promise<SettingsDrawerHostComponent> {
  if (settingsDrawerHostComponent) {
    return Promise.resolve(settingsDrawerHostComponent)
  }
  settingsDrawerHostPromise ||= import('./components/SettingsDrawer').then((module) => {
    settingsDrawerHostComponent = module.SettingsDrawerHost
    return module.SettingsDrawerHost
  })
  return settingsDrawerHostPromise
}

function loadNewtabDeferredHosts(): Promise<NewtabDeferredHostsComponent> {
  if (newtabDeferredHostsComponent) {
    return Promise.resolve(newtabDeferredHostsComponent)
  }
  newtabDeferredHostsPromise ||= import('./components/NewtabDeferredHosts').then((module) => {
    newtabDeferredHostsComponent = module.NewtabDeferredHosts
    return module.NewtabDeferredHosts
  })
  return newtabDeferredHostsPromise
}

function loadNewtabWallpaperFilterLayer(): Promise<NewtabWallpaperFilterLayerComponent> {
  if (newtabWallpaperFilterLayerComponent) {
    return Promise.resolve(newtabWallpaperFilterLayerComponent)
  }
  newtabWallpaperFilterLayerPromise ||= import('./components/NewtabWallpaperFilterLayer').then((module) => {
    newtabWallpaperFilterLayerComponent = module.NewtabWallpaperFilterLayer
    return module.NewtabWallpaperFilterLayer
  })
  return newtabWallpaperFilterLayerPromise
}

function loadNewtabPaperShaderLayer(): Promise<NewtabPaperShaderLayerComponent> {
  if (newtabPaperShaderLayerComponent) {
    return Promise.resolve(newtabPaperShaderLayerComponent)
  }
  newtabPaperShaderLayerPromise ||= import('./components/NewtabPaperShaderLayer').then((module) => {
    newtabPaperShaderLayerComponent = module.NewtabPaperShaderLayer
    return module.NewtabPaperShaderLayer
  })
  return newtabPaperShaderLayerPromise
}

function subscribeToNewtabBookmarkEvents(): () => void {
  const bookmarks = typeof chrome === 'undefined' ? null : chrome.bookmarks
  if (!bookmarks) {
    return () => undefined
  }

  bookmarks.onCreated.addListener(dispatchNewtabBookmarkCreated)
  bookmarks.onRemoved.addListener(dispatchNewtabBookmarkRemoved)
  bookmarks.onChanged.addListener(dispatchNewtabBookmarkChanged)
  bookmarks.onMoved.addListener(dispatchNewtabBookmarkMoved)
  return () => {
    bookmarks.onCreated.removeListener(dispatchNewtabBookmarkCreated)
    bookmarks.onRemoved.removeListener(dispatchNewtabBookmarkRemoved)
    bookmarks.onChanged.removeListener(dispatchNewtabBookmarkChanged)
    bookmarks.onMoved.removeListener(dispatchNewtabBookmarkMoved)
  }
}

export function NewtabApp() {
  return (
    <ThemeProvider>
      <NewtabShell />
    </ThemeProvider>
  )
}

function NewtabShell() {
  const backgroundSettings = useNewtabBackgroundSettingsView()
  const folderSource = useNewtabFolderSourceView()
  const instantWallpaper = useNewtabInstantWallpaperView()
  const settingsDrawerOpen = useNewtabSettingsDrawerOpen()
  const settingsDrawerModal = useSettingsDrawerModalMode()
  const appChromeAttributes = useNewtabAppChromeAttributes()
  const autoHideSettingsTrigger = folderSource.general.hideSettingsTrigger
  const shellRef = useRef<HTMLDivElement | null>(null)
  const backgroundMaskHostRef = useRef<HTMLDivElement | null>(null)
  const settingsBackdropRef = useRef<HTMLButtonElement | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [settingsDrawerHostRequested, setSettingsDrawerHostRequested] = useState(false)
  const settingsBackgroundProps = settingsDrawerOpen && settingsDrawerModal
    ? {
        'aria-hidden': true,
        inert: true
      }
    : {}

  useLayoutEffect(() => {
    setNewtabContentShellNode(shellRef.current)
    return () => {
      setNewtabContentShellNode(null)
    }
  }, [])

  useLayoutEffect(() => {
    const mask = document.getElementById('newtab-background-mask')
    const host = backgroundMaskHostRef.current
    if (mask && host && mask.parentElement !== host) {
      host.append(mask)
    }
  }, [])

  useLayoutEffect(() => {
    setNewtabSettingsDrawerNodes({
      backdrop: settingsBackdropRef.current,
      trigger: settingsTriggerRef.current
    })
    return () => {
      setNewtabSettingsDrawerNodes({
        backdrop: null,
        trigger: null
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!backgroundSettings.ready) return
    const mask = document.getElementById('newtab-background-mask')
    if (!mask) return

    const style = getBackgroundMaskInlineStyle(backgroundSettings)
    mask.className = getBackgroundMaskClass(backgroundSettings)
    mask.style.backgroundColor = String(style.backgroundColor ?? '')
    mask.style.backgroundImage = String(style.backgroundImage ?? '')
    mask.style.setProperty('-webkit-backdrop-filter', String(style.WebkitBackdropFilter ?? ''))
    mask.style.backdropFilter = String(style.backdropFilter ?? '')
    document.documentElement.dataset.instantWallpaperMask = backgroundSettings.maskEnabled
      ? 'true'
      : 'false'
  }, [backgroundSettings])

  useEffect(() => {
    const handleVisibilityChange = () => {
      dispatchNewtabVisibilityChange(document.visibilityState)
    }
    const unsubscribeBookmarkEvents = subscribeToNewtabBookmarkEvents()

    document.addEventListener('keydown', dispatchNewtabDocumentKeyDown)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', dispatchNewtabPageHide)
    window.addEventListener('pointercancel', dispatchNewtabWindowPointerCancel)
    window.addEventListener('pointermove', dispatchNewtabWindowPointerMove)
    window.addEventListener('pointerup', dispatchNewtabWindowPointerUp)
    window.addEventListener('resize', dispatchNewtabWindowResize)
    return () => {
      unsubscribeBookmarkEvents()
      document.removeEventListener('keydown', dispatchNewtabDocumentKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', dispatchNewtabPageHide)
      window.removeEventListener('pointercancel', dispatchNewtabWindowPointerCancel)
      window.removeEventListener('pointermove', dispatchNewtabWindowPointerMove)
      window.removeEventListener('pointerup', dispatchNewtabWindowPointerUp)
      window.removeEventListener('resize', dispatchNewtabWindowResize)
    }
  }, [])

  return (
    <div {...appChromeAttributes} onPointerDownCapture={dispatchNewtabContentShellPointerDownCapture}>
      <NewtabInstantWallpaperHost />
      <div id="newtab-dynamic-background-stage" className={DYNAMIC_BACKGROUND_STAGE_CLASS} aria-hidden="true">
        <NewtabBackgroundLayer loadingWallpaper={instantWallpaper.loading} />
        <SolidBackgroundNoiseLayer active={backgroundSettings.type === 'color'} />
        <NewtabWallpaperFilterLayer />
        <NewtabPaperShaderLayer />
      </div>
      <div
        id="newtab-background-mask-host"
        className="contents"
        ref={backgroundMaskHostRef}
        aria-hidden="true"
      ></div>
      <WallpaperLoadingIndicator />

      <div
        className={cx(
          SETTINGS_TRIGGER_ZONE_BASE_CLASS,
          autoHideSettingsTrigger ? SETTINGS_TRIGGER_ZONE_AUTO_HIDE_CLASS : SETTINGS_TRIGGER_ZONE_VISIBLE_CLASS
        )}
      >
        <Button
          id="newtab-settings-trigger"
          className={getSettingsTriggerButtonClass(autoHideSettingsTrigger)}
          ref={settingsTriggerRef}
          type="button"
          aria-label="打开设置"
          aria-controls="newtab-settings-drawer"
          aria-expanded={settingsDrawerOpen ? 'true' : 'false'}
          {...settingsBackgroundProps}
          onClick={() => {
            setSettingsDrawerHostRequested(true)
            void import('./newtab-controller')
              .then(({ startNewTabController }) => {
                startNewTabController()
                dispatchNewtabSettingsDrawerToggleRequest()
              })
              .catch((error) => {
                console.error('新标签页控制器加载失败。', error)
              })
          }}
          unstyled
        >
          <Icon name="Settings" size={18} aria-hidden="true" />
        </Button>
      </div>

      <Button
        id="newtab-settings-backdrop"
        className={SETTINGS_BACKDROP_BASE_CLASS}
        ref={settingsBackdropRef}
        type="button"
        aria-label="关闭设置"
        aria-hidden="true"
        tabIndex={-1}
        data-close-settings
        onClick={() => dispatchNewtabSettingsDrawerOpenChange(false)}
        unstyled
      />
      <div
        id="newtab-root"
        className={NEWTAB_SHELL_CLASS}
        ref={shellRef}
        onContextMenu={dispatchNewtabContentShellContextMenu}
        {...settingsBackgroundProps}
      >
        <NewtabContentHost shellRef={shellRef} />
      </div>
      <DeferredSettingsDrawerHost requested={settingsDrawerHostRequested || settingsDrawerOpen} />
      <DeferredNewtabHosts />
    </div>
  )
}

function DeferredNewtabHosts() {
  const [Host, setHost] = useState<NewtabDeferredHostsComponent | null>(newtabDeferredHostsComponent)

  useEffect(() => {
    if (Host) {
      return
    }

    let active = true
    const delayTimer = window.setTimeout(() => {
      runIdle(() => {
        void loadNewtabDeferredHosts().then((Component) => {
          if (active) {
            setHost(() => Component)
          }
        })
      }, { timeout: 1200 })
    }, DEFERRED_HOSTS_IDLE_LOAD_DELAY_MS)
    return () => {
      active = false
      window.clearTimeout(delayTimer)
    }
  }, [Host])

  return Host ? <Host /> : null
}

function NewtabWallpaperFilterLayer() {
  const active = useNewtabWallpaperFilterActive()
  const [Layer, setLayer] = useState<NewtabWallpaperFilterLayerComponent | null>(
    newtabWallpaperFilterLayerComponent
  )

  useEffect(() => {
    if (!active || Layer) {
      return
    }
    let mounted = true
    void loadNewtabWallpaperFilterLayer().then((Component) => {
      if (mounted) {
        setLayer(() => Component)
      }
    })
    return () => {
      mounted = false
    }
  }, [active, Layer])

  return active && Layer ? <Layer /> : null
}

function NewtabPaperShaderLayer() {
  const active = useNewtabPaperShaderActive()
  const [Layer, setLayer] = useState<NewtabPaperShaderLayerComponent | null>(
    newtabPaperShaderLayerComponent
  )

  useEffect(() => {
    if (!active || Layer) {
      return
    }
    let mounted = true
    void loadNewtabPaperShaderLayer().then((Component) => {
      if (mounted) {
        setLayer(() => Component)
      }
    })
    return () => {
      mounted = false
    }
  }, [active, Layer])

  return active && Layer ? <Layer /> : null
}

function DeferredSettingsDrawerHost({ requested }: { requested: boolean }) {
  const [Host, setHost] = useState<SettingsDrawerHostComponent | null>(settingsDrawerHostComponent)

  useEffect(() => {
    if (Host) {
      return
    }

    let active = true
    let delayTimer = 0
    const mountHost = () => {
      void loadSettingsDrawerHost().then((Component) => {
        if (active) {
          setHost(() => Component)
        }
      })
    }

    if (requested) {
      mountHost()
    } else {
      // The closed settings inspector is not part of the bookmark first paint.
      // Warm it after the critical card path, or immediately on explicit intent.
      delayTimer = window.setTimeout(() => {
        runIdle(mountHost, { timeout: 1200 })
      }, SETTINGS_DRAWER_IDLE_LOAD_DELAY_MS)
    }

    return () => {
      active = false
      window.clearTimeout(delayTimer)
    }
  }, [Host, requested])

  return Host ? <Host /> : null
}

function SolidBackgroundNoiseLayer({ active }: { active: boolean }) {
  return (
    <div
      id="newtab-solid-background-noise"
      className={SOLID_BACKGROUND_NOISE_CLASS}
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" preserveAspectRatio="none" focusable="false">
        <filter id="newtab-solid-background-noise-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="
              0 0 0 0 1
              0 0 0 0 1
              0 0 0 0 1
              0.2126 0.7152 0.0722 0 0
            "
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#newtab-solid-background-noise-filter)" />
      </svg>
    </div>
  )
}

function getBackgroundMaskClass(background: NewtabBackgroundSettingsView): string {
  return cx(
    BACKGROUND_MASK_BASE_CLASS,
    background.maskEnabled ? BACKGROUND_MASK_ENABLED_CLASS : '',
    background.maskEnabled ? getBackgroundMaskStyleClass(background.maskStyle) : ''
  )
}

function getBackgroundMaskStyleClass(maskStyle: string): string {
  if (!isLegacyBackgroundMaskStyle(maskStyle)) {
    return ''
  }
  return BACKGROUND_MASK_STYLE_CLASS_BY_STYLE[maskStyle]
}

function getBackgroundMaskInlineStyle(background: NewtabBackgroundSettingsView): CSSProperties {
  if (!background.maskEnabled) {
    return {}
  }
  const backdropFilter = getBackgroundMaskBackdropFilter(background.maskStyle, background.maskBlur)
  return {
    backgroundColor: getBackgroundMaskBaseColor(background.maskStyle),
    backgroundImage: getBackgroundMaskOverlayGradient(background.maskOverlay),
    WebkitBackdropFilter: backdropFilter,
    backdropFilter
  }
}

function getSettingsTriggerButtonClass(autoHide: boolean, className = ''): string {
  return cx(
    SETTINGS_TRIGGER_BUTTON_BASE_CLASS,
    autoHide ? SETTINGS_TRIGGER_BUTTON_AUTO_HIDE_CLASS : SETTINGS_TRIGGER_BUTTON_VISIBLE_CLASS,
    className
  )
}

function WallpaperLoadingIndicator() {
  const instantWallpaper = useNewtabInstantWallpaperView()
  const visible = instantWallpaper.loading && instantWallpaper.loaderVisible

  return (
    <output
      className={cx(
        WALLPAPER_LOADING_INDICATOR_CLASS,
        visible ? WALLPAPER_LOADING_INDICATOR_VISIBLE_CLASS : WALLPAPER_LOADING_INDICATOR_HIDDEN_CLASS
      )}
      aria-live="polite"
      aria-label="正在加载背景图"
    >
      <div className={WALLPAPER_LOADING_CARD_CLASS}>
        <div className={WALLPAPER_LOADING_LOADER_CLASS} aria-hidden="true">
          <span className={WALLPAPER_LOADING_DOT_CLASS}></span>
          <span className={cx(WALLPAPER_LOADING_DOT_CLASS, '[animation-delay:120ms]')}></span>
          <span className={cx(WALLPAPER_LOADING_DOT_CLASS, '[animation-delay:240ms]')}></span>
        </div>
      </div>
    </output>
  )
}
