import { api } from './api'

// API do tema ingressos (bloco 1) — dados REAIS do backend, nada mockado.

export type EventListItem = {
  id: string
  slug: string
  name: string
  category: string
  organizer: string
  imageUrl: string | null
  featured: boolean
  sessionCount: number
  nextSessionAt: string | null
  city: string | null
  minPriceCents: number | null
}

export type EventsPage = {
  items: EventListItem[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export type EventSessionSummary = {
  id: string
  startsAt: string
  city: string
  uf: string
  venue: string
  hasOffers: boolean
  minPriceCents: number | null
}

export type EventDetail = {
  id: string
  slug: string
  name: string
  category: string
  organizer: string
  description: string
  imageUrl: string | null
  featured: boolean
  createdAt: string
  sessions: EventSessionSummary[]
}

export type SessionTypeOrCategory = { value: string; minPriceCents: number }

export type SessionDetail = {
  id: string
  startsAt: string
  city: string
  uf: string
  venue: string
  event: { slug: string; name: string; category: string; organizer: string; description: string; imageUrl: string | null }
  types: SessionTypeOrCategory[]
  categories: SessionTypeOrCategory[]
  minPriceCents: number | null
  hasOffers: boolean
}

export type OfferListItem = {
  id: string
  ticketType: string
  ticketCategory: string
  priceCents: number
  available: number
  seller: 'plataforma' | 'vendedor'
}

export type ReservationPayload = {
  id: string
  quantity: number
  expiresAt: string
  reused?: boolean
  offer: {
    id: string
    ticketType: string
    ticketCategory: string
    priceCents: number
    session: { id: string; startsAt: string; city: string; venue: string }
    event: { slug: string; name: string }
  }
}

export const eventsApi = {
  list: (params: { q?: string; category?: string; date?: string; period?: string; sort?: string; page?: number }) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.category) search.set('category', params.category)
    if (params.date) search.set('date', params.date)
    if (params.period) search.set('period', params.period)
    if (params.sort) search.set('sort', params.sort)
    if (params.page) search.set('page', String(params.page))
    const query = search.toString()
    return api.get<EventsPage>(`/events${query ? `?${query}` : ''}`)
  },
  bySlug: (slug: string) => api.get<EventDetail>(`/events/${encodeURIComponent(slug)}`),
  session: (sessionId: string) => api.get<SessionDetail>(`/sessions/${encodeURIComponent(sessionId)}`),
  offers: (sessionId: string, filters: { type?: string; category?: string }) => {
    const search = new URLSearchParams()
    if (filters.type) search.set('type', filters.type)
    if (filters.category) search.set('category', filters.category)
    const query = search.toString()
    return api.get<OfferListItem[]>(`/sessions/${encodeURIComponent(sessionId)}/offers${query ? `?${query}` : ''}`)
  },
  reserve: (offerId: string, quantity = 1) => api.post<ReservationPayload>('/reservations', { offerId, quantity }),
  cancelReservation: (id: string) => api.delete<{ ok: boolean }>(`/reservations/${encodeURIComponent(id)}`),
}

export function eventQueryKey(slug: string) {
  return ['events', 'detail', slug] as const
}

export function sessionQueryKey(sessionId: string) {
  return ['events', 'session', sessionId] as const
}

export function sessionOffersQueryKey(sessionId: string, type: string, category: string) {
  return ['events', 'offers', sessionId, type, category] as const
}

// ─── Formatação de data (pt-BR, fuso local do navegador) ───

export function formatEventDay(startsAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'UTC' }).format(new Date(startsAt))
}

export function formatEventMonthYear(startsAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(startsAt))
    .replace('.', '')
}

export function formatEventWeekday(startsAt: string): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(startsAt))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatEventFullDate(startsAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(startsAt))
}

// Intervalo "14/11 até 15/11" (data única: "14/11")
export function formatEventDateRange(sessions: { startsAt: string }[]): string | null {
  const dates = sessions.map((s) => new Date(s.startsAt)).sort((a, b) => a.getTime() - b.getTime())
  if (dates.length === 0) return null
  const fmtDayMonth = (d: Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d)
  const first = fmtDayMonth(dates[0])
  const last = fmtDayMonth(dates[dates.length - 1])
  return dates.length === 1 ? first : `${first} até ${last}`
}

// ─── Placeholder visual: gradiente determinístico por categoria (nada copiado) ───

const CATEGORY_GRADIENTS = [
  ['#5C4BF9', '#241542'],
  ['#0FA968', '#0B7F4F'],
  ['#F99D23', '#C2410C'],
  ['#FFAEDC', '#5C4BF9'],
  ['#73E589', '#0FA968'],
  ['#E8D33D', '#F99D23'],
]

export function categoryGradient(category: string): string {
  let hash = 0
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) % 997
  const [from, to] = CATEGORY_GRADIENTS[hash % CATEGORY_GRADIENTS.length]
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
}

// ─── Checkout (tema ingressos) ───

export function cancelReservationApi(reservationId: string) {
  return api.delete<{ ok: boolean }>(`/reservations/${encodeURIComponent(reservationId)}`)
}
