import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import { Button } from '../ui/base/Button'
import { CloseButton } from '../ui/base/CloseButton'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../ui/base/Collapsible'
import {
  DialogBackdrop,
  DialogClose,
  DialogOverlay,
  DialogPanel,
  DialogTitle
} from '../ui/base/Dialog'
import { DotMatrixLoader } from '../ui/base/DotMatrixLoader'
import { Icon } from '../ui/icons/Icon'
import type { IconName } from '../ui/icons/icon-map'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { getMotionAwareScrollBehavior } from '../shared/motion'
import { GeneralPanel } from './components/GeneralPanel'
import { useOptionsModalsState } from './components/options-modals-store'
import {
  getOptionsSectionNavigationFromLink,
  type OptionsSectionKey
} from './options-section-store'
import {
  handleOptionsBookmarkTreeChanged,
  handleOptionsWindowSectionChange,
  useOptionsController
} from './options-controller'
import {
  navClass,
  navCollapsibleClass,
  navGroupClass,
  navGroupTriggerClass,
  navActiveIndicatorClass,
  navLinkIconClass,
  navLinkClass,
  navSubitemClass,
  navSublistClass,
  optionsBrandClassBase,
  optionsBrandCopyClass,
  optionsBrandMarkClass,
  optionsBrandMarkImageClass,
  optionsHeaderClass,
  optionsLayoutClass,
  optionsMainClass,
  optionsMobileNavBackdropClass,
  optionsMobileNavCloseClass,
  optionsMobileNavHeaderClass,
  optionsMobileNavOverlayClass,
  optionsMobileNavPanelClass,
  optionsMobileNavTitleClass,
  optionsMobileNavTriggerClass,
  optionsMobileSidebarClass,
  optionsShellClassBase,
  optionsSkipLinkClass,
  optionsSidebarClass,
  optionsSidebarDividerClass,
  optionsSidebarLabelClass
} from './components/options-chrome-classes'
import { useOptionsSectionChrome } from './useOptionsSectionChrome'

const AvailabilityPanel = lazy(() => import('./components/AvailabilityPanel').then((module) => ({ default: module.AvailabilityPanel })))
const AiAnalysisPanel = lazy(() => import('./components/AiAnalysisPanel').then((module) => ({ default: module.AiAnalysisPanel })))
const BookmarkHistoryPanel = lazy(() => import('./components/BookmarkHistoryPanel').then((module) => ({ default: module.BookmarkHistoryPanel })))
const HistoryPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.HistoryPanel })))
const BackupPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.BackupPanel })))
const RedirectsPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.RedirectsPanel })))
const DuplicatesPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.DuplicatesPanel })))
const FolderCleanupPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.FolderCleanupPanel })))
const IgnoreRulesPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.IgnoreRulesPanel })))
const RecyclePanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.RecyclePanel })))

type OptionsModalsComponent = (typeof import('./components/OptionsModals'))['OptionsModals']

let optionsModalsComponent: OptionsModalsComponent | null = null
let optionsModalsPromise: Promise<OptionsModalsComponent> | null = null

function loadOptionsModals(): Promise<OptionsModalsComponent> {
  if (optionsModalsComponent) {
    return Promise.resolve(optionsModalsComponent)
  }
  optionsModalsPromise ||= import('./components/OptionsModals').then((module) => {
    optionsModalsComponent = module.OptionsModals
    return module.OptionsModals
  })
  return optionsModalsPromise
}

interface NavLink {
  section: string
  href: string
  icon: IconName
  label: string
  variant?: 'subitem'
}

interface NavGroup {
  labelId: string
  label: string
  links?: NavLink[]
  collapsible?: {
    key: string
    trigger: string
    panelId: string
    links: NavLink[]
  }
  trailingLinks?: NavLink[]
}

const settingsLinks: NavLink[] = [
  { section: 'general', href: '#general', icon: 'Settings', label: '通用设置' },
  { section: 'backup', href: '#backup', icon: 'Save', label: '数据与备份' }
]

const availabilityLinks: NavLink[] = [
  { section: 'availability', href: '#availability', icon: 'Gauge', label: '书签可用性检测', variant: 'subitem' },
  { section: 'history', href: '#history', icon: 'ArchiveRestore', label: '检测历史', variant: 'subitem' },
  { section: 'redirects', href: '#redirects', icon: 'RefreshCw', label: '重定向更新', variant: 'subitem' },
  { section: 'ignore', href: '#ignore', icon: 'CircleHelp', label: '忽略规则', variant: 'subitem' }
]

