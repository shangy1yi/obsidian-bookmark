import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react'
import { Button } from '../../ui/base/Button'
import { getMotionAwareScrollBehavior } from '../../shared/motion'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { cx } from '../../ui/base/utils'
import { DrawerOverlay, DrawerPanel } from '../../ui/base/Drawer'
import { Icon } from '../../ui/icons/Icon'
import { Input } from '../../ui/base/Input'
import { Select } from '../../ui/base/Select'
import { SliderControl } from '../../ui/base/Slider'
import { Surface } from '../../ui/base/Surface'
import { SwitchControl } from '../../ui/base/Switch'
import { TabsIndicator, TabsList, TabsPanel, TabsRoot, TabsTab } from '../../ui/base/Tabs'
import { ToggleGroup } from '../../ui/base/ToggleGroup'
import {
  OPTION_SWITCH_CONTROL_CLASS,
  OPTION_SWITCH_THUMB_CLASS,
  OPTION_SWITCH_WRAP_CLASS
} from '../../ui/switch-classes'
import { SettingsDrawerClose } from './SettingsDrawerClose'
import {
  ICON_PRESET_META,
  type IconLayoutPresetKey
} from '../icon-settings'
import {
  dispatchNewtabIconPresetApply,
  dispatchNewtabIconResetDefaults,
  dispatchNewtabIconSettingFieldChange,
  dispatchNewtabIconShowTitlesToggle,
  dispatchNewtabIconVerticalCenterToggle,
  useNewtabIconPreviewView
} from '../newtab-icon-preview-store'
import {
  dispatchNewtabTimeSettingFieldChange,
  dispatchNewtabTimeSettingToggle,
  useNewtabTimeSettingsView
} from '../newtab-time-settings-store'
import {
  dispatchNewtabSearchSettingFieldChange,
  dispatchNewtabSearchSettingToggle,
  NEWTAB_SEARCH_BACKGROUND_DEFAULT,
  NEWTAB_SEARCH_BACKGROUND_MAX,
  NEWTAB_SEARCH_BACKGROUND_MIN,
  useNewtabSearchSettingsView
} from '../newtab-search-settings-store'
import {
  dispatchNewtabBackgroundFileSelect,
  dispatchNewtabBackgroundFilterHoverToggle,
  dispatchNewtabBackgroundMaskToggle,
  dispatchNewtabBackgroundSettingFieldChange,
  dispatchNewtabBackgroundUrlCommit,
  useNewtabBackgroundSettingsView
} from '../newtab-background-settings-store'
import type { SettingsDrawerSection } from '../settings-group-sync'
import { useSettingsDrawerModalMode } from '../settings-drawer-mode'
import { snapBackgroundMaskPercentage } from '../background-mask-settings'
import {
  dispatchNewtabSettingsDrawerActiveGroupChange,
  dispatchNewtabSettingsDrawerFeaturedPickerClick,
  dispatchNewtabSettingsDrawerOpenChange,
  dispatchNewtabSettingsDrawerReady,
  getNewtabSettingsDrawerNodes,
  setNewtabSettingsDrawerNodes,
  useNewtabSettingsDrawerLayoutRequest,
  useNewtabSettingsDrawerView
} from '../newtab-settings-drawer-store'
import { setNewtabFeaturedBackgroundPickerNodes } from '../newtab-featured-background-picker-store'
import {
  dispatchNewtabModuleSettingToggle,
  useNewtabModuleSettingsView,
  type NewtabModuleSettingRowView
} from '../newtab-module-settings-store'
import {
  dispatchNewtabFolderCandidateFocus,
  dispatchNewtabFolderCandidateKeyDown,
  dispatchNewtabFolderCandidateQueryChange,
  dispatchNewtabFolderCandidateSearchKeyDown,
  dispatchNewtabFolderCandidateSelect,
  dispatchNewtabFolderCandidatesToggle,
  dispatchNewtabFolderHideNamesToggle,
  dispatchNewtabBrowseModeChange,
  dispatchNewtabGeneralSettingToggle,
  dispatchNewtabSelectedFolderRemove,
  useNewtabFolderCandidateFocusRequest,
  useNewtabFolderSourceView,
  type NewtabFolderCandidateFocusRequest,
  type NewtabFolderCandidateItemView,
  type NewtabFolderCandidateState,
  type NewtabSelectedFolderSourceItemView,
  type NewtabSelectedFolderSourceState
} from '../newtab-folder-source-store'

const settingsTabs = [
  ['source', '来源', true],
  ['appearance', '外观', false],
  ['search', '搜索', false],
  ['advanced', '高级设置', false]
] as const

