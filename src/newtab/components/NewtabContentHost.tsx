import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from 'react'
import { Button } from '../../ui/base/Button'
import { cx } from '../../ui/base/utils'
import {
  type NewTabContentView,
  type NewTabMissingFolderModule,
  type NewTabOnboardingModule,
  type NewTabPageModule
} from '../content-state'
import {
  setNewtabContentLayoutNodes,
  useNewtabContentView
} from '../newtab-content-store'
import { useNewtabClockView } from '../newtab-clock-store'
import { useNewtabSearchWidgetView } from '../newtab-search-widget-store'
import { hideNewtabBookmarkPreboot } from '../newtab-bookmark-preboot'
import { ClockWidgetContent } from './ClockWidgetContent'
import { CLOCK_SPACER_CLASS, getClockClass } from './clockClasses'
import { NewtabBookmarkContent } from './NewtabBookmarkContent'
import { NewtabSearchWidget } from './NewtabSearchWidget'
import {
  getNewtabPageClass,
  getNewtabPrimarySlotClass,
  getNewtabUtilityStackClass
} from './newtabLayoutClasses'
import { getNewtabButtonClass } from './newtabButtonClass'

const STATE_BASE_CLASS = 'newtab-state grid justify-items-center gap-4 text-center'
const STATE_HAS_SEARCH_CLASS = 'mt-2.5'
const STATE_DEFAULT_WIDTH_CLASS = 'w-[min(520px,100%)]'
const STATE_MISSING_CLASS = 'folder-missing w-[min(560px,100%)] py-[22px]'
const STATE_ACTIONS_CLASS = 'newtab-state-actions flex flex-wrap justify-center gap-2.5'
const STATE_TITLE_CLASS = 'm-0 text-xl font-bold leading-[1.25] text-[var(--ui-text-primary)]'
const STATE_COPY_CLASS = 'm-0 max-w-[440px] text-sm leading-[1.7] text-[var(--ui-text-secondary)]'
const ONBOARDING_STRIP_CLASS = 'newtab-onboarding-strip grid w-[min(100%,980px)] grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-[var(--ui-radius-group)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-fill)] px-3 py-2.5 text-[rgba(245,245,247,0.9)] shadow-none [filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)] max-[640px]:grid-cols-[minmax(0,1fr)]'
const ONBOARDING_COPY_CLASS = 'newtab-onboarding-copy t-stagger is-shown grid min-w-0 gap-[3px]'
const ONBOARDING_TITLE_CLASS = 't-stagger-line t-stagger-line--1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-[760] leading-[1.2] max-[640px]:whitespace-normal'
const ONBOARDING_TEXT_CLASS = 't-stagger-line t-stagger-line--2 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-[580] text-[rgba(245,245,247,0.55)] max-[640px]:whitespace-normal'
const ONBOARDING_ACTIONS_CLASS = 'newtab-onboarding-actions flex flex-wrap justify-end gap-2 max-[640px]:justify-start'
const ONBOARDING_BUTTON_CLASS = 'min-h-[30px] rounded-[7px] border border-[rgba(245,245,247,0.12)] bg-[rgba(245,245,247,0.08)] px-2.5 text-xs font-[680] text-[rgba(245,245,247,0.9)] hover:border-[rgba(245,245,247,0.22)] hover:bg-[rgba(245,245,247,0.12)] focus-visible:border-[rgba(245,245,247,0.22)] focus-visible:bg-[rgba(245,245,247,0.12)]'
const ONBOARDING_SECONDARY_BUTTON_CLASS = 'text-[rgba(245,245,247,0.62)]'

export function NewtabContentHost({
  shellRef
}: {
  shellRef: RefObject<HTMLDivElement | null>
}) {
  const view = useNewtabContentView()

  useEffect(() => {
    if (!view) {
      return
    }
    if (view.type === 'state') {
      hideNewtabBookmarkPreboot({ clearSnapshot: true })
      return
    }
    const primaryModule = view.modules.find((module) => module.placement === 'primary')
    if (primaryModule?.kind === 'missing-folder') {
      hideNewtabBookmarkPreboot({ clearSnapshot: true })
    }
  }, [view])

  if (!view) {
    return null
  }

  if (view.type === 'state') {
    return <GenericState action={view.action} actionLabel={view.actionLabel} message={view.message} />
  }

  return <NewTabPage shellRef={shellRef} view={view} />
}

