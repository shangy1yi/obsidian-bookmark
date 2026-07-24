import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { AiSetupPrompt } from '../../ui/ai/AiSetupPrompt'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { Input } from '../../ui/base/Input'
import { cx } from '../../ui/base/utils'
import {
  dispatchPopupModalAction,
  usePopupModalsView,
  type PopupModalsView
} from '../popup-controller-store'
import { focusFolderPickerEdge } from '../popup-keyboard-navigation'
import { PopupFolderPickerHost } from './PopupFolderPickerHost'
import type { PopupFolderPickerState } from './PopupViewModels'

const folderSearchShellClass = [
  'flex min-h-10 w-full items-center gap-1.5 rounded-ds-sm border border-ds-border bg-ds-surface-2 py-0 pl-3 pr-1.5 text-ds-text-primary',
  'transition-[border-color,background-color,box-shadow] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover',
  'focus-within:border-ds-text-primary/45 focus-within:bg-ds-hover focus-within:[outline:3px_solid_rgba(245,245,247,0.14)] focus-within:outline-offset-0'
].join(' ')
const folderSearchIconClass =
  'pointer-events-none flex-none text-ds-text-muted transition-colors duration-ds-fast ease-ds-standard'
const folderSearchInputClass =
  'min-w-0 flex-auto self-stretch border-0 bg-transparent px-0.5 py-0 text-sm leading-[1.4] text-ds-text-primary outline-none placeholder:text-ds-text-muted [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none'
const modalButtonBaseClass = [
  'inline-flex min-h-[34px] min-w-[88px] items-center justify-center gap-2 rounded-ds-sm border px-3 py-2 text-center text-xs font-semibold leading-none shadow-none',
  'transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2',
  'active:scale-[0.985]',
  'disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
].join(' ')
const modalSecondaryButtonClass = [
  modalButtonBaseClass,
  'border-ds-border bg-ds-surface-2 text-ds-text-primary',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary'
].join(' ')
const modalPrimaryButtonClass = [
  modalButtonBaseClass,
  'border-ds-border-hover bg-[var(--ds-text-primary)] text-[var(--ds-bg-app)]',
  'hover:border-ds-border-hover hover:bg-ds-text-primary hover:text-[var(--ds-bg-app)]',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-text-primary focus-visible:text-[var(--ds-bg-app)]'
].join(' ')
const modalDangerButtonClass = [
  modalButtonBaseClass,
  'border-[rgba(255,138,130,0.62)] bg-ds-danger-soft text-ds-danger-text',
  'hover:border-[rgba(255,183,176,0.86)] hover:bg-ds-danger-soft hover:text-ds-danger-text',
  'focus-visible:border-[rgba(255,183,176,0.86)] focus-visible:bg-ds-danger-soft focus-visible:text-ds-danger-text'
].join(' ')
const modalCompactButtonClass =
  cx(modalSecondaryButtonClass, 'min-h-[30px] min-w-0 flex-none px-2.5 py-0 text-xs')
const modalCloseButtonClass = [
  'inline-flex min-h-[30px] items-center justify-center rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2.5 py-1.5 text-xs font-semibold leading-none text-ds-text-secondary shadow-none',
  'transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2',
  'active:scale-[0.96]',
  'disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
].join(' ')
const modalFormClass = 'flex flex-col gap-[9px]'
const modalFieldClass = 'flex flex-col gap-1.5'
const modalLabelClass = 'text-xs font-medium leading-tight text-ds-text-secondary'
const modalInputClass = [
  'min-h-[42px] w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-[11px] text-[13px] leading-normal text-ds-text-primary outline-none',
  'transition-[border-color,background-color,box-shadow] duration-ds-fast ease-ds-standard',
  'placeholder:text-ds-text-muted',
  'focus:border-ds-text-primary/45 focus:bg-ds-hover focus:[outline:3px_solid_rgba(245,245,247,0.14)] focus:outline-offset-0',
  'focus-visible:border-ds-text-primary/45 focus-visible:bg-ds-hover focus-visible:[outline:3px_solid_rgba(245,245,247,0.14)] focus-visible:outline-offset-0',
  'disabled:opacity-50 data-[disabled]:opacity-50'
].join(' ')
const modalHeaderClass = 'flex items-center justify-between gap-2.5'
const modalHeaderCompactClass = cx(modalHeaderClass, 'items-start')
const modalHeaderCopyClass = 'min-w-0'
const modalTitleClass =
  'm-0 mt-0.5 min-w-0 text-base font-semibold leading-[1.1] text-ds-text-primary'
