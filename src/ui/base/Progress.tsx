import { Progress as BaseProgress } from '@base-ui/react/progress'
import type { CSSProperties, HTMLAttributes } from 'react'
import { cx } from './utils'

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value?: number | null
  max?: number
  divisions?: number
  label?: string
  className?: string
  indicatorClassName?: string
  indicatorProps?: HTMLAttributes<HTMLDivElement>
  indicatorStyle?: CSSProperties
  rootClassName?: string
  trackClassName?: string
  unstyled?: boolean
}

export function Progress({
  value = null,
  max = 100,
  divisions,
  label,
  className,
  indicatorClassName,
  indicatorProps,
  indicatorStyle,
  rootClassName,
  trackClassName,
  unstyled = false,
  ...props
}: ProgressProps) {
  const numericMax = Number.isFinite(max) && max > 0 ? max : 1
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(numericMax, value))
    : null
  const normalizedDivisions = Number.isFinite(divisions) && divisions
    ? Math.floor(divisions)
    : 0
  const visibleDivisions = normalizedDivisions >= 2 && normalizedDivisions <= 10
    ? normalizedDivisions
    : 0

  return (
    <BaseProgress.Root
      value={numericValue}
      max={numericMax}
      aria-label={label}
      className={unstyled ? rootClassName : cx('base-progress', rootClassName)}
      {...props}
    >
      <BaseProgress.Track className={unstyled ? className : cx(
        'base-progress-track relative h-2 overflow-hidden rounded-full bg-ds-hover',
        className,
        trackClassName
      )}>
        <BaseProgress.Indicator
          className={unstyled ? indicatorClassName : cx(
            'base-progress-indicator h-full rounded-full bg-ds-accent',
            indicatorClassName
          )}
          style={indicatorStyle}
          {...indicatorProps}
        />
        {visibleDivisions
          ? Array.from({ length: visibleDivisions - 1 }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-[1] w-px -translate-x-1/2 bg-ds-border-hover"
                style={{ insetInlineStart: `${((index + 1) / visibleDivisions) * 100}%` }}
              />
            ))
          : null}
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}
