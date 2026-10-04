import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { orderStatusMeta, ordersApi, ordersPageQueryKey } from '../lib/orders'
import { formatBRL, formatDate } from '../lib/format'
import { Container } from '../components/layout/Container'
import { AuthGate } from '../components/ui/AuthGate'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductImage } from '../components/ecommerce/ProductImage'


export function Orders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

  useEffect(() => {
    document.title = 'Meus pedidos | Marketplace'
  }, [])

  return (
    <AuthGate title="Entre para ver seus pedidos" description="Entre na sua conta para acompanhar seus pedidos.">
      <OrdersContent page={page} onPage={(next) => setSearchParams(next === 1 ? {} : { page: String(next) })} />
    </AuthGate>
  )
}

function OrdersContent({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const ordersQuery = useQuery({
    queryKey: ordersPageQueryKey(page),
    queryFn: () => ordersApi.list(page),
    placeholderData: (previous) => previous,
  })

  const orders = ordersQuery.data

  return (
    <main>
      <Container className="flex flex-col gap-6 py-6 md:py-8">
        <h1 className="text-h2 text-foreground">Meus pedidos</h1>

        {ordersQuery.isPending && (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        )}

        {ordersQuery.isError && (
          <ErrorState
            title="Não conseguimos carregar seus pedidos."
            description="Verifique sua conexão e tente novamente."
            action={
              <Button size="sm" onClick={() => ordersQuery.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        )}

        {orders && orders.items.length === 0 && (
          <EmptyState
            title="Você ainda não fez pedidos"
            description="Quando você confirmar um pedido, ele aparece aqui para acompanhamento."
            action={
              <Button size="sm" to="/">
                Voltar para a Home
              </Button>
            }
          />
        )}

        {orders && orders.items.length > 0 && (
          <>
            <ul className="flex flex-col gap-3">
              {orders.items.map((order) => {
                const status = orderStatusMeta(order.status)
                return (
                  <li key={order.code}>
                    <Link
                      to={`/orders/${order.code}`}
                      className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <ProductImage
                        src={order.firstItemImage}
                        alt={`Pedido ${order.code}`}
                        className="h-16 w-16 shrink-0 rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-body-small font-medium text-foreground">
                          Pedido {order.code}
                          <Badge variant={status.badge}>{status.label}</Badge>
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {formatDate(order.createdAt)} · {order.itemsCount}{' '}
                          {order.itemsCount === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-body font-semibold text-foreground">{formatBRL(order.total)}</span>
                        <span className="text-caption font-medium text-primary">Ver detalhes</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>

            {orders.totalPages > 1 && (
              <nav aria-label="Paginação de pedidos" className="flex items-center justify-between">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                  Anterior
                </Button>
                <p className="text-body-small text-muted-foreground">
                  Página {orders.page} de {orders.totalPages}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= orders.totalPages}
                  onClick={() => onPage(page + 1)}
                >
                  Próxima
                </Button>
              </nav>
            )}
          </>
        )}
      </Container>
    </main>
  )
}
