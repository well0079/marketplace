import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { getSessionUser } from '../lib/auth'
import { readCartToken } from '../lib/cookies'
import { toInt } from '../lib/params'
import * as orders from '../services/order.service'

const DELIVERY_OPTIONS = new Set(['standard', 'express'])

export async function createOrder(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')

  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].trim() : ''
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new ApiError(400, 'VALIDATION', 'Header Idempotency-Key é obrigatório.')
  }

  const addressId = typeof req.body?.addressId === 'string' ? req.body.addressId : ''
  const deliveryOption = typeof req.body?.deliveryOption === 'string' ? req.body.deliveryOption : ''
  if (!addressId) throw new ApiError(400, 'VALIDATION', 'Escolha um endereço de entrega.', { addressId: 'Obrigatório.' })
  if (!DELIVERY_OPTIONS.has(deliveryOption)) {
    throw new ApiError(400, 'VALIDATION', 'Escolha uma opção de entrega.', { deliveryOption: 'Obrigatória.' })
  }

  const { order, created } = await orders.createOrder({
    userId: user.id,
    cartToken: readCartToken(req),
    addressId,
    deliveryOption,
    idempotencyKey,
  })
  res.status(created ? 201 : 200).json(order)
}

export async function listOrders(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  const page = toInt(req.query.page, 1, 1, 100_000)
  const limit = toInt(req.query.limit, 20, 1, 50)
  res.json(await orders.listOrders(user.id, page, limit))
}

export async function getOrder(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  res.json(await orders.getOrderByCode(user.id, String(req.params.code ?? '')))
}

export async function cancelOrder(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  res.json(await orders.cancelOrder(user.id, String(req.params.code ?? '')))
}