function NewTabPage({
  shellRef,
  view
}: {
  shellRef: RefObject<HTMLDivElement | null>
  view: Extract<NewTabContentView, { type: 'page' }>
}) {
  const pageRef = useRef<HTMLElement | null>(null)
  const utilityStackRef = useRef<HTMLDivElement | null>(null)
  const primarySlotRef = useRef<HTMLDivElement | null>(null)
  const publishLayoutNodes = useCallback(() => {
    const primaryElement = primarySlotRef.current?.firstElementChild
    setNewtabContentLayoutNodes({
      page: pageRef.current,
      primaryContent: primaryElement instanceof HTMLElement ? primaryElement : null,
      primarySlot: primarySlotRef.current,
      shell: shellRef.current,
      utilityStack: utilityStackRef.current
    })
  }, [shellRef])
  const utilityModules = view.modules.filter((module) => module.placement === 'utility')
  const [primaryModule] = view.modules.filter((module) => module.placement === 'primary')
  const iconVerticalCenter = view.iconVerticalCenter === 'true'
  const pageClassName = getNewtabPageClass({
    hasClock: view.hasClock,
    hasSearch: view.hasSearch
  })
  const pageStyle = {
    '--primary-collision-offset-y': `${view.primaryCollisionOffsetY}px`
  } as CSSProperties

  useLayoutEffect(() => {
    const shell = shellRef.current
    publishLayoutNodes()
    return () => {
      setNewtabContentLayoutNodes({
        page: null,
        primaryContent: null,
        primarySlot: null,
        shell,
        utilityStack: null
      })
    }
  }, [
    primaryModule?.kind,
    publishLayoutNodes,
    shellRef,
    utilityModules.length,
    view.contentState,
    view.hasClock,
    view.hasSearch,
    view.iconVerticalCenter
  ])

  return (
    <main
      className={pageClassName}
      ref={pageRef}
      style={pageStyle}
      data-content-state={view.contentState}
      data-icon-vertical-center={view.iconVerticalCenter}
    >
      <div className={getNewtabUtilityStackClass(view.hasSearch)} ref={utilityStackRef}>
        {utilityModules.map((module) => (
          <UtilityModule module={module} key={module.id} />
        ))}
      </div>
      <PrimarySlotContent
        contentState={view.contentState}
        hasSearch={view.hasSearch}
        iconVerticalCenter={iconVerticalCenter}
        module={primaryModule}
        primarySlotRef={primarySlotRef}
      />
    </main>
  )
}

function UtilityModule({ module }: { module: NewTabPageModule }) {
  if (module.kind === 'onboarding') {
    return <OnboardingStrip module={module} />
  }

  if (module.kind === 'clock') {
    return <ClockModule />
  }

  if (module.kind === 'clock-spacer') {
    return <div className={CLOCK_SPACER_CLASS} aria-hidden="true" />
  }

  if (module.kind === 'search') {
    return <SearchModule />
  }

  return null
}

function PrimarySlot({
  children,
  contentState,
  iconVerticalCenter,
  primarySlotRef
}: {
  children?: ReactNode
  contentState: 'bookmarks' | 'empty'
  iconVerticalCenter: boolean
  primarySlotRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      className={getNewtabPrimarySlotClass({ contentState, iconVerticalCenter })}
      ref={primarySlotRef}
    >
      {children}
    </div>
  )
}

function PrimarySlotContent({
  contentState,
  hasSearch,
  iconVerticalCenter,
  module,
  primarySlotRef
}: {
  contentState: 'bookmarks' | 'empty'
  hasSearch: boolean
  iconVerticalCenter: boolean
  module: NewTabPageModule | undefined
  primarySlotRef: RefObject<HTMLDivElement | null>
}) {
  if (!module) {
    return (
      <PrimarySlot
        contentState={contentState}
        iconVerticalCenter={iconVerticalCenter}
        primarySlotRef={primarySlotRef}
      />
    )
  }

  if (module.kind === 'loading') {
    return (
      <PrimarySlot
        contentState={contentState}
        iconVerticalCenter={iconVerticalCenter}
        primarySlotRef={primarySlotRef}
      >
        <LoadingState hasSearch={hasSearch} label={module.label} />
      </PrimarySlot>
    )
  }

  if (module.kind === 'missing-folder') {
    return (
      <PrimarySlot
        contentState={contentState}
        iconVerticalCenter={iconVerticalCenter}
        primarySlotRef={primarySlotRef}
      >
        <MissingFolderState hasSearch={hasSearch} module={module} />
      </PrimarySlot>
    )
  }

  if (module.kind === 'bookmarks') {
    return (
      <PrimarySlot
        contentState={contentState}
        iconVerticalCenter={iconVerticalCenter}
        primarySlotRef={primarySlotRef}
      >
        <NewtabBookmarkContent hasSearch={hasSearch} />
      </PrimarySlot>
    )
  }

  return (
    <PrimarySlot
      contentState={contentState}
      iconVerticalCenter={iconVerticalCenter}
      primarySlotRef={primarySlotRef}
    />
  )
}

