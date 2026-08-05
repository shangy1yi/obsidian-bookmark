import { Slider as BaseSlider } from '@base-ui/react/slider'
import {
  useCallback,
  useLayoutEffect,
  useReducer,
  useRef,
  type ComponentPropsWithoutRef,
  type Ref
} from 'react'
import { cx } from './utils'

type BaseSliderRootProps = ComponentPropsWithoutRef<typeof BaseSlider.Root<number>>

export type SliderControlProps = Omit<
  BaseSliderRootProps,
  'children' | 'className' | 'defaultValue' | 'disabled' | 'max' | 'min' | 'onValueChange' | 'onValueCommitted' | 'step' | 'value'
> & {
  ariaLabel?: string
  className?: string
  controlClassName?: string
  defaultValue?: number | string
  disabled?: boolean
  indicatorClassName?: string
  inputRef?: Ref<HTMLInputElement>
  max?: number | string
  min?: number | string
  onValueChange?: BaseSliderRootProps['onValueChange']
  onValueCommitted?: BaseSliderRootProps['onValueCommitted']
  rootId?: string
  step?: number | string
  syncInputState?: boolean
  thumbClassName?: string
  trackClassName?: string
  unstyled?: boolean
  value?: number | string
}

interface SliderInternalState {
  disabled: boolean
  max: number
  min: number
  step: number
  value: number
}

type SliderInternalStatePatch = Partial<SliderInternalState>

