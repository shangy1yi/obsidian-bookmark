import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { displayUrl } from '../../shared/text.js'
import { AiClassificationResult } from '../../ui/ai/AiClassificationResult'
import { Button } from '../../ui/base/Button'
import { CheckboxControl } from '../../ui/base/Checkbox'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import {
  AI_ANALYSIS_CHECKBOX_CLASS,
  AI_ANALYSIS_CONFIRM_ICON_CLASS,
  AI_ANALYSIS_STATUS_BADGE_CLASS,
  aiAnalysisToneClass
} from './ai-analysis-classes.js'
import { handleAiAnalysisResultAction } from '../options-controller'
import { useAiAnalysisResults } from './ai-analysis-status-store.js'
import type { AiNamingResultCardViewModel } from './AiAnalysisResultsTypes.js'

const AI_RESULTS_LIST_CLASS = 'mt-4 flex flex-col gap-3'
const AI_RESULTS_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[18px_16px] text-[13px] leading-[1.7] text-ds-text-secondary'
const AI_RESULT_CARD_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] [transition:border-color_var(--ds-motion-standard)_var(--ds-ease-standard),background-color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:border-ds-border-hover hover:bg-ds-hover'
const AI_RESULT_CARD_SELECTED_CLASS = 'border-ds-border-hover bg-ds-selected'
const AI_RESULT_HEAD_LEFT_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'
const AI_RESULT_CHECK_CLASS =
  'inline-flex items-center gap-2 text-xs font-semibold text-ds-text-secondary'
const AI_RESULT_ACTIONS_CLASS = 'flex min-w-0 flex-wrap items-center justify-end gap-2.5'
const AI_RESULT_ACTION_CLASS =
  'border-0 bg-transparent p-0 font-[inherit] text-xs font-semibold text-ds-text-disabled [transition:color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:text-ds-text-disabled disabled:focus-visible:text-ds-text-disabled data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[disabled]:hover:text-ds-text-disabled data-[disabled]:focus-visible:text-ds-text-disabled'
const AI_RESULT_LINK_CLASS =
  'border-0 bg-transparent p-0 text-xs font-semibold text-ds-text-disabled no-underline [transition:color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary'
const AI_RESULT_CONFIRM_ACTION_CLASS =
  'text-ds-success-text hover:text-ds-success-text focus-visible:text-ds-success-text'
const AI_RESULT_COPY_CLASS = 'mt-3 min-w-0'
const AI_RESULT_CURRENT_TITLE_CLASS =
  'block min-w-0 text-[13px] font-semibold leading-[1.4] text-ds-text-disabled [overflow-wrap:anywhere]'
const AI_RESULT_SUGGESTED_TITLE_CLASS =
  'mt-2.5 mb-0 text-base font-semibold leading-[1.45] tracking-[0] text-ds-text-primary'
const AI_RESULT_ERROR_CLASS =
  'mt-2.5 mb-0 text-[13px] font-medium leading-[1.6] text-ds-danger-text [overflow-wrap:anywhere] [word-break:break-word]'
const AI_RESULT_META_CLASS =
  'mt-2.5 flex flex-wrap gap-y-1.5 gap-x-3 text-xs font-semibold leading-normal text-ds-text-disabled'
const AI_RESULT_META_ITEM_CLASS = 'min-w-0 [overflow-wrap:anywhere]'
const AI_RESULT_FOLDER_CLASS =
  'mt-[9px] flex flex-wrap items-center gap-2.5 text-[13px] leading-normal text-ds-text-secondary'
const AI_RESULT_FOLDER_COPY_CLASS = 'inline-flex min-w-0 flex-wrap items-center gap-2'
const AI_RESULT_FOLDER_LABEL_CLASS =
  'flex-[0_0_auto] text-xs font-medium text-ds-text-muted'
const AI_RESULT_FOLDER_VALUE_CLASS =
  'min-w-0 text-[13px] font-semibold text-ds-text-primary [overflow-wrap:anywhere]'
const AI_RESULT_MOVE_ACTION_CLASS = 'flex-[0_0_auto]'
const AI_RESULT_TAG_SHELL_CLASS = 'mt-3'
const AI_RESULT_TAG_LIST_CLASS =
  'flex max-h-[calc((12px*1.35+6px)*2+6px)] flex-wrap gap-1.5 overflow-hidden'
const AI_RESULT_TAG_LIST_EXPANDED_CLASS = 'max-h-none'
const AI_RESULT_TAG_CLASS =
  'max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-ds-border bg-ds-surface-2 px-2 py-[3px] text-xs font-semibold leading-[1.35] text-ds-text-secondary'
const AI_RESULT_TAG_TOGGLE_CLASS =
  'mt-2 border-0 bg-transparent p-0 text-xs font-semibold text-ds-text-disabled [transition:color_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary'
const AI_RESULT_DETAILS_CLASS = 'mt-3 border-t border-white/10 pt-2.5'
const AI_RESULT_SUMMARY_CLASS =
  'inline-flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-ds-text-disabled after:block after:size-[7px] after:translate-y-[-1px] after:rotate-45 after:border-r-[1.5px] after:border-b-[1.5px] after:border-current after:content-[""] after:[transition:transform_var(--ds-motion-standard)_var(--ds-ease-standard)] hover:text-ds-text-primary focus-visible:text-ds-text-primary data-[panel-open]:after:translate-y-0.5 data-[panel-open]:after:rotate-[225deg]'
const AI_RESULT_DETAIL_LIST_CLASS = 'mt-2'
const AI_RESULT_DETAIL_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.6] text-ds-text-secondary [overflow-wrap:anywhere] [word-break:break-word]'

