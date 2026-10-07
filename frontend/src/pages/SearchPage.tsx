import { useEffect, useState } from 'react'
import type { EventsPage } from '../lib/events'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { eventsApi, formatEventDay, formatEventMonthYear } from '../lib/events'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'


type DateFilter = '' | 'today' | 'weekend' | 'month'

const PERIOD_LABELS: Record<string, string> = {
  today: 'Acontecendo hoje',
  weekend: 'Neste fim de semana',
  month: 'Este mês',
}

// /search — URL como fonte da verdade (?q=&category=&period=&sort=&page=).
// Debounce 300ms no texto; filtros combinados; "Carregar mais" com paginação.
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? ''
  const period = (searchParams.get('period') ?? '') as DateFilter
  const sort = searchParams.get('sort') ?? ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

  const [debouncedQ, setDebouncedQ] = useState(q)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    document.title = q ? `${q} — busca | Ingressos` : 'Buscar eventos | Ingressos'
  }, [q])

  function updateParams(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in updates)) next.delete('page')
    setSearchParams(next)
  }

  function clearFilters() {
    const q = searchParams.get('q')
    setSearchParams(q ? { q } : {})
  }

  const hasFilters = !!(category || period || sort)

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="mx-auto max-w-[1200px] px-2 py-6">
        <h1 className="font-lexend text-t-h1 text-ticket-text">
          {q ? `Resultados para "${q}"` : 'Buscar eventos'}
        </h1>

        {/* FILTROS */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <span className="text-t-caption text-ticket-muted">Filtrar por</span>
          <FilterSelect label="Categorias" value={category} onChange={(v) => updateParams({ category: v })} options={[
            { value: '', label: 'Todas' }, { value: 'Shows', label: 'Shows' }, { value: 'Festivais', label: 'Festivais' },
            { value: 'Futebol', label: 'Futebol' }, { value: 'Teatro', label: 'Teatro' },
          ]} />
          <FilterSelect label="Data" value={period} onChange={(v) => updateParams({ period: v })} options={[
            { value: '', label: 'Todas as datas' }, { value: 'today', label: 'Hoje' },
            { value: 'weekend', label: 'Este fim de semana' }, { value: 'month', label: 'Este mês' },
          ]} />
          <FilterSelect label="Ordenar por" value={sort} onChange={(v) => updateParams({ sort: v })} options={[
            { value: '', label: 'Relevância' }, { value: 'date', label: 'Data' },
            { value: 'price_asc', label: 'Menor preço' }, { value: 'price_desc', label: 'Maior preço' },
          ]} />
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="ml-auto text-t-caption text-ticket-primary underline hover:no-underline">
              Limpar filtro
            </button>
          )}
        </div>

        {/* CHIPS */}
        <div className="mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Filtros rápidos">
          {(['today', 'weekend', 'month'] as DateFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => updateParams({ period: period === p ? '' : p })}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-t-pill px-3 py-1.5 text-t-caption-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline',
                period === p ? 'bg-ticket-primary text-on-ticket-white' : 'bg-ticket-primary-soft text-ticket-primary hover:bg-ticket-primary-tint',
              )}
            >
              <span aria-hidden>{p === 'today' ? '⚡' : p === 'weekend' ? '📅' : '🗓️'}</span>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <SearchResults
          q={debouncedQ} category={category} period={period} sort={sort} page={page}
          updateParams={updateParams} clearFilters={clearFilters} hasFilters={hasFilters}
        />
      </div>
    </main>
  )
}

// ─── Resultados ───

type SearchResultsProps = {
  q: string; category: string; period: DateFilter; sort: string; page: number
  updateParams: (updates: Record<string, string>) => void
  clearFilters: () => void
  hasFilters: boolean
}

function SearchResults(props: SearchResultsProps) {
  const { q, category, period, sort, page } = props
  const results = useQuery({
    queryKey: ['events', 'search', q, category, period, sort, page],
    queryFn: () => eventsApi.list({
      q: q || undefined, category: category || undefined,
      period: period || undefined, sort: sort || undefined, page,
    }),
    placeholderData: (previous: EventsPage | undefined) => previous,
  })

  if (results.isPending) {
    return (
      <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <Skeleton className="aspect-[4/3] w-full rounded-t-card" />
            <Skeleton className="mt-2 h-5 w-3/4" />
            <Skeleton className="mt-1 h-4 w-1/2" />
          </li>
        ))}
      </ul>
    )
  }

  if (results.isError) {
    return (
      <div className="mt-6">
        <ErrorState title="Não conseguimos buscar os eventos." action={
          <Button size="sm" onClick={() => results.refetch()}>Tentar novamente</Button>
        } />
      </div>
    )
  }

  const data = results.data
  if (data.items.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState title="Nenhum evento encontrado"
          description={q ? `Não achamos eventos para "${q}".` : 'Tente ajustar os filtros ou buscar por outro termo.'}
          action={props.hasFilters ? <Button size="sm" variant="outline" onClick={props.clearFilters}>Limpar filtros</Button> : undefined}
        />
      </div>
    )
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data.items.map((event) => {
          const startsAt = event.nextSessionAt
          return (
            <li key={event.id}>
              <Link
                to={`/event/${event.slug}`}
                className="group block overflow-hidden rounded-t-card border-2 border-transparent bg-surface shadow-t-card transition-all duration-150 hover:border-ticket-primary hover:shadow-t-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
              >
                <div className="relative aspect-[4/3] bg-ticket-surface2" aria-hidden>
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ticket-primary-soft to-ticket-surface2 text-3xl">🎟️</div>
                </div>
                <div className="flex flex-col gap-0.5 p-3">
                  <p className="flex items-center gap-1 text-t-caption text-ticket-primary">
                    <span aria-hidden>📅</span>
                    {startsAt ? formatEventDay(startsAt) + ' ' + formatEventMonthYear(startsAt) : 'a definir'}
                  </p>
                  <h3 className="truncate text-t-title text-ticket-text" title={event.name}>{event.name}</h3>
                  <p className="flex items-center gap-0.5 text-t-caption text-ticket-muted">
                    <span aria-hidden>📍</span> {event.city}
                  </p>
                  {event.minPriceCents !== null && (
                    <p className="mt-1 font-sora text-t-price-m text-ticket-primary">
                      {event.minPriceCents > 0 ? `a partir de R$ ${event.minPriceCents / 100}` : 'grátis'}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {data.page < data.totalPages && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => props.updateParams({ page: String(data.page + 1) })}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ───

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-t-nano text-ticket-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-t-control border border-ticket-border bg-surface px-2 text-t-caption text-ticket-text focus:outline-none focus:ring-2 focus:ring-ticket-primary-outline"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  )
}
