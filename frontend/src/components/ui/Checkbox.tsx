import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, disabled, className, id: idProp, ...rest }, ref) => {
    const autoId = useId()
    const id = idProp ?? autoId
    return (
      <div className={cn('flex items-start gap-2', className)}>
        <input ref={ref} id={id} type="checkbox" disabled={disabled} className="peer sr-only" {...rest} />
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border bg-surface transition-colors',
            'border-ink-secondary/60 peer-checked:border-primary peer-checked:bg-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            'peer-checked:[&>svg]:opacity-100',
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3 w-3 text-white opacity-0 transition-opacity"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m3 8.5 3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {label && (
          <label
            htmlFor={id}
            className="cursor-pointer text-body-small text-foreground peer-disabled:cursor-not-allowed peer-disabled:text-muted-foreground"
          >
            {label}
          </label>
        )}
      </div>
    )
  },
)

Checkbox.displayName = 'Checkbox'
