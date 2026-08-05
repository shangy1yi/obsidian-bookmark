import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { SearchIcon, XIcon } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { DialogBackdrop, DialogPanel } from '../base/Dialog'
import { cx } from '../base/utils'

const MODEL_SELECTOR_TRIGGER_CLASS =
  'inline-flex min-h-[50px] w-full touch-manipulation select-none items-center justify-start gap-2 rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3 text-sm font-semibold leading-5 text-ds-text-primary shadow-none outline-none transition-[border-color,background-color,color,transform] duration-ds-fast ease-ds-standard hover:not-disabled:border-ds-border-hover hover:not-disabled:bg-ds-surface-3 focus-visible:border-ds-focus focus-visible:bg-ds-surface-3 focus-visible:shadow-ds-focus active:not-disabled:scale-[var(--ds-press-scale)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:not-disabled:scale-100'
const MODEL_SELECTOR_BACKDROP_CLASS =
  'model-selector-backdrop fixed inset-0 z-[1200] min-h-dvh bg-ds-overlay supports-[-webkit-touch-callout:none]:absolute'
const MODEL_SELECTOR_CONTENT_CLASS =
  'model-selector-content fixed left-1/2 top-[46%] z-[1201] max-h-[min(520px,calc(100dvh-72px))] w-[min(520px,calc(100vw-36px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-ds-lg border border-ds-border bg-ds-surface-2 p-0 text-ds-text-primary [filter:var(--ds-filter-dialog)] outline-none max-[760px]:top-1/2 max-[760px]:w-[min(520px,calc(100vw-24px))]'
const MODEL_SELECTOR_COMMAND_CLASS = 'flex min-h-0 max-h-[inherit] flex-col bg-ds-surface-2'
const MODEL_SELECTOR_INPUT_WRAPPER_CLASS =
  'grid min-h-[50px] grid-cols-[18px_minmax(0,1fr)_18px] items-center gap-2.5 border-b border-ds-border-subtle px-3.5 text-ds-text-muted'
const MODEL_SELECTOR_INPUT_ICON_CLASS = 'size-[17px] text-ds-text-muted'
const MODEL_SELECTOR_CLEAR_BUTTON_CLASS =
  'm-0 inline-flex size-[22px] touch-manipulation cursor-pointer select-none items-center justify-center rounded-ds-sm border-0 bg-transparent p-0 text-ds-text-muted opacity-0 pointer-events-none transition-[background-color,color,opacity,transform] duration-ds-fast ease-ds-standard data-[visible]:pointer-events-auto data-[visible]:opacity-100 hover:bg-ds-hover hover:text-ds-text-primary focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline-none active:scale-[var(--ds-press-scale)] motion-reduce:transition-none motion-reduce:active:scale-100'
const MODEL_SELECTOR_INPUT_CLASS =
  'h-[50px] min-h-[50px] w-full border-0 bg-transparent text-sm font-medium text-ds-text-primary shadow-none outline-none placeholder:text-ds-text-secondary'
const MODEL_SELECTOR_LIST_CLASS =
  'model-selector-list m-0 max-h-[min(400px,calc(100dvh-140px))] list-none overflow-y-auto p-1.5 [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-width:thin]'
const MODEL_SELECTOR_EMPTY_CLASS =
  'model-selector-empty px-3 py-7 text-center text-[13px] text-ds-text-muted empty:p-0'
const MODEL_SELECTOR_GROUP_CLASS = 'model-selector-group'
const MODEL_SELECTOR_GROUP_HEADING_CLASS = 'px-2 pb-1.5 pt-[5px] text-xs font-semibold leading-[1.2] text-ds-accent-text'
const MODEL_SELECTOR_GROUP_ITEMS_CLASS = 'grid list-none gap-px p-0'
const MODEL_SELECTOR_ITEM_CLASS =
  'grid min-h-8 w-full touch-manipulation select-none grid-cols-[16px_minmax(0,1fr)_auto_16px] items-center gap-2 rounded-ds-sm border-0 bg-transparent px-2 text-left text-sm font-semibold text-ds-text-primary outline-none transition-[background-color,color,transform] duration-ds-fast ease-ds-standard hover:bg-ds-hover data-[highlighted]:bg-ds-hover data-[selected]:bg-ds-selected data-[selected]:text-ds-accent-text active:scale-[var(--ds-press-scale)] motion-reduce:transition-none motion-reduce:active:scale-100'
