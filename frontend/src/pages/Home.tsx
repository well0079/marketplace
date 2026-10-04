import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { linkableCategories, pickOffers, type CategoryNode, type ProductsResponse } from '../lib/home'
import { Container } from '../components/layout/Container'
import { HeartIcon, SearchIcon } from '../components/layout/icons'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { CategoryCard } from '../components/ecommerce/CategoryCard'
import { ProductCard, ProductCardSkeleton } from '../components/ecommerce/ProductCard'
import { ProductImage } from '../components/ecommerce/ProductImage'

const BENEFITS: { title: string; description: string; icon: ReactNode }[] = [
  {
    title: 'Compra segura',
    description: 'Seus dados protegidos do início ao fim do pedido.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Entrega rápida',
    description: 'Frete grátis em produtos selecionados.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" strokeLinejoin="round" />
        <circle cx="7" cy="18.5" r="1.6" />
        <circle cx="17" cy="18.5" r="1.6" />
      </svg>
    ),
  },
  {
    title: 'Variedade',
    description: 'Diversas categorias para explorar.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    title: 'Atendimento',
    description: 'Suporte quando você precisar.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 13a8 8 0 0 1 16 0" strokeLinecap="round" />
        <rect x="3" y="13" width="4" height="6" rx="1.5" />
        <rect x="17" y="13" width="4" height="6" rx="1.5" />
        <path d="M19 19a3 3 0 0 1-3 3h-3" strokeLinecap="round" />
      </svg>
    ),
  },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-h2 text-foreground">{title}</h2>
      {subtitle && <p className="text-body-small text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function CategoryCardSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4">
      <Skeleton className="h-14 w-14 rounded-md" />
      <Skeleton className="h-4 flex-1" />
    </div>
  )
}

export function Home() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Marketplace — Encontre o que você precisa'
  }, [])

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryNode[]>('/categories'),
  })
  const productsQuery = useQuery({
    queryKey: ['products', 'home'],
    queryFn: () => api.get<ProductsResponse>('/products?limit=20'),
  })

  const products = productsQuery.data?.items
  const highlights = products?.slice(0, 4)
  const offers = products ? pickOffers(products, 4) : []
  const heroThumbs = (products?.map((p) => p.thumbnail).filter((t): t is string => Boolean(t)) ?? []).slice(0, 2)

  const goToCatalog = () => navigate('/search')

  return (
    <main>
      <section className="border-b border-line bg-surface">
        <Container className="grid items-center gap-8 py-10 md:py-14 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-4">
            <h1 className="text-h1 text-foreground md:text-display">
              Encontre o que você precisa <span className="text-primary">em um só lugar.</span>
            </h1>
            <p className="max-w-md text-body text-muted-foreground">
              Eletrônicos, casa, ferramentas e muito mais — com ofertas do dia e frete grátis em produtos selecionados.
            </p>
            <div className="mt-2">
              <Button size="lg" onClick={goToCatalog}>
                Explorar produtos
              </Button>
            </div>
          </div>
          <div aria-hidden className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
            <div className="aspect-square overflow-hidden rounded-xl shadow-card">
              {heroThumbs[0] ? <ProductImage src={heroThumbs[0]} alt="" /> : <Skeleton className="h-full w-full rounded-none" />}
            </div>
            <div className="flex aspect-square items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-card">
              <SearchIcon className="h-10 w-10" />
            </div>
            <div className="flex aspect-square items-center justify-center rounded-xl bg-secondary text-foreground shadow-card">
              <HeartIcon className="h-10 w-10" />
            </div>
            <div className="aspect-square overflow-hidden rounded-xl shadow-card">
              {heroThumbs[1] ? <ProductImage src={heroThumbs[1]} alt="" /> : <Skeleton className="h-full w-full rounded-none" />}
            </div>
          </div>
        </Container>
      </section>

      <Container className="flex flex-col gap-14 py-10 md:py-14">
        <section className="flex flex-col gap-5">
          <SectionHeader title="Categorias" subtitle="Comece por uma das principais categorias do marketplace." />
          {categoriesQuery.isPending ? (
            <div aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <CategoryCardSkeleton key={i} />
              ))}
            </div>
          ) : categoriesQuery.isError ? (
            <ErrorState
              title="Não conseguimos carregar as categorias."
              description="Verifique sua conexão e tente novamente."
              action={
                <Button size="sm" onClick={() => categoriesQuery.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          ) : !categoriesQuery.data || categoriesQuery.data.length === 0 ? (
            <EmptyState title="Nenhuma categoria disponível" description="Volte em breve para ver as novidades." />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {linkableCategories(categoriesQuery.data).slice(0, 8).map((category) => (
                <CategoryCard key={category.id} name={category.name} href={`/search?category=${category.slug}`} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <SectionHeader title="Produtos em destaque" subtitle="Os mais procurados pelos nossos clientes." />
          {productsQuery.isPending ? (
            <div aria-hidden className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
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
          ) : !highlights || highlights.length === 0 ? (
            <EmptyState title="Nenhum produto disponível" description="Volte em breve para ver as novidades." />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {highlights.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {offers.length > 0 && (
          <section className="flex flex-col gap-5">
            <SectionHeader title="Ofertas especiais" subtitle="Produtos com os maiores descontos." />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {offers.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-5">
          <SectionHeader title="Compre com tranquilidade" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
                <span aria-hidden className="text-primary">
                  {benefit.icon}
                </span>
                <p className="text-body font-medium text-foreground">{benefit.title}</p>
                <p className="text-caption text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-primary px-6 py-12 text-center shadow-card md:py-16">
          <h2 className="text-h2 text-primary-foreground md:text-h1">Pronto para encontrar seu próximo produto?</h2>
          <p className="mx-auto mt-2 max-w-md text-body-small text-primary-foreground/80">
            Explore o catálogo completo e aproveite as ofertas do dia.
          </p>
          <Button variant="secondary" size="lg" className="mt-6" onClick={goToCatalog}>
            Explorar produtos
          </Button>
        </section>
      </Container>
    </main>
  )
}
