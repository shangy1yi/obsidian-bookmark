import type { SearchWidgetNaturalButtonState } from '../newtab-search-widget-store'
import { cx } from '../../ui/base/utils'

export const SEARCH_SLOT_CLASS = 'newtab-search-slot relative z-[2] mt-[var(--search-offset-y)] h-[var(--search-height)] w-full justify-self-center [--search-effective-width:min(max(560px,var(--search-width)),640px,100%)] [--search-height:40px] [--search-offset-y:0px] [--search-width:44vw] max-[420px]:[--search-effective-width:100%]'
export const SEARCH_SLOT_PENDING_LAYOUT_CLASS = 'opacity-0 invisible pointer-events-none'
export const SEARCH_SHELL_CLASS = 'newtab-search-shell relative mx-auto w-[var(--search-effective-width)]'
export const SEARCH_FORM_CLASS = 'newtab-search group relative z-[1] flex h-[var(--search-height)] w-full items-center gap-2 rounded-[var(--ui-radius-group)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[rgba(0,0,0,var(--search-bg-alpha))] py-0 pr-2 pl-4 shadow-none [filter:var(--newtab-glass-drop)] transition-[border-color,background-color,box-shadow] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] hover:border-[var(--newtab-glass-slider-fill)] focus-within:border-[var(--newtab-glass-slider-fill)] focus-within:[outline:3px_solid_var(--ui-focus-ring-soft)] focus-within:outline-offset-0 motion-reduce:transition-colors motion-reduce:duration-[80ms] [-webkit-backdrop-filter:var(--newtab-glass-filter-hero)] [backdrop-filter:var(--newtab-glass-filter-hero)] [--search-bg-alpha:0.6] [--search-height:40px] [--search-width:44vw]'
export const SEARCH_FORM_PANEL_OPEN_CLASS = 'is-panel-open'
export const SEARCH_ICON_CLASS = 'newtab-search-icon pointer-events-none shrink-0 text-[rgba(245,245,247,0.78)] transition-colors duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] group-focus-within:text-[var(--ui-text-primary)] motion-reduce:transition-none'
export const SEARCH_INPUT_CLASS = 'newtab-search-input h-full min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent px-0.5 text-[15px] font-medium leading-normal text-[var(--ui-text-primary)] caret-[var(--ui-text-primary)] outline-0 placeholder:text-[rgba(245,245,247,0.78)] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none'
export const SEARCH_SEPARATOR_CLASS = 'newtab-search-separator mx-px h-[min(22px,calc(var(--search-height)-12px))] w-px shrink-0 bg-[rgba(245,245,247,0.18)]'

const SEARCH_ICON_BUTTON_CLASS = 'curator-compact-hit-target inline-flex h-[30px] min-h-0 w-[30px] min-w-0 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border-0 bg-transparent p-0 text-[var(--ui-text-secondary)] transition-[background-color,color,transform] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] hover:bg-[rgba(245,245,247,0.1)] hover:text-[var(--ui-text-primary)] focus-visible:bg-[rgba(245,245,247,0.1)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline-none active:scale-[var(--ui-press-scale)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--ui-text-secondary)] disabled:active:scale-100 motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:scale-100'

export const SEARCH_CLEAR_BUTTON_CLASS = cx('newtab-search-clear', SEARCH_ICON_BUTTON_CLASS)
export const SEARCH_SUBMIT_BUTTON_CLASS = cx('newtab-search-submit', SEARCH_ICON_BUTTON_CLASS)
export const SEARCH_SUBMIT_ICON_CLASS = 'newtab-search-submit-icon'

const SEARCH_CHIP_BUTTON_BASE_CLASS = 'inline-flex h-[30px] min-h-0 w-auto max-w-none shrink-0 items-center justify-center gap-[5px] whitespace-nowrap rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-transparent px-3 text-xs font-medium leading-none tracking-[0] text-[var(--ui-text-secondary)] transition-[background-color,border-color,color,box-shadow] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] hover:border-[var(--ui-divider-strong)] hover:bg-[rgba(245,245,247,0.08)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[rgba(245,245,247,0.08)] focus-visible:text-[var(--ui-text-primary)] focus-visible:[outline:3px_solid_var(--ui-focus-ring-soft)] focus-visible:outline-offset-0 motion-reduce:transition-none'
const SEARCH_NATURAL_ACTIVE_CLASS = 'border-[var(--ui-accent)] bg-[var(--ui-accent)] text-[var(--ui-text-inverse)] hover:border-[var(--ui-accent-strong)] hover:bg-[var(--ui-accent-strong)] hover:text-[var(--ui-text-inverse)] focus-visible:border-[var(--ui-accent-strong)] focus-visible:bg-[var(--ui-accent-strong)] focus-visible:text-[var(--ui-text-inverse)]'
const SEARCH_NATURAL_FALLBACK_CLASS = 'border-[var(--ui-warning)] bg-[rgba(248,214,109,0.14)] text-[var(--ui-warning)] hover:border-[var(--ui-warning)] hover:bg-[rgba(248,214,109,0.14)] hover:text-[var(--ui-warning)] focus-visible:border-[var(--ui-warning)] focus-visible:bg-[rgba(248,214,109,0.14)] focus-visible:text-[var(--ui-warning)]'

