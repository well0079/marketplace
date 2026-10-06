import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ordersApi } from '../lib/orders'
import type { OrderSummary } from '../lib/orders'
import { formatBRL, formatDate, formatDateTime } from '../lib/format'
import { OrderCard } from '../components/ingressos/Cards'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

type Tab = 'anuncios' | 'comprados' | 'vendidos'

// /tickets (auth): abas segmentadas (role tablist + setas). "Comprados" = pedidos
// de ingresso do usuário; anúncios/vendidos ficam para o bloco 5.
export function TicketsPage() {
  const [tab, setTab] = useState<Tab>('comprados')

  useEffect(() => {
    document.title = 'Ingressos | Marketplace'
  }, [])
  const tablistRef = useRef<HTMLDivElement>(null)

  const ordersQuery = useQuery({
    queryKey: ['orders', 'list', 1, 'ticket'],
    queryFn: () => ordersApi.list(1, 'ticket'),
  })

  const soldCount = ordersQuery.data?.items.filter((order) => (order.ticketSnapshot as { seller?: string } | null)?.seller === 'vendedor').length ?? 0

  function onTabKeyDown(event: React.KeyboardEvent) {
    const order: Tab[] = ['anuncios', 'comprados', 'vendidos']
    const index = order.indexOf(tab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = order[(index + delta + order.length) % order.length]
      setTab(next)
      tablistRef.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
    }
  }

  return (
    <main className="mx-auto max-w-[1200px] px-2 py-6">
      <h1 className="font-lexend text-t-h1 text-ticket-text">Ingressos</h1>

      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Meus ingressos"
        onKeyDown={onTabKeyDown}
        className="mt-4 inline-flex rounded-t-pill bg-ticket-surface2 p-1"
      >
        {(
          [
            { id: 'anuncios' as Tab, label: `Meus anúncios ${soldCount}` },
            { id: 'comprados' as Tab, label: 'Comprados' },
            { id: 'vendidos' as Tab, label: 'Vendidos' },
          ]
        ).map((item) => (
          <button
            key={item.id}
            data-tab={item.id}
            role="tab"
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={`rounded-t-pill px-4 py-1.5 text-t-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline ${
              tab === item.id ? 'bg-surface text-ticket-text shadow-t-row' : 'text-ticket-muted hover:text-ticket-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel" aria-label={tab}>
        {tab === 'comprados' ? <PurchasedTab /> : <ComingSoonTab />}
      </div>
    </main>
  )
}

function PurchasedTab() {
  const ordersQuery = useQuery({
    queryKey: ['orders', 'list', 1, 'ticket'],
    queryFn: () => ordersApi.list(1, 'ticket'),
  })

  if (ordersQuery.isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        <Skeleton className="h-40 w-full rounded-t-card" />
        <Skeleton className="h-40 w-full rounded-t-card" />
      </div>
    )
  }
  if (ordersQuery.isError) {
    return (
      <ErrorState
        title="Não conseguimos carregar seus ingressos."
        action={
          <Button size="sm" onClick={() => ordersQuery.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    )
  }
  const orders = ordersQuery.data
  if (orders.items.length === 0) {
    return (
      <EmptyState
        title="Você ainda não comprou ingressos"
        description="Quando comprar, seus ingressos aparecem aqui para transferência e consulta."
        action={
          <Button size="sm" to="/sellers/verify">
            Anunciar ingresso
          </Button>
        }
      />
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {orders.items.map((order) => (
        <OrderLink key={order.code} order={order} />
      ))}
    </div>
  )
}

function OrderLink({ order }: { order: OrderSummary }) {
  const snapshot = order.ticketSnapshot as { event?: { name?: string }; session?: { startsAt?: string } } | null
  const status = order.status === 'paid' ? 'confirmado' : order.status === 'cancelled' ? 'cancelado' : 'pendente'
  return (
    <Link to={`/tickets/${order.code}`} className="block focus-visible:outline-none">
      <OrderCard
        code={order.code}
        eventTitle={snapshot?.event?.name ?? 'Pedido'}
        date={snapshot?.session?.startsAt ? formatDateTime(snapshot.session.startsAt) : formatDate(order.createdAt)}
        total={formatBRL(order.total)}
        status={status}
      />
    </Link>
  )
}

function ComingSoonTab() {
  return (
    <EmptyState
      title="Nada por aqui ainda"
      description="Anuncie um ingresso e ele aparece nesta aba. A publicação de anúncios chega em breve."
      action={
        <Button size="sm" to="/sellers/verify">
          Anunciar ingresso
        </Button>
      }
    />
  )
}

