export const OPTION_PANEL_ENTER_CLASS = [
  '[.options-motion-ready_&:not([hidden])]:transition-[opacity,translate]',
  '[.options-motion-ready_&:not([hidden])]:duration-[var(--panel-open-dur)]',
  '[.options-motion-ready_&:not([hidden])]:ease-[var(--panel-ease)]',
  '[.options-motion-ready_&:not([hidden])]:starting:opacity-0',
  '[.options-motion-ready_&:not([hidden])]:starting:translate-y-[var(--panel-translate-y)]',
  'motion-reduce:[.options-motion-ready_&:not([hidden])]:transition-opacity',
  'motion-reduce:[.options-motion-ready_&:not([hidden])]:duration-[80ms]',
  'motion-reduce:[.options-motion-ready_&:not([hidden])]:starting:translate-y-0'
].join(' ')

export const OPTION_REVEAL_ENTER_CLASS = [
  '[.options-motion-ready_&]:transition-opacity',
  '[.options-motion-ready_&]:duration-ds-standard',
  '[.options-motion-ready_&]:ease-ds-standard',
  '[.options-motion-ready_&]:starting:opacity-0',
  'motion-reduce:[.options-motion-ready_&]:duration-[80ms]'
].join(' ')

export const OPTION_PANEL_BASE_CLASS =
  `mx-auto min-w-0 ${OPTION_PANEL_ENTER_CLASS} max-[920px]:mx-0 max-[920px]:w-full max-[760px]:max-w-full`

const OPTION_PANEL_SURFACE_RESET_CLASS =
  'pt-6 px-0 pb-12 border-0 rounded-none bg-transparent shadow-none'

export const OPTION_PANEL_STANDARD_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,1120px)]`

export const OPTION_PANEL_WIDE_LAYOUT_CLASS =
  `${OPTION_PANEL_BASE_CLASS} w-[min(100%,1880px)]`

export const OPTION_PANEL_CLASS =
  `${OPTION_PANEL_STANDARD_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_WIDE_PANEL_CLASS =
  `${OPTION_PANEL_WIDE_LAYOUT_CLASS} ${OPTION_PANEL_SURFACE_RESET_CLASS}`

export const OPTION_GROUP_CLASS =
  'curator-motion-surface mt-7 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 py-2 max-[760px]:mt-5'

export const OPTION_TOOL_PANEL_CLASS =
  `curator-motion-surface mt-5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px_20px] shadow-none ${OPTION_REVEAL_ENTER_CLASS} max-[760px]:p-4`

export const OPTION_RUN_HEADER_CLASS = [
  'curator-motion-surface mt-6 grid grid-cols-[minmax(220px,0.82fr)_minmax(260px,1fr)_auto] items-stretch gap-3',
  'max-[1180px]:grid-cols-[minmax(0,1fr)_auto]',
  'max-[860px]:grid-cols-1'
].join(' ')

export const OPTION_RUN_CELL_CLASS =
  'curator-motion-surface min-w-0 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[16px_18px] shadow-none max-[760px]:p-4'

export const OPTION_RUN_CELL_COMPACT_CLASS =
  'curator-motion-surface min-w-0 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] shadow-none'

export const OPTION_RUN_CELL_TITLE_CLASS =
  'block text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'

export const OPTION_RUN_CELL_TEXT_CLASS =
  'mt-2 mb-0 text-[13px] leading-[1.55] text-ds-text-secondary'

export const OPTION_RUN_ACTIONS_CLASS =
  'curator-motion-surface flex min-w-0 flex-wrap items-center justify-end gap-2.5 rounded-ds-md border border-ds-border-subtle bg-ds-surface-1 p-[14px_16px] max-[1180px]:justify-start max-[860px]:items-stretch'

export const OPTION_RUN_ACTION_BUTTON_CLASS =
  'max-[860px]:w-full'

export const OPTION_ROW_CLASS = [
  'grid min-h-[66px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px] p-[14px_16px]',
  'border-ds-border-subtle bg-transparent',
  'max-[1180px]:grid-cols-1 max-[1180px]:items-start',
  'max-[760px]:gap-3 max-[760px]:p-4'
].join(' ')

export const OPTION_COPY_CLASS = 'min-w-0 font-[var(--font-sans)]'

export const OPTION_COPY_TITLE_CLASS =
  'm-0 block text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'

export const OPTION_COPY_TEXT_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.65] text-ds-text-muted'

