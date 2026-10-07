import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { ordersApi } from '../lib/orders'
import { sellerApi, type ListingItem, type SoldListing } from '../lib/events'
import { formatBRL, formatDate, formatDateTime } from '../lib/format'
import { OrderCard } from '../components/ingressos/Cards'
import { StatusPill } from '../components/ingressos/Controls'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

type Tab = 'anuncios' | 'comprados' | 'vendidos'

// /tickets (auth): abas segmentadas (role tablist + setas).
// Anúncios = GET /listings/mine · Comprados = GET /orders?kind=ticket · Vendidos = GET /listings/sold.
export function TicketsPage() {
  const [tab, setTab] = useState<Tab>('comprados')
  const tablistRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Ingressos | Marketplace'
  }, [])

  const listingsQuery = useQuery({
    queryKey: ['listings', 'mine'],
    queryFn: () => sellerApi.myListings(),
    enabled: tab === 'anuncios',
  })
  const ordersQuery = useQuery({
    queryKey: ['orders', 'list', 1, 'ticket'],
    queryFn: () => ordersApi.list(1, 'ticket'),
    enabled: tab === 'comprados',
  })
  const soldQuery = useQuery({
    queryKey: ['listings', 'sold'],
    queryFn: () => sellerApi.sold(),
    enabled: tab === 'vendidos',
  })

  const listingCounts = listingsQuery.data?.counts
  const soldCount = soldQuery.data?.length ?? 0

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

      <div ref={tablistRef} role="tablist" aria-label="Meus ingressos" onKeyDown={onTabKeyDown}
        className="mt-4 inline-flex rounded-t-pill bg-ticket-surface2 p-1">
        {(
          [
            { id: 'anuncios' as Tab, label: `Meus anúncios ${(listingCounts?.active ?? 0) + (listingCounts?.pending_review ?? 0)}` },
            { id: 'comprados' as Tab, label: 'Comprados' },
            { id: 'vendidos' as Tab, label: `Vendidos ${soldCount > 0 ? soldCount : ''}` },
          ]
        ).map((item) => (
          <button
            key={item.id} data-tab={item.id} role="tab" aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}
            className={cn(
              'rounded-t-pill px-4 py-1.5 text-t-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline',
              tab === item.id ? 'bg-surface text-ticket-text shadow-t-row' : 'text-ticket-muted hover:text-ticket-text',
            )}
          >
            {item.label.trim()}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel" aria-label={tab}>
        {tab === 'anuncios' && <ListingsTab query={listingsQuery} />}
        {tab === 'comprados' && <PurchasedTab query={ordersQuery} />}
        {tab === 'vendidos' && <SoldTab query={soldQuery} />}
      </div>
    </main>
  )
}

// ─── Anúncios ───

