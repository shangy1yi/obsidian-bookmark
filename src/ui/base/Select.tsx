import { Select as BaseSelect } from '@base-ui/react/select'
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref
} from 'react'
import { Icon } from '../icons/Icon'
import { cx } from './utils'

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  id?: string
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  options: SelectOption[]
  placeholder?: ReactNode
  label?: ReactNode
  ariaLabel?: string
  className?: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  itemClassName?: string
  listClassName?: string
  popupAttributes?: Record<`data-${string}`, string | undefined>
  popupClassName?: string
  portalContainer?: ComponentPropsWithoutRef<typeof BaseSelect.Portal>['container']
  positionerClassName?: string
  modal?: boolean
  syncInputState?: boolean
  triggerRef?: Ref<HTMLButtonElement>
  valueClassName?: string
  triggerClassName?: string
  unstyled?: boolean
}

export function Select({
  id,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select',
  label,
  ariaLabel,
  className,
  disabled: disabledProp,
  inputRef,
  itemClassName,
  listClassName,
  popupAttributes,
  popupClassName,
  portalContainer,
  positionerClassName,
  modal,
  syncInputState = false,
  triggerRef,
  valueClassName,
  triggerClassName,
  unstyled = false
}: SelectProps) {
  const generatedId = useId()
  const rootId = id ? `${id}-root` : `select-${generatedId}`
  const triggerId = id ? `${id}-control` : undefined
  const resolvedDefaultValue = defaultValue ?? null
  const [valueState, setValueState] = useState<string | null>(() => value !== undefined ? value : resolvedDefaultValue)
  const [disabledState, setDisabledState] = useState(() => Boolean(disabledProp))
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const valueRef = useRef<string | null>(value !== undefined ? value : resolvedDefaultValue)
  const disabledRef = useRef(Boolean(disabledProp))
  const valueControlledRef = useRef(value !== undefined)
  const disabledControlledRef = useRef(disabledProp !== undefined)

  const currentValue = value !== undefined ? value : valueState
  const disabled = disabledProp ?? disabledState

  valueRef.current = currentValue
  disabledRef.current = Boolean(disabled)
  valueControlledRef.current = value !== undefined
  disabledControlledRef.current = disabledProp !== undefined

  const itemClassNameResolver = useMemo(() => {
    if (!unstyled) {
      return undefined
    }
    return ({ highlighted }: { highlighted: boolean; selected: boolean; disabled: boolean }) => cx(
      'base-select-option',
      itemClassName,
      highlighted && 'is-active'
    )
  }, [itemClassName, unstyled])

  const handleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputElementRef.current = node
    assignRef(inputRef, node)
  }, [inputRef])

  const handleValueChange = (nextValue: string | null) => {
    if (value === undefined) {
      setValueState(nextValue)
    }
    onValueChange?.(nextValue)
    if (syncInputState) {
      queueMicrotask(() => {
        inputElementRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
  }

  useLayoutEffect(() => {
    if (!syncInputState) {
      return undefined
    }

    const input = inputElementRef.current
    if (!input) {
      return undefined
    }

    const valueDescriptor = findPropertyDescriptor(input, 'value')
    const disabledDescriptor = findPropertyDescriptor(input, 'disabled')
    const ownValueDescriptor = Object.getOwnPropertyDescriptor(input, 'value')
    const ownDisabledDescriptor = Object.getOwnPropertyDescriptor(input, 'disabled')

    if (!valueDescriptor?.get || !valueDescriptor.set || !disabledDescriptor?.get || !disabledDescriptor.set) {
      return undefined
    }

    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return valueDescriptor.get?.call(this)
      },
      set(nextValue) {
        valueDescriptor.set?.call(this, nextValue)
        const normalizedValue = String(nextValue ?? '')
        if (!valueControlledRef.current && valueRef.current !== normalizedValue) {
          valueRef.current = normalizedValue
          setValueState(normalizedValue)
        }
      }
    })

    Object.defineProperty(input, 'disabled', {
      configurable: true,
      get() {
        return disabledDescriptor.get?.call(this)
      },
      set(nextDisabled) {
        disabledDescriptor.set?.call(this, nextDisabled)
        const normalizedDisabled = Boolean(nextDisabled)
        if (!disabledControlledRef.current && disabledRef.current !== normalizedDisabled) {
          disabledRef.current = normalizedDisabled
          setDisabledState(normalizedDisabled)
        }
      }
    })

    return () => {
      restorePropertyDescriptor(input, 'value', ownValueDescriptor)
      restorePropertyDescriptor(input, 'disabled', ownDisabledDescriptor)
    }
  }, [syncInputState])

  return (
    <BaseSelect.Root
      id={rootId}
      value={currentValue}
      inputRef={handleInputRef}
      disabled={disabled}
      modal={modal}
      onValueChange={(nextValue) => handleValueChange(nextValue)}
    >
      <div className={cx('base-select grid gap-1.5', className)}>
        {label ? <BaseSelect.Label className="text-xs text-ds-text-secondary">{label}</BaseSelect.Label> : null}
        <BaseSelect.Trigger
          disabled={disabled}
          id={triggerId}
          aria-label={ariaLabel}
          ref={triggerRef}
          className={unstyled ? cx('base-select-trigger inline-flex items-center gap-2', triggerClassName) : cx(
            'base-select-trigger inline-flex h-9 min-w-36 items-center justify-start gap-2 rounded-md border border-ds-border bg-ds-surface-1 px-3 text-sm text-ds-text-primary outline-none transition-[background-color,border-color,color] duration-ds-fast ease-ds-standard data-[popup-open]:border-ds-border-hover focus-visible:shadow-ds-focus disabled:opacity-50 motion-reduce:transition-none',
            triggerClassName
          )}
        >
          <BaseSelect.Value className={cx('base-select-value min-w-0 flex-1', valueClassName)} placeholder={placeholder}>
            {(selectedValue: string | null) => options.find((option) => option.value === selectedValue)?.label ?? placeholder}
          </BaseSelect.Value>
          <BaseSelect.Icon
            className={cx(
              'pointer-events-none shrink-0 text-ds-text-secondary',
              unstyled ? 'custom-select-trigger-arrow' : 'base-select-trigger-arrow'
            )}
            aria-hidden="true"
          >
            <Icon name="ChevronDown" size={14} aria-hidden="true" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
      </div>
      <BaseSelect.Portal container={portalContainer}>
        <BaseSelect.Positioner className={positionerClassName} sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup
            {...popupAttributes}
            className={unstyled ? cx('base-select-popup t-dropdown overflow-y-auto overscroll-contain', popupClassName) : cx(
            'base-select-popup t-dropdown z-50 max-h-64 min-w-[var(--anchor-width)] overflow-y-auto overscroll-contain rounded-md border border-ds-border bg-ds-surface-2 p-1 text-ds-text-primary [filter:var(--ds-filter-popover)] outline-none',
            popupClassName
          )}
          >
            <BaseSelect.List className={cx('base-select-list', listClassName ?? (unstyled ? undefined : 'contents'))}>
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={itemClassNameResolver ?? cx(
                    'base-select-option flex cursor-default items-center justify-between gap-3 rounded px-2.5 py-2 text-sm outline-none transition-colors duration-ds-fast ease-ds-standard data-[highlighted]:bg-ds-hover data-[disabled]:opacity-45 motion-reduce:transition-none',
                    itemClassName
                  )}
                >
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Icon name="Check" size={14} aria-hidden="true" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return
  }
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ref.current = value
}

function findPropertyDescriptor(element: object, property: string): PropertyDescriptor | undefined {
  let prototype: object | null = Object.getPrototypeOf(element)
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
    if (descriptor) {
      return descriptor
    }
    prototype = Object.getPrototypeOf(prototype)
  }
  return undefined
}

function restorePropertyDescriptor(
  element: object,
  property: string,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(element, property, descriptor)
    return
  }
  delete (element as Record<string, unknown>)[property]
}
