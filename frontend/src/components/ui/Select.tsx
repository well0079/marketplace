import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  helperText?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, disabled, className, id: idProp, children, ...rest }, ref) => {
    const autoId = useId()
    const id = idProp ?? autoId
    const helperId = `${id}-helper`
    return (
      <div className={cn('flex w-full flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={id} className="text-label text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={helperText || error ? helperId : undefined}
            className={cn(
              'h-10 w-full appearance-none rounded border bg-surface pl-3 pr-9 text-body text-foreground',
              'transition-colors focus:outline-none focus:ring-2',
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
                : 'border-line hover:border-ink-secondary focus:border-primary focus:ring-primary/25',
              'disabled:cursor-not-allowed disabled:bg-page disabled:text-muted-foreground',
            )}
            {...rest}
          >
            {children}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {(error || helperText) && (
          <p id={helperId} className={cn('text-caption', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error ?? helperText}
          </p>
        )}
      </div>
    )
  },
)

Select.displayName = 'Select'
