import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
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
import { Separator } from '../components/ui/Separator'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductImage } from '../components/ecommerce/ProductImage'

// Tela pós-confirmação: pedido criado, pagamento vem na fase seguinte
export function OrderReceived() {
  const { code } = useParams<{ code: string }>()

  useEffect(() => {
    document.title = 'Pedido recebido | Marketplace'
  }, [])

  return (
    <AuthGate title="Entre para ver seu pedido" description="Entre na sua conta para acompanhar este pedido.">
      <OrderReceivedContent code={code ?? ''} />
    </AuthGate>
  )
}

function OrderReceivedContent({ code }: { code: string }) {
  const orderQuery = useQuery({ queryKey: orderQueryKey(code), queryFn: () => ordersApi.byCode(code), retry: false })

  if (orderQuery.isPending) {
    return (
      <main>
        <Container className="flex flex-col gap-4 py-8">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </Container>
      </main>
    )
  }

  if (orderQuery.isError) {
    return (
      <main>
        <Container className="py-10">
          <EmptyState
            title="Pedido não encontrado"
            description={`Não encontramos o pedido ${code} na sua conta.`}
            action={
              <Button size="sm" to="/orders">
                Ver meus pedidos
              </Button>
            }
          />
        </Container>
      </main>
    )
  }

  const order = orderQuery.data
  const status = orderStatusMeta(order.status)

  return (
    <main>
      <Container className="flex flex-col gap-6 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="text-h2 text-foreground">Pedido recebido</h1>
          <p className="text-body text-muted-foreground">
            Código <span className="font-medium text-foreground">{order.code}</span> · {formatDateTime(order.createdAt)}
          </p>
          <Badge variant={status.badge}>{status.label}</Badge>
        </div>

        <Alert variant="info" title="Aguardando pagamento">
          Seu pedido foi registrado e está aguardando pagamento. O pagamento será habilitado em seguida —
          você não foi cobrado nesta etapa.
        </Alert>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-h4 text-foreground">Resumo do pedido</h2>
          <ul className="flex flex-col divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.variantId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <ProductImage
                  src={item.thumbnail}
                  alt={item.title}
                  className="h-14 w-14 shrink-0 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${item.slug}`} className="line-clamp-2 text-body-small font-medium text-foreground hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-caption text-muted-foreground">
                    {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'} · {formatBRL(item.unitPrice)} un.
                  </p>
                </div>
                <p className="text-body-small font-medium text-foreground">{formatBRL(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex flex-col gap-1.5 text-body-small text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Frete — {order.deliveryOption?.label}</span>
              <span>{order.shippingCost === 0 ? 'Grátis' : formatBRL(order.shippingCost)}</span>
            </div>
            <div className="flex items-center justify-between text-h4 text-foreground">
              <span>Total</span>
              <span>{formatBRL(order.total)}</span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-1 text-body-small">
            <p className="font-medium text-foreground">Entrega em</p>
            <p className="text-muted-foreground">
              {order.shippingAddress.street}, {order.shippingAddress.number}
              {order.shippingAddress.complement ? ` — ${order.shippingAddress.complement}` : ''}
            </p>
            <p className="text-muted-foreground">
              {order.shippingAddress.district}, {order.shippingAddress.city} - {order.shippingAddress.state} · CEP{' '}
              {formatZipCode(order.shippingAddress.zipCode)}
            </p>
            <p className="text-caption text-muted-foreground">{order.deliveryOption?.description}</p>
          </div>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" to="/orders">
            Ver meus pedidos
          </Button>
          <Button size="lg" variant="outline" to="/search">
            Continuar comprando
          </Button>
        </div>
      </Container>
    </main>
  )
}