const modalEyebrowClass =
  'm-0 text-xs font-medium leading-4 text-ds-text-secondary'
const modalDangerEyebrowClass = cx(modalEyebrowClass, 'text-ds-danger-text')
const modalBookmarkCardClass =
  'relative flex flex-col gap-[5px] rounded-ds-sm border border-ds-border bg-ds-surface-1 px-3 py-2.5 shadow-none'
const modalCardLabelClass =
  'm-0 text-[11px] leading-[1.35] tracking-[0.01em] text-ds-text-muted'
const modalCardTitleClass =
  'm-0 min-w-0 break-words text-xs font-semibold leading-[1.35] text-ds-text-primary'
const modalCardPathClass =
  'm-0 min-w-0 [overflow-wrap:anywhere] text-[11px] leading-[1.35] tracking-[0.01em] text-ds-text-muted'
const modalCardPathChangedClass = 'text-ds-text-secondary'
const modalPathRowClass = 'flex items-center gap-2'
const modalAiSetupPromptClass = [
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[9px]',
  '[&_.ai-setup-prompt-copy]:grid [&_.ai-setup-prompt-copy]:gap-1',
  '[&_.ai-setup-prompt-icon]:inline-flex [&_.ai-setup-prompt-icon]:h-[26px] [&_.ai-setup-prompt-icon]:w-[26px] [&_.ai-setup-prompt-icon]:items-center [&_.ai-setup-prompt-icon]:justify-center',
  '[&_.ai-setup-prompt-icon]:rounded-lg [&_.ai-setup-prompt-icon]:border [&_.ai-setup-prompt-icon]:border-white/10 [&_.ai-setup-prompt-icon]:bg-ds-text-primary/[0.04] [&_.ai-setup-prompt-icon]:text-ds-text-secondary'
].join(' ')
const modalNoteClass = 'm-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const modalActionsClass = 'flex items-center justify-between gap-2.5'
const modalStackClass =
  'relative grid h-full max-h-full min-h-0 w-full min-w-0 place-items-center overflow-hidden p-[18px] outline-none'
const modalDismissLayerClass =
  'absolute inset-0 z-0 block cursor-default border-0 bg-transparent'
const modalCardShellClass = [
  'relative z-[1] flex min-h-0 flex-col gap-[11px] overflow-hidden rounded-ds-lg border border-ds-border bg-ds-surface-1 p-[13px] text-ds-text-primary shadow-none outline-none',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.86)] focus-visible:outline-offset-2'
].join(' ')
const modalStandardCardClass = cx(
  modalCardShellClass,
  'w-[min(398px,calc(100vw_-_28px))] max-w-[398px] max-h-[calc(100%_-_28px)]'
)
const modalSmallCardClass = cx(
  modalCardShellClass,
  'w-[min(398px,calc(100vw_-_28px))] max-w-[360px] max-h-[calc(100%_-_28px)]'
)
const modalWideCardClass = cx(
  modalCardShellClass,
  'h-[min(548px,calc(100%_-_36px))] w-[min(620px,calc(100vw_-_28px))] max-h-[calc(100%_-_36px)] max-w-[620px]'
)
const modalListClass = [
  'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-ds-sm border border-ds-border bg-ds-surface-1 p-1 pr-1.5',
  '[scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]',
  '[&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-ds-text-primary/20 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-track]:bg-transparent'
].join(' ')
const modalCompactListClass = cx(modalListClass, 'max-h-[170px]')
const editFolderPickerClass = 'flex min-h-0 flex-col gap-2'

