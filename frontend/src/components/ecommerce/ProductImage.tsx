import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Skeleton } from '../ui/Skeleton'

export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error')

  useEffect(() => {
    setStatus(src ? 'loading' : 'error')
  }, [src])

  return (
    <div className={cn('relative aspect-square overflow-hidden bg-page', className)}>
      {status === 'loading' && <Skeleton className="absolute inset-0 rounded-none" />}
      {status === 'error' || !src ? (
        <div aria-hidden className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <circle cx="9" cy="10" r="1.75" />
            <path
              d="m5 18 4.5-4.5a1.5 1.5 0 0 1 2.12 0L16 18M14.5 16l1.38-1.38a1.5 1.5 0 0 1 2.12 0L20 16.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-200',
            status === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