function SearchModule() {
  const view = useNewtabSearchWidgetView()
  if (!view) {
    return null
  }

  return <NewtabSearchWidget view={view} />
}

function ClockModule() {
  const state = useNewtabClockView()
  if (!state) {
    return null
  }

  const settings = state.settings
  return (
    <section
      className={getClockClass(settings)}
      style={{ '--clock-scale': String(settings.clockSize / 100) } as CSSProperties}
      data-clock-display-mode={settings.displayMode}
      data-clock-density={settings.density}
      data-clock-show-seconds={String(settings.showSeconds && settings.displayMode !== 'date')}
      data-clock-hour12={String(settings.hour12 && settings.displayMode !== 'date')}
      aria-label={state.ariaLabel}
    >
      <ClockWidgetContent state={state} />
    </section>
  )
}

function OnboardingStrip({ module }: { module: NewTabOnboardingModule }) {
  return (
    <section className={ONBOARDING_STRIP_CLASS} aria-label="Curator 首次使用引导">
      <div className={ONBOARDING_COPY_CLASS}>
        <strong className={ONBOARDING_TITLE_CLASS}>Curator 已将新标签页设为书签搜索和快捷入口</strong>
        <span className={ONBOARDING_TEXT_CLASS}>核心书签功能默认本地；网页搜索、精选远程背景、AI/Jina 和链接检测可关闭或跳过。</span>
      </div>
      <div className={ONBOARDING_ACTIONS_CLASS}>
        <Button className={ONBOARDING_BUTTON_CLASS} type="button" onClick={module.onOpenFolderSettings} unstyled>
          选择来源
        </Button>
        <Button className={cx(ONBOARDING_BUTTON_CLASS, ONBOARDING_SECONDARY_BUTTON_CLASS)} type="button" onClick={module.onSkip} unstyled>
          我知道了
        </Button>
      </div>
    </section>
  )
}

function LoadingState({ hasSearch, label }: { hasSearch: boolean; label: string }) {
  void hasSearch
  return (
    <section className="sr-only" aria-label={label}>
      {label}
    </section>
  )
}

function MissingFolderState({ hasSearch, module }: { hasSearch: boolean; module: NewTabMissingFolderModule }) {
  return (
    <section className={cx(STATE_BASE_CLASS, STATE_MISSING_CLASS, hasSearch && STATE_HAS_SEARCH_CLASS)} aria-labelledby="newtab-missing-folder-title">
      <h1 id="newtab-missing-folder-title" className={STATE_TITLE_CLASS}>
        {module.reason === 'selected-unavailable' ? '已选书签来源不可用' : '当前没有显示来源'}
      </h1>
      <p className={STATE_COPY_CLASS}>
        {module.reason === 'selected-unavailable'
          ? '之前选择的文件夹可能已被删除或移动。请打开设置里的“书签来源”，重新选择要显示的文件夹。'
          : '没有找到可直接展示的非空文件夹。你可以选择已有来源，或新建专用文件夹后添加书签。'}
      </p>
      <div className={STATE_ACTIONS_CLASS}>
        <Button className={getNewtabButtonClass()} type="button" onClick={module.onOpenFolderSettings} unstyled>
          选择现有来源
        </Button>
        <Button
          className={getNewtabButtonClass('secondary')}
          type="button"
          disabled={module.creatingFolder}
          onClick={module.onCreateFolder}
          unstyled
        >
          {module.creatingFolder ? '正在创建' : '新建专用文件夹'}
        </Button>
      </div>
    </section>
  )
}

function GenericState({
  action,
  actionLabel = '',
  message
}: {
  action?: () => void
  actionLabel?: string
  message: string
}) {
  return (
    <section className={cx(STATE_BASE_CLASS, STATE_DEFAULT_WIDTH_CLASS)}>
      <p className={STATE_COPY_CLASS}>{message}</p>
      {actionLabel && action ? (
        <Button className={getNewtabButtonClass('secondary')} type="button" onClick={action} unstyled>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}