const bookmarkLinks: NavLink[] = [
  { section: 'duplicates', href: '#duplicates', icon: 'Copy', label: '重复书签检测' },
  { section: 'folder-cleanup', href: '#folder-cleanup', icon: 'Folder', label: '文件夹清理' },
  { section: 'recycle', href: '#recycle', icon: 'Trash2', label: '回收站' }
]

const aiLinks: NavLink[] = [
  { section: 'ai', href: '#ai', icon: 'Bot', label: '书签智能分析' },
  { section: 'bookmark-history', href: '#bookmark-history', icon: 'Bookmark', label: 'AI 整理记录' }
]

const availabilitySectionKeys = new Set(availabilityLinks.map((link) => link.section))

const navGroups: NavGroup[] = [
  {
    labelId: 'options-settings-nav-label',
    label: '设置分类',
    links: settingsLinks
  },
  {
    labelId: 'options-bookmark-nav-label',
    label: '书签管理',
    collapsible: {
      key: 'availability-tools',
      trigger: '可用性管理',
      panelId: 'availability-tools-nav',
      links: availabilityLinks
    },
    trailingLinks: bookmarkLinks
  },
  {
    labelId: 'options-ai-nav-label',
    label: 'AI 功能',
    links: aiLinks
  }
]

type SectionLinkClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void

function OptionsNavLink({
  href,
  icon,
  section,
  label,
  variant,
  activeSectionKey,
  onNavigate
}: NavLink & {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
}) {
  const active = activeSectionKey === section
  const className = variant === 'subitem' ? navSubitemClass : ''

  return (
    <a
      className={['group', navLinkClass, className].filter(Boolean).join(' ')}
      href={href}
      aria-current={active ? 'page' : undefined}
      data-options-section={section}
      onClick={onNavigate}
    >
      <span className={navLinkIconClass} aria-hidden="true">
        <Icon name={icon} size={15} />
      </span>
      <span className="relative z-[1] min-w-0 truncate max-[920px]:whitespace-normal">{label}</span>
    </a>
  )
}

function OptionsHeader({
  activeSectionKey,
  mobileNavigationOpen,
  onMobileNavigationOpenChange,
  onNavigate
}: {
  activeSectionKey: OptionsSectionKey
  mobileNavigationOpen: boolean
  onMobileNavigationOpenChange: (open: boolean) => void
  onNavigate: SectionLinkClickHandler
}) {
  const active = activeSectionKey === 'general'

  return (
    <header className={optionsHeaderClass}>
      <a
        className={optionsBrandClassBase}
        href="#general"
        aria-label="跳转到通用设置"
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className={optionsBrandMarkClass} aria-hidden="true">
          <img className={optionsBrandMarkImageClass} src="../assets/icon128.png" alt="" />
        </span>
        <span className={optionsBrandCopyClass}>
          <strong className="block truncate whitespace-nowrap text-[17px] font-[650] leading-none tracking-[0] text-ds-text-primary max-[760px]:text-[20px]">
            Curator Bookmark
          </strong>
        </span>
      </a>
      <Button
        id="options-mobile-nav-trigger"
        className={optionsMobileNavTriggerClass}
        type="button"
        variant="ghost"
        aria-controls="options-mobile-navigation"
        aria-expanded={mobileNavigationOpen}
        aria-label="打开设置导航"
        title="打开设置导航"
        onClick={() => onMobileNavigationOpenChange(true)}
      >
        <Icon name="Menu" size={20} aria-hidden="true" />
      </Button>
    </header>
  )
}