export function PopupModalsHost() {
  const liveState = usePopupModalsView()
  const lastOpenStateRef = useRef(liveState)
  const state = liveState.open ? liveState : lastOpenStateRef.current
  const previousActiveRef = useRef<PopupModalsView['active']>(null)
  const previousEditPickerOpenRef = useRef(false)
  const moveSearchRef = useRef<HTMLInputElement | null>(null)
  const smartFolderSearchRef = useRef<HTMLInputElement | null>(null)
  const aiProviderSettingsRef = useRef<HTMLButtonElement | null>(null)
  const editTitleRef = useRef<HTMLInputElement | null>(null)
  const editFolderSearchRef = useRef<HTMLInputElement | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (liveState.open) {
      lastOpenStateRef.current = liveState
    }
  }, [liveState])

  useEffect(() => {
    if (state.active !== previousActiveRef.current) {
      previousActiveRef.current = state.active
      focusInitialModalControl(state.active, {
        aiProviderSettingsRef,
        cancelDeleteRef,
        editTitleRef,
        moveSearchRef,
        smartFolderSearchRef
      })
    }

    if (state.edit.folderPickerOpen && !previousEditPickerOpenRef.current) {
      focusElement(editFolderSearchRef)
    }
    previousEditPickerOpenRef.current = state.edit.folderPickerOpen
  }, [state.active, state.edit.folderPickerOpen])

  return (
    <div
      className={modalStackClass}
    >
      <Button
        className={modalDismissLayerClass}
        type="button"
        aria-label="关闭弹窗"
        onClick={() => dispatchPopupModalAction('close')}
        unstyled
      />
      {state.move.open ? <MoveBookmarkModal searchRef={moveSearchRef} view={state.move} /> : null}
      {state.smartFolder.open ? <SmartFolderModal searchRef={smartFolderSearchRef} view={state.smartFolder} /> : null}
      {state.aiProvider.open ? <AiProviderPromptModal settingsButtonRef={aiProviderSettingsRef} /> : null}
      {state.edit.open ? <EditBookmarkModal folderSearchRef={editFolderSearchRef} titleRef={editTitleRef} view={state.edit} /> : null}
      {state.delete.open ? <DeleteBookmarkModal cancelButtonRef={cancelDeleteRef} view={state.delete} /> : null}
    </div>
  )
}

function FolderSearch({
  inputRef,
  htmlFor,
  inputId,
  placeholder,
  label,
  mode,
  controls,
  value,
  action,
  disabled = false
}: {
  action: string
  controls: string
  disabled?: boolean
  htmlFor: string
  inputId: string
  inputRef?: RefObject<HTMLInputElement | null>
  label: string
  mode: PopupFolderPickerState['mode']
  placeholder: string
  value: string
}) {
  return (
    <label className={folderSearchShellClass} htmlFor={htmlFor}>
      <Icon name="Search" className={folderSearchIconClass} size={16} aria-hidden="true" />
      <Input
        ref={inputRef}
        id={inputId}
        className={folderSearchInputClass}
        type="text"
        role="searchbox"
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={label}
        aria-controls={controls}
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => dispatchPopupModalAction(action, nextValue)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return
          }

          const list = document.getElementById(controls)
          const edge = event.key === 'ArrowUp' ? 'last' : 'first'
          if (focusFolderPickerEdge(list, mode, edge)) {
            event.preventDefault()
          }
        }}
        unstyled
      />
    </label>
  )
}

function MoveBookmarkModal({
  searchRef,
  view
}: {
  searchRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['move']
}) {
  return (
    <section id="move-modal" className={modalWideCardClass} aria-labelledby="move-modal-title" tabIndex={-1}>
      <header className={modalHeaderClass}>
        <div className={modalHeaderCopyClass}>
          <p className={modalEyebrowClass}>移动书签</p>
          <h2 id="move-modal-title" className={modalTitleClass}>选择目标文件夹</h2>
        </div>
        <Button id="close-move-modal" className={modalCloseButtonClass} type="button" aria-label="关闭移动面板" onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <div className={modalBookmarkCardClass}>
        <p className={modalCardLabelClass}>当前书签</p>
        <p id="move-bookmark-title" className={modalCardTitleClass}>{view.title}</p>
        <p id="move-bookmark-path" className={modalCardPathClass}>{view.path}</p>
      </div>
      <FolderSearch
        inputRef={searchRef}
        htmlFor="move-search-input"
        inputId="move-search-input"
        placeholder="搜索目标文件夹"
        label="搜索移动目标文件夹"
        mode="move"
        controls="move-folder-list"
        value={view.query}
        action="move-query-change"
      />
      <PopupFolderPickerHost id="move-folder-list" className={modalListClass} mode="move" />
    </section>
  )
}

function SmartFolderModal({
  searchRef,
  view
}: {
  searchRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['smartFolder']
}) {
  return (
    <section id="smart-folder-modal" className={modalWideCardClass} aria-labelledby="smart-folder-modal-title" tabIndex={-1}>
      <header className={modalHeaderClass}>
        <div className={modalHeaderCopyClass}>
          <p className={modalEyebrowClass}>当前网页</p>
          <h2 id="smart-folder-modal-title" className={modalTitleClass}>选择保存文件夹</h2>
        </div>
        <Button id="close-smart-folder-modal" className={modalCloseButtonClass} type="button" aria-label="关闭文件夹选择" onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <div className={modalBookmarkCardClass}>
        <p className={modalCardLabelClass}>即将保存</p>
        <p id="smart-folder-page-title" className={modalCardTitleClass}>{view.title}</p>
        <p id="smart-folder-page-url" className={modalCardPathClass}>{view.urlLabel}</p>
      </div>
      <FolderSearch
        inputRef={searchRef}
        htmlFor="smart-folder-search-input"
        inputId="smart-folder-search-input"
        placeholder="搜索目标文件夹"
        label="搜索目标文件夹"
        mode="smart"
        controls="smart-folder-list"
        value={view.query}
        action="smart-folder-query-change"
      />
      <PopupFolderPickerHost id="smart-folder-list" className={modalListClass} mode="smart" />
    </section>
  )
}

