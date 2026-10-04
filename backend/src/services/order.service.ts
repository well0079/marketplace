import { randomBytes } from 'node:crypto'
import { Prisma, type Order } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { ApiError } from '../lib/errors'
import { shippingQuote } from './shipping.service'

// Pedidos: criação idempotente a partir do carrinho ativo do usuário, com
// snapshot de itens/endereço/entrega. Totais SEMPRE recalculados no servidor.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem I/O/0/1 (legibilidade)

export type OrderStatus = 'pending' | 'cancelled'

export type OrderItemSnapshot = {
  variantId: string
  productId: string
  slug: string
  title: string
  thumbnail: string | null
  attributes: Record<string, string>
  unitPrice: number
  quantity: number
  lineTotal: number
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
  shippingAddress: Record<string, string>
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
}

export function generateOrderCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return `RD-${code}`
}

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>

function toDetailPayload(order: OrderWithItems): OrderDetailPayload {
  const delivery = (order.deliveryOption ?? null) as OrderDetailPayload['deliveryOption'] | null
  return {
    code: order.code,
    status: order.status as OrderStatus,
    paymentPending: order.status === 'pending',
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    discount: order.discount,
    total: order.total,
    deliveryOption: delivery,
    shippingAddress: order.shippingAddress as Record<string, string>,
    items: order.items.map((item) => {
      const snapshot = item.productSnapshot as Omit<OrderItemSnapshot, 'variantId' | 'unitPrice' | 'quantity' | 'lineTotal'>
      return {
        variantId: item.variantId,
        productId: snapshot.productId,
        slug: snapshot.slug,
        title: snapshot.title,
        thumbnail: snapshot.thumbnail,
        attributes: snapshot.attributes,
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
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } })
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
  const detail = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: { orderBy: { createdAt: 'asc' } } } })
  return { order: detail ? toDetailPayload(detail) : order, created: true }
}

export async function listOrders(userId: string, page: number, limit: number) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
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
  const order = await prisma.order.findFirst({ where: { code, userId }, include: { items: { orderBy: { createdAt: 'asc' } } } })
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
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })
  return toDetailPayload(cancelled)
}
