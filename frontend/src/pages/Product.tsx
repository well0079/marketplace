import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api, ApiClientError } from '../lib/api'
import { cartApi, CART_QUERY_KEY, type CartPayload } from '../lib/cart'
import {
  clampQuantity, variantAttributeGroups, type ProductsResponse, type ProductDetail,
} from '../lib/home'
import { cn } from '../lib/cn'
import { formatBRL, installments } from '../lib/format'
import { Container } from '../components/layout/Container'
import { HeartIcon } from '../components/layout/icons'
import { Breadcrumb, type BreadcrumbItem } from '../components/ui/Breadcrumb'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { QuantitySelector } from '../components/ui/QuantitySelector'
import { Skeleton } from '../components/ui/Skeleton'
import { Price } from '../components/ecommerce/Price'
import { ProductCard } from '../components/ecommerce/ProductCard'
import { ProductImage } from '../components/ecommerce/ProductImage'

const CONDITION_LABELS: Record<string, string> = {
  new: 'Novo',
  used: 'Usado',
  refurbished: 'Recondicionado',
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" strokeLinejoin="round" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </svg>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn('h-4 w-4', className)} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.9 7.6-4.4M8.2 13.1l7.6 4.4" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn('h-4 w-4', className)} fill="currentColor">
      <path d="M8 1.5l2 4.1 4.5.6-3.3 3.2.8 4.5L8 11.8l-4 2.1.8-4.5L1.5 6.2 6 5.6 8 1.5z" />
    </svg>
  )
}

