import { OPTIONS_REDUCED_MOTION_SURFACE_CLASS } from './options-motion-classes.js'

export const OPTIONS_MODAL_BACKDROP_CLASS =
  `options-modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-[14px] ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

const OPTIONS_MODAL_PANEL_BASE_CLASS =
  `options-modal-panel pointer-events-auto relative z-10 w-full max-h-[calc(100vh-40px)] min-w-0 overflow-auto rounded-ds-lg border border-ds-border-subtle p-[24px_24px_22px] text-ds-text-primary shadow-none outline-none max-[640px]:p-5 ${OPTIONS_REDUCED_MOTION_SURFACE_CLASS}`

export const OPTIONS_MODAL_PANEL_CLASS =
  `${OPTIONS_MODAL_PANEL_BASE_CLASS} max-w-[420px] bg-ds-app`

export const OPTIONS_MODAL_WIDE_PANEL_CLASS =
  `${OPTIONS_MODAL_PANEL_BASE_CLASS} options-modal-wide-panel max-w-[620px] bg-ds-surface-2`

export const OPTIONS_MODAL_EYEBROW_CLASS =
  'm-0 text-xs font-medium leading-4 text-ds-text-secondary'

export const OPTIONS_MODAL_EYEBROW_TONE_CLASS: Record<string, string> = {
  danger: 'text-ds-danger-text',
  warning: 'text-ds-warning'
}

export const OPTIONS_MODAL_TITLE_CLASS =
  'm-0 mt-2 text-[26px] font-[650] leading-[1.1] tracking-[-0.025em] text-ds-text-primary [overflow-wrap:anywhere] max-[640px]:text-[23px]'

export const OPTIONS_MODAL_COPY_CLASS =
  'm-0 mt-3.5 text-sm leading-[1.75] text-ds-text-secondary [overflow-wrap:anywhere]'

export const OPTIONS_MODAL_ACTIONS_CLASS =
  'mt-[22px] flex flex-wrap items-center justify-end gap-3 max-[640px]:flex-col-reverse max-[640px]:items-stretch'

export const OPTIONS_MODAL_BUTTON_CLASS = 'min-h-9 px-3'

export const OPTIONS_MODAL_PRIMARY_BUTTON_CLASS =
  ''

export const OPTIONS_MODAL_DANGER_BUTTON_CLASS =
  ''

export const OPTIONS_MODAL_SEARCH_CLASS =
  'mt-[18px] grid gap-2'

export const OPTIONS_MODAL_SEARCH_LABEL_CLASS =
  'px-px text-xs font-semibold leading-normal text-ds-text-secondary'

export const OPTIONS_MODAL_SEARCH_INPUT_CLASS =
  'folder-picker-search-input min-h-10 bg-ds-surface-3 placeholder:text-ds-text-disabled focus:bg-ds-surface-3 focus-visible:bg-ds-surface-3'

export const OPTIONS_MODAL_RESULTS_CLASS =
  'mt-3 max-h-[360px] overflow-auto border-y border-ds-border-subtle py-1.5 pr-1 [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]'

export const FOLDER_PICKER_EMPTY_CLASS =
  'grid min-h-[92px] place-items-center rounded-ds-sm px-5 py-5 text-center text-sm leading-[1.6] text-ds-text-muted'

export const FOLDER_PICKER_TREE_ROW_CLASS =
  'relative grid min-h-10 grid-cols-[24px_minmax(0,1fr)] items-center gap-1'

export const FOLDER_PICKER_TOGGLE_CLASS =
  'folder-picker-toggle inline-flex h-8 min-h-8 w-6 min-w-6 items-center justify-center rounded-ds-sm border border-transparent bg-transparent text-ds-text-muted outline-none transition-[background-color,color,transform,opacity] duration-ds-fast ease-ds-standard hover:bg-ds-text-primary/[0.055] hover:text-ds-text-primary focus-visible:bg-ds-text-primary/[0.055] focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.36)] focus-visible:outline-offset-1 active:scale-95 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-20'

export const FOLDER_PICKER_TOGGLE_ICON_CLASS =
  'folder-picker-toggle-icon transition-transform duration-ds-fast ease-ds-standard'

export const FOLDER_PICKER_CARD_CLASS =
  'folder-picker-card grid min-h-10 w-full min-w-0 cursor-pointer grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-ds-sm border border-transparent bg-transparent px-2 py-1.5 text-left font-[inherit] leading-normal text-ds-text-primary shadow-none outline-none transition-[background-color,color,transform] duration-ds-fast ease-ds-standard hover:bg-ds-text-primary/[0.055] focus-visible:bg-ds-text-primary/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.34)] focus-visible:outline-offset-1 active:scale-[0.993] disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50'

export const FOLDER_PICKER_CARD_CURRENT_CLASS =
  'bg-ds-selected'

export const FOLDER_PICKER_ICON_CLASS =
  'h-4 w-4 justify-self-center text-ds-text-muted'

export const FOLDER_PICKER_MAIN_CLASS =
  'grid min-w-0 max-w-full gap-px text-left leading-normal'

export const FOLDER_PICKER_TITLE_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold leading-[1.3] text-ds-text-primary'

export const FOLDER_PICKER_DESCRIPTION_CLASS =
  'block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-tight text-ds-text-muted'

export const FOLDER_PICKER_META_CLASS =
  'flex shrink-0 items-center gap-1.5 pl-2'

export const FOLDER_PICKER_BADGE_CLASS =
  'whitespace-nowrap text-[10px] font-semibold leading-tight text-ds-text-secondary'

export const FOLDER_PICKER_BADGE_MUTED_CLASS =
  'text-ds-text-disabled'

export const FOLDER_PICKER_CHECK_CLASS =
  'h-3.5 w-3.5 shrink-0 text-ds-text-primary'
