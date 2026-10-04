import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { readCartToken } from '../lib/cookies'
import { getSessionUser } from '../lib/auth'
import { EMPTY_CART, getCartByToken, getOrCreateCart } from '../services/cart.service'
import { prisma } from '../lib/prisma'

export async function getCart(req: Request, res: Response) {
  const token = readCartToken(req)
  const payload = token ? await getCartByToken(token) : null
  res.json(payload ?? EMPTY_CART)
}

export async function addCartItem(req: Request, res: Response) {
  const variantId = typeof req.body?.variantId === 'string' ? req.body.variantId : ''
  const rawQuantity = req.body?.quantity ?? 1
  const quantity = typeof rawQuantity === 'number' ? rawQuantity : Number.parseInt(String(rawQuantity), 10)
  if (!variantId) throw new ApiError(400, 'VALIDATION', 'variantId é obrigatório')
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError(400, 'VALIDATION', 'Quantidade deve ser um inteiro maior ou igual a 1')
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  })
  if (!variant || !variant.active || variant.product.status !== 'active') {
    throw new ApiError(404, 'NOT_FOUND', 'Variante não encontrada')
  }

  const user = await getSessionUser(req)
  const cart = await getOrCreateCart(req, res, user?.id)

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
  })
  const requestedQuantity = (existing?.quantity ?? 0) + quantity
  if (requestedQuantity > variant.stock) {
    throw new ApiError(
      409,
      'INSUFFICIENT_STOCK',
      `Estoque insuficiente: apenas ${variant.stock} unidade(s) disponível(is)`,
    )
  }

  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    create: { cartId: cart.id, variantId, quantity },
    update: { quantity: requestedQuantity },
  })

  res.status(201).json((await getCartByToken(cart.token)) ?? EMPTY_CART)
}

export async function updateCartItem(req: Request, res: Response) {
  const cart = await requireCart(req)
  const quantity = typeof req.body?.quantity === 'number' ? req.body.quantity : Number.parseInt(String(req.body?.quantity), 10)
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError(400, 'VALIDATION', 'Quantidade deve ser um inteiro maior ou igual a 1')
  }

  const item = await prisma.cartItem.findFirst({
    where: { id: String(req.params.itemId ?? ''), cartId: cart.id },
    include: { variant: true },
  })
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho')
  if (quantity > item.variant.stock) {
    throw new ApiError(
      409,
      'INSUFFICIENT_STOCK',
      `Estoque insuficiente: apenas ${item.variant.stock} unidade(s) disponível(is)`,
    )
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } })
  res.json(await getCartByToken(cart.token))
}

export async function removeCartItem(req: Request, res: Response) {
  const cart = await requireCart(req)
  const item = await prisma.cartItem.findFirst({
    where: { id: String(req.params.itemId ?? ''), cartId: cart.id },
  })
  if (!item) throw new ApiError(404, 'NOT_FOUND', 'Item não encontrado no carrinho')

  await prisma.cartItem.delete({ where: { id: item.id } })
  res.json(await getCartByToken(cart.token))
}

async function requireCart(req: Request) {
  const token = readCartToken(req)
  const cart = token ? await prisma.cart.findUnique({ where: { token } }) : null
  if (!cart) throw new ApiError(404, 'NOT_FOUND', 'Carrinho não encontrado')
  return cart
}
