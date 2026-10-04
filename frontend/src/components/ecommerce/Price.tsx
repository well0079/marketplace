import { discountPercent, formatBRL } from '../../lib/format'
import { cn } from '../../lib/cn'

type PriceSize = 'sm' | 'md' | 'lg'

const CURRENT: Record<PriceSize, string> = {
  sm: 'text-h4 font-semibold',
  md: 'text-h3 font-semibold',
  lg: 'text-h2 font-semibold',
}

export function Price({
  cents,
  originalCents,
  size = 'md',
  className,
}: {
  cents: number
  originalCents?: number | null
  size?: PriceSize
  className?: string
}) {
  const percent = originalCents != null ? discountPercent(cents, originalCents) : null
  const discount = percent !== null && originalCents != null ? { original: originalCents, percent } : null
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('text-foreground', CURRENT[size])}>{formatBRL(cents)}</span>
      {discount && (
        <>
          <span className="text-body-small text-muted-foreground line-through">{formatBRL(discount.original)}</span>
          <span className="text-body-small font-medium text-success">{discount.percent}% OFF</span>
        </>
      )}
    </div>
  )
}
