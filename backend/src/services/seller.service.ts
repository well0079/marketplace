import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { onlyDigits } from '../lib/cpf'

// Vendedor e anúncios (tema ingressos, bloco 5b). Verificação "básica":
// consentimento + endereço de cobrança. Sem KYC/biometria/repasse.
// IMPORTANTE: anúncios de terceiros nascem `pending_review` a menos que
// SELLER_OFFERS_AUTO_APPROVE=true (padrão true em dev/test, false em produção).

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])
const TICKET_TYPES = new Set(['Pista', 'Área VIP', 'Camarote'])
const TICKET_CATEGORIES = new Set(['Inteira', 'Meia', 'Solidário'])

function listingMaxQty(): number {
  const parsed = Number.parseInt(process.env.LISTING_MAX_QTY ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}
function listingMinPrice(): number {
  const parsed = Number.parseInt(process.env.LISTING_MIN_PRICE_CENTS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500
}
function listingMaxPrice(): number {
  const parsed = Number.parseInt(process.env.LISTING_MAX_PRICE_CENTS ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2_000_000
}
function autoApprove(): boolean {
  if (process.env.NODE_ENV === 'production') return process.env.SELLER_OFFERS_AUTO_APPROVE === 'true'
  return process.env.SELLER_OFFERS_AUTO_APPROVE !== 'false'
}
const MAX_ACTIVE_LISTINGS = 20

export async function getSellerMe(userId: string) {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId } })
  if (!profile) return null
  return {
    verificationLevel: profile.verificationLevel,
    cep: profile.cep,
    uf: profile.uf,
    city: profile.city,
    neighborhood: profile.neighborhood,
    street: profile.street,
    number: profile.number,
    complement: profile.complement,
    createdAt: profile.createdAt.toISOString(),
  }
}

export type VerifySellerInput = {
  userId: string
  consent: boolean
  address: { cep: string; uf: string; city: string; neighborhood: string; street: string; number: string; complement?: string }
}

export async function verifySeller(input: VerifySellerInput) {
  if (!input.consent) {
    throw new ApiError(400, 'VALIDATION', 'Consentimento obrigatório.', { consent: 'Marque a caixa de consentimento.' })
  }
  const cep = onlyDigits(input.address.cep)
  if (cep.length !== 8) {
    throw new ApiError(400, 'VALIDATION', 'Verifique o endereço.', { 'address.cep': 'CEP deve ter 8 dígitos.' })
  }
  const uf = input.address.uf.toUpperCase()
  if (!UFS.has(uf)) {
    throw new ApiError(400, 'VALIDATION', 'Verifique o endereço.', { 'address.uf': 'UF inválida.' })
  }
  for (const [field, min] of [['city', 2], ['neighborhood', 2], ['street', 2], ['number', 1]] as const) {
    const value = (input.address as Record<string, string>)[field] ?? ''
    if (value.trim().length < min) {
      throw new ApiError(400, 'VALIDATION', 'Verifique o endereço.', { [`address.${field}`]: 'Campo obrigatório.' })
    }
  }

  // idempotente: refazer atualiza o endereço
  const profile = await prisma.sellerProfile.upsert({
    where: { userId: input.userId },
    update: {
      cep,
      uf,
      city: input.address.city.trim(),
      neighborhood: input.address.neighborhood.trim(),
      street: input.address.street.trim(),
      number: input.address.number.trim(),
      complement: input.address.complement?.trim() ?? null,
      consentAt: new Date(),
    },
    create: {
      userId: input.userId,
      verificationLevel: 'basic',
      consentAt: new Date(),
      cep,
      uf,
      city: input.address.city.trim(),
      neighborhood: input.address.neighborhood.trim(),
      street: input.address.street.trim(),
      number: input.address.number.trim(),
      complement: input.address.complement?.trim() ?? null,
    },
  })
  return { verificationLevel: profile.verificationLevel }
}

export async function isVerifiedSeller(userId: string): Promise<boolean> {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId } })
  return Boolean(profile && profile.verificationLevel === 'basic')
}