const DRAWER_PORTALED_CONTENT_ATTRIBUTES = { 'data-drawer-content': '' } as const
const SETTINGS_DRAWER_CLASS = 'fixed inset-0 z-[10020] overflow-hidden bg-transparent'
const SETTINGS_DRAWER_SURFACE_CLASS = 'settings-drawer-panel isolate rounded-ds-lg border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-transparent text-ds-text-primary [box-shadow:var(--newtab-glass-drop-shadow)] [filter:none] [hanging-punctuation:allow-end] [line-break:strict] [text-autospace:normal] [text-spacing-trim:trim-start] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[hanging-punctuation:none] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[line-break:auto] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[text-autospace:no-autospace] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[text-spacing-trim:space-all]'
const SETTINGS_DRAWER_PANEL_CLASS = 'pointer-events-auto fixed inset-y-0 right-0 z-[1] grid h-dvh w-[min(520px,calc(100vw-24px))] max-w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden opacity-100 [transform:translateX(var(--drawer-swipe-movement-x))] transition-[transform,opacity] duration-[var(--panel-open-dur)] ease-[var(--panel-ease)] data-swiping:duration-0 data-ending-style:duration-[var(--panel-close-dur)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)] motion-reduce:transition-opacity motion-reduce:duration-[80ms] motion-reduce:[transform:none] max-[600px]:w-full max-[600px]:rounded-none max-[600px]:border-x-0'
const SETTINGS_DRAWER_SCROLL_CLASS = 'settings-drawer-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-14 max-[700px]:px-4 max-[700px]:pb-5'
const SETTINGS_ROOT_CLASS = 'grid gap-4'
const SETTINGS_HEADER_CLASS = 'grid gap-1 pr-14'
const SETTINGS_KICKER_CLASS = 'm-0 text-xs font-medium leading-4 text-ds-text-secondary'
const SETTINGS_TITLE_CLASS = 'm-0 text-xl font-semibold leading-tight text-ds-text-primary'
const SETTINGS_SUMMARY_CLASS = 'm-0 text-sm leading-relaxed text-ds-text-secondary'
const SETTINGS_SAVE_STATUS_CLASS = 'mt-1 justify-self-start text-xs font-semibold text-ds-accent-text data-[state=error]:text-ds-danger-text'
const SETTINGS_TABS_LIST_CLASS = 't-tabs sticky top-0 z-[1] grid grid-cols-4 gap-1 rounded-ds-sm border border-[var(--newtab-glass-stroke)] bg-[rgba(245,245,247,0.06)] p-1 [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)] max-[380px]:grid-cols-2'
const SETTINGS_TAB_CLASS = 't-tab min-h-8 min-w-0 rounded-ds-sm bg-transparent px-2 text-xs font-semibold outline-none hover:text-ds-text-primary data-[active]:text-ds-text-primary data-[selected]:text-ds-text-primary data-[state=active]:text-ds-text-primary focus-visible:shadow-ds-focus'
const SETTINGS_TABS_INDICATOR_CLASS = 't-tabs-pill'
const SETTINGS_TAB_PANELS_CLASS = 'settings-tab-panels grid min-w-0 items-start'
const SETTINGS_TAB_PANEL_CLASS = 'grid min-w-0 gap-4 outline-none [grid-area:1/1]'
const SETTINGS_NESTED_SURFACE_CLASS = 'border-[rgba(245,245,247,0.105)] rounded-ds-sm bg-[rgba(245,245,247,0.045)] shadow-none'
const SETTINGS_SELECTED_SURFACE_CLASS = 'border-[rgba(245,245,247,0.24)] bg-[rgba(245,245,247,0.14)] text-ds-text-primary shadow-none'
const SETTINGS_SEGMENTED_BUTTON_CLASS = 'min-h-7 min-w-20 rounded-ds-sm border border-transparent bg-transparent px-2 text-xs font-semibold text-ds-text-secondary shadow-none data-[pressed]:border-ds-border-hover data-[pressed]:bg-ds-selected data-[pressed]:text-ds-text-primary data-[pressed]:shadow-none'
const SETTINGS_PSEUDO_SHADOW_RESET_CLASS = '[&::before]:shadow-none [&::after]:shadow-none'
const SETTINGS_SECTION_CLASS = 'grid min-w-0 gap-2.5'
const SETTINGS_SECTION_TITLE_CLASS = 'm-0 text-sm font-semibold leading-snug text-ds-text-primary'
const SETTINGS_LIST_CLASS = 'grid gap-2'
const SETTINGS_INPUT_SURFACE_CLASS = 'border-[rgba(245,245,247,0.12)] rounded-ds-sm bg-[rgba(245,245,247,0.055)] text-ds-text-primary shadow-none'
const SETTINGS_INPUT_INTERACTION_CLASS = 'outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary hover:shadow-none hover:outline-none focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const SETTINGS_CONTROL_CLASS = cx(SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS)
const SETTINGS_TEXT_INPUT_FOCUS_CLASS = 'focus:border-ds-focus focus:bg-ds-hover focus:outline-none focus:shadow-ds-focus focus-visible:border-ds-focus focus-visible:bg-ds-hover focus-visible:outline-none focus-visible:shadow-ds-focus'
const SETTINGS_TEXT_INPUT_CLASS = cx('h-9 min-h-9 w-full min-w-0 px-3 text-xs font-semibold', SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS, SETTINGS_TEXT_INPUT_FOCUS_CLASS)
const SETTINGS_ROW_CLASS = 'grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-ds-sm border border-[rgba(245,245,247,0.105)] bg-[rgba(245,245,247,0.045)] px-3 py-2.5 max-[700px]:grid-cols-1 max-[700px]:justify-items-stretch'
const SETTINGS_ROW_DISABLED_CLASS = 'opacity-60'
const SETTINGS_ROW_SLIDER_CLASS = 'grid-cols-[minmax(0,1fr)_minmax(150px,42%)]'
const SETTINGS_LABEL_STACK_CLASS = 'grid min-w-0 gap-1'
const SETTINGS_LABEL_CLASS = 'min-w-0 text-sm font-semibold leading-snug text-ds-text-primary'
const SETTINGS_DESCRIPTION_CLASS = 'text-xs font-medium leading-snug text-ds-text-secondary'
const SETTINGS_VALUE_CLASS = 'text-ds-text-secondary tabular-nums'
const SETTINGS_SWITCH_WRAP_CLASS = OPTION_SWITCH_WRAP_CLASS
const SETTINGS_SWITCH_CLASS = OPTION_SWITCH_CONTROL_CLASS
const SETTINGS_SWITCH_THUMB_CLASS = OPTION_SWITCH_THUMB_CLASS
const SETTINGS_SLIDER_CLASS = 'min-w-36 max-[700px]:w-full'
const SETTINGS_SELECT_TRIGGER_CLASS = 'min-h-9 min-w-36 max-w-56 justify-between text-xs font-semibold max-[700px]:w-full max-[700px]:max-w-none'
const SETTINGS_SELECT_VALUE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap'
const SETTINGS_SELECT_POPUP_CLASS = 'max-h-80'
const SETTINGS_SELECT_POSITIONER_CLASS = 'z-[10040]'
const SETTINGS_FIELD_CLASS = 'block min-w-0 max-[700px]:w-full'
const SETTINGS_NOTE_CLASS = 'm-0 text-xs leading-relaxed text-ds-text-secondary'
const SETTINGS_WIDE_BUTTON_CLASS = 'min-h-9 w-full justify-between px-3 text-xs font-semibold'
const SETTINGS_PICKER_BUTTON_CLASS = 'min-h-9 min-w-32 max-w-56 justify-center overflow-hidden px-3 text-xs font-semibold text-ellipsis whitespace-nowrap max-[700px]:w-full max-[700px]:max-w-none'
const SETTINGS_FILE_INPUT_CLASS = 'sr-only'
const SETTINGS_STATUS_CLASS = 'block min-h-8 rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2.5 py-2 text-xs leading-snug text-ds-text-secondary data-[tone=error]:border-ds-danger/60 data-[tone=error]:text-ds-danger-text data-[tone=success]:text-ds-text-primary'
const FOLDER_STACK_CLASS = 'grid min-w-0 gap-2'
const FOLDER_SUMMARY_CLASS = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2.5 py-2'
const FOLDER_SELECTED_COPY_CLASS = 'grid min-w-0 gap-0.5 text-xs text-ds-text-secondary'
const FOLDER_REMOVE_BUTTON_CLASS = 'curator-compact-hit-target group/folder-remove inline-flex size-8 min-h-8 min-w-8 items-center justify-center rounded-ds-sm border border-[rgba(245,245,247,0.07)] bg-[rgba(245,245,247,0.045)] p-0 text-[rgba(245,245,247,0.58)] outline-none transition-[background-color,border-color,color,transform,opacity] duration-ds-fast ease-ds-standard hover:border-[rgba(255,138,130,0.24)] hover:bg-[rgba(255,138,130,0.11)] hover:text-[rgba(255,210,205,0.95)] focus-visible:border-[rgba(255,138,130,0.28)] focus-visible:bg-[rgba(255,138,130,0.12)] focus-visible:text-[rgba(255,210,205,0.95)] focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:scale-100 [&_svg]:size-[15px] [&_svg]:stroke-[1.9]'
const FOLDER_EMPTY_CLASS = SETTINGS_NOTE_CLASS
const FOLDER_CANDIDATES_PANEL_CLASS = cx('grid gap-2 px-2.5 py-2', SETTINGS_NESTED_SURFACE_CLASS)
const FOLDER_CANDIDATE_LIST_CLASS = 'grid max-h-56 gap-1 overflow-y-auto'
const FOLDER_CANDIDATE_CARD_CLASS = 'folder-candidate-card grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-ds-sm border border-transparent bg-transparent px-2.5 py-2 text-left text-ds-text-primary outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover aria-pressed:border-ds-border-hover aria-pressed:bg-ds-selected aria-pressed:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:shadow-ds-focus'
const FOLDER_CANDIDATE_COPY_CLASS = 'grid min-w-0 gap-0.5'
const FOLDER_CANDIDATE_TITLE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-snug text-ds-text-primary'
const FOLDER_CANDIDATE_META_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-ds-text-secondary'
const FOLDER_CANDIDATE_BADGE_CLASS = 'inline-flex min-h-5 items-center justify-center rounded-full bg-ds-surface-1 px-2 text-xs font-semibold text-ds-text-secondary whitespace-nowrap'
const MODULE_SWITCH_LABEL_CLASS = SETTINGS_SWITCH_WRAP_CLASS
const BACKGROUND_CREDIT_ROW_CLASS = '-mt-1 flex min-h-6 min-w-0 items-center gap-1.5 px-1.5 text-xs leading-none text-ds-text-muted'
const BACKGROUND_CREDIT_LABEL_CLASS = 'shrink-0 font-medium text-ds-text-secondary'
const BACKGROUND_CREDIT_CLASS = 'group inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-ds-sm text-xs font-medium leading-none text-ds-text-muted outline-none transition-colors duration-ds-fast ease-ds-standard hover:text-ds-text-primary focus-visible:shadow-ds-focus'
const BACKGROUND_CREDIT_TEXT_CLASS = 'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap'
const BACKGROUND_CREDIT_ICON_CLASS = 'shrink-0 text-ds-text-disabled transition-colors duration-ds-fast ease-ds-standard group-hover:text-ds-text-secondary'
const SETTING_COLOR_CLASS = 'inline-grid min-h-9 min-w-40 grid-cols-[minmax(0,1fr)_34px] items-center gap-2 overflow-hidden rounded-ds-sm border border-ds-border bg-ds-surface-2 p-1 pl-2.5'
const SETTING_COLOR_VALUE_CLASS = 'text-xs font-semibold text-ds-text-primary'
const SETTING_COLOR_INPUT_CLASS = 'h-7 min-h-7 w-8 min-w-8 overflow-hidden rounded-ds-sm border-0 bg-transparent p-0'
const ICON_PREVIEW_PANEL_CLASS = 'grid gap-2.5 rounded-ds-sm border border-ds-border bg-ds-surface-2 p-3'
const ICON_PREVIEW_HEADER_CLASS = 'flex items-baseline justify-between gap-3 text-xs font-semibold text-ds-text-primary'
const ICON_PREVIEW_SUMMARY_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs font-medium text-ds-text-secondary'
const ICON_LIVE_PREVIEW_CLASS = 'm-0 grid min-h-36 justify-items-center overflow-hidden rounded-ds-sm border border-ds-border bg-ds-app px-2.5 py-4'
const ICON_LIVE_PREVIEW_GRID_CLASS = 'grid w-[min(var(--preview-page-width),var(--preview-grid-max-width))] content-center justify-center'
const ICON_LIVE_PREVIEW_TILE_CLASS = 'grid min-w-0 justify-items-center gap-1.5 [width:var(--preview-tile-width)]'
const ICON_LIVE_PREVIEW_SHELL_CLASS = 'grid place-items-center rounded-ds-sm border border-ds-border bg-ds-surface-1 [height:var(--preview-shell-size)] [width:var(--preview-shell-size)]'
const ICON_LIVE_PREVIEW_MARK_CLASS = 'text-xs font-semibold text-ds-text-primary'
const ICON_LIVE_PREVIEW_TITLE_CLASS = 'max-w-full overflow-hidden text-center text-xs leading-tight text-ds-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:var(--preview-title-lines)]'
const ICON_PRESET_ROW_CLASS = 'grid grid-cols-3 gap-2 max-[700px]:grid-cols-1'
const ICON_PRESET_CARD_CLASS = 'grid min-h-32 min-w-0 content-start gap-1.5 rounded-ds-sm border border-ds-border bg-ds-surface-1 p-2.5 text-left text-ds-text-secondary outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-ds-focus'
const ICON_PRESET_PREVIEW_CLASS = 'grid min-h-11 content-center rounded-ds-sm bg-ds-app'
const ICON_PRESET_PREVIEW_CELL_CLASS = 'block rounded-ds-sm bg-ds-surface-2'
const ICON_PRESET_NAME_CLASS = 'min-w-0 overflow-hidden text-ellipsis text-xs font-semibold text-ds-text-primary'
const ICON_PRESET_DETAIL_CLASS = 'min-w-0 overflow-hidden text-ellipsis text-xs leading-snug text-ds-text-secondary'
const SETTINGS_SEGMENTED_CLASS = 'inline-flex min-h-9 items-center gap-1 rounded-ds-sm border border-ds-border bg-ds-surface-2 p-1 max-[700px]:w-full'
const ICON_CONTROL_ROW_CLASS = 'grid-cols-[minmax(0,1fr)_auto]'
const ICON_ADVANCED_PANEL_CLASS = 'grid'
const ICON_RESET_DEFAULTS_CLASS = 'min-h-9 w-full justify-center px-3 text-xs font-semibold'
const SEARCH_ENGINE_ROW_CLASS = 'items-start'
const SEARCH_ENGINE_GRID_CLASS = 'grid min-w-52 grid-cols-3 gap-1.5 max-[700px]:grid-cols-1'
const SEARCH_ENGINE_TOGGLE_CLASS = 'relative inline-flex min-h-8 min-w-0 items-center justify-center px-2 text-xs font-semibold'
const SEARCH_ENGINE_HIDDEN_SWITCH_CLASS = 'pointer-events-none absolute h-px w-px opacity-0'
const SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT = 40

function settingsControlClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_CONTROL_CLASS, ...classNames)
}

function settingsInputClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS, ...classNames)
}

type SettingsSectionRef = (element: HTMLElement | null) => void

function settingRowClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_ROW_CLASS, SETTINGS_PSEUDO_SHADOW_RESET_CLASS, ...classNames)
}

function SettingLabelStack({
  title,
  description,
  descriptionId,
  titleId
}: {
  title: ReactNode
  description?: ReactNode
  descriptionId?: string
  titleId?: string
}) {
  return (
    <span className={SETTINGS_LABEL_STACK_CLASS}>
      <span id={titleId} className={SETTINGS_LABEL_CLASS}>{title}</span>
      {description ? <small id={descriptionId} className={SETTINGS_DESCRIPTION_CLASS}>{description}</small> : null}
    </span>
  )
}

