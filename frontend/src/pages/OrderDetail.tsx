import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { orderQueryKey, orderStatusMeta, ordersApi } from '../lib/orders'
import { formatZipCode } from '../lib/checkout'
import { formatBRL, formatDateTime } from '../lib/format'
import { Container } from '../components/layout/Container'
import { AuthGate } from '../components/ui/AuthGate'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Separator } from '../components/ui/Separator'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductImage } from '../components/ecommerce/ProductImage'
import { PixPaymentCard } from '../components/ecommerce/PixPaymentCard'

export function OrderDetail() {
  const { code } = useParams<{ code: string }>()

  useEffect(() => {
    document.title = `Pedido ${code ?? ''} | Marketplace`
  }, [code])

  return (
    <AuthGate title="Entre para ver seu pedido" description="Entre na sua conta para acompanhar este pedido.">
      <OrderDetailContent code={code ?? ''} />
    </AuthGate>
  )
}

function OrderDetailContent({ code }: { code: string }) {
  const queryClient = useQueryClient()
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const orderQuery = useQuery({ queryKey: orderQueryKey(code), queryFn: () => ordersApi.byCode(code), retry: false })

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(code),
    onSuccess: (updated) => {
      queryClient.setQueryData(orderQueryKey(code), updated)
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      setConfirmingCancel(false)
    },
  })

  if (orderQuery.isPending) {
    return (
      <main>
        <Container className="flex flex-col gap-4 py-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </Container>
      </main>
    )
  }

  if (orderQuery.isError) {
    const notFound = orderQuery.error instanceof ApiClientError && orderQuery.error.status === 404
    return (
      <main>
        <Container className="py-10">
          {notFound ? (
            <EmptyState
              title="Pedido não encontrado"
              description={`Não encontramos o pedido ${code} na sua conta.`}
              action={
                <Button size="sm" to="/orders">
                  Ver meus pedidos
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Não conseguimos carregar o pedido."
              description="Verifique sua conexão e tente novamente."
              action={
                <Button size="sm" onClick={() => orderQuery.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          )}
        </Container>
      </main>
    )
  }

  const order = orderQuery.data
  const status = orderStatusMeta(order.status)

  return (
    <main>
      <Container className="flex flex-col gap-6 py-6 md:py-8">
        <div className="flex flex-col gap-2">
          <Link to="/orders" className="text-body-small font-medium text-primary hover:underline">
            ← Meus pedidos
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-h2 text-foreground">Pedido {order.code}</h1>
            <Badge variant={status.badge}>{status.label}</Badge>
          </div>
          <p className="text-body-small text-muted-foreground">
            Feito em {formatDateTime(order.createdAt)}
            {order.cancelledAt && ` · Cancelado em ${formatDateTime(order.cancelledAt)}`}
          </p>
        </div>

        {order.status === 'pending' && (
          <Alert variant="info" title="Aguardando pagamento">
            O pagamento será habilitado em breve. Enquanto isso, você pode cancelar o pedido sem custo.
          </Alert>
        )}

        {cancelMutation.isError && (
          <Alert variant="error" title="Não foi possível cancelar">
            {cancelMutation.error instanceof ApiClientError
              ? cancelMutation.error.message
              : 'Tente novamente em instantes.'}
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="flex min-w-0 flex-col gap-4 p-5">
            <h2 className="text-h4 text-foreground">Itens do pedido</h2>
            <ul className="flex flex-col divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <ProductImage src={item.thumbnail} alt={item.title} className="h-16 w-16 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${item.slug}`}
                      className="line-clamp-2 text-body-small font-medium text-foreground hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-caption text-muted-foreground">
                      {Object.entries(item.attributes)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' · ') || 'Produto padrão'}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'} · {formatBRL(item.unitPrice)} un.
                    </p>
                  </div>
                  <p className="text-body-small font-medium text-foreground">{formatBRL(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            {order.status === 'pending' && (
              <Card className="flex flex-col gap-3 p-5">
                <PixPaymentCard
                  orderCode={order.code}
                  total={order.total}
                  defaultName={order.shippingAddress.recipient ?? ''}
                />
              </Card>
            )}
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-h4 text-foreground">Totais</h2>
              <div className="flex items-center justify-between text-body-small text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatBRL(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-body-small text-muted-foreground">
                <span>Frete — {order.deliveryOption?.label}</span>
                <span>{order.shippingCost === 0 ? 'Grátis' : formatBRL(order.shippingCost)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-h4 text-foreground">
                <span>Total</span>
                <span>{formatBRL(order.total)}</span>
              </div>
            </Card>

            <Card className="flex flex-col gap-2 p-5 text-body-small">
              <h2 className="text-h4 text-foreground">Entrega</h2>
              <p className="text-muted-foreground">
                {order.deliveryOption?.label} · {order.deliveryOption?.description}
              </p>
              <Separator />
              <p className="font-medium text-foreground">{order.shippingAddress.recipient}</p>
              <p className="text-muted-foreground">
                {order.shippingAddress.street}, {order.shippingAddress.number}
                {order.shippingAddress.complement ? ` — ${order.shippingAddress.complement}` : ''}
              </p>
              <p className="text-muted-foreground">
                {order.shippingAddress.district}, {order.shippingAddress.city} - {order.shippingAddress.state} · CEP{' '}
                {formatZipCode(order.shippingAddress.zipCode)}
              </p>
            </Card>

            {order.status === 'pending' && (
              <Card className="flex flex-col gap-3 p-5">
                <h2 className="text-h4 text-foreground">Cancelar pedido</h2>
                {confirmingCancel ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-body-small text-muted-foreground">
                      Cancelar o pedido {order.code}? Essa ação não pode ser desfeita.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate()}
                      >
                        Cancelar pedido
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cancelMutation.isPending}
                        onClick={() => setConfirmingCancel(false)}
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="self-start" onClick={() => setConfirmingCancel(true)}>
                    Cancelar pedido
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </Container>
    </main>
  )
}
