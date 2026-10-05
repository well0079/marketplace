import type { Request, Response } from 'express'
import { ApiError } from '../lib/errors'
import { getSessionUser } from '../lib/auth'
import { toInt } from '../lib/params'
import * as events from '../services/events.service'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Público: eventos, sessões e ofertas ───

export async function listEvents(req: Request, res: Response) {
  const page = toInt(req.query.page, 1, 1, 100_000)
  const limit = toInt(req.query.limit, 12, 1, 50)
  const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined
  const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : undefined
  const date = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : undefined
  const sort = typeof req.query.sort === 'string' && req.query.sort.trim() ? req.query.sort.trim() : undefined

  res.json(await events.listEvents({ q, category, date, sort, page, limit }))
}

export async function getEvent(req: Request, res: Response) {
  const event = await events.getEventBySlug(String(req.params.slug ?? ''))
  if (!event) throw new ApiError(404, 'NOT_FOUND', 'Evento não encontrado')
  res.json(event)
}

export async function getSession(req: Request, res: Response) {
  const session = await events.getSessionDetail(String(req.params.id ?? ''))
  if (!session) throw new ApiError(404, 'NOT_FOUND', 'Sessão não encontrada')
  res.json(session)
}

export async function listSessionOffers(req: Request, res: Response) {
  const type = typeof req.query.type === 'string' && req.query.type.trim() ? req.query.type.trim() : undefined
  const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : undefined
  const offers = await events.listSessionOffers(String(req.params.id ?? ''), { type, category })
  if (offers === null) throw new ApiError(404, 'NOT_FOUND', 'Sessão não encontrada')
  res.json(offers)
}

// ─── Reservas (sessão obrigatória) ───

// Rate limit simples em memória por usuário (janela de 60s) — protege o fluxo de
// reserva contra martelar o botão; ajustável via RESERVATIONS_RATE_LIMIT (padrão 10/min)
const RESERVATION_WINDOW_MS = 60_000
const reservationBuckets = new Map<string, number[]>()

function reservationRateLimit(key: string): void {
  const parsed = Number.parseInt(process.env.RESERVATIONS_RATE_LIMIT ?? '', 10)
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 10
  const now = Date.now()
  const hits = (reservationBuckets.get(key) ?? []).filter((timestamp) => now - timestamp < RESERVATION_WINDOW_MS)
  if (hits.length >= limit) {
    throw new ApiError(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um instante antes de reservar de novo.')
  }
  hits.push(now)
  reservationBuckets.set(key, hits)
  if (reservationBuckets.size > 10_000) reservationBuckets.clear()
}

async function requireUser(req: Request) {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Não autenticado')
  return user
}

export async function createReservation(req: Request, res: Response) {
  const user = await requireUser(req)
  reservationRateLimit(user.id)
  const offerId = typeof req.body?.offerId === 'string' ? req.body.offerId : ''
  if (!offerId) throw new ApiError(400, 'VALIDATION', 'Oferta não informada.', { offerId: 'Obrigatória.' })
  const rawQuantity = req.body?.quantity ?? 1
  const quantity = typeof rawQuantity === 'number' ? rawQuantity : Number.parseInt(String(rawQuantity), 10)
  const created = await events.createReservation({ userId: user.id, offerId, quantity })
  res.status(created.reused ? 200 : 201).json(created)
}

export async function listReservations(req: Request, res: Response) {
  const user = await requireUser(req)
  res.json(await events.listActiveReservations(user.id))
}

export async function cancelReservation(req: Request, res: Response) {
  const user = await requireUser(req)
  res.json(await events.cancelReservation(user.id, String(req.params.id ?? '')))
}