const searchEngines = [
  ['google', 'Google', true],
  ['bing', 'Bing', true],
  ['baidu', '百度', true],
  ['duckduckgo', 'DuckDuckGo', true],
  ['perplexity', 'Perplexity', false],
  ['chatgpt', 'ChatGPT', false],
  ['you', 'You.com', false],
  ['kagi', 'Kagi', false],
  ['brave', 'Brave', false]
] as const

function SwitchRow({
  id,
  title,
  description,
  checked,
  defaultChecked = false,
  disabled = false,
  controlRef,
  onCheckedChange,
  hidden = false
}: {
  id: string
  title: string
  description: string
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  controlRef?: Ref<HTMLElement>
  onCheckedChange?: (checked: boolean) => void
  hidden?: boolean
}) {
  const labelId = `${id}-label`
  const descriptionId = `${id}-description`

  return (
    <div className={settingRowClassName(disabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)} hidden={hidden}>
      <SettingLabelStack title={title} titleId={labelId} description={description} descriptionId={descriptionId} />
      <span className={SETTINGS_SWITCH_WRAP_CLASS}>
        <SwitchControl
          id={id}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          className={SETTINGS_SWITCH_CLASS}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          rootRef={controlRef}
          syncInputState
          thumbClassName={SETTINGS_SWITCH_THUMB_CLASS}
          unstyled
        />
      </span>
    </div>
  )
}

function SliderRow({
  id,
  label,
  valueId,
  value,
  min,
  max,
  defaultValue,
  ariaLabel,
  rowId,
  hidden = false,
  description,
  disabled = false,
  onValueChange,
  onValueCommitted,
  sliderValue,
  ticks
}: {
  id: string
  label: string
  valueId: string
  value: string
  min: string
  max: string
  defaultValue: string
  ariaLabel: string
  rowId?: string
  hidden?: boolean
  description?: string
  disabled?: boolean
  onValueChange?: (value: number) => void
  onValueCommitted?: (value: number) => void
  sliderValue?: number
  ticks?: readonly [string, string, string]
}) {
  return (
    <label id={rowId} className={settingRowClassName(SETTINGS_ROW_SLIDER_CLASS, disabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)} hidden={hidden}>
      <span className={description ? SETTINGS_LABEL_STACK_CLASS : SETTINGS_LABEL_CLASS}>
        <span className={description ? SETTINGS_LABEL_CLASS : undefined}>
          {label} <output id={valueId} className={SETTINGS_VALUE_CLASS}>{value}</output>
        </span>
        {description ? <small className={SETTINGS_DESCRIPTION_CLASS}>{description}</small> : null}
      </span>
      <span className="grid min-w-36 gap-1.5 max-[700px]:w-full">
        <SliderControl
          id={id}
          ariaLabel={ariaLabel}
          className={SETTINGS_SLIDER_CLASS}
          defaultValue={defaultValue}
          disabled={disabled}
          max={max}
          min={min}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          syncInputState
          value={sliderValue}
        />
        {ticks ? (
          <span className="flex justify-between px-0.5 text-[11px] leading-4 text-ds-text-tertiary" aria-hidden="true">
            {ticks.map((tick) => <span key={tick}>{tick}</span>)}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function SettingsSelect({
  id,
  label,
  description,
  ariaLabel,
  defaultValue,
  options,
  portalContainer,
  disabled = false,
  onValueChange,
  value,
  triggerRef
}: {
  id: string
  label: string
  description?: string
  ariaLabel: string
  defaultValue?: string
  options: Array<readonly [string, string]>
  portalContainer?: HTMLElement | null
  disabled?: boolean
  onValueChange?: (value: string | null) => void
  value?: string | null
  triggerRef?: Ref<HTMLButtonElement>
}) {
  return (
    <div className={settingRowClassName(disabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)}>
      <SettingLabelStack title={label} description={description} />
      <Select
        id={id}
        ariaLabel={ariaLabel}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={onValueChange}
        options={options.map(([value, label]) => ({ value, label }))}
        modal={false}
        popupClassName={SETTINGS_SELECT_POPUP_CLASS}
        popupAttributes={DRAWER_PORTALED_CONTENT_ATTRIBUTES}
        portalContainer={portalContainer}
        positionerClassName={SETTINGS_SELECT_POSITIONER_CLASS}
        syncInputState
        triggerClassName={SETTINGS_SELECT_TRIGGER_CLASS}
        triggerRef={triggerRef}
        value={value}
        valueClassName={SETTINGS_SELECT_VALUE_CLASS}
      />
    </div>
  )
}

export interface SettingsDrawerProps {
  open: boolean
  activeGroup: SettingsDrawerSection
  onActiveGroupChange: (group: SettingsDrawerSection) => void
  onOpenChange: (open: boolean, event?: Event) => void
}

function SettingsDrawerHeader() {
  const view = useNewtabSettingsDrawerView()

  return (
    <header className={SETTINGS_HEADER_CLASS}>
      <p className={SETTINGS_KICKER_CLASS}>新标签页</p>
      <h1 id="newtab-settings-title" className={SETTINGS_TITLE_CLASS}>新标签页设置</h1>
      <p id="newtab-settings-summary" className={SETTINGS_SUMMARY_CLASS}>书签来源、背景、卡片布局、时间与搜索栏。</p>
      <output
        id="settings-save-status"
        className={SETTINGS_SAVE_STATUS_CLASS}
        aria-live="polite"
        data-state={view.saveState}
        hidden={view.saveState === 'idle'}
      >
        {view.saveMessage}
      </output>
    </header>
  )
}

function SettingsDrawerTabs() {
  return (
    <TabsList className={SETTINGS_TABS_LIST_CLASS} aria-label="新标签页设置分组">
      {settingsTabs.map(([group, label]) => (
        <TabsTab
          className={SETTINGS_TAB_CLASS}
          value={group}
          id={`settings-tab-${group}`}
          key={group}
        >
          {label}
        </TabsTab>
      ))}
      <TabsIndicator className={SETTINGS_TABS_INDICATOR_CLASS} />
    </TabsList>
  )
}

function SettingsTabPanel({
  value,
  children
}: {
  value: SettingsDrawerSection
  children: ReactNode
}) {
  return (
    <TabsPanel
      className={SETTINGS_TAB_PANEL_CLASS}
      id={`settings-panel-${value}`}
      value={value}
      keepMounted
    >
      {children}
    </TabsPanel>
  )
}

interface SettingsScrollBarState {
  hidden: boolean
  thumbHeight: number
  thumbTop: number
}

const SETTINGS_SCROLLBAR_HIDDEN_STATE: SettingsScrollBarState = {
  hidden: true,
  thumbHeight: 100,
  thumbTop: 0
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getSettingsScrollBarState(
  scrollHost: HTMLElement | null,
  trackElement: HTMLElement | null
): SettingsScrollBarState {
  if (!scrollHost || scrollHost.scrollHeight <= scrollHost.clientHeight + 1) {
    return SETTINGS_SCROLLBAR_HIDDEN_STATE
  }

  const trackHeight = Math.max(trackElement?.clientHeight || scrollHost.clientHeight, 1)
  const maxScroll = Math.max(scrollHost.scrollHeight - scrollHost.clientHeight, 1)
  const minThumbHeight = (SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT / trackHeight) * 100
  const thumbHeight = clampNumber((scrollHost.clientHeight / scrollHost.scrollHeight) * 100, minThumbHeight, 100)
  const thumbTop = clampNumber((scrollHost.scrollTop / maxScroll) * (100 - thumbHeight), 0, 100 - thumbHeight)

  return {
    hidden: false,
    thumbHeight: Number(thumbHeight.toFixed(3)),
    thumbTop: Number(thumbTop.toFixed(3))
  }
}

function SettingsDrawerScrollBar({
  activeGroup,
  open,
  scrollHostRef
}: {
  activeGroup: SettingsDrawerSection
  open: boolean
  scrollHostRef: RefObject<HTMLDivElement | null>
}) {
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLSpanElement | null>(null)
  const dragThumbOffsetRef = useRef<number | null>(null)
  const syncFrameRef = useRef(0)

  const syncScrollBarNow = useCallback(() => {
    syncFrameRef.current = 0
    const nextState = getSettingsScrollBarState(scrollHostRef.current, trackRef.current)
    const root = rootRef.current
    const thumb = thumbRef.current
    if (!root || !thumb) {
      return
    }
    thumb.style.transform = `translate3d(0, ${nextState.thumbTop}%, 0) scaleY(${nextState.thumbHeight / 100})`
    root.dataset.visible = open && !nextState.hidden ? 'true' : 'false'
  }, [open, scrollHostRef])

  const syncScrollBar = useCallback(() => {
    if (syncFrameRef.current) {
      return
    }
    syncFrameRef.current = window.requestAnimationFrame(syncScrollBarNow)
  }, [syncScrollBarNow])

  const scrollToClientY = useCallback((clientY: number) => {
    const scrollHost = scrollHostRef.current
    const trackElement = trackRef.current

    if (!scrollHost || !trackElement) {
      return
    }

    const maxScroll = scrollHost.scrollHeight - scrollHost.clientHeight

    if (maxScroll <= 0) {
      return
    }

    const trackRect = trackElement.getBoundingClientRect()
    const thumbHeight = clampNumber(
      (scrollHost.clientHeight / scrollHost.scrollHeight) * trackRect.height,
      SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT,
      trackRect.height
    )
    const maxThumbTop = Math.max(trackRect.height - thumbHeight, 1)
    const thumbOffset = dragThumbOffsetRef.current ?? thumbHeight / 2
    const thumbTop = clampNumber(clientY - trackRect.top - thumbOffset, 0, maxThumbTop)

    scrollHost.scrollTop = (thumbTop / maxThumbTop) * maxScroll
  }, [scrollHostRef])
  const scrollToClientYFromEffect = useEffectEvent((clientY: number) => {
    scrollToClientY(clientY)
  })

  useLayoutEffect(() => {
    const scrollHost = scrollHostRef.current

    if (!scrollHost) {
      if (rootRef.current) {
        rootRef.current.dataset.visible = 'false'
      }
      return
    }

    syncScrollBar()
    scrollHost.addEventListener('scroll', syncScrollBar, { passive: true })

    const contentElement = scrollHost.firstElementChild
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncScrollBar)

    resizeObserver?.observe(scrollHost)

    if (contentElement) {
      resizeObserver?.observe(contentElement)
    }

    window.addEventListener('resize', syncScrollBar)
    const frameId = window.requestAnimationFrame(syncScrollBar)

    return () => {
      scrollHost.removeEventListener('scroll', syncScrollBar)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncScrollBar)
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(syncFrameRef.current)
      syncFrameRef.current = 0
    }
  }, [activeGroup, syncScrollBar, scrollHostRef])

  useLayoutEffect(() => {
    syncScrollBar()
  }, [open, syncScrollBar])

  useEffect(() => {
    if (!dragging) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault()
      scrollToClientYFromEffect(event.clientY)
    }
    const handlePointerUp = () => {
      dragThumbOffsetRef.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragging])

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    dragThumbOffsetRef.current = null
    scrollToClientY(event.clientY)
    setDragging(true)
  }

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    dragThumbOffsetRef.current = event.clientY - event.currentTarget.getBoundingClientRect().top
    setDragging(true)
  }

  return (
    <div
      aria-hidden="true"
      className="settings-drawer-scrollbar"
      data-dragging={dragging ? 'true' : 'false'}
      data-visible="false"
      ref={rootRef}
    >
      <div
        className="settings-drawer-scrollbar-track"
        onPointerDown={handleTrackPointerDown}
        ref={trackRef}
      >
        <span
          className="settings-drawer-scrollbar-thumb"
          onPointerDown={handleThumbPointerDown}
          ref={thumbRef}
        />
      </div>
    </div>
  )
}

const AdvancedSettingsSection = memo(function AdvancedSettingsSection({
  firstControlRef,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLElement>
  sectionRef?: SettingsSectionRef
}) {
  const folderSource = useNewtabFolderSourceView()
  const moduleSettings = useNewtabModuleSettingsView()

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="advanced" aria-labelledby="settings-general-title">
      <h2 id="settings-general-title" className={SETTINGS_SECTION_TITLE_CLASS}>高级</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SwitchRow
          id="general-hide-settings-trigger"
          title="隐藏设置图标"
          description="桌面端移到右上角时显示，触屏设备始终显示。"
          controlRef={firstControlRef}
          checked={folderSource.general.hideSettingsTrigger}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('hideSettingsTrigger', checked)
          }}
        />
        <SwitchRow
          id="general-open-bookmarks-new-tab"
          title="新标签页打开"
          description="点击书签图标时在新标签页打开，当前新标签页保持不变。"
          checked={folderSource.general.openBookmarksInNewTab}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('openBookmarksInNewTab', checked)
          }}
        />
        {moduleSettings.rows.map((row) => (
          <ModuleSettingRow row={row} key={row.key} />
        ))}
      </Surface>
    </section>
  )
})

