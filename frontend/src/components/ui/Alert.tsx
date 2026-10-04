import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const ICONS: Record<AlertVariant, ReactElement> = {
  info: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 11v5" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4 2.5 20h19L12 4Z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17.5h.01" strokeLinecap="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" strokeLinecap="round" />
    </svg>
  ),
}

const STYLES: Record<AlertVariant, string> = {
  info: 'border-info/30 bg-info-soft text-info-soft-foreground',
  success: 'border-success/30 bg-success-soft text-success-soft-foreground',
  warning: 'border-warning/30 bg-warning-soft text-warning-soft-foreground',
  error: 'border-destructive/30 bg-destructive-soft text-destructive-soft-foreground',
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: AlertVariant
  title?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4', STYLES[variant], className)}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {ICONS[variant]}
      </span>
      <div className="flex flex-col gap-1">
        {title && <p className="text-label">{title}</p>}
        {children && <div className="text-body-small">{children}</div>}
      </div>
    </div>
  )
}
