import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'

// Eventos, sessões, ofertas e reservas (tema ingressos).
// Disponível = quantity - soma de reservas ativas NÃO expiradas. A reserva é
// criada em transação com lock na oferta (SELECT ... FOR UPDATE): duas pessoas
// nunca reservam o último ingresso. A oferta só perde estoque na confirmação
// do pagamento (payment.service).

export const RESERVATION_TTL_MS = 10 * 60 * 1000
export const MAX_RESERVATION_QUANTITY = 4

const SORTS = new Set(['relevance', 'date', 'price_asc', 'price_desc'])
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type OfferWithHeld = {
  id: string
  ticketType: string
  ticketCategory: string
  priceCents: number
  quantity: number
  sellerId: string | null
}

// Quanto já está reservado (ativo e não expirado) por oferta
async function heldByOfferIds(offerIds: string[]): Promise<Map<string, number>> {
  if (offerIds.length === 0) return new Map()
  const held = await prisma.reservation.groupBy({
    by: ['offerId'],
    where: { offerId: { in: offerIds }, status: 'active', expiresAt: { gt: new Date() } },
    _sum: { quantity: true },
  })
  return new Map(held.map((row) => [row.offerId, row._sum.quantity ?? 0]))
}

export function availabilityOf(offer: { quantity: number }, held: number): number {
  return Math.max(0, offer.quantity - held)
}

export type ListEventsInput = { q?: string; category?: string; date?: string; sort?: string; page: number; limit: number }

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