export const SEARCH_NATURAL_PENDING_DOT_CLASS = 'newtab-search-natural-pending-dot h-1.5 w-1.5 rounded-full bg-current animate-[cb-search-pulse_1s_var(--ui-ease-standard)_infinite] motion-reduce:animate-none'
export const SEARCH_ENGINE_BUTTON_CLASS = cx('newtab-search-engine', SEARCH_CHIP_BUTTON_BASE_CLASS, 'min-w-13 disabled:cursor-default disabled:opacity-40 disabled:hover:border-[var(--ui-divider)] disabled:hover:bg-transparent disabled:hover:text-[var(--ui-text-secondary)]')
export const SEARCH_ENGINE_CARET_CLASS = 'newtab-search-engine-caret shrink-0 opacity-60'
export const SEARCH_ENGINE_MENU_POSITIONER_CLASS = 'newtab-search-engine-menu-positioner z-[3] outline-none'
export const SEARCH_ENGINE_MENU_CLASS = 'newtab-search-engine-menu grid w-44 gap-[3px] rounded-[var(--ui-radius-group)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-popup)] p-1.5 shadow-none [filter:var(--newtab-glass-drop)] motion-reduce:transform-none motion-reduce:transition-none [-webkit-backdrop-filter:var(--newtab-glass-filter-popup)] [backdrop-filter:var(--newtab-glass-filter-popup)]'
export const SEARCH_ENGINE_MENU_ITEMS_CLASS = 'newtab-search-engine-menu-items grid gap-[3px]'
export const SEARCH_ENGINE_ITEM_CLASS = 'newtab-search-engine-item flex min-h-[30px] cursor-pointer items-center justify-between gap-2 rounded-[var(--ui-radius-control)] bg-transparent px-[9px] text-left text-xs font-[650] leading-[1.2] text-[rgba(245,245,247,0.76)] outline-none hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] data-[checked]:bg-[var(--ui-surface-hover)] data-[checked]:text-[var(--ui-text-primary)] data-[highlighted]:bg-[var(--ui-surface-hover)] data-[highlighted]:text-[var(--ui-text-primary)]'
export const SEARCH_ENGINE_ITEM_INDICATOR_CLASS = 'newtab-search-engine-item-indicator inline-flex items-center text-current'
export const SEARCH_ENGINE_MENU_HINT_CLASS = 'newtab-search-engine-menu-hint px-2 pt-1 pb-0.5 text-[10px] leading-[1.4] text-[rgba(245,245,247,0.7)]'

export const SEARCH_PANEL_CLASS = 'newtab-search-suggestions-panel absolute top-[calc(var(--search-height)+8px)] left-0 grid max-h-[min(312px,calc(100vh-180px))] w-full gap-[3px] overflow-y-auto rounded-[var(--ui-radius-group)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-[var(--newtab-glass-bg-popup)] p-1.5 shadow-none [filter:var(--newtab-glass-drop)] [scrollbar-color:rgba(245,245,247,0.22)_transparent] [scrollbar-width:thin] [-webkit-backdrop-filter:var(--newtab-glass-filter-popup)] [backdrop-filter:var(--newtab-glass-filter-popup)]'
export const SEARCH_CHIPS_CLASS = 'newtab-search-chips flex flex-wrap gap-[5px] px-1.5 py-0.5 empty:hidden'
export const SEARCH_SECTION_LABEL_CLASS = 'newtab-search-section-label px-2 pt-0.5 pb-px text-[10px] font-bold leading-[1.3] text-[rgba(245,245,247,0.7)] empty:hidden'
export const SEARCH_SUGGESTIONS_CLASS = 'newtab-search-suggestions grid gap-[3px]'
export const SEARCH_HINT_CLASS = 'newtab-search-hint px-2 pt-[3px] pb-0.5 text-[10px] font-[560] leading-[1.4] text-[rgba(245,245,247,0.7)] empty:hidden'
const SEARCH_CHIP_CLASS = 'newtab-search-chip inline-flex min-h-[22px] max-w-full items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--ui-radius-pill)] border border-[var(--ui-divider)] bg-[rgba(245,245,247,0.055)] px-[7px] text-[10px] font-[680] leading-[1.2] text-[var(--ui-text-secondary)]'

