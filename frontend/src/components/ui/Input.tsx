import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  helperText?: string
  error?: string
  inputClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, disabled, className, inputClassName, id: idProp, ...rest }, ref) => {
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
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={helperText || error ? helperId : undefined}
          className={cn(
            'h-10 w-full rounded border bg-surface px-3 text-body text-foreground placeholder:text-muted-foreground',
            'transition-colors focus:outline-none focus:ring-2',
            error
              ? 'border-destructive focus:border-destructive focus:ring-destructive/30'
              : 'border-line hover:border-ink-secondary focus:border-primary focus:ring-primary/25',
            'disabled:cursor-not-allowed disabled:bg-page disabled:text-muted-foreground',
            inputClassName,
          )}
          {...rest}
        />
        {(error || helperText) && (
          <p id={helperId} className={cn('text-caption', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error ?? helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