const MODEL_SELECTOR_ITEM_INDICATOR_CLASS =
  'inline-grid size-4 place-items-center opacity-0 data-[selected]:opacity-100'
const MODEL_SELECTOR_LOGO_CLASS = 'size-3 flex-none object-contain invert'
const MODEL_SELECTOR_LOGO_GROUP_CLASS = 'ml-auto inline-flex flex-none items-center'
const MODEL_SELECTOR_TAG_CLASS =
  '-ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-ds-border bg-ds-surface-1 px-[5px] text-[9px] font-bold leading-none text-ds-text-secondary'
const MODEL_SELECTOR_NAME_CLASS =
  'model-selector-name min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap leading-5'

export type ModelSelectorProps = ComponentPropsWithoutRef<typeof BaseDialog.Root>

export function ModelSelector(props: ModelSelectorProps) {
  return <BaseDialog.Root {...props} />
}

export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<typeof BaseDialog.Trigger>

export function ModelSelectorTrigger({ className, ...props }: ModelSelectorTriggerProps) {
  const resolvedClassName: ModelSelectorTriggerProps['className'] =
    typeof className === 'function'
      ? (state) => cx(MODEL_SELECTOR_TRIGGER_CLASS, className(state))
      : cx(MODEL_SELECTOR_TRIGGER_CLASS, className)

  return <BaseDialog.Trigger className={resolvedClassName} {...props} />
}

export interface ModelSelectorComboboxProps {
  children: ReactNode
  filteredItems: readonly string[]
  inputValue: string
  items: readonly string[]
  onInputValueChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onValueChange: (value: string | null) => void
  open: boolean
  value: string | null
}

export function ModelSelectorCombobox({
  children,
  filteredItems,
  inputValue,
  items,
  onInputValueChange,
  onOpenChange,
  onValueChange,
  open,
  value
}: ModelSelectorComboboxProps) {
  return (
    <BaseCombobox.Root<string>
      autoHighlight
      filter={null}
      filteredItems={filteredItems}
      inline
      inputValue={inputValue}
      items={items}
      onInputValueChange={(nextValue) => onInputValueChange(nextValue)}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      onValueChange={(nextValue) => onValueChange(nextValue)}
      open={open}
      value={value}
    >
      {children}
    </BaseCombobox.Root>
  )
}

export interface ModelSelectorContentProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseDialog.Popup>, 'className' | 'children' | 'title'> {
  backdropClassName?: string
  children: ReactNode
  className?: string
  title?: ReactNode
}

export function ModelSelectorContent({
  backdropClassName,
  children,
  className,
  title = 'Model Selector',
  ...props
}: ModelSelectorContentProps) {
  return (
    <BaseDialog.Portal keepMounted={false}>
      <DialogBackdrop className={cx(MODEL_SELECTOR_BACKDROP_CLASS, backdropClassName)} />
      <DialogPanel
        aria-describedby={undefined}
        className={cx(MODEL_SELECTOR_CONTENT_CLASS, className)}
        {...props}
      >
        <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
        <div className={MODEL_SELECTOR_COMMAND_CLASS}>{children}</div>
      </DialogPanel>
    </BaseDialog.Portal>
  )
}

export type ModelSelectorInputProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Input>,
  'className'
> & {
  className?: string
  onClear?: () => void
}

export function ModelSelectorInput({ className, onClear, ...props }: ModelSelectorInputProps) {
  return (
    <div className={MODEL_SELECTOR_INPUT_WRAPPER_CLASS}>
      <SearchIcon className={MODEL_SELECTOR_INPUT_ICON_CLASS} aria-hidden="true" />
      <BaseCombobox.Input className={cx(MODEL_SELECTOR_INPUT_CLASS, className)} {...props} />
      {onClear ? (
        <BaseCombobox.Clear
          type="button"
          className={MODEL_SELECTOR_CLEAR_BUTTON_CLASS}
          aria-label="清空模型搜索"
          keepMounted
          onClick={onClear}
        >
          <XIcon className={MODEL_SELECTOR_INPUT_ICON_CLASS} aria-hidden="true" />
        </BaseCombobox.Clear>
      ) : null}
    </div>
  )
}

