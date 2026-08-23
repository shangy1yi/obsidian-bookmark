import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

const badgeVariants = cva(
  'inline-flex min-h-6 items-center rounded-ds-sm border px-2 py-0.5 text-xs font-medium leading-none transition-[background-color,border-color,color,opacity,transform] duration-ds-fast ease-ds-standard motion-reduce:transition-none',
  {
    variants: {
      tone: {
        neutral: 'border-ds-border bg-ds-hover text-ds-text-secondary',
        success: 'border-ds-success/35 bg-ds-success-soft text-ds-success-text',
        warning: 'border-ds-warning/35 bg-ds-warning-soft text-ds-warning',
        danger: 'border-ds-danger/35 bg-ds-danger-soft text-ds-danger-text'
      }
    },
    defaultVariants: {
      tone: 'neutral'
    }
  }
)

type BadgeVariantProps = VariantProps<typeof badgeVariants>

export type BadgeTone = NonNullable<BadgeVariantProps['tone']>

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & BadgeVariantProps & {
  /**
   * 让徽标在出现时演一次 scale + fade。徽标内容变化时元素会被 React 复用，
   * 动画不会自己重播——需要重播就在调用处给出随内容变化的 key。
   */
  animate?: boolean
}

export function Badge({ animate = false, className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={badgeVariants({ tone, className: [animate ? 't-badge-pop' : '', className].filter(Boolean).join(' ') || undefined })}
      {...props}
    />
  )
}
