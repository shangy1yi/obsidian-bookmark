import { Switch as BaseSwitch } from '@base-ui/react/switch'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref
} from 'react'
import { cx } from './utils'

type BaseSwitchRootProps = ComponentPropsWithoutRef<typeof BaseSwitch.Root>
type InputStyle = ComponentPropsWithoutRef<'input'>['style']

const VISUALLY_HIDDEN_INPUT_STYLE: InputStyle = {
  border: 0,
  clipPath: 'inset(50%)',
  height: 1,
  left: 0,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'fixed',
  top: 0,
  whiteSpace: 'nowrap',
  width: 1
}

export type SwitchControlProps = Omit<BaseSwitchRootProps, 'className' | 'children' | 'inputRef'> & {
  className?: string
  inputRef?: Ref<HTMLInputElement>
  rootRef?: Ref<HTMLElement>
  syncInputState?: boolean
  thumbClassName?: string
  unstyled?: boolean
}

export type SwitchProps = SwitchControlProps & {
  children?: ReactNode
  label?: ReactNode
}

export function SwitchControl({
  className,
  checked: checkedProp,
  defaultChecked,
  disabled: disabledProp,
  inputRef,
  onCheckedChange,
  rootRef,
  syncInputState = false,
  thumbClassName,
  unstyled = false,
  ...props
}: SwitchControlProps) {
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

  const handleCheckedChange: BaseSwitchRootProps['onCheckedChange'] = (nextChecked, eventDetails) => {
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

  useLayoutEffect(() => {
    if (!syncInputState) {
      return
    }

    const input = inputElementRef.current
    if (!input) {
      return
    }

    if (input.checked !== Boolean(checked)) {
      input.checked = Boolean(checked)
    }
    if (input.defaultChecked !== Boolean(checked)) {
      input.defaultChecked = Boolean(checked)
    }
    if (input.disabled !== Boolean(disabled)) {
      input.disabled = Boolean(disabled)
    }
  }, [checked, disabled, syncInputState])

  if (syncInputState) {
    const {
      id,
      onClick,
      onKeyDown,
      tabIndex,
      ...rootProps
    } = props as ComponentPropsWithoutRef<'span'> & { id?: string }
    const toggleChecked = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      if (disabledRef.current) {
        return
      }

      const nextChecked = !checkedRef.current
      if (!checkedControlledRef.current) {
        setCheckedState(nextChecked)
      }
      onCheckedChange?.(nextChecked, {
        allowPropagation: () => {},
        cancel: () => {},
        event: event.nativeEvent,
        isCanceled: false,
        isPropagationAllowed: true,
        reason: 'none',
        trigger: event.currentTarget
      } as unknown as Parameters<NonNullable<BaseSwitchRootProps['onCheckedChange']>>[1])
    }

    return (
      <span
        {...rootProps}
        aria-checked={Boolean(checked)}
        aria-disabled={disabled ? true : undefined}
        className={unstyled ? className : cx(
          'relative inline-block h-6 w-11 rounded-full border border-ds-border bg-ds-hover outline-none transition-[background-color,border-color,transform] duration-ds-fast ease-ds-standard data-[checked]:border-ds-border-hover data-[checked]:bg-ds-accent focus-visible:border-ds-focus focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] data-[disabled]:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100',
          className
        )}
        data-checked={checked ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-unchecked={checked ? undefined : ''}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) {
            return
          }
          toggleChecked(event)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || (event.key !== ' ' && event.key !== 'Enter')) {
            return
          }
          event.preventDefault()
          toggleChecked(event)
        }}
        ref={rootRef}
        role="switch"
        tabIndex={disabled ? -1 : tabIndex ?? 0}
      >
        <span
          className={unstyled ? thumbClassName : cx(
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-ds-accent-subtle transition-[transform,background-color] duration-ds-fast ease-ds-standard data-[checked]:translate-x-5 data-[checked]:bg-ds-page motion-reduce:transition-none',
            thumbClassName
          )}
          data-checked={checked ? '' : undefined}
          data-disabled={disabled ? '' : undefined}
          data-unchecked={checked ? undefined : ''}
        />
        <input
          id={id}
          aria-hidden="true"
          checked={Boolean(checked)}
          disabled={Boolean(disabled)}
          onChange={() => {}}
          ref={handleInputRef}
          tabIndex={-1}
          type="checkbox"
          style={VISUALLY_HIDDEN_INPUT_STYLE}
        />
      </span>
    )
  }

  return (
    <BaseSwitch.Root
      checked={checked}
      className={unstyled ? className : cx(
        'relative inline-block h-6 w-11 rounded-full border border-ds-border bg-ds-hover outline-none transition-[background-color,border-color,transform] duration-ds-fast ease-ds-standard data-[checked]:border-ds-border-hover data-[checked]:bg-ds-accent focus-visible:border-ds-focus focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] data-[disabled]:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100',
        className
      )}
      disabled={disabled}
      inputRef={handleInputRef}
      onCheckedChange={handleCheckedChange}
      ref={rootRef}
      {...props}
    >
      <BaseSwitch.Thumb
        className={unstyled ? thumbClassName : cx(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-ds-accent-subtle transition-[transform,background-color] duration-ds-fast ease-ds-standard data-[checked]:translate-x-5 data-[checked]:bg-ds-page motion-reduce:transition-none',
          thumbClassName
        )}
      />
    </BaseSwitch.Root>
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