const SourceSettingsSection = memo(function SourceSettingsSection({
  folderCandidateSearchRef,
  sectionRef
}: {
  folderCandidateSearchRef: RefObject<HTMLInputElement | null>
  sectionRef?: SettingsSectionRef
}) {
  const folderSource = useNewtabFolderSourceView()
  const folderCandidateFocusRequest = useNewtabFolderCandidateFocusRequest()
  const candidatesExpanded = folderSource.candidatesExpanded

  useEffect(() => {
    if (folderCandidateFocusRequest.requestId === 0 ||
      folderCandidateFocusRequest.target !== 'search') {
      return
    }
    folderCandidateSearchRef.current?.focus({ preventScroll: folderCandidateFocusRequest.preventScroll })
  }, [folderCandidateFocusRequest, folderCandidateSearchRef])

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="source" aria-labelledby="settings-folder-title">
      <h2 id="settings-folder-title" className={SETTINGS_SECTION_TITLE_CLASS}>书签来源</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <div className={FOLDER_STACK_CLASS}>
          <div className={FOLDER_SUMMARY_CLASS}>
            <span className={SETTINGS_LABEL_CLASS}>已选文件夹</span>
            <strong id="folder-selected-count" className="text-sm font-semibold text-ds-text-primary tabular-nums">{folderSource.selectedCount}</strong>
          </div>
          <div id="folder-selected-list" className={FOLDER_STACK_CLASS}>
            <SelectedFolderSourceList state={folderSource.selected} />
          </div>
          <CollapsibleRoot
            open={candidatesExpanded}
            onOpenChange={(nextOpen) => {
              if (nextOpen !== candidatesExpanded) {
                dispatchNewtabFolderCandidatesToggle()
              }
            }}
          >
            <CollapsibleTrigger
              id="folder-candidates-toggle"
              className={settingsControlClassName(SETTINGS_WIDE_BUTTON_CLASS)}
              type="button"
              aria-controls="folder-candidates-panel"
            >
              <span data-folder-toggle-label>
                {candidatesExpanded ? '收起候选文件夹' : '展开候选文件夹'}
              </span>
            </CollapsibleTrigger>
            <CollapsiblePanel
              id="folder-candidates-panel"
              className={FOLDER_CANDIDATES_PANEL_CLASS}
              keepMounted={false}
            >
              <div className={FOLDER_STACK_CLASS}>
                <label className={SETTINGS_FIELD_CLASS} htmlFor="folder-candidate-search">
                  <Input
                    id="folder-candidate-search"
                    className={SETTINGS_TEXT_INPUT_CLASS}
                    type="search"
                    ref={folderCandidateSearchRef}
                    placeholder="搜索文件夹"
                    aria-label="搜索候选文件夹"
                    aria-controls="folder-candidate-list"
                    spellCheck={false}
                    value={folderSource.candidateQuery}
                    onValueChange={dispatchNewtabFolderCandidateQueryChange}
                    onKeyDown={(event) => {
                      if (dispatchNewtabFolderCandidateSearchKeyDown(event.key)) {
                        event.preventDefault()
                        event.stopPropagation()
                      }
                    }}
                    unstyled
                  />
                </label>
                <div
                  id="folder-candidate-list"
                  className={FOLDER_CANDIDATE_LIST_CLASS}
                  aria-label="候选文件夹列表"
                  data-squircle-subtree="off"
                >
                  <FolderCandidateList
                    focusRequest={folderCandidateFocusRequest}
                    state={folderSource.candidates}
                  />
                </div>
              </div>
            </CollapsiblePanel>
          </CollapsibleRoot>
        </div>
        <div className={settingRowClassName(ICON_CONTROL_ROW_CLASS)}>
          <SettingLabelStack
            title="浏览方式"
            description="展开：所有来源文件夹的书签一屏铺开。导航：文件夹显示为卡片，点击进入。"
          />
          <ToggleGroup
            id="folder-browse-mode-control"
            aria-label="浏览方式"
            className={SETTINGS_SEGMENTED_CLASS}
            itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
            onValueChange={(value) => {
              const nextValue = value[0]
              if (nextValue === 'expanded' || nextValue === 'navigation') {
                dispatchNewtabBrowseModeChange(nextValue)
              }
            }}
            items={[
              { value: 'expanded', label: '展开', attributes: { 'data-browse-mode': 'expanded' } },
              { value: 'navigation', label: '导航', attributes: { 'data-browse-mode': 'navigation' } }
            ]}
            unstyled
            value={folderSource.browseMode}
          />
        </div>
        <SwitchRow
          id="folder-hide-names"
          title="隐藏文件夹名"
          description="只保留图标网格，适合单一来源或极简布局。"
          checked={folderSource.hideFolderNames}
          onCheckedChange={dispatchNewtabFolderHideNamesToggle}
        />
        <SwitchRow
          id="folder-show-source-navigation"
          title="显示来源导航"
          description="在多个来源之间快速跳转，不影响文件夹和书签拖拽排序。"
          checked={folderSource.general.showSourceNavigation}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('showSourceNavigation', checked)
          }}
        />
      </Surface>
    </section>
  )
})

function SelectedFolderSourceList({ state }: { state: NewtabSelectedFolderSourceState }) {
  if (state.type === 'empty') {
    return <p className={FOLDER_EMPTY_CLASS}>{state.message}</p>
  }

  return (
    <>
      {state.items.map((item) => (
        <div className={FOLDER_SUMMARY_CLASS} key={item.folderId}>
          <span className={FOLDER_SELECTED_COPY_CLASS}>
            <strong className={SETTINGS_LABEL_CLASS}>{item.title}</strong>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.path}</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.stats}</span>
          </span>
          <Button
            className={FOLDER_REMOVE_BUTTON_CLASS}
            type="button"
            data-folder-remove-id={item.folderId}
            aria-label={getFolderSourceRemoveLabel(item)}
            title={getFolderSourceRemoveLabel(item)}
            onClick={() => {
              dispatchNewtabSelectedFolderRemove(item.folderId)
            }}
            unstyled
          >
            <Icon name="Trash2" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </>
  )
}

function getFolderSourceRemoveLabel(item: NewtabSelectedFolderSourceItemView): string {
  return `从新标签页移除「${item.title || '文件夹'}」，将隐藏 ${item.affectedCount} 个书签，不会删除书签`
}

function FolderCandidateList({
  focusRequest,
  state
}: {
  focusRequest: NewtabFolderCandidateFocusRequest
  state: NewtabFolderCandidateState
}) {
  const candidateRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (focusRequest.requestId === 0 ||
      focusRequest.target !== 'candidate' ||
      !focusRequest.folderId) {
      return
    }
    candidateRefs.current.get(focusRequest.folderId)?.focus({ preventScroll: focusRequest.preventScroll })
  }, [focusRequest])

  const setCandidateRef = (folderId: string) => (element: HTMLButtonElement | null) => {
    if (element) {
      candidateRefs.current.set(folderId, element)
      return
    }
    candidateRefs.current.delete(folderId)
  }

  if (state.type === 'empty') {
    return (
      <p className={FOLDER_EMPTY_CLASS} role="status" aria-live="polite">
        {state.message}
      </p>
    )
  }

  return (
    <>
      {state.items.map((item) => (
        <FolderCandidateItem
          buttonRef={setCandidateRef(item.folderId)}
          item={item}
          key={item.folderId}
        />
      ))}
    </>
  )
}