export const OPTION_EMPTY_STATE_CLASS =
  'curator-motion-surface t-stagger rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[18px_20px] text-left shadow-none'

export const OPTION_EMPTY_STATE_TITLE_CLASS =
  'm-0 text-sm font-bold leading-[1.4] text-ds-text-primary'

export const OPTION_EMPTY_STATE_TEXT_CLASS =
  'm-0 mt-2 max-w-[620px] text-[13px] leading-[1.65] text-ds-text-secondary'

export const OPTION_EMPTY_STATE_ACTIONS_CLASS =
  'mt-4 flex flex-wrap items-center gap-2.5'

export const OPTION_PANEL_TITLE_CLASS =
  'm-0 max-w-[780px] text-[clamp(27px,2.2vw,34px)] font-[720] leading-[1.15] tracking-[-0.025em] text-ds-text-primary'

export const OPTION_PANEL_DESCRIPTION_CLASS =
  'mt-[10px] mb-0 max-w-[720px] text-[14px] leading-[1.7] tracking-[0] text-ds-text-secondary'

export const OPTION_PANEL_HEADER_CLASS =
  'mb-1 border-b border-ds-border-subtle pb-6 max-[760px]:pb-5'

export const OPTION_VALUE_CLASS = [
  'inline-flex min-h-5 min-w-0 max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap',
  'font-[var(--font-sans)] text-xs font-medium leading-normal text-ds-text-secondary tabular-nums',
  'max-[760px]:w-fit max-[760px]:whitespace-normal'
].join(' ')

export const OPTION_PAGINATION_CLASS =
  'mt-3.5 flex min-h-8 flex-wrap items-center justify-end gap-2.5 text-[13px] text-ds-text-secondary transition-opacity duration-ds-fast ease-ds-standard motion-reduce:duration-[80ms]'

export const OPTION_PAGINATION_HIDDEN_CLASS =
  'pointer-events-none invisible opacity-0'

export const OPTION_PAGINATION_LABEL_CLASS =
  'font-[var(--font-sans)] text-[13px] font-semibold leading-normal text-ds-text-muted'

export const OPTION_PAGINATION_RANGE_VALUE_CLASS =
  'options-stable-number inline-block min-w-[13ch] text-right'

export const OPTION_PAGINATION_PAGE_VALUE_CLASS =
  'options-stable-number inline-block min-w-[7ch] text-center'

export const OPTION_RESULT_CHECKBOX_CLASS =
  'inline-grid size-[15px] cursor-pointer place-items-center rounded-ds-sm border border-ds-border-hover bg-ds-surface-2 text-ds-text-inverse outline-none data-[checked]:border-ds-text-primary data-[checked]:bg-ds-text-primary data-[disabled]:cursor-default data-[disabled]:opacity-55 focus-visible:shadow-ds-focus'

export const SCOPE_PICKER_TRIGGER_CLASS = [
  'curator-motion-chip relative inline-flex min-h-9 min-w-[220px] max-w-full items-center justify-start gap-2 overflow-visible',
  'rounded-ds-sm border border-ds-border bg-ds-surface-2 p-[0_12px]',
  'font-[var(--font-sans)] text-[13px] font-semibold leading-[1.25] text-ds-text-primary text-left',
  'transition-[background-color,border-color,color,transform,opacity] duration-ds-standard ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-focus focus-visible:bg-ds-surface-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ds-focus focus-visible:shadow-none',
  'active:scale-[0.985] disabled:cursor-default disabled:opacity-55 data-disabled:cursor-default data-disabled:opacity-55',
  'max-[1180px]:w-full max-[1180px]:min-w-0'
].join(' ')

export const SCOPE_PICKER_LABEL_CLASS =
  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.25]'
