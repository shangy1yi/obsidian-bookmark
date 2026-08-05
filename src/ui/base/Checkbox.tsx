import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type LabelHTMLAttributes,
  type ReactNode,
  type Ref
} from 'react'
import { Icon } from '../icons/Icon'
import { cx } from './utils'

type BaseCheckboxRootProps = ComponentPropsWithoutRef<typeof BaseCheckbox.Root>

export type CheckboxControlProps = Omit<BaseCheckboxRootProps, 'className' | 'children' | 'inputRef'> & {
  className?: string
  indicatorClassName?: string
  inputRef?: Ref<HTMLInputElement>
  syncInputState?: boolean
  unstyled?: boolean
}

export type CheckboxProps = CheckboxControlProps & {
  children?: ReactNode
  label?: ReactNode
  labelAttributes?: Omit<LabelHTMLAttributes<HTMLLabelElement>, 'className' | 'children'> & Record<string, unknown>
  labelClassName?: string
}

export function CheckboxControl({
  className,
  checked: checkedProp,
  defaultChecked,
  disabled: disabledProp,
  indicatorClassName,
  inputRef,
  onCheckedChange,
  syncInputState = false,
  unstyled = false,
  ...props
}: CheckboxControlProps) {
  const [checkedState, setCheckedState] = useState(() => Boolean(checkedProp ?? defaultChecked))
  const [disabledState, setDisabledState] = useState(() => Boolean(disabledProp))
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const checkedRef = useRef(Boolean(checkedProp ?? defaultChecked))
  const disabledRef = useRef(Boolean(disabledProp))
  const checkedControlledRef = useRef(checkedProp !== undefined)
  const disabledControlledRef = useRef(disabledProp !== undefined)

  const checked = checkedProp ?? checkedState
  const disabled = disabledProp ?? disabledState

  checkedRef.current = Boolean(checked)
  disabledRef.current = Boolean(disabled)
  checkedControlledRef.current = checkedProp !== undefined
  disabledControlledRef.current = disabledProp !== undefined

  const handleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputElementRef.current = node
    assignRef(inputRef, node)
  }, [inputRef])

  const handleCheckedChange: BaseCheckboxRootProps['onCheckedChange'] = (nextChecked, eventDetails) => {
    if (checkedProp === undefined) {
      setCheckedState(nextChecked)
    }
    onCheckedChange?.(nextChecked, eventDetails)
  }

  useLayoutEffect(() => {
    if (!syncInputState) {
      return undefined
    }

    const input = inputElementRef.current
    if (!input) {
      return undefined
    }

    const checkedDescriptor = findPropertyDescriptor(input, 'checked')
    const disabledDescriptor = findPropertyDescriptor(input, 'disabled')
    const ownCheckedDescriptor = Object.getOwnPropertyDescriptor(input, 'checked')
    const ownDisabledDescriptor = Object.getOwnPropertyDescriptor(input, 'disabled')

    if (!checkedDescriptor?.get || !checkedDescriptor.set || !disabledDescriptor?.get || !disabledDescriptor.set) {
      return undefined
    }

    Object.defineProperty(input, 'checked', {
      configurable: true,
      get() {
        return checkedDescriptor.get?.call(this)
      },
      set(value) {
        checkedDescriptor.set?.call(this, value)
        const nextChecked = Boolean(value)
        if (!checkedControlledRef.current && checkedRef.current !== nextChecked) {
          checkedRef.current = nextChecked
          setCheckedState(nextChecked)
        }
      }
    })

    Object.defineProperty(input, 'disabled', {
      configurable: true,
      get() {
        return disabledDescriptor.get?.call(this)
      },
      set(value) {
        disabledDescriptor.set?.call(this, value)
        const nextDisabled = Boolean(value)
        if (!disabledControlledRef.current && disabledRef.current !== nextDisabled) {
          disabledRef.current = nextDisabled
          setDisabledState(nextDisabled)
        }
      }
    })

    return () => {
      restorePropertyDescriptor(input, 'checked', ownCheckedDescriptor)
      restorePropertyDescriptor(input, 'disabled', ownDisabledDescriptor)
    }
  }, [syncInputState])

  return (
    <BaseCheckbox.Root
      checked={checked}
      className={unstyled ? className : cx(
        't-check flex size-4 items-center justify-center rounded-ds-sm border border-ds-border bg-ds-surface-1 text-ds-text-primary outline-none transition-[background-color,border-color,color,transform] duration-ds-fast ease-ds-standard data-[checked]:border-ds-border-hover data-[checked]:bg-ds-accent data-[checked]:text-ds-accent-contrast focus-visible:border-ds-focus focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] motion-reduce:transition-none motion-reduce:active:scale-100',
        className
      )}
      disabled={disabled}
      inputRef={handleInputRef}
      onCheckedChange={handleCheckedChange}
      {...props}
    >
      <BaseCheckbox.Indicator keepMounted={!unstyled} className={unstyled ? indicatorClassName : cx(
        'grid place-items-center',
        indicatorClassName
      )}>
        <Icon name="Check" size={13} aria-hidden="true" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

export function Checkbox({
  className,
  indicatorClassName,
  label,
  labelAttributes,
  labelClassName,
  children,
  ...props
}: CheckboxProps) {
  return (
    <label
      {...labelAttributes}
      className={cx('inline-flex items-center gap-2 text-sm text-ds-text-primary', labelClassName)}
    >
      <CheckboxControl className={className} indicatorClassName={indicatorClassName} {...props} />
      {label ?? children}
    </label>
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
