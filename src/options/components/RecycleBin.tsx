import { displayUrl } from '../../shared/text.js'
import { Button } from '../../ui/base/Button'
import { CheckboxControl } from '../../ui/base/Checkbox'
import { handleRecycleAction } from '../options-controller'
import { formatDateTime } from '../shared-options/utils.js'
import { OPTION_RESULT_CHECKBOX_CLASS } from './option-layout-classes.js'
import { OptionEmptyState } from './OptionEmptyState.js'
import { useRecycleBinState } from './recycle-bin-store.js'
import type { RecycleEntryViewModel } from './recycle-bin-types.js'

const RECYCLE_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const RECYCLE_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] [transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background-color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:border-ds-border-hover hover:bg-ds-hover'
const RECYCLE_CARD_SELECTED_CLASS = 'border-ds-border-hover bg-ds-selected'
const RECYCLE_CARD_HEAD_CLASS =
  'flex min-w-0 items-start justify-between gap-3 max-[760px]:flex-col'
const RECYCLE_CARD_HEAD_LEFT_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'
const RECYCLE_CHECK_CLASS =
  'inline-flex items-center gap-2 text-xs font-semibold text-ds-text-secondary'
const RECYCLE_CARD_ACTIONS_CLASS = 'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const RECYCLE_CARD_ACTION_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-ds-text-disabled [transition:color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:text-ds-text-disabled disabled:focus-visible:text-ds-text-disabled data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[disabled]:hover:text-ds-text-disabled data-[disabled]:focus-visible:text-ds-text-disabled'
const RECYCLE_CARD_DANGER_ACTION_CLASS = 'text-ds-danger-text hover:text-ds-danger-text focus-visible:text-ds-danger-text'
const RECYCLE_CARD_COPY_CLASS = 'mt-3 min-w-0'
const RECYCLE_CARD_TITLE_CLASS =
  'block min-w-0 text-[15px] font-semibold leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
const RECYCLE_CARD_URL_CLASS =
  'mt-[7px] inline-block text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const RECYCLE_CARD_DETAIL_CLASS =
  'mt-[7px] text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'
const RECYCLE_CARD_PATH_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-ds-text-disabled [overflow-wrap:anywhere] [word-break:break-word]'

export function RecycleBin() {
  const state = useRecycleBinState()

  return (
    <div className={RECYCLE_RESULTS_LIST_CLASS}>
      {state.entries.length ? (
        state.entries.map((entry) => (
          <RecycleEntryCard
            disabled={state.disabled}
            entry={entry}
            key={entry.recycleId}
            selected={state.selectedIds.has(String(entry.recycleId))}
          />
        ))
      ) : (
        <OptionEmptyState
          title="回收站为空"
          description="各清理功能删除的书签会先进入这里，恢复时尽量放回原文件夹。"
        />
      )}
    </div>
  )
}

function RecycleEntryCard({
  disabled,
  entry,
  selected
}: {
  disabled: boolean
  entry: RecycleEntryViewModel
  selected: boolean
}) {
  const selectionLabel = getRecycleEntryActionLabel('选择回收站书签', entry)
  const restoreLabel = getRecycleEntryActionLabel('恢复书签', entry)
  const clearLabel = getRecycleEntryActionLabel('清除回收站记录', entry)

  return (
    <article
      className={[
        RECYCLE_CARD_CLASS,
        selected ? RECYCLE_CARD_SELECTED_CLASS : ''
      ].filter(Boolean).join(' ')}
    >
      <div className={RECYCLE_CARD_HEAD_CLASS}>
        <div className={RECYCLE_CARD_HEAD_LEFT_CLASS}>
          <label className={RECYCLE_CHECK_CLASS} htmlFor={`recycle-entry-${entry.recycleId}`}>
            <CheckboxControl
              id={`recycle-entry-${entry.recycleId}`}
              aria-label={selectionLabel}
              checked={selected}
              className={OPTION_RESULT_CHECKBOX_CLASS}
              disabled={disabled}
              onCheckedChange={(checked) => handleRecycleAction({
                action: 'toggle-entry',
                checked,
                recycleId: entry.recycleId
              })}
              unstyled
            />
            <span>选择</span>
          </label>
        </div>
        <div className={RECYCLE_CARD_ACTIONS_CLASS}>
          <Button
            className={RECYCLE_CARD_ACTION_CLASS}
            type="button"
            aria-label={restoreLabel}
            disabled={disabled}
            onClick={() => handleRecycleAction({
              action: 'restore-entry',
              recycleId: entry.recycleId
            })}
            unstyled
          >
            恢复书签
          </Button>
          <Button
            className={[RECYCLE_CARD_ACTION_CLASS, RECYCLE_CARD_DANGER_ACTION_CLASS].join(' ')}
            type="button"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={() => handleRecycleAction({
              action: 'clear-entry',
              recycleId: entry.recycleId
            })}
            unstyled
          >
            清除
          </Button>
        </div>
      </div>
      <div className={RECYCLE_CARD_COPY_CLASS}>
        <strong className={RECYCLE_CARD_TITLE_CLASS}>{entry.title || '未命名书签'}</strong>
        <div className={RECYCLE_CARD_URL_CLASS}>{displayUrl(entry.url)}</div>
        <div className={RECYCLE_CARD_DETAIL_CLASS}>
          来源：{entry.source || '删除'} · 删除于 {formatDateTime(entry.deletedAt)}
        </div>
        <div className={RECYCLE_CARD_PATH_CLASS} title={entry.path || '未归档路径'}>
          {entry.path || '未归档路径'}
        </div>
      </div>
    </article>
  )
}

function getRecycleEntryActionLabel(action: string, entry: RecycleEntryViewModel): string {
  const title = String(entry?.title || displayUrl(entry?.url) || '未命名书签')
    .replace(/\s+/g, ' ')
    .trim()
  const safeTitle = title.length > 48 ? `${title.slice(0, 47).trim()}...` : title

  return `${action}：${safeTitle || '未命名书签'}`
}