function Gallery({ images, alt }: { images: ProductDetail['images']; alt: string }) {
  const [index, setIndex] = useState(0)
  const safeIndex = Math.min(index, images.length - 1)
  const current = images[safeIndex]

  return (
    <div className="flex flex-col gap-3 lg:flex-row-reverse">
      <div className="aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface lg:flex-1">
        <ProductImage src={current?.url} alt={current?.alt ?? alt} />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {images.map((image, i) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver imagem ${i + 1} de ${images.length}`}
              aria-current={i === safeIndex || undefined}
              className={cn(
                'h-14 w-14 shrink-0 overflow-hidden rounded border-2 bg-surface transition-colors',
                i === safeIndex ? 'border-primary' : 'border-line hover:border-ink-secondary',
              )}
            >
              <ProductImage src={image.url} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PurchaseBox({ product }: { product: ProductDetail }) {
  const groups = variantAttributeGroups(product.variants)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const [favorited, setFavorited] = useState(false)
  const [shareLabel, setShareLabel] = useState<'Compartilhar' | 'Link copiado!'>('Compartilhar')
  const shareTimer = useRef<number | undefined>(undefined)

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0]
  const stock = selectedVariant?.stock ?? 0
  const inStock = stock > 0
  const installmentsInfo = installments(selectedVariant?.price ?? product.price)
  const conditionLabel = CONDITION_LABELS[product.condition] ?? product.condition

  useEffect(() => {
    setQuantity(1)
    setAddedToCart(false)
  }, [selectedVariantId])

  useEffect(() => () => window.clearTimeout(shareTimer.current), [])

  const addMutation = useMutation<CartPayload, Error, { redirectToCart: boolean }>({
    mutationFn: () => cartApi.addItem(selectedVariant?.id ?? '', quantity),
    onSuccess: (data, { redirectToCart }) => {
      queryClient.setQueryData(CART_QUERY_KEY, data)
      setCartError(null)
      if (redirectToCart) {
        navigate('/cart')
      } else {
        setAddedToCart(true)
      }
    },
    onError: (error) => {
      setAddedToCart(false)
      setCartError(error instanceof ApiClientError ? error.message : 'Não foi possível adicionar ao carrinho.')
    },
  })

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareLabel('Link copiado!')
        shareTimer.current = window.setTimeout(() => setShareLabel('Compartilhar'), 2000)
      }
    } catch {
      // usuário cancelou ou permissão negada — estado permanece inalterado
    }
  }

  return (
    <Card className="flex w-full flex-col gap-4 self-start p-5 lg:sticky lg:top-20">
      <p className="text-body-small text-muted-foreground">{conditionLabel}</p>

      <div className="flex flex-col gap-1">
        <Price cents={selectedVariant?.price ?? product.price} originalCents={product.originalPrice} size="lg" />
        {installmentsInfo && (
          <p className="text-body-small text-foreground">
            em{' '}
            <span className="font-medium text-success">
              {installmentsInfo.count}x {formatBRL(installmentsInfo.amount)}
            </span>{' '}
            sem juros
          </p>
        )}
      </div>

      {groups.map((group) => {
        const selectedValue = selectedVariant?.attributes[group.name] ?? group.options[0]?.value
        return (
          <div key={group.name} className="flex flex-col gap-2">
            <p className="text-body-small text-foreground">
              <span className="font-medium">{group.name}:</span>{' '}
              <span className="text-muted-foreground">{selectedValue}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const active = option.variantId === selectedVariant?.id
                return (
                  <button
                    key={option.variantId}
                    type="button"
                    onClick={() => setSelectedVariantId(option.variantId)}
                    disabled={option.stock === 0}
                    aria-pressed={active}
                    className={cn(
                      'rounded border px-3 py-1.5 text-body-small transition-colors',
                      active
                        ? 'border-primary bg-primary/5 font-medium text-foreground'
                        : 'border-line text-muted-foreground hover:border-ink-secondary hover:text-foreground',
                      option.stock === 0 && 'cursor-not-allowed line-through opacity-50',
                    )}
                  >
                    {option.value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className={cn('text-body-small', inStock ? 'text-muted-foreground' : 'font-medium text-destructive')}>
        {inStock
          ? `Disponível: ${stock} unidade${stock > 1 ? 's' : ''}`
          : 'Sem estoque'}
      </p>

      <div className="flex items-center gap-3">
        <QuantitySelector
          value={quantity}
          max={stock}
          onChange={(value) => setQuantity(clampQuantity(value, stock))}
          disabled={!inStock}
        />
        {product.freeShipping ? (
          <p className="flex items-center gap-1.5 text-body-small font-medium text-success">
            <TruckIcon />
            Frete grátis
          </p>
        ) : (
          <p className="text-body-small text-muted-foreground">Frete calculado no checkout</p>
        )}
      </div>

      {addedToCart && (
        <Alert variant="success" title="Adicionado ao carrinho">
          <Link to="/cart" className="font-medium underline underline-offset-2">
            Ver carrinho
          </Link>
        </Alert>
      )}
      {cartError && (
        <Alert variant="warning" title="Não foi possível adicionar">
          {cartError}
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          disabled={!inStock || addMutation.isPending}
          onClick={() => addMutation.mutate({ redirectToCart: true })}
        >
          {addMutation.isPending && addMutation.variables?.redirectToCart ? 'Adicionando…' : 'Comprar agora'}
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={!inStock || addMutation.isPending}
          onClick={() => addMutation.mutate({ redirectToCart: false })}
        >
          {addMutation.isPending && !addMutation.variables?.redirectToCart ? 'Adicionando…' : 'Adicionar ao carrinho'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" aria-pressed={favorited} onClick={() => setFavorited((v) => !v)}>
          <HeartIcon className={cn(favorited && 'fill-destructive text-destructive')} />
          {favorited ? 'Favoritado' : 'Favoritar'}
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <ShareIcon />
          {shareLabel}
        </Button>
      </div>
    </Card>
  )
}

function ProductSkeleton() {
  return (
    <Container className="flex flex-col gap-6 py-6 md:py-8">
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-3/4" />
        </div>
        <div className="lg:col-span-3">
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    </Container>
  )
}

export function Product() {
  const { slug } = useParams()

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.get<ProductDetail>(`/products/${slug}`),
    // 404 é permanente; não faz sentido repetir o request
    retry: false,
  })
  const product = productQuery.data

  const relatedQuery = useQuery({
    queryKey: ['products', 'related', product?.category.slug],
    queryFn: () => api.get<ProductsResponse>(`/products?category=${product?.category.slug}&limit=5`),
    enabled: Boolean(product),
  })
  const related = (relatedQuery.data?.items ?? []).filter((item) => item.slug !== product?.slug).slice(0, 4)

  useEffect(() => {
    if (product) document.title = `${product.title} | Marketplace`
  }, [product])

  if (!slug) {
    return (
      <main>
        <Container className="py-10">
          <EmptyState title="Produto não encontrado" />
        </Container>
      </main>
    )
  }

  if (productQuery.isPending) {
    return (
      <main>
        <ProductSkeleton />
      </main>
    )
  }

  if (productQuery.isError) {
    const notFound = productQuery.error instanceof ApiClientError && productQuery.error.status === 404
    if (notFound) {
      return (
        <main>
          <Container className="py-10">
            <EmptyState
              title="Produto não encontrado"
              description="O produto que você procura não existe ou saiu do ar."
              action={
                <Button size="sm" onClick={() => window.history.back()}>
                  Voltar
                </Button>
              }
            />
          </Container>
        </main>
      )
    }
    return (
      <main>
        <Container className="py-10">
          <ErrorState
            title="Não conseguimos carregar o produto."
            description="Verifique sua conexão e tente novamente."
            action={
              <Button size="sm" onClick={() => productQuery.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        </Container>
      </main>
    )
  }

  if (!product) return null // inalcançável após as guardas acima; satisfaz o narrowing do TS

  const breadcrumbItems: BreadcrumbItem[] = [{ label: 'Início', href: '/' }]
  for (const crumb of product.category.breadcrumb) {
    breadcrumbItems.push({ label: crumb.name, href: `/search?category=${crumb.slug}` })
  }
  breadcrumbItems.push({ label: product.title })

  const conditionLabel = CONDITION_LABELS[product.condition] ?? product.condition

  return (
    <main>
      <Container className="flex flex-col gap-8 py-6 md:py-8">
        <Breadcrumb items={breadcrumbItems} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <Gallery images={product.images} alt={product.title} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-4">
          <p className="text-body-small text-muted-foreground">
            {product.sold.toLocaleString('pt-BR')} vendidos
          </p>
          <h1 className="text-h2 text-foreground">{product.title}</h1>
          <p className="flex items-center gap-1.5 text-body-small text-muted-foreground">
            <StarIcon className="text-warning" />
            {product.rating.average.toFixed(1).replace('.', ',')}
            <span className="text-muted-foreground/70">
              ({product.rating.count.toLocaleString('pt-BR')} avaliações)
            </span>
          </p>
          {product.variants.length > 1 && (
            <p className="text-caption text-muted-foreground">Escolha uma opção para atualizar preço e estoque.</p>
          )}
        </div>

        <div className="min-w-0 lg:col-span-3">
          <PurchaseBox product={product} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-foreground">Descrição</h2>
        <p className="whitespace-pre-line text-body text-foreground">{product.description}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-foreground">Informações do produto</h2>
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-small">
          <dt className="text-muted-foreground">Marca</dt>
          <dd className="text-foreground">{product.brand ?? '—'}</dd>
          <dt className="text-muted-foreground">Condição</dt>
          <dd className="text-foreground">{conditionLabel}</dd>
        </dl>
      </section>

      {related.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-h3 text-foreground">Produtos relacionados</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
      </Container>
    </main>
  )
}