const SEARCH_SUGGESTION_ACTIVE_CLASS = '[&.active]:bg-[var(--newtab-glass-slider-fill)] [&.active]:text-[var(--ui-text-primary)] [&.active]:shadow-[inset_0_0_0_1px_var(--newtab-glass-slider-fill)] [&.active:hover]:bg-[var(--newtab-glass-slider-fill)] [&.active:focus-visible]:bg-[var(--newtab-glass-slider-fill)] [&_.newtab-search-suggestion-mark]:border-[rgba(245,245,247,0.24)] [&_.newtab-search-suggestion-mark]:bg-[rgba(245,245,247,0.14)] [&_.newtab-search-suggestion-mark]:text-[rgba(245,245,247,0.96)] [&_.newtab-search-suggestion-meta]:text-[rgba(245,245,247,0.86)]'
const SEARCH_SUGGESTION_MARK_CLASS = 'newtab-search-suggestion-mark grid h-[30px] w-[30px] place-items-center rounded-lg border border-[rgba(245,245,247,0.1)] bg-[rgba(245,245,247,0.07)] text-xs font-extrabold leading-none text-[rgba(245,245,247,0.82)]'
const SEARCH_SUGGESTION_COMMAND_MARK_CLASS = 'bg-[rgba(189,243,202,0.16)] text-[rgba(189,243,202,0.94)]'
export const SEARCH_SUGGESTION_COPY_CLASS = 'newtab-search-suggestion-copy grid min-w-0 gap-[3px]'
export const SEARCH_SUGGESTION_TITLE_CLASS = 'overflow-hidden text-ellipsis whitespace-nowrap text-xs font-[720] leading-[1.2] text-current'
export const SEARCH_SUGGESTION_META_CLASS = 'newtab-search-suggestion-meta overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-[560] leading-[1.25] text-[rgba(245,245,247,0.7)]'
export const SEARCH_WEB_HINT_CLASS = 'newtab-search-web-hint block min-h-[30px] w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[var(--ui-radius-control)] bg-[rgba(245,245,247,0.035)] px-2 py-1.5 text-left text-[11px] font-[620] leading-[1.25] text-[rgba(245,245,247,0.6)] hover:bg-[rgba(245,245,247,0.07)] hover:text-[var(--ui-text-primary)] focus-visible:bg-[rgba(245,245,247,0.07)] focus-visible:text-[var(--ui-text-primary)] focus-visible:[outline:2px_solid_rgba(245,245,247,0.12)] focus-visible:-outline-offset-1'

export function getSearchNaturalButtonClass(state: SearchWidgetNaturalButtonState): string {
  return cx(
    'newtab-search-natural w-[52px] min-w-[52px] max-w-[52px] px-0',
    SEARCH_CHIP_BUTTON_BASE_CLASS,
    state.active && 'active',
    state.pending && 'pending',
    state.fallback && 'fallback',
    state.active && !state.fallback && SEARCH_NATURAL_ACTIVE_CLASS,
    state.fallback && SEARCH_NATURAL_FALLBACK_CLASS
  )
}

export function getSearchChipClass(kind: string): string {
  return cx(SEARCH_CHIP_CLASS, kind === 'exclude' && 'text-[var(--ui-danger)]')
}

export function getSearchSuggestionClass({
  active,
  command
}: {
  active: boolean
  command: boolean
}): string {
  return cx(
    'newtab-search-suggestion grid min-h-11 w-full cursor-pointer grid-cols-[30px_minmax(0,1fr)] items-center gap-2.5 rounded-[var(--ui-radius-control)] bg-transparent px-2 py-1.5 text-left text-[rgba(245,245,247,0.86)] transition-[background-color,color] duration-[var(--ui-motion-fast)] ease-[var(--ui-ease-standard)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline-none motion-reduce:transition-none',
    command && 'command',
    active && 'active',
    active && SEARCH_SUGGESTION_ACTIVE_CLASS
  )
}

export function getSearchSuggestionMarkClass(command: boolean): string {
  return cx(SEARCH_SUGGESTION_MARK_CLASS, command && SEARCH_SUGGESTION_COMMAND_MARK_CLASS)
}
