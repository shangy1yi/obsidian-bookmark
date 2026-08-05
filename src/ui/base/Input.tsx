import { Input as BaseInput } from '@base-ui/react/input'
import type { ComponentPropsWithRef } from 'react'
import { cx } from './utils'

export type InputProps = Omit<ComponentPropsWithRef<typeof BaseInput>, 'className' | 'size'> & {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  unstyled?: boolean
}

const sizeClass = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3.5 text-sm'
} as const

export function Input({ className, ref, size = 'md', unstyled = false, ...props }: InputProps) {
  if (unstyled) {
    return <BaseInput ref={ref} className={cx('base-input', className)} {...props} />
  }

  return (
    <BaseInput
      ref={ref}
      className={cx(
        'base-input w-full rounded-ds-sm border border-ds-border bg-ds-surface-1 text-ds-text-primary outline-none transition-colors placeholder:text-ds-text-muted focus:border-ds-focus focus:shadow-ds-focus disabled:opacity-50',
        sizeClass[size],
        className
      )}
      {...props}
    />
  )
}