export async function listEvents(input: ListEventsInput): Promise<{
  items: EventListItem[]
  page: number
  limit: number
  total: number
  totalPages: number
}> {
  if (input.sort && !SORTS.has(input.sort)) {
    throw new ApiError(400, 'VALIDATION', 'Ordenação inválida.', { sort: 'Use relevance, date, price_asc ou price_desc.' })
  }
  if (input.date && !DATE_PATTERN.test(input.date)) {
    throw new ApiError(400, 'VALIDATION', 'Data inválida.', { date: 'Use o formato AAAA-MM-DD.' })
  }

  const where: Prisma.EventWhereInput = {}
  if (input.q) {
    where.OR = [
      { name: { contains: input.q, mode: 'insensitive' } },
      { description: { contains: input.q, mode: 'insensitive' } },
      { organizer: { contains: input.q, mode: 'insensitive' } },
    ]
  }
  if (input.category) where.category = { equals: input.category, mode: 'insensitive' }
  if (input.date) {
    const dayStart = new Date(`${input.date}T00:00:00.000Z`)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    where.sessions = { some: { startsAt: { gte: dayStart, lt: dayEnd } } }
  }

  // Dataset pequeno (catálogo curado): agregações de preço/data em memória após o filtro SQL
  const events = await prisma.event.findMany({
    where,
    include: {
      sessions: {
        orderBy: { startsAt: 'asc' },
        include: { offers: { where: { status: 'active' } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const offerIds = events.flatMap((event) => event.sessions.flatMap((session) => session.offers.map((offer) => offer.id)))
  const heldMap = await heldByOfferIds(offerIds)

  const items: (EventListItem & { _sortPrice: number | null; _sortDate: number })[] = events.map((event) => {
    const prices: number[] = []
    let nextSession: { startsAt: Date; city: string } | null = null
    for (const session of event.sessions) {
      if (!nextSession || session.startsAt < nextSession.startsAt) {
        nextSession = { startsAt: session.startsAt, city: session.city }
      }
      for (const offer of session.offers) {
        if (availabilityOf(offer, heldMap.get(offer.id) ?? 0) > 0) prices.push(offer.priceCents)
      }
    }
    const minPrice = prices.length > 0 ? Math.min(...prices) : null
    return {
      id: event.id,
      slug: event.slug,
      name: event.name,
      category: event.category,
      organizer: event.organizer,
      imageUrl: event.imageUrl,
      featured: event.featured,
      sessionCount: event.sessions.length,
      nextSessionAt: nextSession ? nextSession.startsAt.toISOString() : null,
      city: nextSession ? nextSession.city : null,
      minPriceCents: minPrice,
      _sortPrice: minPrice ?? Number.MAX_SAFE_INTEGER,
      _sortDate: nextSession ? nextSession.startsAt.getTime() : Number.MAX_SAFE_INTEGER,
    }
  })

  const sort = input.sort ?? 'relevance'
  items.sort((a, b) => {
    if (sort === 'price_asc') return (a._sortPrice ?? Number.MAX_SAFE_INTEGER) - (b._sortPrice ?? Number.MAX_SAFE_INTEGER)
    if (sort === 'price_desc') return (b._sortPrice ?? Number.MAX_SAFE_INTEGER) - (a._sortPrice ?? Number.MAX_SAFE_INTEGER)
    if (sort === 'date') return a._sortDate - b._sortDate
    // relevance: destaque primeiro, depois mais recente
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return b._sortDate - a._sortDate
  })

  const total = items.length
  const start = (input.page - 1) * input.limit
  return {
    items: items.slice(start, start + input.limit).map(({ _sortPrice: _p, _sortDate: _d, ...rest }) => rest),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  }
}

export async function getEventBySlug(slug: string) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      sessions: {
        orderBy: { startsAt: 'asc' },
        include: { offers: { where: { status: 'active' } } },
      },
    },
  })
  if (!event) return null

  const heldMap = await heldByOfferIds(event.sessions.flatMap((s) => s.offers.map((o) => o.id)))
  const sessions = event.sessions.map((session) => {
    const prices: number[] = []
    let available = 0
    for (const offer of session.offers) {
      const free = availabilityOf(offer, heldMap.get(offer.id) ?? 0)
      available += free
      if (free > 0) for (let i = 0; i < free; i++) prices.push(offer.priceCents)
    }
    return {
      id: session.id,
      startsAt: session.startsAt.toISOString(),
      city: session.city,
      uf: session.uf,
      venue: session.venue,
      hasOffers: session.offers.length > 0 && available > 0,
      minPriceCents: prices.length > 0 ? Math.min(...prices) : null,
    }
  })

  const { sessions: _s, ...eventFields } = event
  return { ...eventFields, createdAt: event.createdAt.toISOString(), sessions }
}

export async function getSessionDetail(sessionId: string) {
  const session = await prisma.eventSession.findUnique({
    where: { id: sessionId },
    include: { event: true, offers: { where: { status: 'active' } } },
  })
  if (!session) return null

  const heldMap = await heldByOfferIds(session.offers.map((o) => o.id))
  const byType = new Map<string, number>()
  const byCategory = new Map<string, number>()
  const prices: number[] = []
  for (const offer of session.offers) {
    if (availabilityOf(offer, heldMap.get(offer.id) ?? 0) <= 0) continue
    byType.set(offer.ticketType, Math.min(byType.get(offer.ticketType) ?? Number.MAX_SAFE_INTEGER, offer.priceCents))
    byCategory.set(offer.ticketCategory, Math.min(byCategory.get(offer.ticketCategory) ?? Number.MAX_SAFE_INTEGER, offer.priceCents))
    prices.push(offer.priceCents)
  }
  const toList = (map: Map<string, number>) => [...map.entries()].map(([value, minPriceCents]) => ({ value, minPriceCents })).sort((a, b) => a.minPriceCents - b.minPriceCents)

  const { event, offers: _o, ...sessionFields } = session
  return {
    id: session.id,
    startsAt: session.startsAt.toISOString(),
    city: session.city,
    uf: session.uf,
    venue: session.venue,
    event: {
      slug: event.slug,
      name: event.name,
      category: event.category,
      organizer: event.organizer,
      imageUrl: event.imageUrl,
    },
    types: toList(byType),
    categories: toList(byCategory),
    minPriceCents: prices.length > 0 ? Math.min(...prices) : null,
    hasOffers: prices.length > 0,
  }
}

export async function listSessionOffers(
  sessionId: string,
  filters: { type?: string; category?: string },
) {
  const session = await prisma.eventSession.findUnique({ where: { id: sessionId }, select: { id: true } })
  if (!session) return null

  const offers: OfferWithHeld[] = await prisma.offer.findMany({
    where: {
      sessionId,
      status: 'active',
      ...(filters.type ? { ticketType: { equals: filters.type, mode: 'insensitive' } } : {}),
      ...(filters.category ? { ticketCategory: { equals: filters.category, mode: 'insensitive' } } : {}),
    },
    orderBy: { priceCents: 'asc' },
  })
  const heldMap = await heldByOfferIds(offers.map((o) => o.id))

  return offers
    .map((offer) => ({ ...offer, available: availabilityOf(offer, heldMap.get(offer.id) ?? 0) }))
    .filter((offer) => offer.available > 0)
    .map((offer) => ({
      id: offer.id,
      ticketType: offer.ticketType,
      ticketCategory: offer.ticketCategory,
      priceCents: offer.priceCents,
      available: offer.available,
      seller: offer.sellerId ? 'vendedor' : 'plataforma',
    }))
}

export type CreateReservationInput = { userId: string; offerId: string; quantity: number }

export async function createReservation(input: CreateReservationInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_RESERVATION_QUANTITY) {
    throw new ApiError(400, 'VALIDATION', 'Quantidade inválida.', { quantity: `Deve ser entre 1 e ${MAX_RESERVATION_QUANTITY}.` })
  }
  // guarda de formato: evita erro de cast uuid = text no lock abaixo
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.offerId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Oferta não encontrada')
  }
  const offer = await prisma.offer.findUnique({
    where: { id: input.offerId },
    include: { session: { include: { event: { select: { slug: true, name: true } } } } },
  })
  if (!offer) throw new ApiError(404, 'NOT_FOUND', 'Oferta não encontrada')

  const now = new Date()
  const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MS)
  // Regra: NO MÁXIMO 1 reserva ativa por usuário.
  // - Mesma oferta ativa → REAPROVEITA (renova o TTL, sem criar nova);
  //   se a oferta dessa reserva já foi decrementada/deixou de existir, a reserva
  //   é descartada (lazily) e o fluxo segue normal.
  // - Outra oferta ativa → vira `cancelled` na MESMA transação (libera o estoque dela).
  const existingActive = await prisma.reservation.findFirst({
    where: { userId: input.userId, status: 'active', expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    include: { offer: { select: { id: true, quantity: true, status: true } } },
  })
  if (existingActive && existingActive.offerId === input.offerId) {
    if (existingActive.offer.status !== 'active') {
      // oferta deixou de existir/foi cancelada: descarta a reserva órfã e segue
      await prisma.reservation.update({ where: { id: existingActive.id }, data: { status: 'cancelled' } })
    } else {
      const renewed = await prisma.reservation.update({
        where: { id: existingActive.id },
        data: { expiresAt },
      })
      return {
        id: renewed.id,
        quantity: renewed.quantity,
        expiresAt: renewed.expiresAt.toISOString(),
        reused: true,
        offer: {
          id: offer.id,
          ticketType: offer.ticketType,
          ticketCategory: offer.ticketCategory,
          priceCents: offer.priceCents,
          session: { id: offer.session.id, startsAt: offer.session.startsAt.toISOString(), city: offer.session.city, venue: offer.session.venue },
          event: { slug: offer.session.event.slug, name: offer.session.event.name },
        },
      }
    }
  }

  // Lock da linha da oferta: serializa reservas concorrentes; a disponibilidade é
  // recalculada DENTRO da transação, depois do lock
  const result = await prisma.$transaction(async (tx) => {
    // cancela a reserva ativa anterior (outra oferta) liberando o estoque dela
    if (existingActive) {
      await tx.reservation.update({ where: { id: existingActive.id }, data: { status: 'cancelled' } })
    }
    await tx.$queryRaw`SELECT "id" FROM "Offer" WHERE "id" = ${offer.id}::uuid FOR UPDATE`
    const active = await tx.reservation.aggregate({
      where: { offerId: offer.id, status: 'active', expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    })
    const available = availabilityOf(offer, active._sum.quantity ?? 0)
    if (offer.status !== 'active' || available < input.quantity) {
      throw new ApiError(422, 'OFFER_UNAVAILABLE', 'Ingressos esgotados ou indisponíveis nesta oferta.')
    }
    return tx.reservation.create({
      data: { offerId: offer.id, userId: input.userId, quantity: input.quantity, expiresAt },
    })
  })

  return {
    id: result.id,
    quantity: result.quantity,
    expiresAt: result.expiresAt.toISOString(),
    offer: {
      id: offer.id,
      ticketType: offer.ticketType,
      ticketCategory: offer.ticketCategory,
      priceCents: offer.priceCents,
      session: { id: offer.session.id, startsAt: offer.session.startsAt.toISOString(), city: offer.session.city, venue: offer.session.venue },
      event: { slug: offer.session.event.slug, name: offer.session.event.name },
    },
  }
}

export async function listActiveReservations(userId: string) {
  const reservations = await prisma.reservation.findMany({
    where: { userId, status: 'active', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: {
      offer: {
        include: {
          session: { include: { event: { select: { slug: true, name: true } } } },
        },
      },
    },
  })
  return reservations.map((reservation) => ({
    id: reservation.id,
    quantity: reservation.quantity,
    expiresAt: reservation.expiresAt.toISOString(),
    offer: {
      id: reservation.offer.id,
      ticketType: reservation.offer.ticketType,
      ticketCategory: reservation.offer.ticketCategory,
      priceCents: reservation.offer.priceCents,
      session: {
        id: reservation.offer.session.id,
        startsAt: reservation.offer.session.startsAt.toISOString(),
        city: reservation.offer.session.city,
        venue: reservation.offer.session.venue,
      },
      event: { slug: reservation.offer.session.event.slug, name: reservation.offer.session.event.name },
    },
  }))
}

export async function cancelReservation(userId: string, reservationId: string) {
  const reservation = await prisma.reservation.findFirst({ where: { id: reservationId, userId } })
  // Mesmo contrato do resto da API: recurso de outro usuário não existe
  if (!reservation) throw new ApiError(404, 'NOT_FOUND', 'Reserva não encontrada')
  if (reservation.status !== 'active' || reservation.expiresAt <= new Date()) {
    throw new ApiError(422, 'INVALID_STATUS', 'Esta reserva não está mais ativa.')
  }
  await prisma.reservation.update({ where: { id: reservation.id }, data: { status: 'cancelled' } })
  return { ok: true }
}