export type CreateListingInput = {
  userId: string
  sessionId: string
  ticketType: string
  ticketCategory: string
  quantity: number
  priceCents: number
}

export async function createListing(input: CreateListingInput) {
  if (!(await isVerifiedSeller(input.userId))) {
    throw new ApiError(403, 'SELLER_NOT_VERIFIED', 'Complete a verificação de vendedor antes de anunciar.')
  }

  const session = await prisma.eventSession.findUnique({
    where: { id: input.sessionId },
    include: { event: { select: { name: true } } },
  })
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Sessão não encontrada')
  if (session.startsAt <= new Date()) {
    throw new ApiError(422, 'SESSION_PAST', 'Não é possível anunciar ingressos para sessões passadas.')
  }

  if (!TICKET_TYPES.has(input.ticketType)) {
    throw new ApiError(400, 'VALIDATION', 'Tipo de ingresso inválido.', { ticketType: 'Use Pista, Área VIP ou Camarote.' })
  }
  if (!TICKET_CATEGORIES.has(input.ticketCategory)) {
    throw new ApiError(400, 'VALIDATION', 'Categoria inválida.', { ticketCategory: 'Use Inteira, Meia ou Solidário.' })
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > listingMaxQty()) {
    throw new ApiError(400, 'VALIDATION', 'Quantidade inválida.', { quantity: `Deve ser entre 1 e ${listingMaxQty()}.` })
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < listingMinPrice() || input.priceCents > listingMaxPrice()) {
    throw new ApiError(400, 'VALIDATION', 'Preço inválido.', { priceCents: `Deve ser entre R$ ${(listingMinPrice() / 100).toFixed(2)} e R$ ${(listingMaxPrice() / 100).toFixed(2)}.` })
  }

  const activeCount = await prisma.listing.count({
    where: { sellerId: input.userId, status: { in: ['active', 'pending_review'] } },
  })
  if (activeCount >= MAX_ACTIVE_LISTINGS) {
    throw new ApiError(409, 'MAX_LISTINGS', `Você já tem ${MAX_ACTIVE_LISTINGS} anúncios ativos.`)
  }

  const status = autoApprove() ? 'active' : 'pending_review'
  // C1: anúncio e oferta nascem JUNTOS na mesma transação — a oferta é o que
  // o comprador vê/reserva; o anúncio espelha o status dela.
  const created = await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.create({
      data: {
        sessionId: input.sessionId,
        ticketType: input.ticketType,
        ticketCategory: input.ticketCategory,
        priceCents: input.priceCents,
        quantity: input.quantity,
        sellerId: input.userId,
        status,
      },
    })
    const listing = await tx.listing.create({
      data: {
        sessionId: input.sessionId,
        sellerId: input.userId,
        ticketType: input.ticketType,
        ticketCategory: input.ticketCategory,
        quantity: input.quantity,
        priceCents: input.priceCents,
        status: offer.status,
        offerId: offer.id,
      },
    })
    return listing
  })
  return { id: created.id, status: created.status, quantity: created.quantity, priceCents: created.priceCents }
}

export async function listMyListings(userId: string, status?: string) {
  const where: Prisma.ListingWhereInput = { sellerId: userId }
  if (status) where.status = status
  const listings = await prisma.listing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      session: {
        include: { event: { select: { name: true, slug: true } } },
      },
    },
  })
  const counts = { active: 0, pending_review: 0, sold: 0, cancelled: 0 }
  for (const listing of listings) {
    if (listing.status in counts) counts[listing.status as keyof typeof counts]++
  }
  return {
    items: listings.map((listing) => {
      const snap = listing.session
      return {
        id: listing.id,
        status: listing.status,
        ticketType: listing.ticketType,
        ticketCategory: listing.ticketCategory,
        quantity: listing.quantity,
        priceCents: listing.priceCents,
        createdAt: listing.createdAt.toISOString(),
        event: { name: snap.event.name, slug: snap.event.slug },
        session: { startsAt: snap.startsAt.toISOString(), city: snap.city, venue: snap.venue },
      }
    }),
    counts,
  }
}

