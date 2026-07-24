import { useAiAnalysisStatus } from './ai-analysis-status-store.js'

const AI_ANALYSIS_STATUS_CARD_CLASS =
  'rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px] max-[760px]:px-4'
const AI_ANALYSIS_STATUS_META_CLASS =
  'flex flex-wrap items-center justify-between gap-3 max-[760px]:flex-col max-[760px]:items-start'
const AI_ANALYSIS_STATUS_TITLE_CLASS =
  'block text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'
const AI_ANALYSIS_STATUS_COPY_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'
const AI_ANALYSIS_STATUS_BADGE_BASE_CLASS =
  'inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'
const AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}

export function AiAnalysisStatusCard() {
  const state = useAiAnalysisStatus()
  const isError = state.badgeTone === 'danger'
  const badgeClassName = [
    AI_ANALYSIS_STATUS_BADGE_BASE_CLASS,
    AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES[state.badgeTone] || AI_ANALYSIS_STATUS_BADGE_TONE_CLASSES.muted
  ].join(' ')

  return (
    <div
      className={AI_ANALYSIS_STATUS_CARD_CLASS}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className={AI_ANALYSIS_STATUS_META_CLASS}>
        <strong className={AI_ANALYSIS_STATUS_TITLE_CLASS}>执行方式</strong>
        <span className={badgeClassName}>
          {state.badgeText}
        </span>
      </div>
      <p className={AI_ANALYSIS_STATUS_COPY_CLASS}>
        {state.statusCopy}
      </p>
    </div>
  )
}
