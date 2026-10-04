import { Fragment } from 'react'
import { Link } from 'react-router-dom'

export type BreadcrumbItem = { label: string; href?: string }

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-body-small text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {isLast ? (
                  <span aria-current="page" className="text-foreground">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Link to={item.href} className="transition-colors hover:text-foreground hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span>{item.label}</span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="m6 4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
