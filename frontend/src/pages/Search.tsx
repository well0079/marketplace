import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import {
  buildCatalogParams, findCategoryName, type CategoryNode, type ProductsResponse,
} from '../lib/home'
import { cn } from '../lib/cn'
import { Container } from '../components/layout/Container'
import { CloseIcon, MenuIcon } from '../components/layout/icons'
import { Breadcrumb, type BreadcrumbItem } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductCard, ProductCardSkeleton } from '../components/ecommerce/ProductCard'

// Valores aceitos pelo contrato de GET /api/v1/products (sort)
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Mais relevantes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
]

function CategoryLink({
  to, active, onClick, className, children,
}: { to: string; active: boolean; onClick?: () => void; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        'block rounded px-3 py-1.5 text-body-small transition-colors hover:bg-page hover:text-foreground',
        active ? 'bg-page font-medium text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function CategoryList({
  categories, activeSlug, buildHref, onNavigate,
}: {
  categories: CategoryNode[]
  activeSlug: string
  buildHref: (slug?: string) => string
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Filtrar por categoria" className="flex flex-col gap-0.5">
      <CategoryLink to={buildHref()} active={!activeSlug} onClick={onNavigate}>
        Todas as categorias
      </CategoryLink>
      {categories.map((root) =>
        root.children.length > 0 ? (
          <div key={root.id} className="flex flex-col gap-0.5 pt-2">
            <p className="px-3 text-caption font-medium text-muted-foreground">{root.name}</p>
            {root.children.map((child) => (
              <CategoryLink key={child.id} to={buildHref(child.slug)} active={activeSlug === child.slug} onClick={onNavigate} className="pl-6">
                {child.name}
              </CategoryLink>
            ))}
          </div>
        ) : (
          <CategoryLink key={root.id} to={buildHref(root.slug)} active={activeSlug === root.slug} onClick={onNavigate}>
            {root.name}
          </CategoryLink>
        ),
      )}
    </nav>
  )
}

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const sort = searchParams.get('sort') ?? 'relevance'
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryNode[]>('/categories'),
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'catalog', { q, category, sort, page }],
    queryFn: () => api.get<ProductsResponse>(`/products?${buildCatalogParams({ q, category, sort, page }).toString()}`),
  })

  const categoryName = categoriesQuery.data ? findCategoryName(categoriesQuery.data, category) : null
  const activeCategoryName = category ? categoryName ?? category : null
  const items = productsQuery.data?.items
  const total = productsQuery.data?.total
  const totalPages = productsQuery.data?.totalPages ?? 1
  const hasFilters = Boolean(q || category || sort !== 'relevance')

  const title = q ? `Resultados para "${q}"` : activeCategoryName ?? 'Todos os produtos'
  const countText = total == null
    ? null
    : `${total} ${total === 1 ? 'produto' : 'produtos'}${q && activeCategoryName ? ` em ${activeCategoryName}` : ''}`

  useEffect(() => {
    document.title = q
      ? `Busca: ${q} | Marketplace`
      : activeCategoryName
        ? `${activeCategoryName} | Marketplace`
        : 'Catálogo | Marketplace'
  }, [q, activeCategoryName])

  useEffect(() => {
    if (!filtersOpen) return
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

  // URL é a fonte da verdade: alterações de filtro escrevem na URL (limpando valores vazios)
  function updateParams(mutate: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    for (const [key, value] of Array.from(next.entries())) {
      if (!value) next.delete(key)
    }
    setSearchParams(next)
  }

  const setSort = (value: string) => updateParams((params) => {
    params.set('sort', value)
    params.delete('page')
  })

  const setPage = (value: number) => {
    updateParams((params) => params.set('page', String(value)))
    window.scrollTo({ top: 0 })
  }

  const clearFilters = () => {
    setSearchParams({})
    window.scrollTo({ top: 0 })
  }

  function hrefForCategory(slug?: string) {
    const next = new URLSearchParams(searchParams)
    if (slug) next.set('category', slug)
    else next.delete('category')
    next.delete('page')
    const qs = next.toString()
    return `/search${qs ? `?${qs}` : ''}`
  }

  const breadcrumbItems: BreadcrumbItem[] = [{ label: 'Início', href: '/' }]
  if (q) breadcrumbItems.push({ label: 'Busca', href: '/search' })
  if (q && activeCategoryName) breadcrumbItems.push({ label: activeCategoryName, href: `/search?category=${category}` })
  if (q) breadcrumbItems.push({ label: q })
  else if (activeCategoryName) breadcrumbItems.push({ label: activeCategoryName })

  return (
    <main>
      <Container className="flex flex-col gap-6 py-6 md:py-8">
        <Breadcrumb items={breadcrumbItems} />

        <header className="flex flex-col gap-1">
          <h1 className="text-h2 text-foreground">{title}</h1>
          {countText && <p className="text-body-small text-muted-foreground">{countText}</p>}
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
              <h2 className="text-label text-foreground">Categorias</h2>
              {categoriesQuery.data ? (
                <CategoryList categories={categoriesQuery.data} activeSlug={category} buildHref={hrefForCategory} />
              ) : (
                <div aria-hidden className="flex flex-col gap-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              )}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
                aria-controls="catalog-filters"
              >
                <MenuIcon className="h-4 w-4" />
                Filtros
              </Button>
              <div className={cn('flex items-center gap-2', 'ml-auto')}>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                )}
                <Select
                  aria-label="Ordenar por"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="w-44"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {productsQuery.isPending ? (
              <div aria-hidden className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : productsQuery.isError ? (
              <ErrorState
                title="Não conseguimos carregar os produtos."
                description="Verifique sua conexão e tente novamente."
                action={
                  <Button size="sm" onClick={() => productsQuery.refetch()}>
                    Tentar novamente
                  </Button>
                }
              />
            ) : !items || items.length === 0 ? (
              <EmptyState
                title="Nenhum produto encontrado"
                description={q ? `Nada para "${q}". Tente outro termo ou limpe os filtros.` : 'Tente ajustar os filtros.'}
                action={
                  <Button size="sm" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <nav aria-label="Paginação" className="flex items-center justify-center gap-3 pt-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Anterior
                    </Button>
                    <span className="text-body-small text-muted-foreground" aria-live="polite">
                      Página {page} de {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      Próxima
                    </Button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </Container>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden className="absolute inset-0 animate-fade-in bg-foreground/50" onClick={() => setFiltersOpen(false)} />
          <div
            id="catalog-filters"
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] animate-slide-in-right flex-col gap-4 overflow-y-auto bg-surface p-5 shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-h4 text-foreground">Filtros</span>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Fechar filtros"
                onClick={() => setFiltersOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded text-foreground transition-colors hover:bg-page"
              >
                <CloseIcon />
              </button>
            </div>
            {categoriesQuery.data && (
              <CategoryList
                categories={categoriesQuery.data}
                activeSlug={category}
                buildHref={hrefForCategory}
                onNavigate={() => setFiltersOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  )
}
