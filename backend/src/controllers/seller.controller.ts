import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { getSessionUser } from '../lib/auth'
import { enforceRateLimit, rateLimitFromEnv } from '../lib/rate-limit-error'
import * as seller from '../services/seller.service'

function requireUser(req: Request) {
  const user = getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  return user
}

export async function getSellerMe(req: Request, res: Response) {
  const user = await requireUser(req)
  res.json(await seller.getSellerMe(user.id))
}

export async function postVerifySeller(req: Request, res: Response) {
  const user = await requireUser(req)
  enforceRateLimit(`seller:verify:${user.id}`, rateLimitFromEnv('SIGNUP_RATE_LIMIT', 10))

  const consent = req.body?.consent === true
  const address = {
    cep: typeof req.body?.address?.cep === 'string' ? req.body.address.cep : '',
    uf: typeof req.body?.address?.uf === 'string' ? req.body.address.uf : '',
    city: typeof req.body?.address?.city === 'string' ? req.body.address.city : '',
    neighborhood: typeof req.body?.address?.neighborhood === 'string' ? req.body.address.neighborhood : '',
    street: typeof req.body?.address?.street === 'string' ? req.body.address.street : '',
    number: typeof req.body?.address?.number === 'string' ? req.body.address.number : '',
    complement: typeof req.body?.address?.complement === 'string' ? req.body.address.complement : undefined,
  }
  const result = await seller.verifySeller({ userId: user.id, consent, address })
  res.json(result)
}

export async function postListing(req: Request, res: Response) {
  const user = await requireUser(req)
  enforceRateLimit(`seller:listing:${user.id}`, rateLimitFromEnv('SIGNUP_RATE_LIMIT', 10))
  if (!(await seller.isVerifiedSeller(user.id))) {
    throw new ApiError(403, 'SELLER_NOT_VERIFIED', 'Complete a verificação de vendedor primeiro.')
  }
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : ''
  const ticketType = typeof req.body?.ticketType === 'string' ? req.body.ticketType.trim() : ''
  const ticketCategory = typeof req.body?.ticketCategory === 'string' ? req.body.ticketCategory.trim() : ''
  const quantity = typeof req.body?.quantity === 'number' ? req.body.quantity : Number.parseInt(String(req.body?.quantity), 10)
  const priceCents = typeof req.body?.priceCents === 'number' ? req.body.priceCents : Number.parseInt(String(req.body?.priceCents), 10)

  const result = await seller.createListing({ userId: user.id, sessionId, ticketType, ticketCategory, quantity, priceCents })
  res.status(201).json(result)
}

export async function getMyListings(req: Request, res: Response) {
  const user = await requireUser(req)
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  res.json(await seller.listMyListings(user.id, status))
}

export async function deleteListing(req: Request, res: Response) {
  const user = await requireUser(req)
  res.json(await seller.cancelListing(user.id, String(req.params.id ?? '')))
}

export async function getSoldListings(req: Request, res: Response) {
  const user = await requireUser(req)
  res.json(await seller.listSoldListings(user.id))
}
