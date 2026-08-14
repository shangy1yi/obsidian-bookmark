import { useMemo, type ReactNode } from 'react'
import { AiThinkingOrb } from '../../ui/ai/AiThinkingOrb'
import { AiTaskStatus } from '../../ui/ai/AiTaskStatus'
import {
  SHEEN_PROGRESS_BAR_CLASS,
  SHEEN_PROGRESS_TRACK_CLASS,
  getSheenProgressBarStyle,
  getSheenProgressTrackStyle
} from '../../ui/base/sheen-progress'
import {
  useAiAnalysisDuration,
  useAiAnalysisProgress
} from './ai-analysis-status-store.js'
import { OPTION_VALUE_CLASS } from './option-layout-classes.js'

const OPTIONS_PROGRESS_TRACK_CLASS = `mt-[14px] ${SHEEN_PROGRESS_TRACK_CLASS}`
const AI_ANALYSIS_DECISION_PANEL_CLASS =
  'mt-[18px] border-ds-border-subtle bg-ds-surface-1'
const AI_ANALYSIS_PROGRESS_COPY_CLASS =
  'mt-0 mb-0 text-[13px] leading-[1.55] text-ds-text-muted'
const AI_ANALYSIS_BUSY_LABEL_CLASS =
  'inline-flex min-h-5 min-w-0 max-w-full items-center gap-2 align-middle'

export function AiAnalysisProgressPanel({ children }: { children: ReactNode }) {
  const state = useAiAnalysisProgress()
  const { durationLabel } = useAiAnalysisDuration()
  // 这里的进度是真值（已处理 / 总数），不套 popup 那套面向未知耗时的缓动。
  const progressPercent = state.progressMax > 0
    ? (state.progressValue / state.progressMax) * 100
    : 0
  const title = useMemo(() => (
    <strong>
      {state.busy ? (
        <span className={AI_ANALYSIS_BUSY_LABEL_CLASS}>
          <AiThinkingOrb state="composing" size={20} />
          <span>{state.progressLabel}</span>
        </span>
      ) : (
        state.progressLabel
      )}
    </strong>
  ), [state.busy, state.progressLabel])
  const description = useMemo(() => (
    <p className={AI_ANALYSIS_PROGRESS_COPY_CLASS}>
      {state.progressCopy}
    </p>
  ), [state.progressCopy])
  const statusNode = useMemo(() => <span className={OPTION_VALUE_CLASS}>{durationLabel}</span>, [durationLabel])

  return (
    <AiTaskStatus
      status="idle"
      className={AI_ANALYSIS_DECISION_PANEL_CLASS}
      label="执行进度"
      title={title}
      description={description}
      progress={state.progressValue}
      progressAriaLabel="书签智能分析进度"
      progressMax={state.progressMax}
      progressDivisions={state.progressMax}
      progressValueText={state.progressLabel}
      progressClassName={OPTIONS_PROGRESS_TRACK_CLASS}
      progressStyle={getSheenProgressTrackStyle(progressPercent)}
      progressIndicatorClassName={SHEEN_PROGRESS_BAR_CLASS}
      progressIndicatorStyle={getSheenProgressBarStyle(progressPercent)}
      progressUnstyled
      statusNode={statusNode}
      aria-label="书签智能分析决策概览"
    >
      {children}
    </AiTaskStatus>
  )
}
