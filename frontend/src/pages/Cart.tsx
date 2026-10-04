import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { cartApi, CART_QUERY_KEY, type CartItemPayload } from '../lib/cart'
import { formatBRL } from '../lib/format'
import { Container } from '../components/layout/Container'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { QuantitySelector } from '../components/ui/QuantitySelector'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductImage } from '../components/ecommerce/ProductImage'

function variantLabel(item: CartItemPayload): string {
  const entries = Object.entries(item.product.variantAttributes)
  return entries.length > 0 ? entries.map(([key, value]) => `${key}: ${value}`).join(' · ') : 'Produto padrão'
}

export function Cart() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const cartQuery = useQuery({ queryKey: CART_QUERY_KEY, queryFn: cartApi.get })

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartApi.updateItem(itemId, quantity),
    onSuccess: (data) => queryClient.setQueryData(CART_QUERY_KEY, data),
  })
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: (data) => queryClient.setQueryData(CART_QUERY_KEY, data),
  })

  const mutatingItemId =
    updateMutation.isPending ? updateMutation.variables?.itemId : removeMutation.isPending ? removeMutation.variables : null
  const mutationError = updateMutation.error ?? removeMutation.error
  const mutationErrorMessage = mutationError instanceof ApiClientError ? mutationError.message : null

  useEffect(() => {
    document.title = 'Carrinho | Marketplace'
  }, [])

  if (cartQuery.isPending) {
    return (
      <main>
        <Container className="flex flex-col gap-6 py-8">
          <Skeleton className="h-8 w-48" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} aria-hidden className="flex gap-4 rounded-lg border border-line bg-surface p-4">
                <Skeleton className="h-24 w-24 rounded-md" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        </Container>
      </main>
    )
  }

  if (cartQuery.isError) {
    return (
      <main>
        <Container className="py-10">
          <ErrorState
            title="Não conseguimos carregar seu carrinho."
            description="Verifique sua conexão e tente novamente."
            action={
              <Button size="sm" onClick={() => cartQuery.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        </Container>
      </main>
    )
  }

  const cart = cartQuery.data

  if (!cart || cart.items.length === 0) {
    return (
      <main>
        <Container className="py-10">
          <EmptyState
            title="Seu carrinho está vazio"
            description="Explore o catálogo e adicione produtos para continuar."
            action={
              <Button size="sm" onClick={() => navigate('/search')}>
                Explorar produtos
              </Button>
            }
          />
        </Container>
      </main>
    )
  }

  return (
    <main>
      <Container className="flex flex-col gap-6 py-6 md:py-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-h2 text-foreground">Seu carrinho</h1>
          <p className="text-body-small text-muted-foreground">
            {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'itens'}
          </p>
        </header>

        {mutationErrorMessage && (
          <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-body-small text-warning-soft-foreground">
            {mutationErrorMessage}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <ul className="flex min-w-0 flex-1 flex-col gap-4">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-4 rounded-lg border border-line bg-surface p-4">
                <Link to={`/product/${item.product.slug}`} className="shrink-0" aria-label={item.product.title}>
                  <ProductImage src={item.product.thumbnail} alt={item.product.title} className="h-24 w-24 rounded-md" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Link to={`/product/${item.product.slug}`} className="line-clamp-2 text-body-small font-medium text-foreground hover:underline">
                    {item.product.title}
                  </Link>
                  <p className="text-caption text-muted-foreground">{variantLabel(item)}</p>
                  <p className="text-caption text-muted-foreground">{formatBRL(item.unitPrice)} un.</p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
                    <QuantitySelector
                      value={item.quantity}
                      max={item.stock}
                      disabled={mutatingItemId === item.id}
                      onChange={(quantity) => updateMutation.mutate({ itemId: item.id, quantity })}
                    />
                    <button
                      type="button"
                      disabled={mutatingItemId === item.id}
                      onClick={() => removeMutation.mutate(item.id)}
                      className="text-caption font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <p className="text-body font-semibold text-foreground">{formatBRL(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <Card className="flex w-full flex-col gap-3 p-5 lg:sticky lg:top-20 lg:w-72">
            <h2 className="text-h4 text-foreground">Resumo</h2>
            <div className="flex items-center justify-between text-body-small text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatBRL(cart.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3 text-h4 text-foreground">
              <span>Total</span>
              <span>{formatBRL(cart.subtotal)}</span>
            </div>
            <p className="text-caption text-muted-foreground">O frete é calculado no checkout.</p>
            <Button className="mt-2 w-full" onClick={() => navigate('/checkout')}>
              Finalizar compra
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/search')}>
              Continuar comprando
            </Button>
          </Card>
        </div>
      </Container>
    </main>
  )
}
