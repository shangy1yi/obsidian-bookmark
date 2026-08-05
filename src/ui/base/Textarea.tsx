import type { Ref, TextareaHTMLAttributes } from 'react'
import { cx } from './utils'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cx(
        'base-textarea min-h-24 w-full resize-y rounded-ds-sm border border-ds-border bg-ds-surface-1 px-3 py-2 text-sm text-ds-text-primary outline-none transition-colors placeholder:text-ds-text-muted focus:border-ds-focus focus:shadow-ds-focus disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
