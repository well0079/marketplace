import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export type CategoryCardProps = {
  name: string
  description?: string
  count?: number
  image?: string | null
  href?: string
  className?: string
}

export function CategoryCard({ name, description, count, image, href, className }: CategoryCardProps) {
  const content = (
    <>
      {image ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-md object-cover" />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-page text-muted-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-foreground">{name}</span>
        {description && <span className="line-clamp-1 text-caption text-muted-foreground">{description}</span>}
        {count != null && <span className="text-caption text-muted-foreground">{count.toLocaleString('pt-BR')} produtos</span>}
      </span>
    </>
  )

  const classes = cn(
    'flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    href && 'hover:-translate-y-0.5 hover:shadow-card-hover',
    className,
  )

  return href ? (
    <Link to={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  )
}