function AiProviderPromptModal({
  settingsButtonRef
}: {
  settingsButtonRef: RefObject<HTMLButtonElement | null>
}) {
  return (
    <section id="ai-provider-prompt-modal" className={modalSmallCardClass} aria-labelledby="ai-provider-prompt-title" tabIndex={-1}>
      <header className={modalHeaderCompactClass}>
        <div className={modalHeaderCopyClass}>
          <p className={modalEyebrowClass}>AI 搜索</p>
          <h2 id="ai-provider-prompt-title" className={modalTitleClass}>请配置 AI 渠道</h2>
        </div>
        <Button id="close-ai-provider-prompt" className={modalCloseButtonClass} type="button" aria-label="关闭 AI 渠道配置提示" onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <AiSetupPrompt
        className={modalAiSetupPromptClass}
        description="普通搜索已包含本地规则。语义搜索需要先配置 AI 渠道。"
        descriptionClassName={modalNoteClass}
        titleClassName="sr-only"
        title="AI 渠道配置提示"
      />
      <footer className={modalActionsClass}>
        <Button id="cancel-ai-provider-prompt" className={modalSecondaryButtonClass} type="button" onClick={() => dispatchPopupModalAction('close')} unstyled>暂不配置</Button>
        <Button ref={settingsButtonRef} id="open-ai-provider-settings" className={modalPrimaryButtonClass} type="button" onClick={() => dispatchPopupModalAction('open-ai-settings')} unstyled>配置 AI 渠道</Button>
      </footer>
    </section>
  )
}

