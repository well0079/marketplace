import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ordersApi } from '../lib/orders'
import { formatBRL, formatDateTime } from '../lib/format'
import { StatusPill } from '../components/ingressos/Controls'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Separator } from '../components/ui/Separator'
import { Skeleton } from '../components/ui/Skeleton'
import { ProductImage } from '../components/ecommerce/ProductImage'

type TicketSnapshot = {
  kind?: string
  event?: { slug?: string; name?: string; category?: string; organizer?: string }
  session?: { startsAt?: string; city?: string; uf?: string; venue?: string }
  ticketType?: string
  ticketCategory?: string
  unitPriceCents?: number
  serviceFeeCents?: number
  totalCents?: number
  receiptEmail?: string | null
}

// Detalhe do ingresso comprado (/tickets/:code, auth): dados do evento, tipo,
// categoria, valores, e-mail de recebimento. SEM QR/código de ingresso falso —
// a transferência é informada como status (aguardando transferência para x@).
export function TicketOrderDetailPage() {
  const { code } = useParams<{ code: string }>()

  useEffect(() => {
    document.title = `Ingresso ${code ?? ''} | Marketplace`
  }, [code])

  const orderQuery = useQuery({
    queryKey: ['orders', 'detail', code],
    queryFn: () => ordersApi.byCode(code ?? ''),
    enabled: !!code,
    retry: false,
  })

  if (orderQuery.isPending) {
    return (
      <main className="mx-auto max-w-[720px] px-2 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full rounded-t-card" />
      </main>
    )
  }

  if (orderQuery.isError) {
    return (
      <main className="mx-auto max-w-[720px] px-2 py-6">
        <EmptyState
          title="Ingresso não encontrado"
          description={`Não encontramos o pedido ${code ?? ''} na sua conta.`}
          action={
            <Button size="sm" to="/tickets">
              Voltar para Ingressos
            </Button>
          }
        />
      </main>
    )
  }

  const order = orderQuery.data
  const snapshot = (order.ticketSnapshot ?? null) as TicketSnapshot | null
  const status = order.status === 'paid' ? 'confirmado' : order.status === 'cancelled' ? 'cancelado' : 'pendente'

  return (
    <main className="mx-auto max-w-[720px] px-2 py-6">
      <Link to="/tickets" className="text-t-label text-ticket-primary hover:underline">
        ← Ingressos
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-lexend text-t-h1 text-ticket-text">Pedido {order.code}</h1>
        <StatusPill status={status} />
      </div>
      <p className="text-t-caption text-ticket-muted">Feito em {formatDateTime(order.createdAt)}</p>

      {order.status === 'pending' && order.activePaymentId && (
        <div className="mt-4 rounded-t-card bg-ticket-caution-soft p-4">
          <p className="text-t-label-strong text-ticket-caution-text">Aguardando pagamento</p>
          <Button size="sm" className="mt-2" to={`/payments/${order.activePaymentId}`}>
            Pagar com Pix
          </Button>
        </div>
      )}

      {order.status === 'paid' && snapshot?.receiptEmail && (
        <div className="mt-4 rounded-t-card bg-ticket-accent-soft p-4 text-t-body-s text-ticket-success">
          Aguardando transferência para {snapshot.receiptEmail} — o ingresso chega por transferência
          quando o vendedor enviar. Você será notificado. (Não geramos QR Code de ingresso nesta etapa.)
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
        <Card className="p-5">
          <h2 className="font-lexend text-t-title text-ticket-text">Seu ingresso</h2>
          {snapshot?.kind === 'ticket' ? (
            <div className="mt-3 flex flex-col gap-1 text-t-body-s text-ticket-muted">
              <p className="font-lexend text-t-title text-ticket-text">{snapshot.event?.name}</p>
              <p>
                {snapshot.session?.venue} · {snapshot.session?.city} - {snapshot.session?.uf}
              </p>
              <p>{snapshot.session?.startsAt ? formatDateTime(snapshot.session.startsAt) : ''}</p>
              <Separator className="my-2" />
              <p>
                Tipo: <span className="text-ticket-text">{snapshot.ticketType}</span>
              </p>
              <p>
                Categoria: <span className="text-ticket-text">{snapshot.ticketCategory}</span>
              </p>
              <p>
                Organizador: <span className="text-ticket-text">{snapshot.event?.organizer}</span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-t-body-s text-ticket-muted">Este pedido não é de ingresso.</p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2 p-5">
            <h2 className="font-lexend text-t-title text-ticket-text">Valores</h2>
            {snapshot?.kind === 'ticket' && (
              <>
                <div className="flex items-center justify-between text-t-body-s text-ticket-muted">
                  <span>Ingresso</span>
                  <span className="text-ticket-text">{formatBRL(snapshot.unitPriceCents ?? order.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-t-body-s text-ticket-muted">
                  <span>Taxa de serviço</span>
                  <span className="text-ticket-text">{formatBRL(snapshot.serviceFeeCents ?? 0)}</span>
                </div>
              </>
            )}
            <Separator className="my-1" />
            <div className="flex items-baseline justify-between">
              <span className="text-t-label">Total</span>
              <span className="font-sora text-t-total text-ticket-primary">{formatBRL(order.total)}</span>
            </div>
          </Card>

          {snapshot?.event?.slug && (
            <Card className="p-5">
              <h2 className="font-lexend text-t-title text-ticket-text">Evento</h2>
              <div className="mt-2 flex items-center gap-3">
                <ProductImage src={null} alt="" className="h-14 w-14 rounded-t-tile" />
                <Link to={`/event/${snapshot.event.slug}`} className="text-t-label text-ticket-primary hover:underline">
                  Ver página do evento
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
