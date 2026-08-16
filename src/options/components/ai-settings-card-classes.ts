import {
  OPTION_SWITCH_CONTROL_CLASS,
  OPTION_SWITCH_THUMB_CLASS,
  OPTION_SWITCH_WRAP_CLASS
} from '../../ui/switch-classes'

export const AI_SETTINGS_CARD_CLASS =
  'options-interactive-surface mt-5 overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-0 text-ds-text-primary shadow-none'

export const AI_SETTINGS_NARROW_CARD_CLASS =
  'options-interactive-surface mt-5 overflow-hidden rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-0 text-ds-text-primary shadow-none'

export const AI_SETTINGS_HEADER_CLASS =
  'mb-0 flex min-w-0 items-start justify-between gap-3 border-b border-ds-border-subtle p-[14px_16px] max-[760px]:flex-col'

export const AI_SETTINGS_BODY_CLASS = 'mt-0 flex flex-col divide-y divide-ds-border-subtle'

export const AI_SETTINGS_TITLE_CLASS = 'm-0 text-base font-bold leading-[1.35] text-ds-text-primary'

export const AI_SETTINGS_SUBTITLE_CLASS =
  'mt-1.5 mb-0 text-[13px] leading-[1.7] text-ds-text-disabled'

export const AI_SETTINGS_STATUS_BADGE_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border border-ds-hover bg-ds-surface-2 px-2.5 text-[11px] font-semibold leading-none tracking-[0] text-ds-text-muted'

export const AI_SETTINGS_INLINE_STATUS_CLASS =
  'inline-flex min-h-6 w-fit flex-none items-center justify-center rounded-full border px-[9px] text-[10px] font-semibold leading-none tracking-[0]'

export const AI_SETTINGS_STATUS_TONE_CLASS = {
  muted: 'border-ds-hover bg-ds-surface-2 text-ds-text-muted',
  success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
  warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning'
} as const

export const AI_SETTINGS_ROW_CLASS =
  'grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] px-4 py-3 max-[420px]:gap-3 max-[420px]:px-3.5'

export const AI_SETTINGS_COPY_CLASS = 'min-w-0'

export const AI_SETTINGS_TITLE_ROW_CLASS = 'flex min-w-0 flex-wrap items-center gap-2.5'

export const AI_SETTINGS_ROW_TITLE_CLASS =
  'block text-sm font-bold leading-[1.4] text-ds-text-primary'

export const AI_SETTINGS_SECONDARY_CLASS =
  'mt-[3px] block text-[13px] leading-[1.65] text-ds-text-disabled'

export const AI_SETTINGS_SWITCH_WRAP_CLASS = OPTION_SWITCH_WRAP_CLASS

export const AI_SETTINGS_SWITCH_CONTROL_CLASS = OPTION_SWITCH_CONTROL_CLASS

export const AI_SETTINGS_SWITCH_THUMB_CLASS = OPTION_SWITCH_THUMB_CLASS

export const AI_SETTINGS_FIELD_TIP_CLASS =
  'm-0 px-4 py-3 text-[13px] leading-[1.65] text-ds-text-muted'

export const AI_SETTINGS_LOADING_BADGE_CLASS =
  'inline-flex h-2.5 w-14 flex-none rounded-full bg-ds-text-primary/[0.055]'

export const AI_SETTINGS_LOADING_SWITCH_CLASS =
  'absolute inset-0 rounded-full border border-ds-border-subtle bg-ds-surface-3/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.015)]'

export const AI_SETTINGS_READY_BODY_CLASS = 'options-settings-ready-body'

export const AI_SETTINGS_HELP_TOOLTIP_CLASS =
  'ml-1.5 inline-flex size-4 cursor-help items-center justify-center rounded-full border border-ds-hover bg-transparent p-0 text-[11px] leading-none text-ds-text-secondary align-[1px] shadow-none hover:border-ds-border hover:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-focus'

export const AI_SETTINGS_HELP_TOOLTIP_POPUP_CLASS =
  'z-[80] w-[min(300px,calc(100vw-48px))] rounded-ds-sm border border-ds-hover bg-ds-app p-[10px_12px] text-left text-xs font-medium leading-[1.6] text-ds-text-primary [filter:var(--ds-filter-popover)]'
