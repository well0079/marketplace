import { randomUUID } from 'node:crypto'
import { Prisma, type Cart } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { readCartToken, setCartCookie } from '../lib/cookies'

type CartWithItems = Prisma.CartGetPayload<{
  include: { items: { include: { variant: { include: { product: { include: { images: true } } } } } } }
}>

export type CartItemPayload = {
  id: string
  variantId: string
  quantity: number
  unitPrice: number
  lineTotal: number
  stock: number
  product: {
    slug: string
    title: string
    thumbnail: string | null
    freeShipping: boolean
    variantAttributes: Record<string, string>
  }
}

export type CartPayload = { items: CartItemPayload[]; subtotal: number; totalItems: number }

export const EMPTY_CART: CartPayload = { items: [], subtotal: 0, totalItems: 0 }

// Retorna o carrinho do cookie ou cria um novo (emitindo o cookie na resposta).
// Usuário autenticado: novo carrinho já nasce vinculado e, sem cookie válido,
// recupera o carrinho mais recente dele. Carrinho "converted" (virou pedido) é
// ignorado — novas compras começam um carrinho ativo.
export async function getOrCreateCart(
  req: Parameters<typeof readCartToken>[0],
  res: Parameters<typeof setCartCookie>[0],
  userId?: string | null,
): Promise<Cart> {
  const token = readCartToken(req)
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } })
    if (existing && existing.status === 'active') return existing
  }
  if (userId) {
    const userCart = await prisma.cart.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })
    if (userCart) {
      setCartCookie(res, userCart.token)
      return userCart
    }
  }
  const newToken = randomUUID()
  const cart = await prisma.cart.create({ data: { token: newToken, ...(userId ? { userId } : {}) } })
  setCartCookie(res, newToken)
  return cart
}

export async function getCartByToken(token: string): Promise<CartPayload | null> {
  const cart = await prisma.cart.findUnique({
    where: { token },
    include: {
      items: {
        orderBy: { addedAt: 'asc' },
        include: {
          variant: { include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } } },
        },
      },
    },
  })
  return cart ? toCartPayload(cart) : null
}

// Preço SEMPRE do banco: priceOverride da variante ou preço do produto — nunca do frontend
function toCartPayload(cart: CartWithItems): CartPayload {
  const items: CartItemPayload[] = cart.items.map((item) => {
    const { variant } = item
    const product = variant.product
    const unitPrice = variant.priceOverride ?? product.price
    return {
      id: item.id,
      variantId: variant.id,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      stock: variant.stock,
      product: {
        slug: product.slug,
        title: product.title,
        thumbnail: product.images[0]?.url ?? null,
        freeShipping: product.freeShipping,
        variantAttributes: variant.attributes as Record<string, string>,
      },
    }
  })
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  }
}

// No login: vincula o carrinho do visitante ao usuário; se o usuário já tiver carrinho,
// mescla os itens somando por variante e respeitando o estoque; o cookie aponta para o
// carrinho do usuário ao final (endpoints existentes continuam funcionando sem mudança).
export async function mergeGuestCartForUser(
  guestToken: string | null,
  userId: string,
  res: Parameters<typeof setCartCookie>[0],
): Promise<void> {
  const guestCart = guestToken
    ? await prisma.cart.findUnique({ where: { token: guestToken }, include: { items: true } })
    : null
  const userCart = await prisma.cart.findFirst({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!guestCart || guestCart.id === userCart?.id) {
    if (userCart) setCartCookie(res, userCart.token)
    return
  }

  if (!userCart) {
    await prisma.cart.update({ where: { id: guestCart.id }, data: { userId } })
    setCartCookie(res, guestCart.token)
    return
  }

  const userItems = new Map(userCart.items.map((item) => [item.variantId, item]))
  for (const guestItem of guestCart.items) {
    const variant = await prisma.productVariant.findUnique({ where: { id: guestItem.variantId } })
    if (!variant || !variant.active || variant.stock === 0) continue
    const existing = userItems.get(guestItem.variantId)
    if (existing) {
      const quantity = Math.min(existing.quantity + guestItem.quantity, variant.stock)
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } })
    } else {
      await prisma.cartItem.create({
        data: { cartId: userCart.id, variantId: guestItem.variantId, quantity: Math.min(guestItem.quantity, variant.stock) },
      })
    }
  }
  await prisma.cart.delete({ where: { id: guestCart.id } }) // itens somem junto (cascade)
  setCartCookie(res, userCart.token)
}
