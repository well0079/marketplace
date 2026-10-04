import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Badge } from '../ui/Badge'
import { Skeleton, SkeletonText } from '../ui/Skeleton'
import { Price } from './Price'
import { ProductImage } from './ProductImage'

export type ProductCardData = {
  id: string
  slug: string
  title: string
  price: number
  originalPrice?: number | null
  discountPercent?: number | null
  freeShipping?: boolean
  thumbnail?: string | null
  rating?: { average: number; count: number } | null
  outOfStock?: boolean
}

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  return (
    <Link
      to={`/product/${product.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg bg-surface shadow-card transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'hover:-translate-y-0.5 hover:shadow-card-hover',
        product.outOfStock && 'opacity-75',
        className,
      )}
    >
      <div className="relative">
        <ProductImage src={product.thumbnail} alt={product.title} className={cn(product.outOfStock && 'grayscale')} />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.outOfStock ? (
            <Badge variant="destructive">Sem estoque</Badge>
          ) : (
            product.discountPercent != null &&
            product.discountPercent > 0 && <Badge variant="success">{product.discountPercent}% OFF</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 min-h-[2.6rem] text-body-small text-foreground group-hover:underline">{product.title}</p>
        <Price cents={product.price} originalCents={product.originalPrice} size="sm" className="mt-auto" />
        {product.freeShipping && !product.outOfStock && (
          <span className="text-caption font-medium text-success">Frete grátis</span>
        )}
        {product.rating && product.rating.count > 0 && (
          <span className="flex items-center gap-1 text-caption text-muted-foreground">
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 text-warning" fill="currentColor">
              <path d="M8 1.5l2 4.1 4.5.6-3.3 3.2.8 4.5L8 11.8l-4 2.1.8-4.5L1.5 6.2 6 5.6 8 1.5z" />
            </svg>
            {product.rating.average.toFixed(1).replace('.', ',')}
            <span className="text-muted-foreground/70">({product.rating.count.toLocaleString('pt-BR')})</span>
          </span>
        )}
      </div>
    </Link>
  )
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col overflow-hidden rounded-lg bg-surface shadow-card', className)}>
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <SkeletonText lines={2} />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  )
}
