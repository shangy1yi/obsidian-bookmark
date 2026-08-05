import type { CSSProperties } from 'react'
import { AiThinkingOrb } from '../../ui/ai/AiThinkingOrb'
import { Button } from '../../ui/base/Button'
import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
import { Input } from '../../ui/base/Input'
import { Progress } from '../../ui/base/Progress'
import { Toolbar } from '../../ui/base/Toolbar'
import { cx } from '../../ui/base/utils'
import { Icon } from '../../ui/icons/Icon'
import { getSmartDisplayProgress, getSmartLoadingOrbState } from '../smart-loading-progress.js'
import type { PopupSmartClassifierViewModel, PopupSmartPageViewModel } from './PopupViewModels'

const SMART_ERROR_BANNER_CLASS =
  'relative z-[1] flex-none rounded-ds-lg border border-[rgba(255,138,130,0.42)] bg-[rgba(255,138,130,0.10)] px-3.5 py-3 text-xs leading-[1.5] tracking-[0.01em] text-ds-danger-text shadow-none'

const pageRevealShellClass = 't-skel popup-t-skel popup-page-reveal relative min-h-12 w-full'
const pageLayerClass = 'absolute inset-0 min-h-12'
const pageSkeletonLayerClass = cx(
  pageLayerClass,
  't-skel-skeleton is-pulsing popup-page-skeleton pointer-events-none z-[1]'
)
const pageContentLayerClass = cx(
  pageLayerClass,
  't-skel-content popup-page-content z-[2]'
)
const pageCardClass =
  'grid min-h-12 w-full grid-cols-[minmax(0,1fr)_156px] items-center gap-[7px] overflow-hidden rounded-ds-sm border border-ds-border-subtle bg-transparent px-[7px] py-1.5 shadow-none max-[520px]:grid-cols-[minmax(0,1fr)] max-[520px]:items-stretch max-[520px]:gap-2 max-[520px]:p-2.5'
const pageMainClass = 'grid min-w-0 grid-cols-[26px_minmax(0,1fr)] items-center gap-[7px]'
const pageIconClass =
  'grid h-[26px] w-[26px] place-items-center overflow-hidden rounded-md border border-ds-border bg-ds-surface-2 text-sm font-bold leading-none text-ds-text-primary'
const pageFaviconClass = 'block h-full w-full object-cover'
const pageCopyClass = 'min-w-0'
const pageTitleClass = 'm-0 min-w-0 truncate text-[13px] font-[760] leading-tight text-ds-text-primary'
const pageStatusClass = 'mt-[3px] mb-0 min-w-0 truncate text-[11px] leading-tight text-ds-text-muted'
const placeholderPageCardClass = 'text-ds-text-secondary'
const placeholderIconClass = 'border-ds-border bg-ds-surface-2 text-ds-text-secondary'
const placeholderTitleClass = 'text-ds-text-primary'
const placeholderStatusClass = 'text-ds-text-muted'

const currentPageActionsClass =
  'grid w-[156px] grid-cols-[minmax(0,1fr)_auto] gap-1 justify-self-end max-[520px]:w-full max-[520px]:grid-cols-2 max-[520px]:justify-self-stretch'
