export const AI_ANALYSIS_RESULTS_GROUP_CLASS =
  'mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] max-[760px]:p-4'

export const AI_ANALYSIS_SELECTION_GROUP_CLASS =
  't-panel-slide mt-7 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] [--panel-translate-y:12px] max-[760px]:mt-5 max-[760px]:p-4'

export const AI_ANALYSIS_PRIMARY_BUTTON_CLASS =
  'font-bold active:scale-[0.985]'

export const AI_ANALYSIS_SMALL_BUTTON_CLASS =
  'font-semibold'

export const AI_ANALYSIS_CONFIRM_BUTTON_ACTIVE_CLASS =
  'border-ds-success/40 bg-ds-success-soft text-ds-success-text hover:border-ds-success hover:bg-ds-success-soft focus-visible:border-ds-success focus-visible:bg-ds-success-soft'

export const AI_ANALYSIS_CONFIRM_ICON_CLASS =
  'mr-1 inline-block font-extrabold tracking-[0] text-ds-success-text'

export const AI_ANALYSIS_METRIC_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'

export const AI_ANALYSIS_STATUS_BADGE_CLASS =
  'inline-flex min-h-7 flex-none items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'

const AI_ANALYSIS_STATUS_TONE_CLASS: Record<string, string> = {
  danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text',
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  ready: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
}

export const AI_ANALYSIS_CHECKBOX_CLASS =
  'inline-grid size-[15px] cursor-pointer place-items-center rounded-ds-sm border border-ds-border-hover bg-ds-surface-2 text-ds-text-inverse outline-none data-[checked]:border-ds-text-primary data-[checked]:bg-ds-text-primary data-[disabled]:cursor-default data-[disabled]:opacity-55 focus-visible:shadow-ds-focus'

export function aiAnalysisToneClass(tone: string | undefined) {
  return AI_ANALYSIS_STATUS_TONE_CLASS[tone || 'muted'] || AI_ANALYSIS_STATUS_TONE_CLASS.muted
}