function EditBookmarkModal({
  folderSearchRef,
  titleRef,
  view
}: {
  folderSearchRef: RefObject<HTMLInputElement | null>
  titleRef: RefObject<HTMLInputElement | null>
  view: PopupModalsView['edit']
}) {
  return (
    <section id="edit-modal" className={modalStandardCardClass} aria-labelledby="edit-modal-title" tabIndex={-1}>
      <header className={modalHeaderClass}>
        <div className={modalHeaderCopyClass}>
          <p className={modalEyebrowClass}>编辑书签</p>
          <h2 id="edit-modal-title" className={modalTitleClass}>修改标题与网址</h2>
        </div>
        <Button id="close-edit-modal" className={modalCloseButtonClass} type="button" aria-label="关闭编辑面板" disabled={view.closeDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>
          关闭
        </Button>
      </header>
      <CollapsibleRoot
        open={view.folderPickerOpen}
        onOpenChange={(open) => {
          if (open !== view.folderPickerOpen) {
            dispatchPopupModalAction('edit-toggle-folder-picker')
          }
        }}
      >
        <div className={modalBookmarkCardClass}>
          <p className={modalCardLabelClass}>来源路径</p>
          <div className={modalPathRowClass}>
            <p id="edit-bookmark-path" className={cx(modalCardPathClass, 'flex-auto', view.pathChanged ? modalCardPathChangedClass : '')}>
              {view.path}
            </p>
            <CollapsibleTrigger
              id="edit-folder-picker-button"
              className={modalCompactButtonClass}
              type="button"
              aria-controls="edit-folder-picker"
              disabled={view.closeDisabled}
            >
              <span>{view.folderPickerOpen ? '收起' : '更改'}</span>
              <Icon name="ChevronDown" className="t-acc-chevron size-3.5" aria-hidden="true" />
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsiblePanel id="edit-folder-picker" className={editFolderPickerClass} aria-label="选择新的来源路径">
          <FolderSearch
            inputRef={folderSearchRef}
            htmlFor="edit-folder-search-input"
            inputId="edit-folder-search-input"
            placeholder="搜索目标文件夹"
            label="搜索编辑目标文件夹"
            mode="edit"
            controls="edit-folder-list"
            value={view.folderQuery}
            action="edit-folder-query-change"
            disabled={view.folderSearchDisabled}
          />
          <PopupFolderPickerHost id="edit-folder-list" className={modalCompactListClass} mode="edit" />
        </CollapsiblePanel>
      </CollapsibleRoot>
      <div className={modalFormClass}>
        <label className={modalFieldClass} htmlFor="edit-title-input">
          <span className={modalLabelClass}>标题</span>
          <Input
            ref={titleRef}
            id="edit-title-input"
            className={modalInputClass}
            type="text"
            spellCheck={false}
            maxLength={512}
            value={view.title}
            disabled={view.titleDisabled}
            onValueChange={(nextValue) => dispatchPopupModalAction('edit-title-change', nextValue)}
            onKeyDown={handleEditInputKeydown}
            unstyled
          />
        </label>
        <label className={modalFieldClass} htmlFor="edit-url-input">
          <span className={modalLabelClass}>网址</span>
          <Input
            id="edit-url-input"
            className={modalInputClass}
            type="url"
            spellCheck={false}
            inputMode="url"
            value={view.url}
            disabled={view.urlDisabled}
            onValueChange={(nextValue) => dispatchPopupModalAction('edit-url-change', nextValue)}
            onKeyDown={handleEditInputKeydown}
            unstyled
          />
        </label>
      </div>
      <footer className={modalActionsClass}>
        <Button id="cancel-edit" className={modalSecondaryButtonClass} type="button" disabled={view.cancelDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>取消</Button>
        <Button id="save-edit" className={modalPrimaryButtonClass} type="button" disabled={view.saveDisabled} onClick={() => dispatchPopupModalAction('save-edit')} unstyled>{view.saveLabel}</Button>
      </footer>
    </section>
  )
}

function DeleteBookmarkModal({
  cancelButtonRef,
  view
}: {
  cancelButtonRef: RefObject<HTMLButtonElement | null>
  view: PopupModalsView['delete']
}) {
  return (
    <section id="delete-modal" className={modalSmallCardClass} aria-labelledby="delete-modal-title" tabIndex={-1}>
      <header className={modalHeaderCompactClass}>
        <div className={modalHeaderCopyClass}>
          <p className={modalDangerEyebrowClass}>删除确认</p>
          <h2 id="delete-modal-title" className={modalTitleClass}>确认删除该书签？</h2>
        </div>
      </header>
      <div className={modalBookmarkCardClass}>
        <p className={modalCardLabelClass}>即将删除</p>
        <p id="delete-bookmark-title" className={modalCardTitleClass}>{view.title}</p>
        <p id="delete-bookmark-path" className={modalCardPathClass}>{view.path}</p>
      </div>
      <footer className={modalActionsClass}>
        <Button ref={cancelButtonRef} id="cancel-delete" className={modalSecondaryButtonClass} type="button" disabled={view.cancelDisabled} onClick={() => dispatchPopupModalAction('close')} unstyled>取消</Button>
        <Button id="confirm-delete" className={modalDangerButtonClass} type="button" disabled={view.confirmDisabled} onClick={() => dispatchPopupModalAction('confirm-delete')} unstyled>{view.confirmLabel}</Button>
      </footer>
    </section>
  )
}

function handleEditInputKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') {
    event.preventDefault()
    dispatchPopupModalAction('save-edit')
  }
}

interface ModalFocusRefs {
  aiProviderSettingsRef: RefObject<HTMLElement | null>
  cancelDeleteRef: RefObject<HTMLElement | null>
  editTitleRef: RefObject<HTMLInputElement | null>
  moveSearchRef: RefObject<HTMLElement | null>
  smartFolderSearchRef: RefObject<HTMLElement | null>
}

function focusInitialModalControl(active: PopupModalsView['active'], refs: ModalFocusRefs) {
  if (active === 'move') {
    focusElement(refs.moveSearchRef)
    return
  }
  if (active === 'smart-folder') {
    focusElement(refs.smartFolderSearchRef)
    return
  }
  if (active === 'ai-provider') {
    focusElement(refs.aiProviderSettingsRef)
    return
  }
  if (active === 'edit') {
    focusElement(refs.editTitleRef, true)
    return
  }
  if (active === 'delete') {
    focusElement(refs.cancelDeleteRef)
  }
}

function focusElement(ref: RefObject<HTMLElement | null>, select = false) {
  window.requestAnimationFrame(() => {
    const element = ref.current
    if (!(element instanceof HTMLElement)) {
      return
    }
    element.focus()
    if (select && 'select' in element && typeof element.select === 'function') {
      element.select()
    }
  })
}
