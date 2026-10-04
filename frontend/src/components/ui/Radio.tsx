import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode
  labelClassName?: string
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, labelClassName, disabled, className, id: idProp, ...rest }, ref) => {
    const autoId = useId()
    const id = idProp ?? autoId
    return (
      <div className={cn('flex items-start gap-2', className)}>
        <input ref={ref} id={id} type="radio" disabled={disabled} className="peer sr-only" {...rest} />
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border bg-surface transition-colors',
            'border-ink-secondary/60 peer-checked:border-primary',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            'peer-checked:[&>span]:opacity-100',
          )}
        >
          <span className="h-2 w-2 rounded-full bg-primary opacity-0 transition-opacity" />
        </span>
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'cursor-pointer text-body-small text-foreground peer-disabled:cursor-not-allowed peer-disabled:text-muted-foreground',
              labelClassName,
            )}
          >
            {label}
          </label>
        )}
      </div>
    )
  },
)

Radio.displayName = 'Radio'
