import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { getSessionUser } from '../lib/auth'
import { prisma } from '../lib/prisma'
import { createPayment as createPaymentService, getPaymentForUser, validatePayer } from '../services/payment.service'

// Rate limit simples em memória por usuário (janela de 60s) — protege o provedor
const RATE_WINDOW_MS = 60_000
const rateBuckets = new Map<string, number[]>()

function rateLimit(): number {
  const parsed = Number.parseInt(process.env.PAYMENTS_RATE_LIMIT ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

function checkRateLimit(key: string): void {
  const now = Date.now()
  const hits = (rateBuckets.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS)
  if (hits.length >= rateLimit()) {
    throw new ApiError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um instante antes de tentar de novo.')
  }
  hits.push(now)
  rateBuckets.set(key, hits)
  if (rateBuckets.size > 10_000) rateBuckets.clear() // teto de memória
}

export async function createPayment(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  checkRateLimit(user.id)

  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].trim() : ''
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new ApiError(400, 'VALIDATION', 'Header Idempotency-Key é obrigatório.')
  }

  const orderCode = typeof req.body?.orderCode === 'string' ? req.body.orderCode.trim() : ''
  const method = typeof req.body?.method === 'string' ? req.body.method : ''
  if (!orderCode) throw new ApiError(400, 'VALIDATION', 'Pedido não informado.', { orderCode: 'Obrigatório.' })

  const payer = validatePayer(req.body?.payer)
  if (Object.keys(payer.fields).length > 0) {
    throw new ApiError(400, 'VALIDATION', 'Verifique os dados do pagador.', payer.fields)
  }

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, phone: true, cpfHash: true },
  })
  if (!fullUser) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')

  const { payload, created } = await createPaymentService({
    user: { id: fullUser.id, email: fullUser.email, name: fullUser.name, phone: fullUser.phone, cpfHash: fullUser.cpfHash },
    orderCode,
    method,
    payer: { document: payer.document, phone: payer.phone },
    idempotencyKey,
    ip: req.ip ?? '',
  })
  res.status(created ? 201 : 200).json(payload)
}

export async function getPayment(req: Request, res: Response) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  res.json(await getPaymentForUser(user.id, String(req.params.id ?? '')))
}
