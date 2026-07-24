import {
  type AiAnalysisDecisionMetricsState,
  useAiAnalysisDecisionMetrics
} from './ai-analysis-status-store.js'
import { AI_ANALYSIS_METRIC_LABEL_CLASS } from './ai-analysis-classes.js'

const metrics: Array<{
  key: keyof AiAnalysisDecisionMetricsState
  label: string
}> = [
  { key: 'eligible', label: '可处理' },
  { key: 'suggested', label: '建议改名' },
  { key: 'manualReview', label: '待确认' },
  { key: 'unchanged', label: '无需改名' },
  { key: 'failed', label: '失败' }
]

const AI_ANALYSIS_DECISION_CLASS =
  'mt-3 grid grid-cols-[minmax(150px,0.7fr)_minmax(0,2fr)] gap-4 rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-4 max-[760px]:grid-cols-1'
const AI_ANALYSIS_PRIMARY_CLASS = 'grid content-center gap-1 border-r border-ds-border-subtle pr-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3 max-[760px]:pr-0'
const AI_ANALYSIS_PRIMARY_VALUE_CLASS = 'text-[28px] font-[650] leading-none tracking-[-0.03em] text-ds-text-primary tabular-nums'
const AI_ANALYSIS_SECONDARY_CLASS = 'grid grid-cols-4 gap-x-5 gap-y-2 max-[980px]:grid-cols-2 max-[520px]:grid-cols-1'
const AI_ANALYSIS_SECONDARY_ITEM_CLASS = 'flex min-w-0 items-baseline justify-between gap-3 border-b border-ds-border-subtle py-1.5'
const AI_ANALYSIS_SECONDARY_VALUE_CLASS = 'text-sm font-semibold text-ds-text-primary tabular-nums'

export function AiAnalysisDecisionMetrics() {
  const state = useAiAnalysisDecisionMetrics()

  return (
    <div className={AI_ANALYSIS_DECISION_CLASS}>
      <div className={AI_ANALYSIS_PRIMARY_CLASS}>
        <span className={AI_ANALYSIS_METRIC_LABEL_CLASS}>{metrics[0].label}</span>
        <strong className={AI_ANALYSIS_PRIMARY_VALUE_CLASS}>{state.eligible}</strong>
      </div>
      <dl className={AI_ANALYSIS_SECONDARY_CLASS}>
        {metrics.slice(1).map((metric) => (
          <div className={AI_ANALYSIS_SECONDARY_ITEM_CLASS} key={metric.key}>
            <dt className={AI_ANALYSIS_METRIC_LABEL_CLASS}>{metric.label}</dt>
            <dd className={AI_ANALYSIS_SECONDARY_VALUE_CLASS}>{state[metric.key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