export type ModelSelectorListProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.List>,
  'className'
> & {
  className?: string
}

export function ModelSelectorList({ className, ...props }: ModelSelectorListProps) {
  return <BaseCombobox.List className={cx(MODEL_SELECTOR_LIST_CLASS, className)} {...props} />
}

export type ModelSelectorEmptyProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Empty>,
  'className'
> & {
  className?: string
}

export function ModelSelectorEmpty({ className, ...props }: ModelSelectorEmptyProps) {
  return <BaseCombobox.Empty className={cx(MODEL_SELECTOR_EMPTY_CLASS, className)} {...props} />
}

export interface ModelSelectorGroupProps extends Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Group>,
  'className'
> {
  className?: string
  heading: ReactNode
}

export function ModelSelectorGroup({ children, className, heading, ...props }: ModelSelectorGroupProps) {
  return (
    <BaseCombobox.Group className={cx(MODEL_SELECTOR_GROUP_CLASS, className)} {...props}>
      <BaseCombobox.GroupLabel className={MODEL_SELECTOR_GROUP_HEADING_CLASS}>
        {heading}
      </BaseCombobox.GroupLabel>
      <div className={MODEL_SELECTOR_GROUP_ITEMS_CLASS}>{children}</div>
    </BaseCombobox.Group>
  )
}

export interface ModelSelectorItemProps extends Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.Item>,
  'className' | 'value'
> {
  className?: string
  value: string
}

export function ModelSelectorItem({
  children,
  className,
  value,
  ...props
}: ModelSelectorItemProps) {
  return (
    <BaseCombobox.Item
      className={cx(MODEL_SELECTOR_ITEM_CLASS, className)}
      data-ai-model-id={value}
      value={value}
      {...props}
    >
      {children}
    </BaseCombobox.Item>
  )
}

export type ModelSelectorItemIndicatorProps = Omit<
  ComponentPropsWithoutRef<typeof BaseCombobox.ItemIndicator>,
  'className'
> & {
  className?: string
}

export function ModelSelectorItemIndicator({
  className,
  ...props
}: ModelSelectorItemIndicatorProps) {
  return (
    <BaseCombobox.ItemIndicator
      className={cx(MODEL_SELECTOR_ITEM_INDICATOR_CLASS, className)}
      keepMounted
      {...props}
    />
  )
}

export type ModelSelectorShortcutProps = ComponentPropsWithoutRef<'span'>

export type ModelSelectorSeparatorProps = ComponentPropsWithoutRef<'hr'>

export interface ModelSelectorLogoProps extends Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> {
  provider: string
}

export function ModelSelectorLogo({ provider, className, ...props }: ModelSelectorLogoProps) {
  return (
    <img
      alt={`${provider} logo`}
      className={cx(MODEL_SELECTOR_LOGO_CLASS, className)}
      height={12}
      src={`https://models.dev/logos/${provider}.svg`}
      width={12}
      {...props}
    />
  )
}

export type ModelSelectorLogoGroupProps = ComponentPropsWithoutRef<'div'>

export function ModelSelectorLogoGroup({ className, ...props }: ModelSelectorLogoGroupProps) {
  return <div className={cx(MODEL_SELECTOR_LOGO_GROUP_CLASS, className)} {...props} />
}

export type ModelSelectorNameProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorName({ className, ...props }: ModelSelectorNameProps) {
  return <span className={cx(MODEL_SELECTOR_NAME_CLASS, className)} {...props} />
}

export type ModelSelectorTagProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorTag({ className, ...props }: ModelSelectorTagProps) {
  return <span className={cx(MODEL_SELECTOR_TAG_CLASS, className)} {...props} />
}