export async function cancelListing(userId: string, listingId: string) {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, sellerId: userId } })
  if (!listing) throw new ApiError(404, 'NOT_FOUND', 'Anúncio não encontrado')
  if (listing.status !== 'active' && listing.status !== 'pending_review') {
    throw new ApiError(422, 'INVALID_STATUS', 'Este anúncio não pode mais ser cancelado.')
  }
  // C1: cancela a OFERTA junto, na mesma transação. Com reserva ativa ou
  // pedido pendente/pago ligado à oferta → 409 (conflito de estado).
  await prisma.$transaction(async (tx) => {
    if (listing.offerId) {
      const offer = await tx.offer.findUnique({ where: { id: listing.offerId } })
      if (offer) {
        const activeReservation = await tx.reservation.findFirst({
          where: { offerId: offer.id, status: 'active', expiresAt: { gt: new Date() } },
        })
        if (activeReservation) {
          throw new ApiError(409, 'RESERVATION_ACTIVE', 'Há uma reserva ativa neste anúncio. Aguarde a expiração.')
        }
        const linkedOrder = await tx.order.findFirst({
          where: { status: { in: ['pending', 'paid'] }, ticketSnapshot: { path: ['offerId'], equals: offer.id } },
        })
        if (linkedOrder) {
          throw new ApiError(409, 'ORDER_LINKED', 'Existe um pedido ligado a este anúncio — ele não pode ser cancelado.')
        }
        await tx.offer.update({ where: { id: offer.id }, data: { status: 'cancelled' } })
      }
    }
    await tx.listing.update({ where: { id: listing.id }, data: { status: 'cancelled' } })
  })
  return { ok: true }
}

// C1: aprovação de anúncio SEM painel admin — script de linha de comando
// (pnpm approve-listing <id>), com log de auditoria. Nenhuma rota pública.
export async function approveListing(listingId: string, actor = 'cli') {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } })
  if (!listing) throw new ApiError(404, 'NOT_FOUND', 'Anúncio não encontrado')
  if (listing.status !== 'pending_review') {
    throw new ApiError(422, 'INVALID_STATUS', `Só anúncios em análise podem ser aprovados (status atual: ${listing.status}).`)
  }
  const updated = await prisma.$transaction(async (tx) => {
    const listingNow = await tx.listing.update({ where: { id: listing.id }, data: { status: 'active' } })
    if (listing.offerId) {
      await tx.offer.updateMany({ where: { id: listing.offerId, status: 'pending_review' }, data: { status: 'active' } })
    }
    return listingNow
  })
  // Log de auditoria (rastreável em logs do servidor)
  console.log(`[approve-listing] listing=${listing.id} offer=${listing.offerId ?? 'sem-vínculo'} pending_review → active por ${actor}`)
  return { id: updated.id, status: updated.status }
}

export async function listSoldListings(userId: string) {
  // C1: vendas derivadas das OFERTAS vendidas do vendedor (fonte única de
  // verdade da venda). NUNCA expõe nome, e-mail, CPF ou telefone do comprador.
  const offers = await prisma.offer.findMany({
    where: { sellerId: userId, status: 'sold' },
    orderBy: { updatedAt: 'desc' },
    include: {
      session: { include: { event: { select: { name: true, slug: true } } } },
      listing: { select: { quantity: true } },
    },
  })
  const sold = await Promise.all(offers.map(async (offer) => {
    const order = await prisma.order.findFirst({
      where: { status: 'paid', ticketSnapshot: { path: ['offerId'], equals: offer.id } },
      orderBy: { createdAt: 'asc' },
      select: { code: true },
    })
    return {
      id: offer.id,
      ticketType: offer.ticketType,
      ticketCategory: offer.ticketCategory,
      quantity: offer.listing?.quantity ?? offer.quantity,
      priceCents: offer.priceCents,
      soldAt: offer.updatedAt.toISOString(),
      orderCode: order?.code ?? null,
      status: 'sold',
      event: { name: offer.session.event.name, slug: offer.session.event.slug },
      // NUNCA expor dados do comprador (nome, e-mail, CPF, telefone)
    }
  }))
  return sold
}

