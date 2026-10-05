import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { orderQueryKey, ordersApi } from '../lib/orders'
import { formatBRL, formatDateTime } from '../lib/format'
import { Container } from '../components/layout/Container'
import { AuthGate } from '../components/ui/AuthGate'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Confirmação de pagamento: SÓ mostra sucesso se a API confirmar o pedido pago.
// ?order=RD-XXXX (rota definida na FASE 11; documentada em API_REFERENCE/DECISIONS).
export function CheckoutSuccess() {
  const [searchParams] = useSearchParams()
  const orderCode = searchParams.get('order') ?? ''

  useEffect(() => {
    document.title = 'Pagamento confirmado | Marketplace'
  }, [])

  return (
    <AuthGate title="Entre para ver seu pedido" description="Entre na sua conta para ver a confirmação.">
      <CheckoutSuccessContent orderCode={orderCode} />
    </AuthGate>
  )
}

function CheckoutSuccessContent({ orderCode }: { orderCode: string }) {
  const orderQuery = useQuery({
    queryKey: orderQueryKey(orderCode),
    queryFn: () => ordersApi.byCode(orderCode),
    retry: false,
    enabled: orderCode !== '',
  })

  if (!orderCode || orderQuery.isPending) {
    return (
      <main>
        <Container className="flex flex-col items-center gap-4 py-10">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full max-w-md rounded-lg" />
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
            description={`Não encontramos o pedido ${orderCode} na sua conta.`}
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

  // Regra da rota: sem confirmação de pagamento pela API, NÃO há tela de sucesso
  if (order.status !== 'paid') {
    return (
      <main>
        <Container className="flex justify-center py-10">
          <Card className="w-full max-w-md p-8 text-center">
            <h1 className="text-h3 text-foreground">Pagamento ainda pendente</h1>
            <p className="mt-2 text-body-small text-muted-foreground">
              O pedido <span className="font-medium text-foreground">{order.code}</span> ainda não tem
              pagamento confirmado. Acompanhe a situação na página do pedido.
            </p>
            <div className="mt-6">
              <Button to={`/orders/${order.code}`}>Ir para o pedido</Button>
            </div>
          </Card>
        </Container>
      </main>
    )
  }

  return (
    <main>
      <Container className="flex flex-col items-center gap-6 py-10">
        <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-h2 text-foreground">Pagamento confirmado!</h1>
          <p className="text-body-small text-muted-foreground">
            Pedido <span className="font-medium text-foreground">{order.code}</span> · {formatDateTime(order.createdAt)}
          </p>
          <Badge variant="success">Pago</Badge>
        </header>

        <Card className="w-full max-w-md p-5">
          <p className="text-body-small text-muted-foreground">Total pago</p>
          <p className="text-h2 text-foreground">{formatBRL(order.total)}</p>
          <Alert variant="success" title="Pedido em preparação">
            Recebemos seu pagamento. Seu pedido seguirá para preparação e envio.
          </Alert>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button to={`/orders/${order.code}`}>Ver detalhes do pedido</Button>
          <Button variant="outline" to="/orders">
            Meus pedidos
          </Button>
        </div>

        <p className="text-center text-caption text-muted-foreground">
          Dúvidas? Acompanhe tudo em{' '}
          <Link to="/orders" className="font-medium text-primary hover:underline">
            Meus pedidos
          </Link>
          .
        </p>
      </Container>
    </main>
  )
}