export function SliderControl({
  ariaLabel,
  className,
  controlClassName,
  defaultValue,
  disabled: disabledProp,
  id,
  indicatorClassName,
  inputRef,
  max: maxProp,
  min: minProp,
  onValueChange,
  onValueCommitted,
  rootId,
  step: stepProp,
  syncInputState = false,
  thumbClassName,
  trackClassName,
  unstyled = false,
  value: valueProp,
  ...props
}: SliderControlProps) {
  const initialMin = normalizeNumber(minProp, 0)
  const initialMax = normalizeNumber(maxProp, 100)
  const initialStep = normalizeNumber(stepProp, 1)
  const initialValue = normalizeNumber(valueProp ?? defaultValue, initialMin)
  const [internalState, updateInternalState] = useReducer(sliderInternalStateReducer, {
    disabled: Boolean(disabledProp),
    max: initialMax,
    min: initialMin,
    step: initialStep,
    value: initialValue
  })
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const dispatchingLegacyEventRef = useRef(false)
  const valueRef = useRef(initialValue)
  const minRef = useRef(initialMin)
  const maxRef = useRef(initialMax)
  const stepRef = useRef(initialStep)
  const disabledRef = useRef(Boolean(disabledProp))
  const valueControlledRef = useRef(valueProp !== undefined)
  const minControlledRef = useRef(minProp !== undefined)
  const maxControlledRef = useRef(maxProp !== undefined)
  const stepControlledRef = useRef(stepProp !== undefined)
  const disabledControlledRef = useRef(disabledProp !== undefined)

  const minControlled = minProp !== undefined && !syncInputState
  const maxControlled = maxProp !== undefined && !syncInputState
  const stepControlled = stepProp !== undefined && !syncInputState
  const currentMin = minControlled ? normalizeNumber(minProp, internalState.min) : internalState.min
  const currentMax = maxControlled ? normalizeNumber(maxProp, internalState.max) : internalState.max
  const currentStep = Math.max(stepControlled ? normalizeNumber(stepProp, internalState.step) : internalState.step, Number.EPSILON)
  const currentValue = valueProp !== undefined ? normalizeNumber(valueProp, internalState.value) : internalState.value
  const resolvedMax = currentMax === currentMin ? currentMax + currentStep : currentMax
  const disabled = disabledProp ?? internalState.disabled

  valueRef.current = currentValue
  minRef.current = currentMin
  maxRef.current = resolvedMax
  stepRef.current = currentStep
  disabledRef.current = Boolean(disabled)
  valueControlledRef.current = valueProp !== undefined
  minControlledRef.current = minControlled
  maxControlledRef.current = maxControlled
  stepControlledRef.current = stepControlled
  disabledControlledRef.current = disabledProp !== undefined

  const handleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputElementRef.current = node
    assignRef(inputRef, node)
  }, [inputRef])

  const syncInputValue = useCallback((nextValue: number) => {
    const input = inputElementRef.current
    if (input && input.value !== String(nextValue)) {
      input.value = String(nextValue)
    }
  }, [])

  const dispatchInputEvent = useCallback((type: 'change' | 'input') => {
    if (!syncInputState) {
      return
    }

    queueMicrotask(() => {
      const input = inputElementRef.current
      if (!input) {
        return
      }

      dispatchingLegacyEventRef.current = true
      try {
        input.dispatchEvent(new Event(type, { bubbles: true }))
      } finally {
        dispatchingLegacyEventRef.current = false
      }
    })
  }, [syncInputState])

  const handleValueChange: BaseSliderRootProps['onValueChange'] = (nextValue, eventDetails) => {
    if (dispatchingLegacyEventRef.current) {
      return
    }
    if (valueProp === undefined) {
      updateInternalState({ value: nextValue })
    }
    syncInputValue(nextValue)
    onValueChange?.(nextValue, eventDetails)
    if (eventDetails.reason !== 'input-change') {
      dispatchInputEvent('input')
    }
  }

  const handleValueCommitted: BaseSliderRootProps['onValueCommitted'] = (nextValue, eventDetails) => {
    if (dispatchingLegacyEventRef.current) {
      return
    }
    syncInputValue(nextValue)
    onValueCommitted?.(nextValue, eventDetails)
    dispatchInputEvent('change')
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
    const maxDescriptor = findPropertyDescriptor(input, 'max')
    const minDescriptor = findPropertyDescriptor(input, 'min')
    const stepDescriptor = findPropertyDescriptor(input, 'step')
    const ownValueDescriptor = Object.getOwnPropertyDescriptor(input, 'value')
    const ownDisabledDescriptor = Object.getOwnPropertyDescriptor(input, 'disabled')
    const ownMaxDescriptor = Object.getOwnPropertyDescriptor(input, 'max')
    const ownMinDescriptor = Object.getOwnPropertyDescriptor(input, 'min')
    const ownStepDescriptor = Object.getOwnPropertyDescriptor(input, 'step')

    if (
      !valueDescriptor?.get ||
      !valueDescriptor.set ||
      !disabledDescriptor?.get ||
      !disabledDescriptor.set ||
      !maxDescriptor?.get ||
      !maxDescriptor.set ||
      !minDescriptor?.get ||
      !minDescriptor.set ||
      !stepDescriptor?.get ||
      !stepDescriptor.set
    ) {
      return undefined
    }

    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return valueDescriptor.get?.call(this)
      },
      set(nextValue) {
        valueDescriptor.set?.call(this, nextValue)
        const normalizedValue = normalizeNumber(nextValue, valueRef.current)
        if (!valueControlledRef.current && valueRef.current !== normalizedValue) {
          valueRef.current = normalizedValue
          updateInternalState({ value: normalizedValue })
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
          updateInternalState({ disabled: normalizedDisabled })
        }
      }
    })

    Object.defineProperty(input, 'max', {
      configurable: true,
      get() {
        return maxDescriptor.get?.call(this)
      },
      set(nextMax) {
        maxDescriptor.set?.call(this, nextMax)
        const normalizedMax = normalizeNumber(nextMax, maxRef.current)
        if (!maxControlledRef.current && maxRef.current !== normalizedMax) {
          maxRef.current = normalizedMax
          updateInternalState({ max: normalizedMax })
        }
      }
    })

    Object.defineProperty(input, 'min', {
      configurable: true,
      get() {
        return minDescriptor.get?.call(this)
      },
      set(nextMin) {
        minDescriptor.set?.call(this, nextMin)
        const normalizedMin = normalizeNumber(nextMin, minRef.current)
        if (!minControlledRef.current && minRef.current !== normalizedMin) {
          minRef.current = normalizedMin
          updateInternalState({ min: normalizedMin })
        }
      }
    })

    Object.defineProperty(input, 'step', {
      configurable: true,
      get() {
        return stepDescriptor.get?.call(this)
      },
      set(nextStep) {
        stepDescriptor.set?.call(this, nextStep)
        const normalizedStep = normalizeNumber(nextStep, stepRef.current)
        if (!stepControlledRef.current && stepRef.current !== normalizedStep) {
          stepRef.current = normalizedStep
          updateInternalState({ step: normalizedStep })
        }
      }
    })

    return () => {
      restorePropertyDescriptor(input, 'value', ownValueDescriptor)
      restorePropertyDescriptor(input, 'disabled', ownDisabledDescriptor)
      restorePropertyDescriptor(input, 'max', ownMaxDescriptor)
      restorePropertyDescriptor(input, 'min', ownMinDescriptor)
      restorePropertyDescriptor(input, 'step', ownStepDescriptor)
    }
  }, [syncInputState])

  return (
    <BaseSlider.Root
      id={rootId ?? (id ? `${id}-root` : undefined)}
      value={currentValue}
      min={currentMin}
      max={resolvedMax}
      step={currentStep}
      disabled={disabled}
      onValueChange={handleValueChange}
      onValueCommitted={handleValueCommitted}
      className={unstyled ? className : cx(
        'grid h-6 w-full items-center',
        className
      )}
      {...props}
    >
      <BaseSlider.Control
        className={unstyled ? controlClassName : cx(
          'relative h-6 w-full touch-none',
          controlClassName
        )}
      >
        <BaseSlider.Track
          className={unstyled ? trackClassName : cx(
            'absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ds-hover',
            trackClassName
          )}
        >
          <BaseSlider.Indicator
            className={unstyled ? indicatorClassName : cx(
              'h-full rounded-full bg-ds-accent',
              indicatorClassName
            )}
          />
        </BaseSlider.Track>
        <BaseSlider.Thumb
          className={unstyled ? thumbClassName : cx(
            'size-4 rounded-full border border-ds-border-hover bg-ds-accent outline-none focus-within:ring-2 focus-within:shadow-ds-focus',
            thumbClassName
          )}
          getAriaLabel={ariaLabel ? () => ariaLabel : undefined}
          inputRef={handleInputRef}
        />
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}

function sliderInternalStateReducer(
  state: SliderInternalState,
  patch: SliderInternalStatePatch
): SliderInternalState {
  const next = {
    ...state,
    ...patch
  }
  return (
    next.disabled === state.disabled &&
    next.max === state.max &&
    next.min === state.min &&
    next.step === state.step &&
    next.value === state.value
  ) ? state : next
}

function normalizeNumber(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
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