const currentPageActionBaseClass = [
  'inline-flex min-h-6 min-w-0 items-center justify-center overflow-hidden truncate whitespace-nowrap rounded-md border px-[7px] text-[11px] font-[750] leading-none outline-none',
  'transition-[border-color,background-color,color,transform,opacity] duration-ds-fast ease-ds-standard',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98] disabled:cursor-default disabled:opacity-70'
].join(' ')
const currentPageSecondaryActionClass = cx(
  currentPageActionBaseClass,
  'min-w-[42px] border-ds-border bg-ds-surface-2 text-[rgba(244,246,251,0.72)] hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary'
)
const currentPagePrimaryActionClass = cx(
  currentPageActionBaseClass,
  'w-full border-[rgba(245,245,247,0.82)] bg-ds-text-primary text-ds-text-inverse hover:border-ds-text-primary hover:bg-ds-text-primary hover:text-ds-text-inverse focus-visible:border-ds-text-primary focus-visible:bg-ds-text-primary focus-visible:text-ds-text-inverse'
)
const currentPagePinnedActionClass = cx(
  currentPageActionBaseClass,
  'w-full border-[rgba(245,245,247,0.5)] bg-ds-success-soft text-ds-success-text hover:border-[rgba(245,245,247,0.62)] hover:bg-ds-success-soft hover:text-ds-success-text focus-visible:border-[rgba(245,245,247,0.62)] focus-visible:bg-ds-success-soft focus-visible:text-ds-success-text'
)
const placeholderSecondaryActionClass = cx(
  currentPageActionBaseClass,
  'min-w-[42px] border-ds-border bg-ds-surface-2 text-ds-text-disabled disabled:opacity-100'
)
const placeholderPrimaryActionClass = cx(
  currentPageActionBaseClass,
  'w-full border-ds-border-hover bg-ds-surface-2 text-ds-text-muted disabled:opacity-100'
)

const skeletonBarClass =
  'block h-[9px] w-[calc(var(--skeleton-width,0.7)*100%)] rounded-full bg-[rgba(255,255,255,0.065)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.024)]'
const skeletonDotClass =
  'block h-7 w-7 rounded-md bg-[rgba(255,255,255,0.065)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.024)]'
const pageSkeletonCopyClass = 'grid min-w-0 gap-[7px]'
const pageSkeletonTitleClass = cx(skeletonBarClass, 'h-[11px] min-w-24')
const pageSkeletonStatusClass = cx(skeletonBarClass, 'h-2 min-w-[132px] opacity-[0.68]')
const pageSkeletonActionsClass = cx(currentPageActionsClass, 'items-center')
const pageSkeletonActionClass = cx(skeletonBarClass, 'h-6 w-full rounded-md')
const pageSkeletonSecondaryActionClass = cx(pageSkeletonActionClass, 'min-w-[42px]')

const panelCardClass =
  'w-full bg-transparent shadow-none'
const panelHeaderClass = 'flex items-center justify-between gap-3 px-px'
const panelHeaderTitleClass = 'm-0 text-xs font-[650] text-ds-text-secondary'
const panelHeaderWithMarginClass = cx(panelHeaderClass, 'mb-3.5')
const panelHeaderLargeMarginClass = panelHeaderClass
const panelHeaderStandaloneClass = panelHeaderClass
const exitButtonClass = [
  'inline-flex h-7 min-w-[42px] items-center justify-center rounded-md border border-ds-border bg-ds-surface-2 px-2 text-xs font-[650] text-ds-text-secondary outline-none',
  'transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98]'
].join(' ')

const actionsClass = 'mt-3 grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2'
const actionsThreeClass = cx(actionsClass, 'grid-cols-3 max-[430px]:grid-cols-1')
const actionButtonBaseClass = [
  'inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg border px-3 text-[13px] font-[750] leading-none outline-none',
  'transition-[border-color,background-color,color,transform,opacity] duration-ds-fast ease-ds-standard',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98] disabled:cursor-default'
].join(' ')
const secondaryActionButtonClass = cx(
  actionButtonBaseClass,
  'border-ds-border bg-ds-surface-2 text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover'
)
const settingsActionButtonClass = cx(
  actionButtonBaseClass,
  'border-ds-border-hover bg-ds-surface-3 text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-surface-3 focus-visible:border-ds-border-hover focus-visible:bg-ds-surface-3'
)
const primaryActionButtonClass = cx(
  actionButtonBaseClass,
  'border-[rgba(245,245,247,0.92)] bg-ds-text-primary text-ds-text-inverse hover:border-ds-text-primary hover:bg-ds-text-primary focus-visible:border-ds-text-primary focus-visible:bg-ds-text-primary'
)
const savedActionButtonClass =
  'border-ds-success bg-ds-success-soft text-ds-success-text disabled:opacity-100'

