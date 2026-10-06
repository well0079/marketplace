import { randomBytes } from 'node:crypto'
import { Prisma, type Order } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { shippingQuote } from './shipping.service'

// Pedidos: criação idempotente a partir do carrinho ativo do usuário, com
// snapshot de itens/endereço/entrega. Totais SEMPRE recalculados no servidor.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem I/O/0/1 (legibilidade)

export type OrderStatus = 'pending' | 'paid' | 'cancelled'

export type OrderItemSnapshot = {
  variantId: string | null
  productId: string
  slug: string
  title: string
  thumbnail: string | null
  attributes: Record<string, string>
  unitPrice: number
  quantity: number
  lineTotal: number
}

// Snapshot do pedido de ingresso (Order.ticketSnapshot). Regra de negócio: a taxa
// de serviço é 10% do preço do ingresso, ARREDONDADA para o centavo (Math.round).
export type TicketOrderSnapshot = {
  kind: 'ticket'
  offerId: string
  reservationId: string
  event: { id: string; slug: string; name: string; category: string; organizer: string; imageUrl: string | null }
  session: { id: string; startsAt: string; city: string; uf: string; venue: string }
  ticketType: string
  ticketCategory: string
  unitPriceCents: number
  quantity: number
  serviceFeeCents: number
  totalCents: number
  receiptEmail: string | null
}

export const SERVICE_FEE_RATE = 0.1

export function serviceFeeFor(priceCents: number): number {
  return Math.round(priceCents * SERVICE_FEE_RATE)
}

export type OrderDetailPayload = {
  code: string
  status: OrderStatus
  paymentPending: boolean
  subtotal: number
  shippingCost: number
  discount: number
  total: number
  deliveryOption: { id: string; label: string; description: string; region: string; price: number } | null
  shippingAddress: Record<string, string> | null
  ticketSnapshot: Record<string, unknown> | null
  // pagamento Pix ativo (WAITING_PAYMENT/PROCESSING) — usado pelo link "Pagar" em /tickets
  activePaymentId: string | null
  items: OrderItemSnapshot[]
  createdAt: string
  cancelledAt: string | null
}

export type OrderSummaryPayload = {
  code: string
  status: OrderStatus
  total: number
  createdAt: string
  firstItemImage: string | null
  itemsCount: number
  ticketSnapshot: Record<string, unknown> | null
}

export function generateOrderCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return `RD-${code}`
}

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>

function toDetailPayload(order: OrderWithItems & { payments?: { id: string; status: string }[] }): OrderDetailPayload {
  const delivery = (order.deliveryOption ?? null) as OrderDetailPayload['deliveryOption'] | null
  const activePayment = order.payments?.find(
    (payment) => payment.status === 'WAITING_PAYMENT' || payment.status === 'PROCESSING',
  )
  return {
    code: order.code,
    status: order.status as OrderStatus,
    paymentPending: order.status === 'pending',
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    discount: order.discount,
    total: order.total,
    deliveryOption: delivery,
    shippingAddress: (order.shippingAddress ?? null) as Record<string, string> | null,
    ticketSnapshot: (order.ticketSnapshot ?? null) as Record<string, unknown> | null,
    activePaymentId: activePayment?.id ?? null,
    items: order.items.map((item): OrderItemSnapshot => {
      const snapshot = item.productSnapshot as Record<string, unknown>
      // Item de ingresso (sem variante): o snapshot completo vive em ticketSnapshot
      if (item.variantId === null) {
        return {
          variantId: null,
          productId: (snapshot.productId as string) ?? '',
          slug: (snapshot.slug as string) ?? '',
          title: (snapshot.title as string) ?? '',
          thumbnail: (snapshot.thumbnail as string | null) ?? null,
          attributes: (snapshot.attributes as Record<string, string>) ?? {},
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        }
      }
      return {
        variantId: item.variantId,
        productId: snapshot.productId as string,
        slug: snapshot.slug as string,
        title: snapshot.title as string,
        thumbnail: (snapshot.thumbnail as string | null) ?? null,
        attributes: snapshot.attributes as Record<string, string>,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      }
    }),
    createdAt: order.createdAt.toISOString(),
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
  }
}

export function toSummaryPayload(order: OrderWithItems): OrderSummaryPayload {
  return {
    code: order.code,
    status: order.status as OrderStatus,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    firstItemImage: (order.items[0]?.productSnapshot as { thumbnail?: string | null } | undefined)?.thumbnail ?? null,
    itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    ticketSnapshot: (order.ticketSnapshot ?? null) as Record<string, unknown> | null,
  }
}

type CreateOrderInput = {
  userId: string
  cartToken: string | null
  addressId: string
  deliveryOption: string
  idempotencyKey: string
}

