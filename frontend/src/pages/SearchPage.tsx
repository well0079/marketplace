import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { eventsApi } from '../lib/events'
import { EventCard } from '../components/ingressos/Cards'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

// Busca mínima (ETAPA 2+3): grid de EventCard por q; filtros completos ficam para depois.
export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  useEffect(() => {
    document.title = q ? `${q} — busca | Ingressos` : 'Buscar eventos | Ingressos'
  }, [q])

  const results = useQuery({
    queryKey: ['events', 'search', q],
    queryFn: () => eventsApi.list({ q: q || undefined }),
  })

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="mx-auto max-w-[1200px] px-2 py-6">
        <h1 className="font-lexend text-t-h1 text-ticket-text">
          {q ? `Resultados para "${q}"` : 'Todos os eventos'}
        </h1>

        {results.isPending && (
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="aspect-[4/3] w-full rounded-t-card" />
                <Skeleton className="mt-2 h-5 w-3/4" />
                <Skeleton className="mt-1 h-4 w-1/2" />
              </li>
            ))}
          </ul>
        )}

        {results.isError && (
          <div className="mt-6">
            <ErrorState
              title="Não conseguimos buscar os eventos."
              description="Verifique sua conexão e tente novamente."
              action={
                <Button size="sm" onClick={() => results.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          </div>
        )}

        {results.data && results.data.items.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title="Nenhum evento encontrado"
              description={q ? `Não achamos eventos para "${q}". Tente outro termo.` : 'Ainda não há eventos publicados.'}
              action={
                <Button size="sm" to="/">
                  Ver destaques
                </Button>
              }
            />
          </div>
        )}

        {results.data && results.data.items.length > 0 && (
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {results.data.items.map((event) => (
              <EventCard
                key={event.id}
                event={{
                  id: event.slug,
                  title: event.name,
                  date: event.nextSessionAt ? new Date(event.nextSessionAt).toLocaleDateString('pt-BR') : 'a definir',
                  venue: event.city ?? '',
                  price: event.minPriceCents !== null ? event.minPriceCents / 100 : 0,
                }}
              />
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-t-caption text-ticket-faint">
          Filtros por categoria, data e preço chegam na próxima etapa.
        </p>
      </div>
    </main>
  )
}