function OptionsSidebar({
  activeSectionKey,
  onNavigate,
  variant = 'desktop',
  visible = true
}: {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
  variant?: 'desktop' | 'mobile'
  visible?: boolean
}) {
  const [availabilityManuallyOpen, setAvailabilityManuallyOpen] = useState(false)
  const availabilityOpen = availabilitySectionKeys.has(activeSectionKey) || availabilityManuallyOpen
  const idPrefix = variant === 'mobile' ? 'mobile-' : ''
  const sidebarRef = useRef<HTMLElement | null>(null)
  const activeIndicatorRef = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current
    const indicator = activeIndicatorRef.current
    if (!sidebar || !indicator || !visible) {
      if (indicator) {
        indicator.style.opacity = '0'
        delete indicator.dataset.ready
      }
      return
    }

    let settleFrame = 0
    let readyFrame = 0
    const startedAt = performance.now()
    const positionIndicator = () => {
      const activeLink = sidebar.querySelector<HTMLElement>(
        '.options-nav-link[aria-current="page"]'
      )
      if (!activeLink) {
        indicator.style.opacity = '0'
        return
      }

      const sidebarRect = sidebar.getBoundingClientRect()
      const linkRect = activeLink.getBoundingClientRect()
      if (!linkRect.width || !linkRect.height) {
        indicator.style.opacity = '0'
        return
      }

      indicator.style.width = `${linkRect.width}px`
      indicator.style.height = `${linkRect.height}px`
      indicator.style.transform = `translate3d(${linkRect.left - sidebarRect.left + sidebar.scrollLeft}px, ${linkRect.top - sidebarRect.top + sidebar.scrollTop}px, 0)`
      indicator.style.opacity = '1'
      if (!indicator.dataset.ready && !readyFrame) {
        readyFrame = window.requestAnimationFrame(() => {
          indicator.dataset.ready = 'true'
        })
      }
    }
    const trackSettlingLayout = (now: number) => {
      positionIndicator()
      if (now - startedAt < 360) {
        settleFrame = window.requestAnimationFrame(trackSettlingLayout)
      }
    }

    settleFrame = window.requestAnimationFrame(trackSettlingLayout)
    const resizeObserver = new ResizeObserver(positionIndicator)
    resizeObserver.observe(sidebar)
    window.addEventListener('resize', positionIndicator)
    return () => {
      window.cancelAnimationFrame(settleFrame)
      window.cancelAnimationFrame(readyFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', positionIndicator)
    }
  }, [activeSectionKey, availabilityOpen, variant, visible])

  return (
    <aside
      className={variant === 'mobile' ? optionsMobileSidebarClass : optionsSidebarClass}
      aria-label={variant === 'mobile' ? '移动端设置导航' : '设置导航'}
      ref={sidebarRef}
    >
      <span className={navActiveIndicatorClass} ref={activeIndicatorRef} aria-hidden="true" />
      {navGroups.map((group, groupIndex) => (
        <div
          className={[navGroupClass, groupIndex > 0 ? 'mt-[18px]' : ''].filter(Boolean).join(' ')}
          key={group.labelId}
        >
          <p id={`${idPrefix}${group.labelId}`} className={optionsSidebarLabelClass}>
            {group.label}
          </p>
          <nav className={navClass} aria-labelledby={`${idPrefix}${group.labelId}`}>
            {group.links?.map((link) => (
              <OptionsNavLink
                key={link.section}
                activeSectionKey={activeSectionKey}
                onNavigate={onNavigate}
                {...link}
              />
            ))}
            {group.collapsible ? (
              <CollapsibleRoot
                className={navCollapsibleClass}
                open={availabilityOpen}
                onOpenChange={setAvailabilityManuallyOpen}
              >
                <CollapsibleTrigger
                  className={navGroupTriggerClass}
                  type="button"
                  aria-controls={`${idPrefix}${group.collapsible.panelId}`}
                >
                  <span>{group.collapsible.trigger}</span>
                  <span className="t-acc-chevron text-ds-text-disabled" aria-hidden="true">
                    <Icon name="ChevronDown" size={14} />
                  </span>
                </CollapsibleTrigger>
                <CollapsiblePanel
                  id={`${idPrefix}${group.collapsible.panelId}`}
                  className={navSublistClass}
                >
                  {group.collapsible.links.map((link) => (
                    <OptionsNavLink
                      key={link.section}
                      activeSectionKey={activeSectionKey}
                      onNavigate={onNavigate}
                      {...link}
                    />
                  ))}
                </CollapsiblePanel>
              </CollapsibleRoot>
            ) : null}
            {group.trailingLinks?.map((link) => (
              <OptionsNavLink
                key={link.section}
                activeSectionKey={activeSectionKey}
                onNavigate={onNavigate}
                {...link}
              />
            ))}
          </nav>
        </div>
      ))}
    </aside>
  )
}

