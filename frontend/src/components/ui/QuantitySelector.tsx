import { cn } from '../../lib/cn'

export function QuantitySelector({
  value, max, onChange, disabled,
}: { value: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  const buttonClass = cn(
    'flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-page',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
  )
  return (
    <div className="inline-flex items-center rounded border border-line bg-surface">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
        className={buttonClass}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8h10" strokeLinecap="round" />
        </svg>
      </button>
      <span aria-live="polite" className="w-10 text-center text-body-small font-medium text-foreground">
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        className={buttonClass}
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
