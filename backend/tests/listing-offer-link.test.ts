import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { approveListing } from '../src/services/seller.service'

// C1 — vínculo Listing → Offer: o anúncio publicado vira oferta comprável.
// Ciclo completo: criar → (aprovar) → visível → reservável → cancelar 409/ok →
// PAID marca sold → /listings/sold com código do pedido e SEM PII do comprador.

vi.mock('../src/lib/fastsoft', () => ({
  FastSoftError: class FastSoftError extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
  isConfigured: () => true,
  createTransaction: vi.fn(),
  getTransaction: vi.fn(),
}))

import * as fastsoft from '../src/lib/fastsoft'
const createTransaction = vi.mocked(fastsoft.createTransaction)
const getTransaction = vi.mocked(fastsoft.getTransaction)

const suffix = Date.now()
process.env.PAYMENTS_RATE_LIMIT = '1000'
const SELLER = { name: 'Sol Vendedora', email: `link-vendedor.${suffix}@teste.com`, password: 'Senha1@a' }
const BUYER = { name: 'Bento Comprador', email: `link-comprador.${suffix}@teste.com`, password: 'Senha1@a', phone: undefined }
const PAYER = { name: 'Bento Comprador', document: '111.444.777-35', phone: '11987654321' }

let sellerAuth: string
let buyerAuth: string
let sellerId: string
let buyerId: string
const createdEventIds: string[] = []

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = /auth_token=([^;]+)/.exec(cookies.find((c) => c.startsWith('auth_token=')) ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

async function makeSession() {
  const event = await prisma.event.create({
    data: {
      slug: `evt-link-${suffix}-${createdEventIds.length}`,
      name: 'Evento Vínculo Test',
      category: 'Shows',
      organizer: 'Cia. Teste',
      description: 'Vínculo Listing→Offer.',
      sessions: {
        create: [{
          startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          city: 'São Paulo', uf: 'SP', venue: 'Palco de Testes',
        }],
      },
    },
    include: { sessions: true },
  })
  createdEventIds.push(event.id)
  return event.sessions[0]
}

async function createListing(sessionId: string, auth: string, priceCents = 1000, quantity = 2) {
  const res = await request(app).post('/api/v1/listings').set('Cookie', auth).send({
    sessionId, ticketType: 'Pista', ticketCategory: 'Inteira', quantity, priceCents,
  })
  expect(res.status).toBe(201)
  return res.body as { id: string; status: string }
}

beforeAll(async () => {
  process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
  process.env.SIGNUP_RATE_LIMIT = '1000'
  process.env.RESERVATIONS_RATE_LIMIT = '1000'
  const regSeller = await request(app).post('/api/v1/auth/register').send(SELLER)
  sellerAuth = authCookieFrom(regSeller)
  sellerId = (await prisma.user.findUnique({ where: { email: SELLER.email } }))!.id
  const regBuyer = await request(app).post('/api/v1/auth/register').send(BUYER)
  buyerAuth = authCookieFrom(regBuyer)
  buyerId = (await prisma.user.findUnique({ where: { email: BUYER.email } }))!.id

  await request(app).post('/api/v1/sellers/verify').set('Cookie', sellerAuth).send({
    consent: true,
    address: { cep: '01310-100', uf: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Avenida Paulista', number: '1000', complement: '' },
  })
})

beforeEach(() => {
  createTransaction.mockReset()
  getTransaction.mockReset()
})

afterAll(async () => {
  process.env.SELLER_OFFERS_AUTO_APPROVE = undefined
  await prisma.paymentEvent.deleteMany({ where: { payment: { order: { user: { email: { in: [SELLER.email, BUYER.email] } } } } } })
  await prisma.payment.deleteMany({ where: { order: { user: { email: { in: [SELLER.email, BUYER.email] } } } } })
  await prisma.order.deleteMany({ where: { user: { email: { in: [SELLER.email, BUYER.email] } } } })
  await prisma.reservation.deleteMany({ where: { offer: { session: { eventId: { in: createdEventIds } } } } })
  await prisma.listing.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.offer.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.eventSession.deleteMany({ where: { eventId: { in: createdEventIds } } })
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await prisma.sellerProfile.deleteMany({ where: { userId: { in: [sellerId, buyerId] } } })
  await prisma.user.deleteMany({ where: { email: { in: [SELLER.email, BUYER.email] } } })
  await prisma.$disconnect()
})

describe('C1 — anúncio vira oferta comprável', () => {
  it('POST /listings cria Listing+Offer na mesma transação; ativo aparece em /sessions/:id/offers e é reservável por outra conta', async () => {
    const session = await makeSession()
    const listing = await createListing(session.id, sellerAuth, 1500, 2)
    expect(listing.status).toBe('active')

    // vínculo 1:1
    const stored = await prisma.listing.findUnique({ where: { id: listing.id }, include: { offer: true } })
    expect(stored?.offer).toBeTruthy()
    expect(stored?.offer?.sellerId).toBe(sellerId)
    expect(stored?.offer?.quantity).toBe(2)
    expect(stored?.offer?.priceCents).toBe(1500)

    // aparece para o comprador
    const offers = await request(app).get(`/api/v1/sessions/${session.id}/offers`)
    expect(offers.status).toBe(200)
    const found = offers.body.find((o: { id: string }) => o.id === stored?.offer?.id)
    expect(found).toBeTruthy()
    expect(found.seller).toBe('vendedor')
    expect(found.available).toBe(2)

    // reservável por outra conta
    const reserve = await request(app).post('/api/v1/reservations').set('Cookie', buyerAuth).send({ offerId: stored?.offer?.id, quantity: 1 })
    expect(reserve.status).toBe(201)
  })

  it('pending_review (AUTO_APPROVE=false) não aparece nem reserva; aprovação via script o torna visível', async () => {
    process.env.SELLER_OFFERS_AUTO_APPROVE = 'false'
    try {
      const session = await makeSession()
      const listing = await createListing(session.id, sellerAuth, 900, 1)
      expect(listing.status).toBe('pending_review')

      let offers = await request(app).get(`/api/v1/sessions/${session.id}/offers`)
      expect(offers.body.length).toBe(0)

      const stored = await prisma.listing.findUnique({ where: { id: listing.id }, include: { offer: true } })
      const refused = await request(app).post('/api/v1/reservations').set('Cookie', buyerAuth).send({ offerId: stored?.offer?.id, quantity: 1 })
      expect(refused.status).toBe(422)
      expect(refused.body.error.code).toBe('OFFER_UNAVAILABLE')

      // aprovação pelo CAMINHO do script (mesma função usada por pnpm approve-listing)
      const approved = await approveListing(listing.id, 'cli:test')
      expect(approved.status).toBe('active')

      offers = await request(app).get(`/api/v1/sessions/${session.id}/offers`)
      expect(offers.body.length).toBe(1)
      const ok = await request(app).post('/api/v1/reservations').set('Cookie', buyerAuth).send({ offerId: stored?.offer?.id, quantity: 1 })
      expect(ok.status).toBe(201)

      // aprovar de novo → 422 (estado já avançou)
      await expect(approveListing(listing.id, 'cli:test')).rejects.toMatchObject({ statusCode: 422 })
    } finally {
      process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
    }
  })
})

describe('C1 — cancelamento transacional', () => {
  it('DELETE /listings/:id com reserva ativa → 409 RESERVATION_ACTIVE (teste pendente do C0)', async () => {
    const session = await makeSession()
    const listing = await createListing(session.id, sellerAuth, 1200, 1)
    const stored = await prisma.listing.findUnique({ where: { id: listing.id }, include: { offer: true } })

    const reserve = await request(app).post('/api/v1/reservations').set('Cookie', buyerAuth).send({ offerId: stored?.offer?.id, quantity: 1 })
    expect(reserve.status).toBe(201)

    const cancel = await request(app).delete(`/api/v1/listings/${listing.id}`).set('Cookie', sellerAuth)
    expect(cancel.status).toBe(409)
    expect(cancel.body.error.code).toBe('RESERVATION_ACTIVE')

    // anúncio e oferta seguem ativos
    expect((await prisma.listing.findUnique({ where: { id: listing.id } }))?.status).toBe('active')
    expect((await prisma.offer.findUnique({ where: { id: stored?.offer?.id } }))?.status).toBe('active')
  })

  it('DELETE cancela anúncio E oferta juntos; a oferta some de /sessions/:id/offers', async () => {
    const session = await makeSession()
    const listing = await createListing(session.id, sellerAuth, 1300, 3)
    const stored = await prisma.listing.findUnique({ where: { id: listing.id }, include: { offer: true } })

    const cancel = await request(app).delete(`/api/v1/listings/${listing.id}`).set('Cookie', sellerAuth)
    expect(cancel.status).toBe(200)

    expect((await prisma.listing.findUnique({ where: { id: listing.id } }))?.status).toBe('cancelled')
    expect((await prisma.offer.findUnique({ where: { id: stored?.offer?.id } }))?.status).toBe('cancelled')

    const offers = await request(app).get(`/api/v1/sessions/${session.id}/offers`)
    expect(offers.body.some((o: { id: string }) => o.id === stored?.offer?.id)).toBe(false)
  })

  it('anúncio LEGADO (criado antes do vínculo, sem offerId) cancela sozinho sem quebrar', async () => {
    const session = await makeSession()
    const legacy = await prisma.listing.create({
      data: { sessionId: session.id, sellerId, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 800, status: 'active' },
    })
    const cancel = await request(app).delete(`/api/v1/listings/${legacy.id}`).set('Cookie', sellerAuth)
    expect(cancel.status).toBe(200)
    expect((await prisma.listing.findUnique({ where: { id: legacy.id } }))?.status).toBe('cancelled')
  })
})

describe('C1 — venda marca sold e /listings/sold sem PII', () => {
  it('PAID com quantity → 0 marca oferta e anúncio como sold; /listings/sold traz código do pedido e NENHUMA PII', async () => {
    const session = await makeSession()
    const listing = await createListing(session.id, sellerAuth, 2000, 1) // 1 ingresso: venda esgota
    const stored = await prisma.listing.findUnique({ where: { id: listing.id }, include: { offer: true } })
    const offerId = stored!.offer!.id

    const reserve = await request(app).post('/api/v1/reservations').set('Cookie', buyerAuth).send({ offerId, quantity: 1 })
    expect(reserve.status).toBe(201)

    const order = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', buyerAuth)
      .set('Idempotency-Key', `link-order-${suffix}`)
      .send({ reservationId: reserve.body.id, receiptEmail: 'quem@recebe.com' })
    expect(order.status).toBe(201)
    const orderCode = order.body.code as string

    createTransaction.mockResolvedValue({
      id: `tx-link-${suffix}`, amount: order.body.total, status: 'WAITING_PAYMENT',
      externalRef: 'GW-LINK-1', metadata: JSON.stringify({ orderCode }),
      pix: { qrcode: '00020126EMV', expirationDate: new Date(Date.now() + 3600_000).toISOString() },
    })
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', buyerAuth)
      .set('Idempotency-Key', `link-pay-${suffix}`)
      .send({ orderCode, method: 'pix', payer: PAYER })
    expect(pay.status).toBe(201)

    getTransaction.mockResolvedValue({
      id: `tx-link-${suffix}`, amount: order.body.total, status: 'PAID',
      externalRef: 'GW-LINK-1', metadata: JSON.stringify({ orderCode }), paidAt: new Date().toISOString(),
    })
    const hook = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-link-${suffix}`, data: { id: `tx-link-${suffix}`, status: 'PAID', amount: order.body.total } })
    expect(hook.status).toBe(200)

    // oferta esgotada → sold (oferta E anúncio)
    const offerAfter = await prisma.offer.findUnique({ where: { id: offerId } })
    expect(offerAfter?.quantity).toBe(0)
    expect(offerAfter?.status).toBe('sold')
    expect((await prisma.listing.findUnique({ where: { id: listing.id } }))?.status).toBe('sold')

    // /listings/sold: derivado das ofertas vendidas, com código do pedido, SEM PII
    const sold = await request(app).get('/api/v1/listings/sold').set('Cookie', sellerAuth)
    expect(sold.status).toBe(200)
    const entry = sold.body.find((s: { id: string }) => s.id === offerId)
    expect(entry).toBeTruthy()
    expect(entry.orderCode).toBe(orderCode)
    expect(entry.status).toBe('sold')
    expect(entry.event.name).toBe('Evento Vínculo Test')
    const serialized = JSON.stringify(entry)
    expect(serialized).not.toContain(BUYER.name)
    expect(serialized).not.toContain(BUYER.email)
    expect(serialized).not.toContain('11144477735')
    expect(serialized).not.toContain('11987654321')

    // comprador NÃO vê a venda (rota é do vendedor)
    const asBuyer = await request(app).get('/api/v1/listings/sold').set('Cookie', buyerAuth)
    expect(asBuyer.status).toBe(200)
    expect(asBuyer.body.some((s: { id: string }) => s.id === offerId)).toBe(false)
  })
})
