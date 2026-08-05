import type { HTMLAttributes } from 'react'
import { cx } from './utils'

export type CardProps = HTMLAttributes<HTMLElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      className={cx(
        'rounded-ds-md border border-ds-border bg-ds-surface-1 p-4 text-ds-text-primary transition-[background-color,border-color,box-shadow] duration-ds-fast ease-ds-standard motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  )
}
