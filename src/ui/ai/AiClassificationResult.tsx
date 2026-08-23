import type { ReactNode } from 'react'
import { Badge } from '../base/Badge'
import { Surface, type SurfaceProps } from '../base/Surface'
import { cx } from '../base/utils'
import { Icon } from '../icons/Icon'

export interface AiClassificationResultProps extends Omit<SurfaceProps, 'title'> {
  actions?: ReactNode
  bodyClassName?: string
  title: ReactNode
  folder?: ReactNode
  confidence?: ReactNode
  description?: ReactNode
  meta?: ReactNode
}

export function AiClassificationResult({
  actions,
  bodyClassName,
  children,
  className,
  title,
  folder,
  confidence,
  description,
  meta,
  ...props
}: AiClassificationResultProps) {
  return (
    <Surface className={cx('grid gap-2 p-3', className)} variant="group" {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="Sparkles" size={16} aria-hidden="true" />
          {typeof title === 'string' ? <strong className="text-sm">{title}</strong> : title}
        </div>
        {confidence ? <Badge key={String(confidence)} animate>{confidence}</Badge> : null}
      </div>
      {actions}
      {meta}
      {description ? <p className="text-sm text-ds-text-secondary">{description}</p> : null}
      {folder ? <p className="text-sm text-ds-text-primary">{folder}</p> : null}
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </Surface>
  )
}
