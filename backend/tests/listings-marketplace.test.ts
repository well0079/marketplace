import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

// Invariantes de compra/venda (C0 — pré-requisito da Parte 2):
// - oferta pending_review/cancelada NUNCA aparece em /sessions/:id/offers nem é reservável;
// - vendedor não compra o próprio anúncio (409 OWN_OFFER);
// - limite de anúncios ativos por vendedor (409 MAX_LISTINGS);
// - anúncio cancelado não pode ser cancelado de novo (422 INVALID_STATUS).
// NOTA: DELETE /listings/:id com reserva ativa → 409 depende do vínculo
// Listing→Offer (TODO em seller.service.ts) — teste entra na Parte 2.

const suffix = Date.now()
const USER_A = { name: 'Vendedor Invariante', email: `inv-vendedor.${suffix}@teste.com`, password: 'Senha1@a' }
const USER_B = { name: 'Comprador Invariante', email: `inv-comprador.${suffix}@teste.com`, password: 'Senha1@a' }

let authA: string
let authB: string
let userAId: string
const createdEventIds: string[] = []

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = /auth_token=([^;]+)/.exec(cookies.find((c) => c.startsWith('auth_token=')) ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

async function makeSession(offerData: { ticketType: string; ticketCategory: string; priceCents: number; quantity: number; status?: string; sellerId?: string }) {
  const event = await prisma.event.create({
    data: {
      slug: `evt-inv-${suffix}-${createdEventIds.length}`,
      name: 'Evento Invariantes',
      category: 'Shows',
      organizer: 'Cia. Teste',
      description: 'Invariantes de compra.',
      sessions: {
        create: [{
          startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          city: 'São Paulo', uf: 'SP', venue: 'Palco de Testes',
          offers: { create: [offerData] },
        }],
      },
    },
    include: { sessions: { include: { offers: true } } },
  })
  createdEventIds.push(event.id)
  return event.sessions[0]
}

beforeAll(async () => {
  process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
  process.env.SIGNUP_RATE_LIMIT = '1000'
  process.env.RESERVATIONS_RATE_LIMIT = '1000'
  const regA = await request(app).post('/api/v1/auth/register').send(USER_A)
  authA = authCookieFrom(regA)
  const regB = await request(app).post('/api/v1/auth/register').send(USER_B)
  authB = authCookieFrom(regB)
  userAId = (await prisma.user.findUnique({ where: { email: USER_A.email } }))!.id

  // vendedor A verificado (consentimento + endereço)
  await request(app).post('/api/v1/sellers/verify').set('Cookie', authA).send({
    consent: true,
    address: { cep: '01310-100', uf: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Avenida Paulista', number: '1000', complement: '' },
  })
  // vendedor B também verificado (testes com cota própria, isolados do limite de A)
  await request(app).post('/api/v1/sellers/verify').set('Cookie', authB).send({
    consent: true,
    address: { cep: '01310-100', uf: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Avenida Paulista', number: '1001', complement: '' },
  })
})

afterAll(async () => {
  process.env.SELLER_OFFERS_AUTO_APPROVE = undefined
  await prisma.reservation.deleteMany({ where: { offer: { session: { eventId: { in: createdEventIds } } } } })
  await prisma.offer.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.listing.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.eventSession.deleteMany({ where: { eventId: { in: createdEventIds } } })
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await prisma.user.deleteMany({ where: { email: { in: [USER_A.email, USER_B.email] } } })
  await prisma.$disconnect()
})

describe('Invariantes de oferta — visibilidade e reserva', () => {
  it('oferta pending_review não aparece em /sessions/:id/offers e POST /reservations → 422 OFFER_UNAVAILABLE', async () => {
    const session = await makeSession({ ticketType: 'Pista', ticketCategory: 'Inteira', priceCents: 1000, quantity: 5, status: 'pending_review' })
    const offerId = session.offers[0].id

    const list = await request(app).get(`/api/v1/sessions/${session.id}/offers`)
    expect(list.status).toBe(200)
    expect(list.body.some((o: { id: string }) => o.id === offerId)).toBe(false)

    const res = await request(app).post('/api/v1/reservations').set('Cookie', authB).send({ offerId, quantity: 1 })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('OFFER_UNAVAILABLE')
  })

  it('oferta cancelada nunca aparece nem é reservável', async () => {
    const session = await makeSession({ ticketType: 'Área VIP', ticketCategory: 'Inteira', priceCents: 5000, quantity: 3, status: 'cancelled' })
    const offerId = session.offers[0].id

    const list = await request(app).get(`/api/v1/sessions/${session.id}/offers`)
    expect(list.body.some((o: { id: string }) => o.id === offerId)).toBe(false)

    const res = await request(app).post('/api/v1/reservations').set('Cookie', authB).send({ offerId, quantity: 1 })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('OFFER_UNAVAILABLE')
  })

  it('vendedor não reserva o próprio anúncio → 409 OWN_OFFER (regressão)', async () => {
    const session = await makeSession({ ticketType: 'Camarote', ticketCategory: 'Inteira', priceCents: 20000, quantity: 2, sellerId: userAId })
    const offerId = session.offers[0].id

    const own = await request(app).post('/api/v1/reservations').set('Cookie', authA).send({ offerId, quantity: 1 })
    expect(own.status).toBe(409)
    expect(own.body.error.code).toBe('OWN_OFFER')

    // outro usuário consegue reservar normalmente
    const other = await request(app).post('/api/v1/reservations').set('Cookie', authB).send({ offerId, quantity: 1 })
    expect(other.status).toBe(201)
  })
})

describe('Invariantes de anúncio — limites e ciclo de vida', () => {
  it('limite de anúncios ativos por vendedor → 409 MAX_LISTINGS; cancelar um libera slot', async () => {
    const session = await makeSession({ ticketType: 'Pista', ticketCategory: 'Inteira', priceCents: 1000, quantity: 5 })
    const sessionId = session.id
    const listing = { sessionId, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000 }

    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send(listing)
      expect(res.status).toBe(201)
    }
    const overflow = await request(app).post('/api/v1/listings').set('Cookie', authA).send(listing)
    expect(overflow.status).toBe(409)
    expect(overflow.body.error.code).toBe('MAX_LISTINGS')

    // cancelar um anúncio libera o slot (limite conta só ativos)
    const mine = await request(app).get('/api/v1/listings/mine').set('Cookie', authA)
    const oneActive = mine.body.items.find((l: { status: string }) => l.status === 'active')
    const del = await request(app).delete(`/api/v1/listings/${oneActive.id}`).set('Cookie', authA)
    expect(del.status).toBe(200)

    const retry = await request(app).post('/api/v1/listings').set('Cookie', authA).send(listing)
    expect(retry.status).toBe(201)
  })

  it('anúncio cancelado não pode ser cancelado de novo → 422 INVALID_STATUS', async () => {
    const session = await makeSession({ ticketType: 'Pista', ticketCategory: 'Meia', priceCents: 500, quantity: 5 })
    const created = await request(app).post('/api/v1/listings').set('Cookie', authB).send({
      sessionId: session.id, ticketType: 'Pista', ticketCategory: 'Meia', quantity: 1, priceCents: 1000,
    })
    expect(created.status).toBe(201)

    const first = await request(app).delete(`/api/v1/listings/${created.body.id}`).set('Cookie', authB)
    expect(first.status).toBe(200)

    const again = await request(app).delete(`/api/v1/listings/${created.body.id}`).set('Cookie', authB)
    expect(again.status).toBe(422)
    expect(again.body.error.code).toBe('INVALID_STATUS')
  })
})