function OptionsMobileNavigation({
  activeSectionKey,
  onNavigate,
  onOpenChange,
  open
}: {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const handleNavigate: SectionLinkClickHandler = (event) => {
    const shouldClose =
      event.button === 0 &&
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    onNavigate(event)
    if (shouldClose) {
      onOpenChange(false)
    }
  }

  return (
    <DialogOverlay
      id="options-mobile-navigation"
      className={`${optionsMobileNavOverlayClass} ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="options-mobile-nav-trigger"
      aria-hidden={open ? 'false' : 'true'}
      inert={!open}
      tabIndex={-1}
    >
      <DialogBackdrop className={optionsMobileNavBackdropClass} />
      <DialogPanel
        className={optionsMobileNavPanelClass}
        motionVariant="drawer"
        aria-labelledby="options-mobile-navigation-title"
        finalFocus={() => document.getElementById('options-mobile-nav-trigger')}
      >
        <div className={optionsMobileNavHeaderClass}>
          <DialogTitle id="options-mobile-navigation-title" className={optionsMobileNavTitleClass}>
            设置导航
          </DialogTitle>
          <DialogClose
            render={
              <CloseButton
                className={optionsMobileNavCloseClass}
                type="button"
                label="关闭设置导航"
                variant="ghost"
              />
            }
          />
        </div>
        <OptionsSidebar
          activeSectionKey={activeSectionKey}
          onNavigate={handleNavigate}
          variant="mobile"
          visible={open}
        />
      </DialogPanel>
    </DialogOverlay>
  )
}

function subscribeToOptionsBookmarkEvents(): () => void {
  const bookmarks = typeof chrome === 'undefined' ? null : chrome.bookmarks
  if (!bookmarks) {
    return () => undefined
  }

  bookmarks.onCreated.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onRemoved.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onChanged.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onMoved.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onChildrenReordered.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onImportEnded.addListener(handleOptionsBookmarkTreeChanged)
  return () => {
    bookmarks.onCreated.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onRemoved.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onChanged.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onMoved.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onChildrenReordered.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onImportEnded.removeListener(handleOptionsBookmarkTreeChanged)
  }
}

export function OptionsApp() {
  useOptionsController()
  const {
    sectionAnchor,
    sectionKey,
    sectionRevision,
    navigateToSectionHash
  } = useOptionsSectionChrome({ onSectionChange: handleOptionsWindowSectionChange })
  const optionsShellRef = useRef<HTMLDivElement | null>(null)
  const optionsMainRef = useRef<HTMLElement | null>(null)
  const aiProviderAnchorRef = useRef<HTMLDivElement | null>(null)
  const [aiProviderAttentionRequestId, setAiProviderAttentionRequestId] = useState(0)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  useEffect(() => {
    if (!('scrollRestoration' in window.history)) {
      return
    }

    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  useEffect(() => {
    return subscribeToOptionsBookmarkEvents()
  }, [])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 921px)')
    const closeMobileNavigation = () => {
      if (desktopQuery.matches) {
        setMobileNavigationOpen(false)
      }
    }
    closeMobileNavigation()
    desktopQuery.addEventListener('change', closeMobileNavigation)
    return () => desktopQuery.removeEventListener('change', closeMobileNavigation)
  }, [])

  useLayoutEffect(() => {
    const shell = optionsShellRef.current
    const root = document.getElementById('options-root')
    root?.setAttribute('data-options-ready', 'true')
    if (!shell) {
      return
    }

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (optionsShellRef.current === shell) {
          shell.classList.add('options-motion-ready')
        }
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame)
      }
      shell.classList.remove('options-motion-ready')
      root?.removeAttribute('data-options-ready')
    }
  }, [])

  const requestAiProviderAnchorAttention = useCallback(() => {
    if (sectionKey !== 'general' || sectionAnchor !== 'ai-provider') {
      return
    }

    const target = aiProviderAnchorRef.current
    if (!target) {
      return
    }

    window.requestAnimationFrame(() => {
      if (aiProviderAnchorRef.current !== target) {
        return
      }

      const scrollHost = optionsMainRef.current
      if (scrollHost && scrollHost.scrollHeight > scrollHost.clientHeight) {
        const hostRect = scrollHost.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const top = scrollHost.scrollTop + targetRect.top - hostRect.top - 24
        scrollHost.scrollTo({
          top: Math.max(0, Math.min(top, scrollHost.scrollHeight - scrollHost.clientHeight)),
          behavior: getMotionAwareScrollBehavior('smooth')
        })
      } else {
        target.scrollIntoView({
          block: 'start',
          behavior: getMotionAwareScrollBehavior('smooth')
        })
      }
      setAiProviderAttentionRequestId((requestId) => requestId + 1)
    })
  }, [sectionAnchor, sectionKey])

  const handleAiProviderAnchorRef = useCallback((node: HTMLDivElement | null) => {
    aiProviderAnchorRef.current = node
    if (node) {
      window.requestAnimationFrame(requestAiProviderAnchorAttention)
    }
  }, [requestAiProviderAnchorAttention])

  useEffect(() => {
    requestAiProviderAnchorAttention()
  }, [requestAiProviderAnchorAttention, sectionRevision])

  useEffect(() => {
    if (sectionAnchor) {
      return
    }

    let secondFrame = 0
    const scrollTop = () => {
      optionsMainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      optionsShellRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    scrollTop()
    const firstFrame = window.requestAnimationFrame(() => {
      scrollTop()
      secondFrame = window.requestAnimationFrame(scrollTop)
    })
    const timeout = window.setTimeout(scrollTop, 0)
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame)
      }
      window.clearTimeout(timeout)
    }
  }, [sectionAnchor, sectionRevision])

  const handleSectionNavigationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    const navigation = getOptionsSectionNavigationFromLink(event.currentTarget)
    if (!navigation) {
      return
    }

    event.preventDefault()
    navigateToSectionHash(navigation.hash)
  }

  return (
    <ThemeProvider>
      <div className={optionsShellClassBase} ref={optionsShellRef}>
        <a className={optionsSkipLinkClass} href="#options-main">跳到主要内容</a>
        <div className={optionsSidebarDividerClass} aria-hidden="true"></div>
        <OptionsHeader
          activeSectionKey={sectionKey}
          mobileNavigationOpen={mobileNavigationOpen}
          onMobileNavigationOpenChange={setMobileNavigationOpen}
          onNavigate={handleSectionNavigationClick}
        />
        <div className={optionsLayoutClass}>
          <OptionsSidebar activeSectionKey={sectionKey} onNavigate={handleSectionNavigationClick} />
          <main id="options-main" className={optionsMainClass} ref={optionsMainRef} tabIndex={-1}>
            <Suspense fallback={<OptionsPanelLoading />}>
              <ActiveOptionsPanel
                aiProviderAnchorRef={handleAiProviderAnchorRef}
                aiProviderAttentionRequestId={aiProviderAttentionRequestId}
                sectionKey={sectionKey}
              />
            </Suspense>
          </main>
        </div>
      </div>
      <OptionsMobileNavigation
        activeSectionKey={sectionKey}
        onNavigate={handleSectionNavigationClick}
        onOpenChange={setMobileNavigationOpen}
        open={mobileNavigationOpen}
      />
      <DeferredOptionsModals />
    </ThemeProvider>
  )
}

function ActiveOptionsPanel({
  aiProviderAnchorRef,
  aiProviderAttentionRequestId,
  sectionKey
}: {
  aiProviderAnchorRef: (node: HTMLDivElement | null) => void
  aiProviderAttentionRequestId: number
  sectionKey: OptionsSectionKey
}) {
  if (sectionKey === 'general') {
    return (
      <GeneralPanel
        aiProviderAnchorRef={aiProviderAnchorRef}
        aiProviderAttentionRequestId={aiProviderAttentionRequestId}
        hidden={false}
      />
    )
  }
  if (sectionKey === 'availability') return <AvailabilityPanel hidden={false} />
  if (sectionKey === 'history') return <HistoryPanel hidden={false} />
  if (sectionKey === 'ai') return <AiAnalysisPanel hidden={false} />
  if (sectionKey === 'bookmark-history') return <BookmarkHistoryPanel hidden={false} />
  if (sectionKey === 'backup') return <BackupPanel hidden={false} />
  if (sectionKey === 'redirects') return <RedirectsPanel hidden={false} />
  if (sectionKey === 'duplicates') return <DuplicatesPanel hidden={false} />
  if (sectionKey === 'folder-cleanup') return <FolderCleanupPanel hidden={false} />
  if (sectionKey === 'ignore') return <IgnoreRulesPanel hidden={false} />
  return <RecyclePanel hidden={false} />
}

function OptionsPanelLoading() {
  return (
    <output
      className="flex min-h-40 items-center justify-center gap-2.5 text-[13px] text-ds-text-muted"
      aria-live="polite"
    >
      <DotMatrixLoader className="size-5" variant="bar" />
      <span>正在载入…</span>
    </output>
  )
}

function DeferredOptionsModals() {
  const modals = useOptionsModalsState()
  const open = modals.confirm.open || modals.delete.open || modals.move.open || modals.scope.open
  const [Modals, setModals] = useState<OptionsModalsComponent | null>(optionsModalsComponent)

  useEffect(() => {
    if (Modals || !open) {
      return
    }

    let active = true
    void loadOptionsModals().then((Component) => {
      if (active) {
        setModals(() => Component)
      }
    })

    return () => {
      active = false
    }
  }, [Modals, open])

  return Modals ? <Modals /> : null
}
