import { Button } from '../../ui/base/Button'
import { Input } from '../../ui/base/Input'
import { Select, type SelectOption } from '../../ui/base/Select'
import { handleAiResultsFilterChange } from '../options-controller'
import { AI_ANALYSIS_SMALL_BUTTON_CLASS } from './ai-analysis-classes.js'
import { useAiAnalysisResultsFilter } from './ai-analysis-status-store.js'

const resultOptions: SelectOption[] = [
  { value: 'all', label: '全部结果' },
  { value: 'suggested', label: '建议改名' },
  { value: 'manual_review', label: '待人工确认' },
  { value: 'unchanged', label: '无需改名' },
  { value: 'failed', label: '失败' }
]

const AI_RESULTS_FILTER_ROW_CLASS =
  'mt-[14px] min-w-0'
const AI_RESULTS_FILTER_ACTIONS_CLASS =
  'grid w-full min-w-0 grid-cols-[minmax(260px,1fr)_minmax(220px,242px)_auto] items-end gap-2.5 max-[760px]:grid-cols-1'
const AI_RESULTS_FILTER_FIELD_CLASS =
  'grid min-w-0 gap-1.5'
const AI_RESULTS_FILTER_LABEL_CLASS =
  'text-xs font-medium leading-none text-ds-text-secondary'
const AI_RESULTS_FILTER_QUERY_CLASS =
  'h-[42px] min-h-[42px] w-full rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3.5 font-[inherit] text-sm font-medium leading-[42px] text-ds-text-primary outline-none shadow-none placeholder:text-[rgba(255,255,255,0.58)] focus:border-ds-border focus:bg-ds-surface-2 focus:outline focus:outline-1 focus:outline-offset-2 focus:outline-ds-focus'
const AI_RESULTS_FILTER_SELECT_CLASS = 'w-full'
const AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS = 'min-h-[42px] w-full'
const AI_RESULTS_FILTER_CLEAR_CLASS =
  `${AI_ANALYSIS_SMALL_BUTTON_CLASS} h-[42px] self-end whitespace-nowrap px-3.5 max-[760px]:w-full`

export function AiAnalysisResultsFilter() {
  const state = useAiAnalysisResultsFilter()

  return (
    <div className={AI_RESULTS_FILTER_ROW_CLASS}>
      <div className={AI_RESULTS_FILTER_ACTIONS_CLASS}>
        <label className={AI_RESULTS_FILTER_FIELD_CLASS} htmlFor="ai-analysis-results-filter-query">
          <span className={AI_RESULTS_FILTER_LABEL_CLASS}>文件夹或域名</span>
          <Input
            id="ai-analysis-results-filter-query"
            className={AI_RESULTS_FILTER_QUERY_CLASS}
            type="search"
            spellCheck={false}
            placeholder="筛选文件夹或域名"
            aria-label="筛选书签智能分析结果"
            value={state.query}
            onValueChange={(value) => handleAiResultsFilterChange({
              action: 'change',
              key: 'query',
              value
            })}
            unstyled
          />
        </label>
        <Select
          ariaLabel="按结果筛选书签智能分析结果"
          className={AI_RESULTS_FILTER_SELECT_CLASS}
          label="结果"
          options={resultOptions}
          triggerClassName={AI_RESULTS_FILTER_SELECT_TRIGGER_CLASS}
          value={state.status}
          onValueChange={(value) => handleAiResultsFilterChange({
            action: 'change',
            key: 'status',
            value: value || 'all'
          })}
        />
        <Button
          className={AI_RESULTS_FILTER_CLEAR_CLASS}
          size="sm"
          type="button"
          variant="secondary"
          aria-label="清空书签智能分析筛选条件"
          disabled={state.clearDisabled}
          focusableWhenDisabled={state.clearDisabled}
          onClick={() => handleAiResultsFilterChange({ action: 'clear' })}
        >
          清空筛选
        </Button>
      </div>
    </div>
  )
}
