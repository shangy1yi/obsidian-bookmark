import type { ReactNode } from 'react'
import { Badge } from '../base/Badge'
import { Progress } from '../base/Progress'
import { Spinner } from '../base/Spinner'
import { cx } from '../base/utils'

export interface AiTaskStatusProps {
  children?: ReactNode
  className?: string
  descriptionClassName?: string
  label?: ReactNode
  progressIndicatorClassName?: string
  progressClassName?: string
  status: 'idle' | 'running' | 'success' | 'warning' | 'error'
  statusNode?: ReactNode
  title: ReactNode
  description?: ReactNode
  progress?: number | null
  progressAriaLabel?: string
  progressDivisions?: number
  progressMax?: number
  progressValueText?: string
}

const toneByStatus = {
  idle: 'neutral',
  running: 'neutral',
  success: 'success',
  warning: 'warning',
  error: 'danger'
} as const

const AI_TASK_STATUS_LABEL_CLASS =
  'block text-[11px] font-semibold uppercase tracking-[0] text-ds-text-disabled'

export function AiTaskStatus({
  children,
  className,
  description,
  descriptionClassName,
  label,
  progress,
  progressAriaLabel,
  progressDivisions,
  progressIndicatorClassName,
  progressClassName,
  progressMax,
  progressValueText,
  status,
  statusNode,
  title
}: AiTaskStatusProps) {
  return (
    <section className={cx('grid gap-2 rounded-ds-md border border-ds-border bg-ds-surface-1 p-3 text-ds-text-primary', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {label ? <span className={AI_TASK_STATUS_LABEL_CLASS}>{label}</span> : null}
          {status === 'running' ? <Spinner /> : null}
          {typeof title === 'string' ? <strong className="text-sm">{title}</strong> : title}
        </div>
        {statusNode || <Badge tone={toneByStatus[status]}>{status}</Badge>}
      </div>
      {description ? (
        typeof description === 'string' ? (
          <p className={cx('text-sm text-ds-text-secondary', descriptionClassName)}>{description}</p>
        ) : (
          description
        )
      ) : null}
      {typeof progress === 'number' ? (
        <Progress
          value={progress}
          max={progressMax}
          divisions={progressDivisions}
          label={progressAriaLabel}
          className={progressClassName}
          indicatorClassName={progressIndicatorClassName}
          aria-valuetext={progressValueText}
        />
      ) : null}
      {children}
    </section>
  )
}