function FolderCandidateItem({
  buttonRef,
  item
}: {
  buttonRef: (element: HTMLButtonElement | null) => void
  item: NewtabFolderCandidateItemView
}) {
  return (
    <Button
      className={FOLDER_CANDIDATE_CARD_CLASS}
      type="button"
      ref={buttonRef}
      tabIndex={item.active ? 0 : -1}
      title={item.path || item.title}
      aria-pressed={item.selected}
      onClick={() => {
        dispatchNewtabFolderCandidateSelect(item.folderId)
      }}
      onFocus={() => {
        dispatchNewtabFolderCandidateFocus(item.folderId)
      }}
      onKeyDown={(event) => {
        if (dispatchNewtabFolderCandidateKeyDown(event.key, item.folderId)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      unstyled
    >
      <span className={FOLDER_CANDIDATE_COPY_CLASS}>
        <strong className={FOLDER_CANDIDATE_TITLE_CLASS}>{item.title || '未命名文件夹'}</strong>
        <span className={FOLDER_CANDIDATE_META_CLASS}>{`${item.path || item.title || '未命名文件夹'} · ${item.stats}`}</span>
      </span>
      <span className={FOLDER_CANDIDATE_BADGE_CLASS}>{item.badge}</span>
    </Button>
  )
}

function ModuleSettingRow({
  controlRef,
  row
}: {
  controlRef?: Ref<HTMLElement>
  row: NewtabModuleSettingRowView
}) {
  return (
    <div className={settingRowClassName()} data-module-row={row.key}>
      <SettingLabelStack title={row.label} description={row.description} />
      <span className={MODULE_SWITCH_LABEL_CLASS}>
        <SwitchControl
          aria-label={`${row.enabled ? '隐藏' : '显示'}模块：${row.label}`}
          checked={row.enabled}
          className={SETTINGS_SWITCH_CLASS}
          data-module-setting-toggle={row.key}
          onCheckedChange={(checked) => {
            dispatchNewtabModuleSettingToggle(row.key, checked)
          }}
          rootRef={controlRef}
          syncInputState
          thumbClassName={SETTINGS_SWITCH_THUMB_CLASS}
          unstyled
        />
      </span>
    </div>
  )
}

function handleBackgroundFileChange(mediaType: 'image' | 'video', file: File | null): void {
  if (!file) return
  dispatchNewtabBackgroundFileSelect(mediaType, file)
}

const BackgroundSettingsSection = memo(function BackgroundSettingsSection({
  firstControlRef,
  panelElement,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLButtonElement>
  panelElement: HTMLElement | null
  sectionRef?: SettingsSectionRef
}) {
  const backgroundSettings = useNewtabBackgroundSettingsView()
  const featuredPickerRef = useRef<HTMLButtonElement | null>(null)
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const videoFileInputRef = useRef<HTMLInputElement | null>(null)

  useLayoutEffect(() => {
    setNewtabFeaturedBackgroundPickerNodes({
      trigger: featuredPickerRef.current
    })
    return () => {
      setNewtabFeaturedBackgroundPickerNodes({
        trigger: null
      })
    }
  }, [])

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="appearance" aria-labelledby="settings-background-title">
      <h2 id="settings-background-title" className={SETTINGS_SECTION_TITLE_CLASS}>背景</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SettingsSelect
          id="background-type"
          label="背景类型"
          description="可选择精选图库、纯色、本地图片/视频或远程图片链接。"
          ariaLabel="背景类型"
          onValueChange={(value) => {
            if (value) dispatchNewtabBackgroundSettingFieldChange('type', value)
          }}
          portalContainer={panelElement}
          triggerRef={firstControlRef}
          value={backgroundSettings.type}
          options={[
            ['featured', '精选图库'],
            ['image', '图片'],
            ['video', '视频'],
            ['urls', '图片链接'],
            ['color', '纯色']
          ]}
        />
        <div id="background-featured-row" className={settingRowClassName()} hidden={backgroundSettings.featuredPickerHidden}>
          <SettingLabelStack title="精选图库" description="主动选择后会访问 NASA、Wikimedia Commons、The Met 等第三方图片域名并自动缓存。" />
          <Button
            unstyled
            id="background-featured-picker"
            ref={featuredPickerRef}
            className={settingsControlClassName(SETTINGS_PICKER_BUTTON_CLASS, backgroundSettings.featuredPickerSelected ? SETTINGS_SELECTED_SURFACE_CLASS : undefined)}
            type="button"
            aria-haspopup="dialog"
            aria-controls="background-featured-modal"
            aria-expanded={backgroundSettings.featuredPickerExpanded ? 'true' : 'false'}
            disabled={backgroundSettings.featuredPickerDisabled}
            onClick={() => {
              dispatchNewtabSettingsDrawerFeaturedPickerClick()
            }}
          >
            <span id="background-featured-picker-label">{backgroundSettings.featuredPickerLabel}</span>
          </Button>
          <Input
            id="background-featured-id"
            type="hidden"
            value={backgroundSettings.featuredId}
            onChange={(event) => dispatchNewtabBackgroundSettingFieldChange('featuredId', event.currentTarget.value)}
            unstyled
          />
        </div>
        <div id="background-featured-credit-row" className={BACKGROUND_CREDIT_ROW_CLASS} hidden={backgroundSettings.featuredCreditHidden}>
          <span className={BACKGROUND_CREDIT_LABEL_CLASS}>来源</span>
          <span aria-hidden="true" className="shrink-0 text-ds-text-disabled">·</span>
          <a
            id="background-featured-credit"
            className={BACKGROUND_CREDIT_CLASS}
            href={backgroundSettings.featuredCreditHref}
            aria-label={`打开图片来源：${backgroundSettings.featuredCreditText}`}
            title={backgroundSettings.featuredCreditTitle}
            target="_blank"
            rel="noreferrer"
          >
            <span className={BACKGROUND_CREDIT_TEXT_CLASS}>{backgroundSettings.featuredCreditText}</span>
            <Icon className={BACKGROUND_CREDIT_ICON_CLASS} name="ExternalLink" size={13} aria-hidden="true" />
          </a>
        </div>
        <SliderRow rowId="background-featured-display-size-row" id="background-featured-display-size" label="背景大小" valueId="background-featured-display-size-value" value={`${backgroundSettings.displaySize}%`} min={String(backgroundSettings.displaySizeMin)} max={String(backgroundSettings.displaySizeMax)} defaultValue="100" ariaLabel="精选图库背景大小" hidden={backgroundSettings.featuredDisplayHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('displaySize', value)} sliderValue={backgroundSettings.displaySize} />
        <SliderRow rowId="background-featured-position-x-row" id="background-featured-position-x" label="水平位置" valueId="background-featured-position-x-value" value={`${backgroundSettings.positionX}%`} min={String(backgroundSettings.positionXMin)} max={String(backgroundSettings.positionXMax)} defaultValue="50" ariaLabel="精选图库背景水平位置" hidden={backgroundSettings.featuredDisplayHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('positionX', value)} sliderValue={backgroundSettings.positionX} />
        <SliderRow rowId="background-featured-position-y-row" id="background-featured-position-y" label="垂直位置" valueId="background-featured-position-y-value" value={`${backgroundSettings.positionY}%`} min={String(backgroundSettings.positionYMin)} max={String(backgroundSettings.positionYMax)} defaultValue="50" ariaLabel="精选图库背景垂直位置" hidden={backgroundSettings.featuredDisplayHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('positionY', value)} sliderValue={backgroundSettings.positionY} />
        <label id="background-color-row" className={settingRowClassName()} htmlFor="background-color" hidden={backgroundSettings.type !== 'color'}>
          <span className={SETTINGS_LABEL_CLASS}>背景颜色</span>
          <span id="background-color-control" className={SETTING_COLOR_CLASS}>
            <span id="background-color-value" className={SETTING_COLOR_VALUE_CLASS}>{backgroundSettings.color.toUpperCase()}</span>
            <Input
              id="background-color"
              className={settingsInputClassName(SETTING_COLOR_INPUT_CLASS)}
              type="color"
              value={backgroundSettings.color}
              onChange={(event) => dispatchNewtabBackgroundSettingFieldChange('color', event.currentTarget.value)}
              aria-label="背景颜色"
              unstyled
            />
          </span>
        </label>
        <div id="background-image-row" className={settingRowClassName()} hidden={backgroundSettings.imageRowHidden}>
          <span className={SETTINGS_LABEL_CLASS}>背景图片</span>
          <Button unstyled id="background-image-picker" className={settingsControlClassName(SETTINGS_PICKER_BUTTON_CLASS)} type="button" title={backgroundSettings.imageName || undefined} onClick={() => imageFileInputRef.current?.click()}>{backgroundSettings.imageName ? '更换图片' : '选择图片'}</Button>
          <Input
            id="background-image-file"
            ref={imageFileInputRef}
            className={settingsInputClassName(SETTINGS_FILE_INPUT_CLASS)}
            type="file"
            accept="image/*"
            onChange={(event) => {
              handleBackgroundFileChange('image', event.currentTarget.files?.[0] || null)
              event.currentTarget.value = ''
            }}
            unstyled
          />
        </div>
        <div id="background-video-row" className={settingRowClassName()} hidden={backgroundSettings.videoRowHidden}>
          <span className={SETTINGS_LABEL_CLASS}>背景视频</span>
          <Button unstyled id="background-video-picker" className={settingsControlClassName(SETTINGS_PICKER_BUTTON_CLASS)} type="button" title={backgroundSettings.videoName || undefined} onClick={() => videoFileInputRef.current?.click()}>{backgroundSettings.videoName ? '更换视频' : '选择视频'}</Button>
          <Input
            id="background-video-file"
            ref={videoFileInputRef}
            className={settingsInputClassName(SETTINGS_FILE_INPUT_CLASS)}
            type="file"
            accept="video/*"
            onChange={(event) => {
              handleBackgroundFileChange('video', event.currentTarget.files?.[0] || null)
              event.currentTarget.value = ''
            }}
            unstyled
          />
        </div>
        <div id="background-url-row" className={settingRowClassName()} hidden={backgroundSettings.urlRowHidden}>
          <span className={SETTINGS_LABEL_CLASS}>图片链接</span>
          <span className={SETTINGS_FIELD_CLASS}>
            <Input
              id="background-url"
              className={SETTINGS_TEXT_INPUT_CLASS}
              type="url"
              placeholder="图片链接"
              aria-label="背景图片链接"
              spellCheck={false}
              value={backgroundSettings.url}
              onBlur={dispatchNewtabBackgroundUrlCommit}
              onChange={(event) => dispatchNewtabBackgroundSettingFieldChange('url', event.currentTarget.value)}
              unstyled
            />
          </span>
        </div>
        <output
          id="background-status"
          className={SETTINGS_STATUS_CLASS}
          aria-live="polite"
          data-tone={backgroundSettings.backgroundStatusTone}
          hidden={!backgroundSettings.backgroundStatus}
        >
          {backgroundSettings.backgroundStatus}
        </output>
        <SwitchRow
          id="background-mask-enabled"
          title="背景蒙版"
          description="提升复杂背景上的图标和文字可读性。"
          checked={backgroundSettings.maskEnabled}
          onCheckedChange={dispatchNewtabBackgroundMaskToggle}
        />
        <SliderRow rowId="background-mask-overlay-row" id="background-mask-overlay" label="遮罩效果" valueId="background-mask-overlay-value" value={`${backgroundSettings.maskOverlay}%`} min="0" max="100" defaultValue="50" ariaLabel="背景遮罩效果" hidden={backgroundSettings.maskStyleHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskOverlay', snapBackgroundMaskPercentage(value))} sliderValue={backgroundSettings.maskOverlay} ticks={['透明', '默认', '覆盖']} />
        <div id="background-mask-style-row" className={settingRowClassName()} hidden={backgroundSettings.maskStyleHidden}>
          <span className={SETTINGS_LABEL_CLASS}>蒙版样式</span>
          <Select
            id="background-mask-style"
            ariaLabel="背景蒙版样式"
            onValueChange={(value) => {
              if (value) dispatchNewtabBackgroundSettingFieldChange('maskStyle', value)
            }}
            options={[
              { value: 'dark', label: '深色渐变' },
              { value: 'frosted', label: '磨砂玻璃' },
              { value: 'noise', label: '胶片噪点' },
              { value: 'light', label: '柔光渐变' },
              { value: 'grain', label: '胶片颗粒' },
              { value: 'halftone', label: '单色网点' },
              { value: 'ascii', label: 'ASCII 字符' },
              { value: 'paper-texture', label: '纸张纹理' },
              { value: 'fluted-glass', label: '条纹玻璃' },
              { value: 'water', label: '水面折射' },
              { value: 'image-dithering', label: '图像抖动' },
              { value: 'halftone-dots', label: '彩色网点' },
              { value: 'halftone-cmyk', label: 'CMYK 网点' }
            ]}
            popupClassName={SETTINGS_SELECT_POPUP_CLASS}
            popupAttributes={DRAWER_PORTALED_CONTENT_ATTRIBUTES}
            modal={false}
            portalContainer={panelElement}
            positionerClassName={SETTINGS_SELECT_POSITIONER_CLASS}
            syncInputState
            triggerClassName={SETTINGS_SELECT_TRIGGER_CLASS}
            value={backgroundSettings.maskStyle}
            valueClassName={SETTINGS_SELECT_VALUE_CLASS}
          />
        </div>
        <SwitchRow
          id="background-mask-filter-hover"
          title="悬停效果"
          description="在空白背景区域移动指针时增强附近的滤镜纹理。"
          checked={backgroundSettings.maskFilterHover}
          hidden={backgroundSettings.maskFilterHoverHidden}
          onCheckedChange={dispatchNewtabBackgroundFilterHoverToggle}
        />
        <SliderRow rowId="background-mask-blur-row" id="background-mask-blur" label="模糊程度" valueId="background-mask-blur-value" value={`${backgroundSettings.maskBlur}px`} min="0" max="32" defaultValue="12" ariaLabel="背景蒙版模糊程度" hidden={backgroundSettings.maskBlurHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskBlur', value)} sliderValue={backgroundSettings.maskBlur} />
        <SliderRow rowId="background-mask-filter-strength-row" id="background-mask-filter-strength" label="采样强度" valueId="background-mask-filter-strength-value" value={`${backgroundSettings.maskFilterStrength}%`} min="0" max="100" defaultValue="50" ariaLabel="壁纸滤镜采样强度" hidden={backgroundSettings.maskFilterStrengthHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskFilterStrength', snapBackgroundMaskPercentage(value))} sliderValue={backgroundSettings.maskFilterStrength} ticks={['0', '默认', '100%']} />
        <SliderRow rowId="background-mask-filter-size-row" id="background-mask-filter-size" label="大小" valueId="background-mask-filter-size-value" value={`${backgroundSettings.maskFilterSize}%`} min="0" max="100" defaultValue="50" ariaLabel="壁纸滤镜元素大小" hidden={backgroundSettings.maskFilterSizeHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskFilterSize', snapBackgroundMaskPercentage(value))} sliderValue={backgroundSettings.maskFilterSize} ticks={['0', '默认', '100%']} />
        <SliderRow rowId="background-mask-filter-spacing-row" id="background-mask-filter-spacing" label="间距" valueId="background-mask-filter-spacing-value" value={`${backgroundSettings.maskFilterSpacing}%`} min="0" max="100" defaultValue="50" ariaLabel="壁纸滤镜元素间距" hidden={backgroundSettings.maskFilterSpacingHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskFilterSpacing', snapBackgroundMaskPercentage(value))} sliderValue={backgroundSettings.maskFilterSpacing} ticks={['0', '默认', '100%']} />
      </Surface>
    </section>
  )
})

const IconSettingsSection = memo(function IconSettingsSection() {
  const iconPreview = useNewtabIconPreviewView()
  const previewStyle = {
    '--preview-page-width': `${iconPreview.pageWidth}%`,
    '--preview-column-gap': `${iconPreview.previewColumnGap}px`,
    '--preview-grid-max-width': `${iconPreview.previewGridMaxWidth}px`,
    '--preview-row-gap': `${iconPreview.previewRowGap}px`,
    '--preview-shell-size': `${iconPreview.previewShellSize}px`,
    '--preview-tile-width': `${iconPreview.previewTileWidth}px`,
    '--preview-title-lines': String(iconPreview.titleLines)
  } as React.CSSProperties

  return (
    <section className={SETTINGS_SECTION_CLASS} data-settings-group="appearance" aria-labelledby="settings-icon-title">
      <h2 id="settings-icon-title" className={SETTINGS_SECTION_TITLE_CLASS}>书签卡片</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <div className={ICON_PREVIEW_PANEL_CLASS}>
          <div className={ICON_PREVIEW_HEADER_CLASS}>
            <span>实时预览</span>
            <span id="icon-live-preview-summary" className={ICON_PREVIEW_SUMMARY_CLASS}>
              {iconPreview.summary}
            </span>
          </div>
          <figure
            id="icon-live-preview"
            className={ICON_LIVE_PREVIEW_CLASS}
            aria-label="书签卡片布局预览"
            data-icon-layout-mode={iconPreview.layoutMode}
            style={previewStyle}
          >
            <div
              className={ICON_LIVE_PREVIEW_GRID_CLASS}
              style={{ gridTemplateColumns: `repeat(${iconPreview.columns}, minmax(0, 1fr))` }}
            >
              {iconPreview.tiles.map((item) => (
                <span className={ICON_LIVE_PREVIEW_TILE_CLASS} key={item.id}>
                  <span className={ICON_LIVE_PREVIEW_SHELL_CLASS}>
                    <span className={ICON_LIVE_PREVIEW_MARK_CLASS}>{item.mark}</span>
                  </span>
                  {iconPreview.showTitles ? <span className={ICON_LIVE_PREVIEW_TITLE_CLASS}>{item.title}</span> : null}
                </span>
              ))}
            </div>
          </figure>
        </div>
        <div id="icon-preset-row" className={ICON_PRESET_ROW_CLASS}>
          {iconPresetCards.map((card) => (
            <Button
              className={cx(
                ICON_PRESET_CARD_CLASS,
                SETTINGS_PSEUDO_SHADOW_RESET_CLASS,
                iconPreview.preset === card.key ? SETTINGS_SELECTED_SURFACE_CLASS : undefined
              )}
              type="button"
              data-preset={card.key}
              aria-pressed={iconPreview.preset === card.key}
              aria-label={`${card.name}布局，${card.desc}，${card.detail}`}
              onClick={() => dispatchNewtabIconPresetApply(card.key)}
              key={card.key}
              unstyled
            >
              <span
                className={ICON_PRESET_PREVIEW_CLASS}
                style={{
                  gap: card.previewGap,
                  gridTemplateColumns: `repeat(${card.previewColumnCount}, 1fr)`,
                  padding: card.previewPadding
                }}
              >
                {Array.from({ length: card.previewColumnCount * card.previewRowCount }, (_, index) => (
                  <span
                    className={ICON_PRESET_PREVIEW_CELL_CLASS}
                    style={{ height: card.previewCellHeight }}
                    key={`${card.key}:${index}`}
                  />
                ))}
              </span>
              <span className={ICON_PRESET_NAME_CLASS}>{card.name}</span>
              <span className={ICON_PRESET_DETAIL_CLASS}>{card.desc}</span>
              <span className={ICON_PRESET_DETAIL_CLASS}>{card.detail}</span>
            </Button>
          ))}
        </div>
        <div className={settingRowClassName(ICON_CONTROL_ROW_CLASS)}>
          <SettingLabelStack title="布局方式" description="自动适配屏幕宽度；固定列数会在窄屏收缩。" />
          <ToggleGroup
            id="icon-layout-control"
            aria-label="布局方式"
            className={SETTINGS_SEGMENTED_CLASS}
            itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
            onValueChange={(value) => {
              const nextValue = value[0]
              if (nextValue) dispatchNewtabIconSettingFieldChange('layoutMode', nextValue)
            }}
            items={[
              { value: 'auto', label: '自动适配', attributes: { 'data-icon-layout-mode': 'auto' } },
              { value: 'fixed', label: '固定列数', attributes: { 'data-icon-layout-mode': 'fixed' } }
            ]}
            unstyled
            value={iconPreview.layoutMode}
          />
        </div>
        <SwitchRow
          id="icon-vertical-center"
          title="垂直居中"
          description="书签较少时让主内容贴近屏幕中部。"
          checked={iconPreview.verticalCenter}
          onCheckedChange={dispatchNewtabIconVerticalCenterToggle}
        />
        <SwitchRow
          id="icon-show-titles"
          title="显示标题"
          description="关闭后卡片收缩为只显示网站图标。"
          checked={iconPreview.showTitles}
          onCheckedChange={dispatchNewtabIconShowTitlesToggle}
        />
        <div id="icon-title-lines-row" className={settingRowClassName(ICON_CONTROL_ROW_CLASS, iconPreview.titleLinesDisabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)}>
          <span className={SETTINGS_LABEL_CLASS}>标题行数</span>
          <ToggleGroup
            id="icon-title-lines-control"
            aria-label="标题行数"
            className={SETTINGS_SEGMENTED_CLASS}
            itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
            onValueChange={(value) => {
              const nextValue = value[0]
              if (nextValue) dispatchNewtabIconSettingFieldChange('titleLines', Number(nextValue))
            }}
            items={[
              { value: '1', label: '1 行', disabled: iconPreview.titleLinesDisabled, attributes: { 'data-icon-title-lines': '1' } },
              { value: '2', label: '2 行', disabled: iconPreview.titleLinesDisabled, attributes: { 'data-icon-title-lines': '2' } }
            ]}
            unstyled
            value={String(iconPreview.titleLines)}
          />
        </div>
        <CollapsibleRoot>
          <CollapsibleTrigger
            id="icon-advanced-toggle"
            className={settingsControlClassName(SETTINGS_WIDE_BUTTON_CLASS)}
            aria-controls="icon-advanced-panel"
          >
            <span>卡片细节</span>
          </CollapsibleTrigger>
          <CollapsiblePanel id="icon-advanced-panel" className={ICON_ADVANCED_PANEL_CLASS}>
            <div className={FOLDER_STACK_CLASS}>
              <Button unstyled id="icon-reset-defaults" className={settingsControlClassName(ICON_RESET_DEFAULTS_CLASS)} type="button" onClick={dispatchNewtabIconResetDefaults}>恢复默认布局</Button>
              <SliderRow id="icon-page-width" label="页面宽度" valueId="icon-page-width-value" value={`${iconPreview.pageWidth}%`} min="16" max="100" defaultValue="78" ariaLabel="书签卡片页面宽度" onValueChange={(value) => dispatchNewtabIconSettingFieldChange('pageWidth', value)} sliderValue={iconPreview.pageWidth} />
              <SliderRow rowId="icon-tile-width-row" id="icon-tile-width" label="卡片宽度" valueId="icon-tile-width-value" value={`${iconPreview.tileWidth}px`} min="132" max="260" defaultValue="184" ariaLabel="书签卡片宽度" disabled={iconPreview.tileWidthDisabled} onValueChange={(value) => dispatchNewtabIconSettingFieldChange('tileWidth', value)} sliderValue={iconPreview.tileWidth} />
              <SliderRow id="icon-shell-size" label="图标区域" valueId="icon-shell-size-value" value={`${iconPreview.iconShellSize}px`} min="24" max="48" defaultValue="32" ariaLabel="书签图标区域尺寸" onValueChange={(value) => dispatchNewtabIconSettingFieldChange('iconShellSize', value)} sliderValue={iconPreview.iconShellSize} />
              <SliderRow id="icon-column-gap" label="横向间距" valueId="icon-column-gap-value" value={`${iconPreview.effectiveColumnGap}px`} min="0" max="100" defaultValue="10" ariaLabel="书签卡片横向间距" onValueChange={(value) => dispatchNewtabIconSettingFieldChange('columnGap', value)} sliderValue={iconPreview.columnGap} />
              <SliderRow id="icon-row-gap" label="行距" valueId="icon-row-gap-value" value={`${iconPreview.effectiveRowGap}px`} min="0" max="100" defaultValue="10" ariaLabel="书签卡片行距" onValueChange={(value) => dispatchNewtabIconSettingFieldChange('rowGap', value)} sliderValue={iconPreview.rowGap} />
              <SliderRow id="icon-folder-gap" label="文件夹间距" valueId="icon-folder-gap-value" value={`${iconPreview.effectiveFolderGap}px`} min="0" max="120" defaultValue="20" ariaLabel="书签文件夹间距" onValueChange={(value) => dispatchNewtabIconSettingFieldChange('folderGap', value)} sliderValue={iconPreview.folderGap} />
              <SliderRow rowId="icon-columns-row" id="icon-columns" label="固定列数" valueId="icon-columns-value" value={String(iconPreview.fixedColumns)} min="2" max="8" defaultValue="4" ariaLabel="书签卡片固定列数" disabled={iconPreview.fixedColumnsDisabled} onValueChange={(value) => dispatchNewtabIconSettingFieldChange('columns', value)} sliderValue={iconPreview.fixedColumns} />
            </div>
          </CollapsiblePanel>
        </CollapsibleRoot>
      </Surface>
    </section>
  )
})

const iconPresetCards = (Object.entries(ICON_PRESET_META) as Array<[
  IconLayoutPresetKey,
  typeof ICON_PRESET_META[IconLayoutPresetKey]
]>).map(([key, meta]) => ({
  desc: meta.desc,
  detail: meta.detail,
  key,
  name: meta.name,
  previewCellHeight: key === 'compact' ? '8px' : key === 'spacious' ? '12px' : '10px',
  previewColumnCount: meta.cols,
  previewGap: key === 'compact' ? '3px' : key === 'spacious' ? '5px' : '4px',
  previewPadding: '0 4px',
  previewRowCount: meta.rows
}))

const TimeSettingsSection = memo(function TimeSettingsSection({ panelElement }: { panelElement: HTMLElement | null }) {
  const timeSettings = useNewtabTimeSettingsView()

  return (
    <section className={SETTINGS_SECTION_CLASS} data-settings-group="appearance" aria-labelledby="settings-time-title">
      <h2 id="settings-time-title" className={SETTINGS_SECTION_TITLE_CLASS}>时间和日期</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SwitchRow
          id="time-enabled"
          title="显示时间模块"
          description="放在搜索栏上方，关闭后保留原布局间距。"
          checked={timeSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('enabled', checked)}
        />
        <SettingsSelect
          id="time-display-mode"
          label="显示内容"
          description="保留时间+日期、仅时间、仅日期三种模式。"
          ariaLabel="时间显示内容"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('displayMode', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.displayMode}
          options={[['time-date', '时间和日期'], ['time', '仅时间'], ['date', '仅日期']]}
        />
        <SettingsSelect
          id="time-time-zone"
          label="时区"
          description="自动跟随系统，也可固定为常用城市。"
          ariaLabel="时区"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('timeZone', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.timeZone}
          options={[['auto', '自动跟随系统'], ['UTC', 'UTC'], ['Asia/Shanghai', '北京'], ['Asia/Hong_Kong', '香港'], ['Asia/Tokyo', '东京'], ['Asia/Singapore', '新加坡'], ['Europe/London', '伦敦'], ['Europe/Paris', '巴黎'], ['America/New_York', '纽约'], ['America/Los_Angeles', '洛杉矶']]}
        />
        <SettingsSelect
          id="time-date-format"
          label="日期格式"
          description="仅在显示日期时生效。"
          ariaLabel="日期格式"
          disabled={timeSettings.settingsDisabled || timeSettings.displayMode === 'time'}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('dateFormat', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.dateFormat}
          options={[['year-month-day-weekday', '2026.05.01 周五'], ['chinese-date-weekday', '2026年5月1日 周五'], ['month-day-weekday', '05.01 周五'], ['weekday-month-day', '周五 05/01'], ['weekday-day-month', '周五 01/05'], ['year-month-day', '2026.05.01']]}
        />
        <SwitchRow
          id="time-show-seconds"
          title="显示秒数"
          description="开启后每秒更新；关闭时按分钟更新以减少渲染。"
          checked={timeSettings.showSeconds}
          disabled={timeSettings.switchesDisabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('showSeconds', checked)}
        />
        <SwitchRow
          id="time-hour12"
          title="12 小时制"
          description="显示 AM/PM，24 小时制会隐藏该标记。"
          checked={timeSettings.hour12}
          disabled={timeSettings.switchesDisabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('hour12', checked)}
        />
        <SettingsSelect
          id="time-density"
          label="布局密度"
          description="切换时间模块的排版结构，不改变字号。"
          ariaLabel="时间布局密度"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('density', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.density}
          options={[['compact', '极简单行'], ['balanced', '平衡胶囊'], ['comfortable', '独立卡片']]}
        />
        <SliderRow
          id="time-clock-size"
          label="字号"
          valueId="time-clock-size-value"
          value={`${timeSettings.clockSize}%`}
          min="70"
          max="140"
          defaultValue="100"
          ariaLabel="时间字号"
          description="只影响时间和日期，不改变搜索和书签区域。"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => dispatchNewtabTimeSettingFieldChange('clockSize', value)}
          sliderValue={timeSettings.clockSize}
        />
      </Surface>
    </section>
  )
})

const SearchSettingsSection = memo(function SearchSettingsSection({
  firstControlRef,
  panelElement,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLElement>
  panelElement: HTMLElement | null
  sectionRef?: SettingsSectionRef
}) {
  const searchSettings = useNewtabSearchSettingsView()
  const enabledEngineSet = new Set(searchSettings.enabledEngines)
  const handleSearchEngineToggle = (engine: string, checked: boolean) => {
    const currentEngines = searchSettings.enabledEngines.includes(searchSettings.engine)
      ? searchSettings.enabledEngines
      : [...searchSettings.enabledEngines, searchSettings.engine]
    const nextEngines = checked
      ? [...new Set([...currentEngines, engine])]
      : currentEngines.filter((item) => item !== engine)

    dispatchNewtabSearchSettingFieldChange('enabledEngines', nextEngines)
  }

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="search" aria-labelledby="settings-search-title">
      <h2 id="settings-search-title" className={SETTINGS_SECTION_TITLE_CLASS}>搜索栏</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <p className={SETTINGS_NOTE_CLASS}>仅影响 Curator 新标签页内搜索，不会修改 Chrome 默认搜索引擎或启动页；搜索栏可随时关闭。</p>
        <SwitchRow
          id="search-enabled"
          title="启用"
          description="在新标签页顶部搜索本地书签、命令和可选网页搜索。"
          controlRef={firstControlRef}
          checked={searchSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('enabled', checked)}
        />
        <SwitchRow
          id="search-web-enabled"
          title="启用网页搜索"
          description="提交网页搜索时，关键词会发送给所选搜索引擎；关闭后仅保留本地书签搜索。"
          checked={searchSettings.webSearchEnabled}
          disabled={searchSettings.webSearchDisabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('webSearchEnabled', checked)}
        />
        <SwitchRow
          id="search-open-new-tab"
          title="在新标签页打开链接"
          description="保留当前 Curator 新标签页。"
          checked={searchSettings.openInNewTab}
          disabled={searchSettings.openInNewTabDisabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('openInNewTab', checked)}
        />
        <SettingsSelect
          id="search-engine"
          label="搜索引擎"
          description="输入内容不是网址时使用此引擎。"
          ariaLabel="默认搜索引擎"
          disabled={searchSettings.engineControlsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabSearchSettingFieldChange('engine', value)
          }}
          portalContainer={panelElement}
          value={searchSettings.engine}
          options={searchEngines.map(([value, label]) => [value, label])}
        />
        <div className={settingRowClassName(SEARCH_ENGINE_ROW_CLASS)}>
          <SettingLabelStack title="启用引擎" description="决定搜索框快捷菜单和 Cmd/Ctrl+Enter 的打开顺序。" />
          <div className={SEARCH_ENGINE_GRID_CLASS} aria-label="启用的搜索引擎">
            {searchEngines.map(([value, label]) => {
              const isSelected = searchSettings.engine === value
              const checked = enabledEngineSet.has(value) || isSelected

              return (
              <label
                className={settingsControlClassName(SEARCH_ENGINE_TOGGLE_CLASS, checked ? SETTINGS_SELECTED_SURFACE_CLASS : undefined, isSelected ? 'opacity-80' : undefined)}
                key={value}
              >
                <SwitchControl
                  aria-label={label}
                  checked={checked}
                  disabled={searchSettings.engineControlsDisabled || isSelected}
                  className={SEARCH_ENGINE_HIDDEN_SWITCH_CLASS}
                  data-search-engine-toggle={value}
                  onCheckedChange={(checked) => handleSearchEngineToggle(value, checked)}
                  syncInputState
                  unstyled
                />
                <span>{label}</span>
              </label>
              )
            })}
          </div>
        </div>
        <div className={settingRowClassName()}>
          <span className={SETTINGS_LABEL_CLASS}>占位符文本</span>
          <span className={SETTINGS_FIELD_CLASS}>
            <Input
              id="search-placeholder"
              className={SETTINGS_TEXT_INPUT_CLASS}
              type="text"
              placeholder="占位符文本"
              maxLength={40}
              aria-label="搜索栏占位符文本"
              disabled={searchSettings.placeholderDisabled}
              onChange={(event) => {
                dispatchNewtabSearchSettingFieldChange('placeholder', event.currentTarget.value)
              }}
              value={searchSettings.placeholder}
              unstyled
            />
          </span>
        </div>
        <SliderRow
          id="search-width"
          label="宽度"
          valueId="search-width-value"
          value={`${searchSettings.width}vw`}
          min={String(searchSettings.widthMin)}
          max={String(searchSettings.widthMax)}
          defaultValue="44"
          ariaLabel="搜索栏宽度"
          disabled={searchSettings.widthDisabled}
          onValueChange={(value) => dispatchNewtabSearchSettingFieldChange('width', value)}
          sliderValue={searchSettings.width}
        />
        <SliderRow
          id="search-height"
          label="高度"
          valueId="search-height-value"
          value={`${searchSettings.height}px`}
          min="28"
          max="56"
          defaultValue="40"
          ariaLabel="搜索栏高度"
          disabled={searchSettings.widthDisabled}
          onValueChange={(value) => dispatchNewtabSearchSettingFieldChange('height', value)}
          sliderValue={searchSettings.height}
        />
        <SliderRow
          id="search-offset-y"
          label="上下位置"
          valueId="search-offset-y-value"
          value={searchSettings.autoVerticalCenter ? '自动' : `${searchSettings.offsetY}px`}
          min={String(searchSettings.offsetMin)}
          max={String(searchSettings.offsetMax)}
          defaultValue="0"
          ariaLabel="搜索栏上下位置"
          disabled={searchSettings.offsetDisabled}
          onValueChange={(value) => dispatchNewtabSearchSettingFieldChange('offsetY', value)}
          sliderValue={searchSettings.offsetY}
        />
        <SwitchRow
          id="search-auto-vertical-center"
          title="自动垂直居中"
          description="根据上方和下方模块之间的可用空间自动居中搜索栏。"
          checked={searchSettings.autoVerticalCenter}
          disabled={searchSettings.autoVerticalCenterDisabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('autoVerticalCenter', checked)}
        />
        <SliderRow
          id="search-background"
          label="背景"
          valueId="search-background-value"
          value={`${searchSettings.background}%`}
          min={String(NEWTAB_SEARCH_BACKGROUND_MIN)}
          max={String(NEWTAB_SEARCH_BACKGROUND_MAX)}
          defaultValue={String(NEWTAB_SEARCH_BACKGROUND_DEFAULT)}
          ariaLabel="搜索栏背景透明度"
          disabled={searchSettings.backgroundDisabled}
          onValueChange={(value) => dispatchNewtabSearchSettingFieldChange('background', value)}
          sliderValue={searchSettings.background}
        />
      </Surface>
    </section>
  )
})

export function SettingsDrawerHost() {
  const view = useNewtabSettingsDrawerView()

  useEffect(() => {
    dispatchNewtabSettingsDrawerReady()
  }, [])

  return (
    <SettingsDrawer
      open={view.open}
      activeGroup={view.activeGroup}
      onActiveGroupChange={dispatchNewtabSettingsDrawerActiveGroupChange}
      onOpenChange={dispatchNewtabSettingsDrawerOpenChange}
    />
  )
}

function SettingsDrawer({ open, activeGroup, onActiveGroupChange, onOpenChange }: SettingsDrawerProps) {
  const modal = useSettingsDrawerModalMode()
  const [drawerElement, setDrawerElement] = useState<HTMLDivElement | null>(null)
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null)
  const layoutRequest = useNewtabSettingsDrawerLayoutRequest()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const firstControlRefs = useRef<Record<SettingsDrawerSection, HTMLElement | null>>({
    advanced: null,
    appearance: null,
    search: null,
    source: null
  })
  const scrollHostRef = useRef<HTMLDivElement | null>(null)
  const folderCandidateSearchRef = useRef<HTMLInputElement | null>(null)
  const sectionRefs = useRef<Record<SettingsDrawerSection, HTMLElement | null>>({
    advanced: null,
    appearance: null,
    search: null,
    source: null
  })

  useLayoutEffect(() => {
    setNewtabSettingsDrawerNodes({
      drawer: drawerElement,
      panel: panelElement
    })

    return () => {
      setNewtabSettingsDrawerNodes({
        drawer: null,
        panel: null
      })
    }
  }, [drawerElement, panelElement])

  useLayoutEffect(() => {
    if (!open || layoutRequest.requestId === 0) {
      return
    }

    if (layoutRequest.action === 'scroll-top') {
      scrollHostRef.current?.scrollTo({
        top: 0,
        behavior: getMotionAwareScrollBehavior(layoutRequest.behavior)
      })
      return
    }

    if (layoutRequest.action === 'focus-first-control') {
      ;(closeButtonRef.current || panelElement)?.focus()
      return
    }

    if (layoutRequest.action === 'focus-section') {
      const targetSection = sectionRefs.current[layoutRequest.section]
      targetSection?.scrollIntoView({
        block: 'start',
        behavior: getMotionAwareScrollBehavior(layoutRequest.behavior)
      })

      if (layoutRequest.section === 'source') {
        folderCandidateSearchRef.current?.focus()
        return
      }

      firstControlRefs.current[layoutRequest.section]?.focus()
    }
  }, [layoutRequest, open, panelElement])

  const setAdvancedSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.advanced = element
  }, [])
  const setAppearanceSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.appearance = element
  }, [])
  const setSearchSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.search = element
  }, [])
  const setSourceSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.source = element
  }, [])
  const setAdvancedFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.advanced = element
  }, [])
  const setAppearanceFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.appearance = element
  }, [])
  const setSearchFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.search = element
  }, [])

  const handleActiveGroupChange = useCallback((value: string) => {
    onActiveGroupChange(value as SettingsDrawerSection)
  }, [onActiveGroupChange])

  return (
    <DrawerOverlay
      id="newtab-settings-drawer"
      className={cx(
        SETTINGS_DRAWER_CLASS,
        open && modal ? 'pointer-events-auto' : 'pointer-events-none',
        open ? 'open' : ''
      )}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="newtab-settings-trigger"
      modal={modal ? 'trap-focus' : false}
      aria-hidden={open ? 'false' : 'true'}
      inert={!open}
      tabIndex={-1}
      overlayRef={setDrawerElement}
    >
      <DrawerPanel
        className={cx(SETTINGS_DRAWER_PANEL_CLASS, SETTINGS_DRAWER_SURFACE_CLASS)}
        ref={setPanelElement}
        aria-labelledby="newtab-settings-title"
        aria-describedby="newtab-settings-summary"
        initialFocus={false}
        finalFocus={() => getNewtabSettingsDrawerNodes().trigger}
        unanimated
      >
        <SettingsDrawerClose buttonRef={closeButtonRef} className={SETTINGS_CONTROL_CLASS} />

        <div className={SETTINGS_DRAWER_SCROLL_CLASS} ref={scrollHostRef}>
          <TabsRoot
            className={SETTINGS_ROOT_CLASS}
            value={activeGroup}
            onValueChange={handleActiveGroupChange}
          >
            <SettingsDrawerHeader />
            <SettingsDrawerTabs />
            <div className={SETTINGS_TAB_PANELS_CLASS}>
              <SettingsTabPanel value="advanced">
                <AdvancedSettingsSection
                  firstControlRef={setAdvancedFirstControlRef}
                  sectionRef={setAdvancedSectionRef}
                />
              </SettingsTabPanel>
              <SettingsTabPanel value="source">
                <SourceSettingsSection
                  folderCandidateSearchRef={folderCandidateSearchRef}
                  sectionRef={setSourceSectionRef}
                />
              </SettingsTabPanel>
              <SettingsTabPanel value="appearance">
                <BackgroundSettingsSection
                  firstControlRef={setAppearanceFirstControlRef}
                  panelElement={panelElement}
                  sectionRef={setAppearanceSectionRef}
                />
                <IconSettingsSection />
                <TimeSettingsSection panelElement={panelElement} />
              </SettingsTabPanel>
              <SettingsTabPanel value="search">
                <SearchSettingsSection
                  firstControlRef={setSearchFirstControlRef}
                  panelElement={panelElement}
                  sectionRef={setSearchSectionRef}
                />
              </SettingsTabPanel>
            </div>
          </TabsRoot>
        </div>
        <SettingsDrawerScrollBar
          activeGroup={activeGroup}
          open={open}
          scrollHostRef={scrollHostRef}
        />
      </DrawerPanel>
    </DrawerOverlay>
  )
}