export function AiAnalysisResults() {
  const state = useAiAnalysisResults()

  if (!state.results.length) {
    return (
      <div className={AI_RESULTS_LIST_CLASS}>
        <div className={AI_RESULTS_EMPTY_CLASS}>{state.emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={AI_RESULTS_LIST_CLASS}>
      {state.results.map((result) => (
        <AiNamingResultCard key={result.id} result={result} />
      ))}
    </div>
  )
}

function AiNamingResultCard({ result }: { result: AiNamingResultCardViewModel }) {
  const title = useMemo(() => (
    <div className={AI_RESULT_HEAD_LEFT_CLASS}>
      <label className={AI_RESULT_CHECK_CLASS} htmlFor={`ai-analysis-result-${result.id}`}>
        <CheckboxControl
          id={`ai-analysis-result-${result.id}`}
          aria-label={result.selectionLabel}
          className={AI_ANALYSIS_CHECKBOX_CLASS}
          checked={result.selectable && result.isSelected}
          disabled={!result.selectable || result.interactionLocked}
          onCheckedChange={(checked) => handleAiAnalysisResultAction({
            action: 'select',
            checked,
            id: result.id
          })}
          unstyled
        />
        <span>{result.selectable ? '选择' : '不可直接应用'}</span>
      </label>
      <span className={`${AI_ANALYSIS_STATUS_BADGE_CLASS} ${aiAnalysisToneClass(result.badgeTone)}`}>
        {result.statusLabel}
      </span>
    </div>
  ), [
    result.badgeTone,
    result.id,
    result.interactionLocked,
    result.isSelected,
    result.selectable,
    result.selectionLabel,
    result.statusLabel
  ])
  const confidence = useMemo(() => (
    <>
      {result.confidenceLabel}
      {result.confidenceScorePercent !== null ? ` · ${result.confidenceScorePercent}%` : ''}
    </>
  ), [result.confidenceLabel, result.confidenceScorePercent])
  const actions = useMemo(() => (
    <div className={AI_RESULT_ACTIONS_CLASS}>
      <a
        className={AI_RESULT_LINK_CLASS}
        href={result.url}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={result.openLabel}
      >
        打开页面
      </a>
      {result.selectable ? (
        <>
          <Button
            className={AI_RESULT_ACTION_CLASS}
            type="button"
            aria-label={result.applyLabel}
            disabled={result.interactionLocked}
            onClick={() => handleAiAnalysisResultAction({ action: 'apply', id: result.id })}
            unstyled
          >
            应用建议
          </Button>
          <Button
            className={AI_RESULT_ACTION_CLASS}
            type="button"
            aria-label={result.rejectLabel}
            disabled={result.interactionLocked}
            onClick={() => handleAiAnalysisResultAction({ action: 'reject', id: result.id })}
            unstyled
          >
            拒绝建议
          </Button>
        </>
      ) : null}
    </div>
  ), [
    result.applyLabel,
    result.id,
    result.interactionLocked,
    result.openLabel,
    result.rejectLabel,
    result.selectable,
    result.url
  ])

  return (
    <AiClassificationResult
      className={[
        AI_RESULT_CARD_CLASS,
        result.isSelected ? AI_RESULT_CARD_SELECTED_CLASS : ''
      ].filter(Boolean).join(' ')}
      title={title}
      confidence={confidence}
      actions={actions}
      bodyClassName={AI_RESULT_COPY_CLASS}
    >
      <strong className={AI_RESULT_CURRENT_TITLE_CLASS}>{result.currentTitle || '未命名书签'}</strong>
      <p className={AI_RESULT_SUGGESTED_TITLE_CLASS}>{result.suggestedTitle || '未生成建议标题'}</p>
      {result.errorMessage ? (
        <p className={AI_RESULT_ERROR_CLASS}>
          {result.errorMessage}
        </p>
      ) : null}
      <div className={AI_RESULT_META_CLASS}>
        <span className={AI_RESULT_META_ITEM_CLASS}>{displayUrl(result.url)}</span>
        <span className={AI_RESULT_META_ITEM_CLASS}>{result.path || '未归档路径'}</span>
      </div>
      <SuggestedFolder result={result} />
      <TagPreview result={result} />
      <ResultDetails result={result} />
    </AiClassificationResult>
  )
}

function SuggestedFolder({ result }: { result: AiNamingResultCardViewModel }) {
  if (!result.suggestedFolder) {
    return null
  }

  return (
    <div className={AI_RESULT_FOLDER_CLASS}>
      <div className={AI_RESULT_FOLDER_COPY_CLASS}>
        <span className={AI_RESULT_FOLDER_LABEL_CLASS}>推荐文件夹</span>
        <strong className={AI_RESULT_FOLDER_VALUE_CLASS}>{result.suggestedFolder}</strong>
      </div>
      {result.canMoveToSuggestedFolder ? (
        <Button
          className={[
            AI_RESULT_ACTION_CLASS,
            AI_RESULT_MOVE_ACTION_CLASS,
            result.pendingMove ? AI_RESULT_CONFIRM_ACTION_CLASS : ''
          ].filter(Boolean).join(' ')}
          type="button"
          title={result.pendingMove
            ? `再次点击，移动到 ${result.suggestedFolder}`
            : `移动到 ${result.suggestedFolder}`}
          aria-label={result.moveLabel}
          disabled={result.interactionLocked}
          onClick={() => handleAiAnalysisResultAction({ action: 'move-recommended', id: result.id })}
          unstyled
        >
          {result.pendingMove ? (
            <>
              <span className={AI_ANALYSIS_CONFIRM_ICON_CLASS} aria-hidden="true">✓✓</span> 确认移动
            </>
          ) : (
            '移动至推荐文件夹'
          )}
        </Button>
      ) : null}
    </div>
  )
}

function TagPreview({ result }: { result: AiNamingResultCardViewModel }) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) {
      setHasOverflow(false)
      return undefined
    }

    const updateOverflow = () => {
      setHasOverflow(list.scrollHeight > list.clientHeight + 1)
    }

    updateOverflow()
    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(updateOverflow)
    observer.observe(list)
    return () => observer.disconnect()
  }, [result.id, result.tags, result.expandedTags])

  if (!result.tags.length) {
    return null
  }

  const showToggle = result.expandedTags || hasOverflow

  return (
    <div className={AI_RESULT_TAG_SHELL_CLASS}>
      <div
        ref={listRef}
        className={[
          AI_RESULT_TAG_LIST_CLASS,
          result.expandedTags ? AI_RESULT_TAG_LIST_EXPANDED_CLASS : ''
        ].filter(Boolean).join(' ')}
        aria-label="标签预览"
      >
        {result.tags.map((tag) => (
          <span className={AI_RESULT_TAG_CLASS} key={`${result.id}:${tag}`}>
            {tag}
          </span>
        ))}
      </div>
      {showToggle ? (
        <Button
          className={AI_RESULT_TAG_TOGGLE_CLASS}
          type="button"
          aria-expanded={result.expandedTags ? 'true' : 'false'}
          onClick={() => handleAiAnalysisResultAction({ action: 'toggle-tags', id: result.id })}
          unstyled
        >
          {result.expandedTags ? '收起标签' : '展开标签'}
        </Button>
      ) : null}
    </div>
  )
}

function ResultDetails({ result }: { result: AiNamingResultCardViewModel }) {
  if (!result.detailRows.length) {
    return null
  }

  return (
    <CollapsibleRoot className={AI_RESULT_DETAILS_CLASS}>
      <CollapsibleTrigger className={AI_RESULT_SUMMARY_CLASS}>分析细节</CollapsibleTrigger>
      <CollapsiblePanel className={AI_RESULT_DETAIL_LIST_CLASS}>
        {result.detailRows.map((detail) => (
          <p className={AI_RESULT_DETAIL_CLASS} key={`${result.id}:${detail}`}>
            {detail}
          </p>
        ))}
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}