function ListingsTab({ query }: { query: ReturnType<typeof useQuery<import('../lib/events').MyListingsPayload | undefined>> }) {
  const queryClient = useQueryClient()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      setCancellingId(id)
      const res = await fetch(`/api/v1/listings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } }
        throw Object.assign(new Error(body?.error?.message ?? 'Erro ao cancelar'), { status: res.status })
      }
      return (await res.json()) as { ok: boolean }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['listings', 'mine'] }); setCancellingId(null) },
    onError: (error) => {
      setCancelError(error instanceof Error ? error.message : 'Erro ao cancelar.')
      setCancellingId(null)
    },
  })

  if (query.isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        <Skeleton className="h-40 w-full rounded-t-card" />
        <Skeleton className="h-40 w-full rounded-t-card" />
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState title="Erro ao carregar anúncios." action={<Button size="sm" onClick={() => query.refetch()}>Tentar novamente</Button>} />
  }
  const data = query.data
  if (!data || data.items.length === 0) {
    return (
      <EmptyState title="Você ainda não anunciou ingressos"
        description="Anuncie um ingresso e ele aparece aqui para gerenciar."
        action={<Button size="sm" to="/sellers/new">Anunciar ingresso</Button>} />
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {cancelError && (
        <div role="alert" className="rounded-t-control bg-ticket-danger-soft px-3 py-2 text-t-caption text-ticket-danger">
          {cancelError.includes('RESERVATION_ACTIVE') || cancelError.includes('reserva')
            ? 'Não foi possível cancelar: há uma reserva ativa neste anúncio. Aguarde a expiração.'
            : cancelError}
        </div>
      )}
      {data.items.map((listing) => (
        <ListingCard key={listing.id} listing={listing}
          onCancel={listing.status === 'active' || listing.status === 'pending_review' ? () => cancelMutation.mutate(listing.id) : undefined}
          cancelling={cancellingId === listing.id}
        />
      ))}
    </div>
  )
}

function ListingCard({ listing, onCancel, cancelling }: {
  listing: ListingItem; onCancel?: () => void; cancelling?: boolean
}) {
  const statusMap: Record<string, string> = { active: 'Ativo', pending_review: 'Em análise', sold: 'Vendido', cancelled: 'Cancelado' }
  return (
    <div className="flex flex-col gap-2 rounded-t-card bg-surface p-4 shadow-t-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-t-caption text-ticket-muted">{formatDate(listing.createdAt)}</span>
        <StatusPill status={statusMap[listing.status] === 'Ativo' ? 'confirmado' : statusMap[listing.status] === 'Vendido' ? 'confirmado' : statusMap[listing.status] === 'Cancelado' ? 'cancelado' : 'pendente'} />
      </div>
      <p className="line-clamp-1 font-lexend text-t-title text-ticket-text">{listing.event.name}</p>
      <p className="text-t-caption text-ticket-muted">
        {listing.ticketCategory} · {listing.ticketType} · {listing.quantity} unidade{listing.quantity > 1 ? 's' : ''}
      </p>
      <p className="font-sora text-t-price-m text-ticket-primary">{formatBRL(listing.priceCents)}</p>
      {onCancel && (
        <Button size="sm" variant="outline" disabled={cancelling} onClick={onCancel} className="self-start mt-1">
          {cancelling ? 'Cancelando…' : 'Cancelar anúncio'}
        </Button>
      )}
    </div>
  )
}

// ─── Comprados ───

function PurchasedTab({ query }: { query: ReturnType<typeof useQuery<import('../lib/orders').OrdersPage | undefined>> }) {
  if (query.isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        <Skeleton className="h-40 w-full rounded-t-card" />
        <Skeleton className="h-40 w-full rounded-t-card" />
      </div>
    )
  }
  if (query.isError) {
    return <ErrorState title="Erro ao carregar ingressos." action={<Button size="sm" onClick={() => query.refetch()}>Tentar novamente</Button>} />
  }
  const data = query.data
  if (!data || data.items.length === 0) {
    return (
      <EmptyState title="Você ainda não comprou ingressos"
        description="Quando comprar, seus ingressos aparecem aqui."
        action={<Button size="sm" to="/sellers/new">Anunciar ingresso</Button>} />
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.items.map((order) => {
        const snapshot = order.ticketSnapshot as { event?: { name?: string }; session?: { startsAt?: string } } | null
        const status = order.status === 'paid' ? 'confirmado' : order.status === 'cancelled' ? 'cancelado' : 'pendente'
        return (
          <Link key={order.code} to={`/tickets/${order.code}`} className="block focus-visible:outline-none">
            <OrderCard code={order.code}
              eventTitle={snapshot?.event?.name ?? 'Pedido'}
              date={snapshot?.session?.startsAt ? formatDateTime(snapshot.session.startsAt) : formatDate(order.createdAt)}
              total={formatBRL(order.total)} status={status} />
          </Link>
        )
      })}
    </div>
  )
}

// ─── Vendidos ───

function SoldTab({ query }: { query: ReturnType<typeof useQuery<SoldListing[] | undefined>> }) {
  if (query.isPending) {
    return <div className="grid gap-3 md:grid-cols-2" aria-hidden><Skeleton className="h-24 w-full rounded-t-card" /></div>
  }
  if (query.isError) {
    return <ErrorState title="Erro ao carregar vendas." action={<Button size="sm" onClick={() => query.refetch()}>Tentar novamente</Button>} />
  }
  const sold = query.data ?? []
  if (sold.length === 0) {
    return (
      <EmptyState title="Nenhuma venda ainda"
        description="Quando um dos seus anúncios for vendido, aparece aqui (sem dados do comprador)."
        action={<Button size="sm" to="/sellers/new">Anunciar ingresso</Button>} />
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {sold.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-t-card bg-surface p-4 shadow-t-row">
          <div className="min-w-0 flex-1">
            <p className="text-t-label-strong text-ticket-text">{item.event.name}</p>
            <p className="text-t-caption text-ticket-muted">
              {item.ticketCategory} · {item.ticketType} · {item.quantity} un.
            </p>
            <p className="text-t-caption text-ticket-muted">{formatDate(item.soldAt)}</p>
          </div>
          <p className="font-sora text-t-price-m text-ticket-primary">{formatBRL(item.priceCents)}</p>
        </li>
      ))}
    </ul>
  )
}
