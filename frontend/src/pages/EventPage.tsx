import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { eventQueryKey, eventsApi, formatEventDateRange, formatEventDay, formatEventMonthYear, formatEventWeekday, categoryGradient } from '../lib/events'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

// Página pública do evento: fundo hero desfocado (gradiente por categoria), card da
// imagem com sombra, título, intervalo de datas e lista de sessões clicáveis.
export function EventPage() {
  const { slug } = useParams<{ slug: string }>()

  useEffect(() => {
    document.title = 'Evento | Ingressos'
  }, [])

  const eventQuery = useQuery({
    queryKey: eventQueryKey(slug ?? ''),
    queryFn: () => eventsApi.bySlug(slug ?? ''),
    enabled: !!slug,
    retry: false,
  })

  // todos os hooks ANTES dos returns condicionais (regra do React)
  useEffect(() => {
    document.title = eventQuery.data ? `${eventQuery.data.name} | Ingressos` : 'Evento | Ingressos'
  }, [eventQuery.data])

  if (eventQuery.isPending || !slug) {
    return (
      <main className="min-h-screen bg-ticket-surface-muted">
        <div className="h-72 w-full bg-ticket-surface2" aria-hidden />
        <div className="mx-auto -mt-40 w-full max-w-[600px] px-4">
          <Skeleton className="aspect-[3/4] w-full rounded-t-card" />
          <Skeleton className="mt-6 h-8 w-2/3" />
          <Skeleton className="mt-3 h-5 w-40" />
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-t-card" />
            <Skeleton className="h-20 w-full rounded-t-card" />
          </div>
        </div>
      </main>
    )
  }

  if (eventQuery.isError) {
    const notFound = eventQuery.error instanceof ApiClientError && eventQuery.error.status === 404
    return (
      <main className="min-h-screen bg-ticket-surface-muted">
        <div className="mx-auto max-w-[600px] px-4 py-16">
          {notFound ? (
            <EmptyState
              title="Evento não encontrado"
              description="Este evento não existe ou foi removido."
              action={
                <Button size="sm" to="/">
                  Voltar para a página inicial
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Não conseguimos carregar o evento."
              description="Verifique sua conexão e tente novamente."
              action={
                <Button size="sm" onClick={() => eventQuery.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          )}
        </div>
      </main>
    )
  }

  const event = eventQuery.data
  const gradient = categoryGradient(event.category)
  const dateRange = formatEventDateRange(event.sessions)

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      {/* fundo hero: mesma arte da capa, em largura total, cinza desfocado */}
      <div className="relative h-96 w-full overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 scale-110 grayscale blur-2xl"
          style={{ background: gradient }}
        />
        <div aria-hidden className="absolute inset-0 bg-ticket-scrim/40" />
        <div className="relative mx-auto -mb-24 w-full max-w-[380px] px-4 pt-10">
          {/* card da imagem: cantos arredondados + sombra (placeholder = gradiente da categoria) */}
          <div
            className="aspect-[3/4] w-full rounded-t-card shadow-t-hover"
            style={{ background: gradient }}
            role="img"
            aria-label={`Imagem do evento ${event.name}`}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[600px] px-4 pb-12">
        <h1 className="mt-6 text-center font-lexend text-t-display text-ticket-text">{event.name}</h1>

        <div className="mt-3 flex items-center justify-center gap-2 text-t-body text-ticket-muted">
          <span aria-hidden>🗓️</span>
          <span>{dateRange ?? 'Datas a definir'}</span>
        </div>
        <p className="mt-1 text-center text-t-caption text-ticket-muted">
          {event.sessions.length} {event.sessions.length === 1 ? 'data' : 'datas'}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {event.featured && (
            <span className="rounded-t-pill border border-ticket-primary-outline px-3 py-1 text-t-caption-strong text-ticket-primary">
              Destaque
            </span>
          )}
          <span className="rounded-t-pill border border-ticket-primary-outline px-3 py-1 text-t-caption-strong text-ticket-primary">
            {event.category}
          </span>
        </div>

        <section aria-label="Datas" className="mt-8 flex flex-col gap-3">
          <h2 className="text-t-label text-ticket-muted">Datas</h2>
          {event.sessions.map((session) => (
            <Link
              key={session.id}
              to={`/event/${event.slug}/session/${session.id}`}
              className="flex items-center gap-4 rounded-t-card border border-ticket-border bg-surface p-4 shadow-t-row transition-shadow duration-150 hover:shadow-t-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
            >
              <div className="flex w-16 shrink-0 flex-col items-center rounded-t-control border border-ticket-primary-outline px-2 py-1.5">
                <span className="font-sora text-t-h2 text-ticket-primary">{formatEventDay(session.startsAt)}</span>
                <span className="text-t-nano uppercase text-ticket-muted">{formatEventMonthYear(session.startsAt)}</span>
                <span className="text-t-nano text-ticket-muted">{formatEventWeekday(session.startsAt)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-t-body-strong text-ticket-text">{session.city}</p>
                <p className="text-t-caption text-ticket-muted">
                  {session.venue} · {session.uf}
                </p>
                <p className="text-t-caption">
                  {session.hasOffers && session.minPriceCents !== null ? (
                    <span className="font-sora text-ticket-primary">a partir de R$ {session.minPriceCents / 100}</span>
                  ) : (
                    <span className="text-ticket-faint">Indisponível</span>
                  )}
                </p>
              </div>
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-t-control bg-ticket-primary text-on-ticket-white transition-colors hover:bg-ticket-primary-press"
              >
                →
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