export async function createOrder(input: CreateOrderInput): Promise<{ order: OrderDetailPayload; created: boolean }> {
  // Idempotência primeiro: mesma key + mesmo usuário devolve o pedido original
  // (a key é única global no schema; key igual de OUTRO usuário é conflito 409)
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true, payments: true } })
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já está em uso.')
    }
    return { order: toDetailPayload(existing), created: false }
  }

  if (input.deliveryOption !== 'standard' && input.deliveryOption !== 'express') {
    throw new ApiError(400, 'VALIDATION', 'Opção de entrega inválida.', {
      deliveryOption: 'Escolha entre Normal ou Expressa.',
    })
  }

  const address = await prisma.address.findFirst({ where: { id: input.addressId, userId: input.userId } })
  // Mesmo contrato do restante da API: recurso de outro usuário NÃO existe (404)
  if (!address) throw new ApiError(404, 'NOT_FOUND', 'Endereço não encontrado')

  const cart = input.cartToken
    ? await prisma.cart.findUnique({
        where: { token: input.cartToken },
        include: {
          items: {
            orderBy: { addedAt: 'asc' },
            include: {
              variant: { include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } } },
            },
          },
        },
      })
    : null
  if (!cart || cart.userId !== input.userId || cart.status !== 'active' || cart.items.length === 0) {
    throw new ApiError(422, 'CART_EMPTY', 'Seu carrinho está vazio.')
  }

  // Estoque: apenas VALIDA aqui; decremento acontece na confirmação do pagamento (fase futura)
  const stockIssues: Record<string, string> = {}
  for (const item of cart.items) {
    if (!item.variant.active || item.variant.stock < item.quantity) {
      stockIssues[item.variant.product.slug] = `Estoque insuficiente: apenas ${Math.max(0, item.variant.stock)} unidade(s) disponível(is)`
    }
  }
  if (Object.keys(stockIssues).length > 0) {
    throw new ApiError(422, 'STOCK_INSUFFICIENT', 'Alguns itens não têm estoque suficiente.', stockIssues)
  }

  // Preços/totais SEMPRE do banco — valores enviados pelo cliente são ignorados
  const snapshots: OrderItemSnapshot[] = cart.items.map((item) => {
    const product = item.variant.product
    const unitPrice = item.variant.priceOverride ?? product.price
    return {
      variantId: item.variantId,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      thumbnail: product.images[0]?.url ?? null,
      attributes: item.variant.attributes as Record<string, string>,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
    }
  })
  const subtotal = snapshots.reduce((sum, item) => sum + item.lineTotal, 0)

  const quote = shippingQuote(address.zipCode, cart.items.map((item) => ({ freeShipping: item.variant.product.freeShipping })))
  const option = quote.options.find((candidate) => candidate.id === input.deliveryOption)
  if (!option) throw new ApiError(400, 'VALIDATION', 'Opção de entrega inválida.')
  const shippingCost = option.price
  const total = subtotal + shippingCost

  const shippingAddress = {
    label: address.label,
    recipient: address.recipient,
    zipCode: address.zipCode,
    street: address.street,
    number: address.number,
    complement: address.complement,
    district: address.district,
    city: address.city,
    state: address.state,
  }
  const deliverySnapshot = { id: option.id, label: option.label, description: option.description, region: quote.region, price: option.price }

  // Pedido + itens + conversão do carrinho na MESMA transação; itens do carrinho
  // são removidos (ficam só nos snapshots do pedido)
  const order = await prisma.$transaction(async (tx) => {
    let created: Order | null = null
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        created = await tx.order.create({
          data: {
            code: generateOrderCode(),
            userId: input.userId,
            status: 'pending',
            subtotal,
            shippingCost,
            total,
            shippingAddress,
            deliveryOption: deliverySnapshot,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: snapshots.map((snapshot, index) => ({
                variantId: snapshot.variantId,
                productSnapshot: {
                  productId: snapshot.productId,
                  slug: snapshot.slug,
                  title: snapshot.title,
                  thumbnail: snapshot.thumbnail,
                  attributes: snapshot.attributes,
                },
                unitPrice: snapshot.unitPrice,
                quantity: snapshot.quantity,
                lineTotal: snapshot.lineTotal,
                // ordem do carrinho preservada no snapshot (índices crescentes)
                createdAt: new Date(Date.now() + index),
              })),
            },
          },
        })
      } catch (error) {
        // corrida na key idempotente ou no code: devolve o pedido que venceu
        const conflicting = await tx.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } })
        if (conflicting) {
          if (conflicting.userId !== input.userId) {
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já está em uso.')
          }
          return toDetailPayload(conflicting)
        }
        if (attempt === 2) throw error
      }
    }
    if (!created) throw new ApiError(500, 'INTERNAL', 'Não foi possível criar o pedido.')
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    await tx.cart.update({ where: { id: cart.id }, data: { status: 'converted' } })
    return toDetailPayload({ ...created, items: [] }) // substituído abaixo pelo detail completo
  })

  // Releitura fora da transação para devolver o detalhe completo com itens
  const detail = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: { orderBy: { createdAt: 'asc' } }, payments: true } })
  return { order: detail ? toDetailPayload(detail) : order, created: true }
}

