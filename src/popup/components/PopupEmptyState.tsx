import { AiSetupPrompt } from '../../ui/ai/AiSetupPrompt'
import { Button } from '../../ui/base/Button'
import type { PopupEmptyStateViewModel } from './PopupViewModels'

const EMPTY_STATE_CLASS = [
  'grid max-w-[320px] justify-items-center gap-[9px]',
  '[&_.ai-setup-prompt-copy]:grid',
  '[&_.ai-setup-prompt-copy]:justify-items-center',
  '[&_.ai-setup-prompt-copy]:gap-[7px]',
  '[&_.ai-setup-prompt-actions]:mt-0.5',
  '[&_.ai-setup-prompt-actions]:flex',
  '[&_.ai-setup-prompt-actions]:flex-wrap',
  '[&_.ai-setup-prompt-actions]:justify-center',
  '[&_.ai-setup-prompt-actions]:gap-[7px]'
].join(' ')

const EMPTY_TITLE_CLASS = 'm-0 text-[13px] font-[750] [color:var(--ds-text-primary)]'
const EMPTY_HINT_CLASS = 'm-0 [color:var(--ds-text-secondary)]'
const EMPTY_ACTIONS_CLASS = 'mt-0.5 flex flex-wrap justify-center gap-[7px]'
const EMPTY_ACTION_CLASS = [
  'inline-flex min-h-7 items-center justify-center rounded-[7px] border px-2.5 text-xs font-bold',
  'border-[rgba(245,245,247,0.28)] bg-ds-surface-2 [color:var(--ds-text-secondary)]',
  'transition-[background-color,border-color,color,transform] duration-[var(--duration-quick)] ease-ds-standard',
  'hover:border-[rgba(245,245,247,0.54)] hover:bg-ds-hover hover:[color:var(--ds-text-primary)]',
  'focus-visible:border-[rgba(245,245,247,0.54)] focus-visible:bg-ds-hover focus-visible:[color:var(--ds-text-primary)]',
  'active:scale-[0.98]'
].join(' ')
const EMPTY_PRIMARY_ACTION_CLASS = [
  'border-[rgba(245,245,247,0.86)] bg-ds-text-primary text-ds-text-inverse',
  'hover:border-ds-text-primary hover:bg-ds-text-primary hover:text-ds-text-inverse',
  'focus-visible:border-ds-text-primary focus-visible:bg-ds-text-primary focus-visible:text-ds-text-inverse'
].join(' ')

export function PopupEmptyState({
  onAction,
  state
}: {
  onAction?: (action: string) => void
  state: PopupEmptyStateViewModel
}) {
  if (state.kind === 'none') {
    return null
  }

  if (state.kind === 'message') {
    return <>{state.message}</>
  }

  if (state.kind === 'natural-setup') {
    return (
      <AiSetupPrompt
        className={EMPTY_STATE_CLASS}
        iconHidden
        title={<p className={EMPTY_TITLE_CLASS}>请配置 AI 渠道</p>}
        description={<p className={EMPTY_HINT_CLASS}>普通搜索已包含本地规则。语义搜索需要配置 AI 渠道后使用。</p>}
        actions={
          <>
            <Button
              className={getEmptyActionClassName(true)}
              type="button"
              onClick={() => onAction?.('open-ai-settings')}
              unstyled
            >
              配置 AI 渠道
            </Button>
            <Button
              className={getEmptyActionClassName(false)}
              type="button"
              onClick={() => onAction?.('dismiss-natural-setup')}
              unstyled
            >
              继续普通搜索
            </Button>
          </>
        }
      />
    )
  }

  return (
    <div className={EMPTY_STATE_CLASS}>
      <p className={EMPTY_TITLE_CLASS}>{state.title}</p>
      <p className={EMPTY_HINT_CLASS}>{state.hint}</p>
      <div className={EMPTY_ACTIONS_CLASS}>
        {state.actions.map((action) => (
          <Button
            className={getEmptyActionClassName(action.primary)}
            type="button"
            onClick={() => onAction?.(action.action)}
            key={action.action}
            unstyled
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function getEmptyActionClassName(primary = false) {
  return primary ? `${EMPTY_ACTION_CLASS} ${EMPTY_PRIMARY_ACTION_CLASS}` : EMPTY_ACTION_CLASS
}
