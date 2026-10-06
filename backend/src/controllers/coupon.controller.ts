import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { getSessionUser } from '../lib/auth'
import { findValidCouponForPrice } from '../services/order.service'
import { prisma } from '../lib/prisma'

// POST /coupons/validate {code, reservationId} — calcula o desconto no SERVIDOR
// a partir do preço da oferta da reserva (nunca do cliente)
export async function validateCoupon(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  const reservationId = typeof req.body?.reservationId === 'string' ? req.body.reservationId.trim() : ''
  if (!code || !reservationId) {
    throw new ApiError(400, 'VALIDATION', 'Informe o cupom e a reserva.', { code: code ? '' : 'Obrigatório.' })
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, userId: user.id },
    include: { offer: { select: { priceCents: true } } },
  })
  if (!reservation) throw new ApiError(404, 'NOT_FOUND', 'Reserva não encontrada')

  const unitPrice = reservation.offer.priceCents
  const { coupon, error } = await findValidCouponForPrice(code, unitPrice)
  if (!coupon) throw new ApiError(422, 'INVALID_COUPON', error ?? 'Cupom inválido.', { code: error ?? 'Inválido.' })

  const discountCents = Math.round((unitPrice * coupon.percentOff) / 100)
  const discountedPrice = unitPrice - discountCents
  const fee = Math.round(discountedPrice * 0.1)

  res.json({
    code: coupon.code,
    percentOff: coupon.percentOff,
    discountedPriceCents: discountedPrice,
    serviceFeeCents: fee,
    totalCents: discountedPrice + fee,
  })
}