const manualButtonClass = [
  'mx-auto inline-flex w-fit items-center justify-center gap-[7px] rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-ds-text-secondary outline-none',
  'transition-[color,background-color,transform] duration-ds-fast ease-ds-standard',
  'hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.98]'
].join(' ')
const manualButtonSlotClass = 'mt-auto flex justify-center pt-4'
const folderIconClass = 'h-3.5 w-3.5 flex-none text-ds-text-secondary'

const permissionCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden px-[18px] py-4')
const permissionBodyClass = 'mx-auto grid w-full max-w-[560px] gap-2.5 py-8'
const permissionCopyClass = 'm-0 text-xs leading-[1.55] text-ds-text-secondary'
const permissionErrorClass = 'm-0 text-xs leading-[1.55] text-ds-danger-text'
const permissionOriginsClass = 'flex flex-wrap gap-1.5'
const permissionOriginClass =
  'max-w-full overflow-hidden truncate whitespace-nowrap rounded-md border border-ds-border bg-ds-surface-2 px-2 py-1.5 text-[11px] leading-tight text-ds-text-primary'

const buttonLoadingLabelClass = 'inline-flex min-w-0 items-center justify-center gap-[7px]'
const buttonDotLoaderClass = 'h-3.5 w-3.5'
const loadingCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden px-[18px] py-4')
const loadingStageClass = 'flex min-h-0 flex-1 items-center justify-center pb-8'
const loadingBodyClass = 'grid w-full max-w-[590px] grid-cols-[64px_minmax(0,1fr)] items-center gap-4 max-[430px]:grid-cols-[minmax(0,1fr)] max-[430px]:justify-items-center max-[430px]:text-center'
const loadingLoaderClass = 'opacity-90'
const loadingContentClass = 'min-w-0'
const loadingCopyClass =
  'mb-2.5 mt-0 flex items-center justify-between gap-3 text-[13px] font-[650] text-ds-text-primary'
const loadingStepClass = 'text-[11px] font-medium text-ds-text-secondary'
const progressTrackClass =
  'smart-progress-track relative h-[6px] overflow-hidden rounded-full bg-ds-text-primary/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'
const progressBarClass = [
  'smart-progress-bar relative block h-full overflow-hidden rounded-[inherit]',
  'origin-left bg-[rgba(237,237,237,0.86)]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]',
  'transition-transform duration-[320ms] ease-linear will-change-transform motion-reduce:transition-none'
].join(' ')

const resultCardClass = cx(panelCardClass, 'flex h-full min-h-0 flex-col overflow-hidden px-[18px] py-4')
const titleRowClass = 'mb-3.5 grid grid-cols-[minmax(0,1fr)] gap-2'
const titleInputClass =
  'min-h-9 w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3 text-[13px] font-[650] leading-tight text-ds-text-primary outline-none placeholder:text-ds-text-muted focus:border-ds-text-primary/45 focus:bg-ds-hover focus:[outline:3px_solid_rgba(245,245,247,0.14)] focus:outline-offset-0 focus-visible:border-ds-text-primary/45 focus-visible:bg-ds-hover focus-visible:[outline:3px_solid_rgba(245,245,247,0.14)] focus-visible:outline-offset-0'
const sectionLabelClass = 'mb-[9px] mt-0 text-xs font-semibold text-ds-text-secondary'
const recommendationsClass =
  'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'
const folderOptionBaseClass = [
  'grid min-h-[50px] w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg border border-ds-border bg-ds-surface-2 px-3 py-2.5 text-left outline-none max-[430px]:grid-cols-[minmax(0,1fr)]',
  'transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.32)] focus-visible:outline-offset-1',
  'active:scale-[0.993]'
].join(' ')
const folderOptionSelectedClass =
  'border-ds-border-hover bg-ds-selected text-ds-text-primary'
