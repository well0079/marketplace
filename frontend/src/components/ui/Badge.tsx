import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline'

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'border border-line bg-page text-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  info: 'bg-info text-info-foreground',
  outline: 'border border-line bg-transparent text-foreground',
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }

export function Badge({ variant = 'default', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium', VARIANTS[variant], className)}
      {...rest}
    />
  )
}
