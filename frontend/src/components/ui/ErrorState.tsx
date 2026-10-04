import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function ErrorState({
  title = 'Algo deu errado',
  description,
  action,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive-soft px-6 py-12 text-center',
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-8 w-8 text-destructive"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6M15 9l-6 6" strokeLinecap="round" />
      </svg>
      <p className="text-h4 text-destructive-soft-foreground">{title}</p>
      {description && <p className="max-w-sm text-body-small text-destructive-soft-foreground/80">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