const folderMainClass = 'grid min-w-0 gap-1'
const folderHeadClass = 'flex min-w-0 items-center gap-2'
const folderNameClass = 'min-w-0 truncate text-[13px] font-bold leading-tight text-ds-text-primary'
const folderPathClass = 'ml-[22px] min-w-0 break-all text-[11px] leading-snug text-ds-text-secondary'
const folderMetaClass =
  'flex items-start gap-2 text-[11px] font-[650] text-ds-text-secondary'
const checkIconClass = 'h-3.5 w-3.5 text-ds-text-primary'
const newBadgeClass =
  'inline-flex min-h-[18px] items-center rounded-full border border-ds-border bg-ds-surface-2 px-1.5 text-[10px] font-extrabold text-ds-text-secondary'
const compactStateClass =
  'grid min-h-[90px] place-items-center px-4 py-3 text-center text-xs leading-[1.55] text-ds-text-muted'

export interface PopupSmartClassifierActionHandlers {
  onAction?: (action: string, returnFocusElement?: HTMLElement | null) => void
  onCurrentPageAction?: (action: string, returnFocusElement?: HTMLElement | null) => void
  onRecommendationSelect?: (recommendationId: string) => void
  onTitleChange?: (title: string) => void
}

export function PopupSmartClassifier({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  if (state.status === 'hidden') {
    return null
  }

  if (state.status === 'page-loading') {
    return <PopupSmartPageRevealCard handlers={handlers} page={state.page} loading />
  }

  if (state.status === 'loading') {
    return <PopupSmartLoading handlers={handlers} state={state} />
  }

  if (state.status === 'results') {
    return <PopupSmartResult handlers={handlers} state={state} />
  }

  if (state.status === 'error') {
    return (
      <>
        <PopupSmartPageCard handlers={handlers} page={state.page} />
        <div className={panelHeaderStandaloneClass}>
          <p className={panelHeaderTitleClass}>智能分类失败</p>
          <PopupSmartExitButton handlers={handlers} />
        </div>
        <div className={SMART_ERROR_BANNER_CLASS}>{state.error || '智能分类失败，请稍后重试。'}</div>
        <Toolbar className={actionsThreeClass} unstyled>
          <Button
            className={secondaryActionButtonClass}
            type="button"
            data-smart-action="manual-folder"
            onClick={(event) => handlers?.onAction?.('manual-folder', event.currentTarget)}
            unstyled
          >
            手动选择
          </Button>
          <Button
            className={settingsActionButtonClass}
            type="button"
            data-smart-action="open-ai-settings"
            onClick={() => handlers?.onAction?.('open-ai-settings')}
            unstyled
          >
            AI 设置
          </Button>
          <Button
            className={primaryActionButtonClass}
            type="button"
            data-smart-action="classify"
            onClick={() => handlers?.onAction?.('classify')}
            unstyled
          >
            重试
          </Button>
        </Toolbar>
      </>
    )
  }

  if (state.status === 'permission') {
    return <PopupSmartPermission handlers={handlers} state={state} />
  }

  return <PopupSmartPageRevealCard handlers={handlers} page={state.page} loading={false} />
}

function PopupSmartPageCard({
  handlers,
  page
}: {
  handlers?: PopupSmartClassifierActionHandlers
  page: PopupSmartPageViewModel | null
}) {
  return (
    <article className={getPopupSmartPageCardClassName(page)}>
      <PopupSmartPageCardContent handlers={handlers} page={page} />
    </article>
  )
}

function PopupSmartPageRevealCard({
  handlers,
  loading,
  page
}: {
  handlers?: PopupSmartClassifierActionHandlers
  loading: boolean
  page: PopupSmartPageViewModel | null
}) {
  return (
    <div
      className={cx(pageRevealShellClass, loading ? '' : 'is-revealed')}
      data-state={loading ? 'loading' : 'ready'}
      aria-busy={loading ? 'true' : 'false'}
      role={loading ? 'status' : undefined}
      aria-live="polite"
    >
      <div className={cx(pageCardClass, pageSkeletonLayerClass)} aria-hidden="true">
        <PopupSmartPageSkeletonContent />
      </div>
      <article className={cx(getPopupSmartPageCardClassName(page), pageContentLayerClass, loading ? 'pointer-events-none' : '')}>
        <PopupSmartPageCardContent handlers={handlers} page={page} />
      </article>
    </div>
  )
}

function getPopupSmartPageCardClassName(page: PopupSmartPageViewModel | null) {
  return cx(pageCardClass, page ? '' : placeholderPageCardClass)
}

function PopupSmartPageCardContent({
  handlers,
  page
}: {
  handlers?: PopupSmartClassifierActionHandlers
  page: PopupSmartPageViewModel | null
}) {
  if (!page) {
    return <PopupSmartPagePlaceholderContent />
  }

  return (
    <>
      <div className={pageMainClass}>
        <span className={pageIconClass} aria-hidden="true">
          {page.favicon ? <img className={pageFaviconClass} src={page.favicon} alt="" /> : page.fallbackIcon}
        </span>
        <div className={pageCopyClass}>
          <p className={pageTitleClass} title={page.title}>{page.title}</p>
          <p className={pageStatusClass} title={page.statusTitle}>{page.status}</p>
        </div>
      </div>
      {page.bookmarked ? (
        <Toolbar className={currentPageActionsClass} aria-label="当前页快捷操作" unstyled>
          <Button
            className={page.pinned ? currentPagePinnedActionClass : currentPagePrimaryActionClass}
            type="button"
            data-current-page-action="pin-newtab"
            aria-pressed={page.pinned}
            disabled={page.pinPending}
            onClick={() => handlers?.onCurrentPageAction?.('pin-newtab')}
            unstyled
          >
            {page.pinPending ? <PopupButtonLoadingLabel label={page.pinned ? '取消中' : '固定中'} /> : page.pinLabel}
          </Button>
          <Button
            className={currentPageSecondaryActionClass}
            type="button"
            data-current-page-action="edit"
            onClick={(event) => handlers?.onCurrentPageAction?.('edit', event.currentTarget)}
            unstyled
          >
            编辑
          </Button>
        </Toolbar>
      ) : (
        <Toolbar className={currentPageActionsClass} aria-label="当前页快捷操作" unstyled>
          <Button
            className={currentPagePrimaryActionClass}
            type="button"
            data-current-page-action="save"
            onClick={(event) => handlers?.onCurrentPageAction?.('save', event.currentTarget)}
            unstyled
          >
            快速保存
          </Button>
          <Button
            className={currentPageSecondaryActionClass}
            type="button"
            data-smart-action="classify"
            onClick={() => handlers?.onAction?.('classify')}
            unstyled
          >
            智能分类
          </Button>
        </Toolbar>
      )}
    </>
  )
}

function PopupSmartPageSkeletonContent() {
  return (
    <>
      <div className={pageMainClass}>
        <span className={skeletonDotClass} aria-hidden="true"></span>
        <span className={pageSkeletonCopyClass} aria-hidden="true">
          <span
            className={pageSkeletonTitleClass}
            style={{ '--skeleton-width': 0.64 } as CSSProperties}
          ></span>
          <span
            className={pageSkeletonStatusClass}
            style={{ '--skeleton-width': 0.86 } as CSSProperties}
          ></span>
        </span>
      </div>
      <span className={pageSkeletonActionsClass} aria-hidden="true">
        <span className={pageSkeletonActionClass}></span>
        <span className={pageSkeletonSecondaryActionClass}></span>
      </span>
    </>
  )
}

function PopupSmartPagePlaceholderContent() {
  return (
    <>
      <div className={pageMainClass}>
        <span className={cx(pageIconClass, placeholderIconClass)} aria-hidden="true">
          <Icon name="PanelRight" size={15} />
        </span>
        <div className={pageCopyClass}>
          <p className={cx(pageTitleClass, placeholderTitleClass)}>当前标签页</p>
          <p className={cx(pageStatusClass, placeholderStatusClass)} title="打开网页后可快速保存或智能分类">
            打开网页后可快速保存或智能分类
          </p>
        </div>
      </div>
      <Toolbar className={cx(currentPageActionsClass, 'pointer-events-none')} aria-label="当前页快捷操作" unstyled>
        <Button className={placeholderPrimaryActionClass} type="button" disabled unstyled>
          快速保存
        </Button>
        <Button className={placeholderSecondaryActionClass} type="button" disabled unstyled>
          智能分类
        </Button>
      </Toolbar>
    </>
  )
}

function PopupSmartExitButton({ handlers }: { handlers?: PopupSmartClassifierActionHandlers }) {
  return (
    <Button
      className={exitButtonClass}
      type="button"
      data-smart-action="exit"
      aria-label="退出智能分类"
      onClick={() => handlers?.onAction?.('exit')}
      unstyled
    >
      退出
    </Button>
  )
}

function PopupSmartManualButton({ handlers }: { handlers?: PopupSmartClassifierActionHandlers }) {
  return (
    <Button
      className={manualButtonClass}
      type="button"
      data-smart-action="manual-folder"
      onClick={(event) => handlers?.onAction?.('manual-folder', event.currentTarget)}
      unstyled
    >
      <Icon name="Folder" className={folderIconClass} aria-hidden="true" />
      <span>手动选择文件夹</span>
    </Button>
  )
}

function PopupSmartPermission({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  return (
    <article className={permissionCardClass}>
      <div className={panelHeaderWithMarginClass}>
        <p className={panelHeaderTitleClass}>需要授权 AI 渠道</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={permissionBodyClass}>
        <p className={permissionCopyClass}>
          智能分类需要访问你配置的 AI 服务地址。当前网页不会申请额外权限，正文读取失败时会用标题和 URL 继续推荐。
        </p>
        {state.permissionOrigins.length ? (
          <div className={permissionOriginsClass}>
            {state.permissionOrigins.map((origin) => <span className={permissionOriginClass} key={origin}>{origin}</span>)}
          </div>
        ) : null}
        {state.error ? <p className={permissionErrorClass}>{state.error}</p> : null}
      </div>
      <Toolbar className={actionsClass} unstyled>
        <Button
          className={secondaryActionButtonClass}
          type="button"
          data-smart-action="manual-folder"
          onClick={(event) => handlers?.onAction?.('manual-folder', event.currentTarget)}
          unstyled
        >
          手动选择
        </Button>
        <Button
          className={settingsActionButtonClass}
          type="button"
          data-smart-action="open-ai-settings"
          onClick={() => handlers?.onAction?.('open-ai-settings')}
          unstyled
        >
          AI 设置
        </Button>
        <Button
          className={primaryActionButtonClass}
          type="button"
          data-smart-action="grant-permission"
          onClick={() => handlers?.onAction?.('grant-permission')}
          unstyled
        >
          授权并继续
        </Button>
      </Toolbar>
    </article>
  )
}

function PopupButtonLoadingLabel({ label }: { label: string }) {
  return (
    <span className={buttonLoadingLabelClass}>
      <DotMatrixLoader variant="bar" className={buttonDotLoaderClass} />
      <span className="t-shimmer" data-text={label}>{label}</span>
    </span>
  )
}

function PopupSmartLoading({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  const loadingProgress = getSmartDisplayProgress(state.loadingProgress, state.loadingStep)
  const loadingPercent = Math.round(loadingProgress)

  return (
    <article className={loadingCardClass}>
      <div className={panelHeaderLargeMarginClass}>
        <p className={panelHeaderTitleClass}>智能分类</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={loadingStageClass}>
        <div className={loadingBodyClass}>
          <AiThinkingOrb
            state={getSmartLoadingOrbState(state.loadingStep)}
            size={64}
            className={loadingLoaderClass}
          />
          <div className={loadingContentClass}>
            <p className={loadingCopyClass}>
              <span className="t-shimmer" data-text={state.loadingLabel}>{state.loadingLabel}</span>
              <small className={loadingStepClass}>
                <span className="tabular-nums">{loadingPercent}%</span>
              </small>
            </p>
            <Progress
              className={progressTrackClass}
              indicatorClassName={progressBarClass}
              indicatorProps={{ 'data-smart-progress-target': loadingProgress } as Record<string, string | number>}
              indicatorStyle={{
                width: '100%',
                transform: `scaleX(${loadingProgress / 100})`,
                transformOrigin: 'left center',
                '--smart-progress-scale': loadingProgress / 100
              } as CSSProperties}
              label="智能分类进度"
              value={loadingProgress}
              aria-valuetext={`${state.loadingLabel} 第 ${state.loadingStep}/${state.loadingStepCount} 阶段，已完成 ${loadingPercent}%`}
              unstyled
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function PopupSmartResult({
  handlers,
  state
}: {
  handlers?: PopupSmartClassifierActionHandlers
  state: PopupSmartClassifierViewModel
}) {
  const canSave = Boolean(state.recommendations.length && !state.saving && !state.saved)

  return (
    <article className={resultCardClass}>
      <div className={panelHeaderWithMarginClass}>
        <p className={panelHeaderTitleClass}>推荐文件夹</p>
        <PopupSmartExitButton handlers={handlers} />
      </div>
      <div className={titleRowClass}>
        <Input
          id="smart-title-input"
          className={titleInputClass}
          type="text"
          spellCheck={false}
          maxLength={180}
          defaultValue={state.suggestedTitle}
          aria-label="推荐书签标题"
          onValueChange={(value) => handlers?.onTitleChange?.(value)}
          unstyled
        />
      </div>
      <p className={sectionLabelClass}>推荐文件夹</p>
      <div className={recommendationsClass}>
        {state.recommendations.length ? (
          state.recommendations.map((recommendation) => (
            <Button
              className={cx(folderOptionBaseClass, recommendation.selected ? folderOptionSelectedClass : '')}
              type="button"
              data-smart-recommendation={recommendation.id}
              aria-pressed={recommendation.selected}
              onClick={() => handlers?.onRecommendationSelect?.(recommendation.id)}
              key={recommendation.id}
              unstyled
            >
              <span className={folderMainClass}>
                <span className={folderHeadClass}>
                  <Icon name="Folder" className={folderIconClass} aria-hidden="true" />
                  <span className={folderNameClass}>{recommendation.title}</span>
                </span>
                <span className={folderPathClass} title={recommendation.path}>{recommendation.path}</span>
              </span>
              <span className={folderMetaClass}>
                {recommendation.isNew ? <span className={newBadgeClass}>新建</span> : null}
                {recommendation.selected ? <Icon name="Check" className={checkIconClass} aria-hidden="true" /> : null}
                <span>{recommendation.confidence}%</span>
              </span>
            </Button>
          ))
        ) : (
          <div className={compactStateClass}>未生成可用推荐，请手动选择文件夹。</div>
        )}
      </div>
      <div className={manualButtonSlotClass}>
        <PopupSmartManualButton handlers={handlers} />
      </div>
      <Toolbar className={actionsClass} unstyled>
        <Button
          className={secondaryActionButtonClass}
          type="button"
          data-smart-action="reset"
          onClick={() => handlers?.onAction?.('reset')}
          unstyled
        >
          取消
        </Button>
        <Button
          className={cx(primaryActionButtonClass, state.saved ? savedActionButtonClass : '')}
          type="button"
          data-smart-action="save"
          disabled={!canSave}
          onClick={() => handlers?.onAction?.('save')}
          unstyled
        >
          {state.saving ? (
            <PopupButtonLoadingLabel label="保存中" />
          ) : (
            <span className="popup-save-action-label">
              {state.saved ? (
                <svg className="popup-saved-check" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
                </svg>
              ) : null}
              <span>{state.saved ? '已保存' : '确认保存'}</span>
            </span>
          )}
        </Button>
      </Toolbar>
    </article>
  )
}