export async function listOrders(userId: string, page: number, limit: number, kind?: 'ticket' | 'product') {
  const kindWhere: Prisma.OrderWhereInput = kind === 'ticket' ? { ticketSnapshot: { not: Prisma.AnyNull } } : kind === 'product' ? { ticketSnapshot: { equals: Prisma.AnyNull } } : {}
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId, ...kindWhere },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { items: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.order.count({ where: { userId } }),
  ])
  return {
    items: orders.map(toSummaryPayload),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

// Usuário só enxerga os PRÓPRIOS pedidos: pedido de outro usuário é 404
// (mesmo contrato de carrinho/endereço — recurso inexistente para quem pergunta)
export async function getOrderByCode(userId: string, code: string): Promise<OrderDetailPayload> {
  const order = await prisma.order.findFirst({ where: { code, userId }, include: { items: { orderBy: { createdAt: 'asc' } }, payments: true } })
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Pedido não encontrado')
  return toDetailPayload(order)
}

export async function cancelOrder(userId: string, code: string): Promise<OrderDetailPayload> {
  const order = await prisma.order.findFirst({ where: { code, userId } })
  if (!order) throw new ApiError(404, 'NOT_FOUND', 'Pedido não encontrado')
  if (order.status !== 'pending') {
    throw new ApiError(422, 'INVALID_STATUS', 'Só pedidos aguardando pagamento podem ser cancelados.')
  }
  const cancelled = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'cancelled', cancelledAt: new Date() },
    include: { items: { orderBy: { createdAt: 'asc' } }, payments: true },
  })
  return toDetailPayload(cancelled)
}

// ─── Pedido de ingresso a partir da reserva (tema ingressos, ETAPA 2+3 bloco 1) ───

export type CreateTicketOrderInput = {
  userId: string
  reservationId: string
  receiptEmail: string | null
  idempotencyKey: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createTicketOrder(
  input: CreateTicketOrderInput,
): Promise<{ order: OrderDetailPayload; created: boolean }> {
  // Idempotência idêntica à do carrinho: mesma key + mesmo usuário devolve o
  // pedido original (a unique é global no schema; key de outro usuário = 409)
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true, payments: true } })
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já está em uso.')
    }
    return { order: toDetailPayload(existing), created: false }
  }

  if (input.receiptEmail !== null && !EMAIL_PATTERN.test(input.receiptEmail)) {
    throw new ApiError(400, 'VALIDATION', 'E-mail de recebimento inválido.', { receiptEmail: 'Informe um e-mail válido.' })
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: {
      offer: {
        include: {
          session: { include: { event: true } },
        },
      },
    },
  })
  // Mesmo contrato de endereço/pedido: recurso de outro usuário = 404
  if (!reservation || reservation.userId !== input.userId) {
    throw new ApiError(404, 'NOT_FOUND', 'Reserva não encontrada')
  }
  if (reservation.status !== 'active' || reservation.expiresAt <= new Date()) {
    throw new ApiError(422, 'RESERVATION_EXPIRED', 'Sua reserva expirou. Volte ao evento e selecione o ingresso novamente.')
  }
  if (reservation.offer.status !== 'active') {
    throw new ApiError(422, 'OFFER_UNAVAILABLE', 'Esta oferta não está mais disponível.')
  }

  const offer = reservation.offer
  const session = offer.session
  const event = session.event
  const unitPrice = offer.priceCents // SEMPRE do banco — valor enviado pelo cliente é ignorado
  const quantity = reservation.quantity
  const serviceFeeCents = serviceFeeFor(unitPrice) // 10% arredondado ao centavo (por ingresso)
  const subtotal = unitPrice * quantity
  const total = subtotal + serviceFeeCents * quantity

  const ticketSnapshot: TicketOrderSnapshot = {
    kind: 'ticket',
    offerId: offer.id,
    reservationId: reservation.id,
    event: { id: event.id, slug: event.slug, name: event.name, category: event.category, organizer: event.organizer, imageUrl: event.imageUrl },
    session: { id: session.id, startsAt: session.startsAt.toISOString(), city: session.city, uf: session.uf, venue: session.venue },
    ticketType: offer.ticketType,
    ticketCategory: offer.ticketCategory,
    unitPriceCents: unitPrice,
    quantity,
    serviceFeeCents,
    totalCents: total,
    receiptEmail: input.receiptEmail,
  }

  const itemSnapshot = {
    kind: 'ticket',
    productId: event.id,
    slug: event.slug,
    title: event.name,
    thumbnail: event.imageUrl,
    attributes: { Tipo: offer.ticketType, Categoria: offer.ticketCategory, Organizador: event.organizer },
  }

  const created = await prisma.order.create({
    data: {
      code: generateOrderCode(),
      userId: input.userId,
      status: 'pending',
      subtotal,
      shippingCost: 0,
      total,
      // pedido de ingresso: sem endereço/entrega — o snapshot do ingresso carrega tudo
      ticketSnapshot,
      reservationId: reservation.id,
      idempotencyKey: input.idempotencyKey,
      items: {
        create: [
          {
            variantId: null,
            productSnapshot: itemSnapshot,
            unitPrice,
            quantity,
            lineTotal: unitPrice * quantity,
          },
        ],
      },
    },
  })

  const items = await prisma.orderItem.findMany({ where: { orderId: created.id } })
  return { order: toDetailPayload({ ...created, items, payments: [] }), created: true }
}
