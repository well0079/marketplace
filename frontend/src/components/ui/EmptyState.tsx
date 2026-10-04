import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="text-h4 text-foreground">{title}</p>
      {description && <p className="max-w-sm text-body-small text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
