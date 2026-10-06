import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

// MOCK do client FastSoft — nenhuma chamada real (o pagamento de ingresso usa o mesmo fluxo)
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
const USER_A = { name: 'Rui Ingressos', email: `rui.${suffix}@teste.com`, password: 'senha-segura-123' }
const USER_B = { name: 'Sofia Ingressos', email: `sofia.${suffix}@teste.com`, password: 'senha-segura-123' }
const PAYER = { name: 'Rui Ingressos', document: '529.982.247-25', phone: '(11) 98765-4321' }

let authA: string
let authB: string
const cleanupUserEmails = [USER_A.email, USER_B.email]
const createdEventIds: string[] = []
let readEventSlug: string
let readSessionId: string
let readEmptySessionId: string

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = /auth_token=([^;]+)/.exec(cookies.find((c) => c.startsWith('auth_token=')) ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

async function reserve(cookie: string, offerId: string, quantity = 1) {
  return request(app).post('/api/v1/reservations').set('Cookie', cookie).send({ offerId, quantity })
}

// fixture ISOLADA por teste: evento + 1 sessão + 1 oferta (Pista/Inteira, seller opcional)
async function makeFixture(opts: { quantity?: number; withSeller?: boolean } = {}) {
  const seller = opts.withSeller ? await prisma.user.findUnique({ where: { email: USER_A.email } }) : null
  const event = await prisma.event.create({
    data: {
      slug: `evt-${suffix}-${createdEventIds.length}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Evento de Testes Automatizados',
      category: 'Shows',
      organizer: 'Cia. de Testes',
      description: 'Evento criado pelos testes de ingressos.',
      featured: true,
      sessions: {
        create: [
          {
            startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            city: 'São Paulo',
            uf: 'SP',
            venue: 'Palco de Testes',
            offers: {
              create: [
                {
                  ticketType: 'Pista',
                  ticketCategory: 'Inteira',
                  priceCents: 1000,
                  quantity: opts.quantity ?? 2,
                  ...(seller ? { sellerId: seller.id } : {}),
                },
              ],
            },
          },
        ],
      },
    },
    include: { sessions: { include: { offers: true } } },
  })
  createdEventIds.push(event.id)
  return {
    eventId: event.id,
    eventSlug: event.slug,
    sessionId: event.sessions[0].id,
    offerId: event.sessions[0].offers[0].id,
  }
}

beforeAll(async () => {
  const regA = await request(app).post('/api/v1/auth/register').send(USER_A)
  authA = authCookieFrom(regA)
  const regB = await request(app).post('/api/v1/auth/register').send(USER_B)
  authB = authCookieFrom(regB)

  // fixture compartilhada apenas para os testes de LEITURA (não mutam estado)
  const seller = await prisma.user.findUnique({ where: { email: USER_A.email } })
  const event = await prisma.event.create({
    data: {
      slug: `evt-read-${suffix}`,
      name: 'Evento de Testes Automatizados',
      category: 'Shows',
      organizer: 'Cia. de Testes',
      description: 'Evento criado pelos testes de ingressos.',
      featured: true,
      sessions: {
        create: [
          {
            startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            city: 'São Paulo',
            uf: 'SP',
            venue: 'Palco de Testes',
            offers: {
              create: [
                { ticketType: 'Pista', ticketCategory: 'Inteira', priceCents: 1000, quantity: 2, sellerId: seller!.id },
                // 1 lugar: alvo do teste de concorrência
                { ticketType: 'Pista', ticketCategory: 'Meia', priceCents: 500, quantity: 1 },
              ],
            },
          },
          // sessão sem ofertas → "Indisponível"
          {
            startsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            city: 'São Paulo',
            uf: 'SP',
            venue: 'Palco de Testes 2',
          },
        ],
      },
    },
    include: { sessions: { include: { offers: true } } },
  })
  createdEventIds.push(event.id)
  readEventSlug = event.slug
  readSessionId = event.sessions[0].id
  readEmptySessionId = event.sessions[1].id
})

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { offer: { session: { eventId: { in: createdEventIds } } } } })
  await prisma.paymentEvent.deleteMany({ where: { payment: { order: { user: { email: { in: cleanupUserEmails } } } } } })
  await prisma.payment.deleteMany({ where: { order: { user: { email: { in: cleanupUserEmails } } } } })
  await prisma.order.deleteMany({ where: { user: { email: { in: cleanupUserEmails } } } })
  await prisma.offer.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.eventSession.deleteMany({ where: { eventId: { in: createdEventIds } } })
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await prisma.address.deleteMany({ where: { user: { email: { in: cleanupUserEmails } } } })
  await prisma.cart.deleteMany({ where: { user: { email: { in: cleanupUserEmails } } } })
  await prisma.user.deleteMany({ where: { email: { in: cleanupUserEmails } } })
  await prisma.$disconnect()
})

describe('GET /events — filtros e paginação', () => {
  it('lista paginada com agregados (sessões, próxima data, menor preço)', async () => {
    const res = await request(app).get('/api/v1/events?page=1&limit=5')
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(1)
    const item = res.body.items.find((e: { slug: string }) => e.slug === readEventSlug)
    expect(item).toBeTruthy()
    expect(item.sessionCount).toBe(2)
    expect(item.minPriceCents).toBe(500)
  })

  it('filtra por q (nome) e category', async () => {
    const byQ = await request(app).get('/api/v1/events?q=Testes Automatizados')
    expect(byQ.body.items.some((e: { slug: string }) => e.slug === readEventSlug)).toBe(true)

    const byCategory = await request(app).get('/api/v1/events?category=Shows')
    expect(byCategory.body.items.every((e: { category: string }) => e.category.toLowerCase() === 'shows')).toBe(true)
  })

  it('filtra por date (sessão do dia) e ordena por preço', async () => {
    const day = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const byDate = await request(app).get(`/api/v1/events?date=${day}`)
    expect(byDate.body.items.some((e: { slug: string }) => e.slug === readEventSlug)).toBe(true)

    const asc = await request(app).get('/api/v1/events?sort=price_asc&limit=50')
    const prices = asc.body.items.map((e: { minPriceCents: number | null }) => e.minPriceCents ?? Number.MAX_SAFE_INTEGER)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('sort inválido e date inválida → 400', async () => {
    const badSort = await request(app).get('/api/v1/events?sort=barato')
    expect(badSort.status).toBe(400)
    const badDate = await request(app).get('/api/v1/events?date=ontem')
    expect(badDate.status).toBe(400)
  })
})

describe('GET /events/:slug e /sessions/:id', () => {
  it('detalhe do evento com sessões (minPrice, hasOffers); slug inexistente → 404', async () => {
    const res = await request(app).get(`/api/v1/events/${readEventSlug}`)
    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(2)
    expect(res.body.sessions[0].minPriceCents).toBe(500)
    expect(res.body.sessions[1].hasOffers).toBe(false)

    const missing = await request(app).get('/api/v1/events/nao-existe')
    expect(missing.status).toBe(404)
  })

  it('detalhe da sessão com tipos/categorias; sem ofertas → hasOffers false', async () => {
    const res = await request(app).get(`/api/v1/sessions/${readSessionId}`)
    expect(res.status).toBe(200)
    expect(res.body.event.slug).toBe(readEventSlug)
    expect(res.body.types[0].value).toBe('Pista')

    const empty = await request(app).get(`/api/v1/sessions/${readEmptySessionId}`)
    expect(empty.status).toBe(200)
    expect(empty.body.hasOffers).toBe(false)
    expect(empty.body.types).toEqual([])
  })

  it('GET /sessions/:id/offers — disponíveis, preço asc, seller plataforma e vendedor', async () => {
    const res = await request(app).get(`/api/v1/sessions/${readSessionId}/offers`)
    expect(res.status).toBe(200)
    const prices = res.body.map((o: { priceCents: number }) => o.priceCents)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    const sellers = res.body.map((o: { seller: string }) => o.seller).sort()
    expect(sellers).toEqual(['plataforma', 'vendedor'])

    const vip = await request(app).get(`/api/v1/sessions/${readSessionId}/offers?type=Meia`)
    expect(vip.body.every((o: { ticketType: string }) => o.ticketType === 'Pista')).toBe(true)
    expect(vip.body.every((o: { ticketCategory: string }) => o.ticketCategory === 'Meia')).toBe(true)

    const none = await request(app).get(`/api/v1/sessions/${readSessionId}/offers?type=Camarote`)
    expect(none.body).toEqual([])
  })
})

describe('POST /reservations — reserva com lock', () => {
  it('sem sessão → 401; oferta inexistente → 404; quantity inválida → 400', async () => {
    const anon = await request(app).post('/api/v1/reservations').send({ offerId: '00000000-0000-4000-8000-000000000000' })
    expect(anon.status).toBe(401)

    const missing = await request(app).post('/api/v1/reservations').set('Cookie', authA).send({ offerId: '00000000-0000-4000-8000-000000000000' })
    expect(missing.status).toBe(404)

    const fixture = await makeFixture({ quantity: 2 })
    const badQty = await request(app).post('/api/v1/reservations').set('Cookie', authA).send({ offerId: fixture.offerId, quantity: 9 })
    expect(badQty.status).toBe(400)
  })

  it('RESERVA CONCORRENTE do último ingresso: exatamente um usuário consegue', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const results = await Promise.allSettled([reserve(authA, fixture.offerId), reserve(authB, fixture.offerId)])
    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 0))
    expect(statuses.filter((s) => s === 201 || s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s === 422)).toHaveLength(1)

    // a oferta com availability 0 nem aparece na listagem
    const offers = await request(app).get(`/api/v1/sessions/${fixture.sessionId}/offers`)
    expect(offers.body.some((o: { id: string }) => o.id === fixture.offerId)).toBe(false)

    // libera o lugar (a reserva vencedora é cancelada; próximo teste re-reserva)
    const winner = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<request.Response>
    const reservationId = winner.value.body.id
    await request(app).delete(`/api/v1/reservations/${reservationId}`).set('Cookie', authA)
  })

  it('NO MÁXIMO 1 reserva ativa por usuário: reservar outra oferta cancela a anterior', async () => {
    const fx1 = await makeFixture({ quantity: 3 })
    const fx2 = await makeFixture({ quantity: 3 })
    const first = await reserve(authA, fx1.offerId)
    expect(first.status).toBe(201)

    const second = await reserve(authA, fx2.offerId)
    expect(second.status).toBe(201)

    // a reserva da fx1 virou cancelled (estoque liberado: oferta aparece de novo)
    const cancelled = await prisma.reservation.findUnique({ where: { id: first.body.id } })
    expect(cancelled?.status).toBe('cancelled')
    const offers1 = await request(app).get(`/api/v1/sessions/${fx1.sessionId}/offers`)
    expect(offers1.body.some((o: { id: string }) => o.id === fx1.offerId)).toBe(true)

    // active lista só a nova
    const active = await request(app).get('/api/v1/reservations/active').set('Cookie', authA)
    expect(active.body).toHaveLength(1)
    expect(active.body[0].id).toBe(second.body.id)
  })

  it('REAPROVEITA a reserva ativa da mesma oferta (renova TTL, sem criar outra)', async () => {
    const fixture = await makeFixture({ quantity: 3 })
    const first = await reserve(authA, fixture.offerId)
    expect(first.status).toBe(201)
    const userA = await prisma.user.findUnique({ where: { email: USER_A.email } })
    const countBefore = await prisma.reservation.count({ where: { userId: userA!.id } })

    const again = await reserve(authA, fixture.offerId)
    expect(again.status).toBe(200)
    expect(again.body.reused).toBe(true)
    expect(again.body.id).toBe(first.body.id)
    expect(new Date(again.body.expiresAt).getTime()).toBeGreaterThan(new Date(first.body.expiresAt).getTime())
    expect(await prisma.reservation.count({ where: { userId: userA!.id } })).toBe(countBefore)
  })

  it('rate limit: acima do limite configurado → 429', async () => {
    const fixture = await makeFixture({ quantity: 4 })
    const email = `rate.reserva.${suffix}@teste.com`
    const user = await request(app).post('/api/v1/auth/register').send({
      name: 'Rate Reserva', email, password: 'senha-segura-123',
    })
    const cookie = authCookieFrom(user)
    cleanupUserEmails.push(email)

    process.env.RESERVATIONS_RATE_LIMIT = '2'
    try {
      const r1 = await reserve(cookie, fixture.offerId)
      const r2 = await reserve(cookie, fixture.offerId) // reuso → 200
      const r3 = await reserve(cookie, fixture.offerId)
      expect(r1.status).toBe(201)
      expect(r2.status).toBe(200)
      expect(r3.status).toBe(429)
      expect(r3.body.error.code).toBe('RATE_LIMITED')
    } finally {
      process.env.RESERVATIONS_RATE_LIMIT = '1000'
    }
  })

  it('cancelar própria reserva libera o lugar; cancelar de outro usuário → 404', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const mine = await reserve(authA, fixture.offerId)
    expect(mine.status).toBe(201)
    const reservationId = mine.body.id

    const stranger = await request(app).delete(`/api/v1/reservations/${reservationId}`).set('Cookie', authB)
    expect(stranger.status).toBe(404)

    const ok = await request(app).delete(`/api/v1/reservations/${reservationId}`).set('Cookie', authA)
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ ok: true })

    const again = await request(app).delete(`/api/v1/reservations/${reservationId}`).set('Cookie', authA)
    expect(again.status).toBe(422)

    const offers = await request(app).get(`/api/v1/sessions/${fixture.sessionId}/offers`)
    expect(offers.body.some((o: { id: string }) => o.id === fixture.offerId)).toBe(true)
  })
})

describe('Expiração de reserva', () => {
  it('reserva expirada sai de /reservations/active, volta a contar como disponível e bloqueia o pedido', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const created = await reserve(authA, fixture.offerId)
    expect(created.status).toBe(201)
    const reservationId = created.body.id

    let active = await request(app).get('/api/v1/reservations/active').set('Cookie', authA)
    expect(active.body).toHaveLength(1)

    // força a expiração no banco (TTL de 10 min é avaliado por timestamp)
    await prisma.reservation.update({ where: { id: reservationId }, data: { expiresAt: new Date(Date.now() - 1000) } })

    active = await request(app).get('/api/v1/reservations/active').set('Cookie', authA)
    expect(active.body).toHaveLength(0)

    const order = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-exp-${suffix}`)
      .send({ reservationId })
    expect(order.status).toBe(422)
    expect(order.body.error.code).toBe('RESERVATION_EXPIRED')
  })
})

describe('POST /orders a partir da reserva', () => {
  it('cria pedido com taxa de 10% no servidor, snapshot completo e IGNORA preço do cliente', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const created = await reserve(authA, fixture.offerId)
    const reservationId = created.body.id

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-${suffix}`)
      .send({ reservationId, receiptEmail: 'rui@recebimento.com', priceCents: 1, total: 1 })
    expect(res.status).toBe(201)
    expect(res.body.code).toMatch(/^RD-[A-Z0-9]{8}$/)
    expect(res.body.status).toBe('pending')
    // subtotal 1000 + taxa Math.round(100)=100 → total 1100 (preço do BANCO, não do cliente)
    expect(res.body.subtotal).toBe(1000)
    expect(res.body.total).toBe(1100)
    const snapshot = res.body.ticketSnapshot
    expect(snapshot.kind).toBe('ticket')
    expect(snapshot.serviceFeeCents).toBe(100)
    expect(snapshot.totalCents).toBe(1100)
    expect(snapshot.receiptEmail).toBe('rui@recebimento.com')
    expect(snapshot.event.slug).toBe(fixture.eventSlug)
    expect(snapshot.ticketType).toBe('Pista')
    expect(res.body.shippingAddress).toBeNull()

    // idempotência: mesma key devolve o MESMO pedido (200)
    const repeat = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-${suffix}`)
      .send({ reservationId })
    expect(repeat.status).toBe(200)
    expect(repeat.body.code).toBe(res.body.code)
  })

  it('reserva de outro usuário → 404; e-mail inválido → 400; key de outro usuário → 409', async () => {
    const fixture = await makeFixture({ quantity: 4 })
    const created = await reserve(authA, fixture.offerId)
    const foreign = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authB)
      .set('Idempotency-Key', `ticket-foreign-${suffix}`)
      .send({ reservationId: created.body.id })
    expect(foreign.status).toBe(404)

    const badEmail = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-bademail-${suffix}`)
      .send({ reservationId: created.body.id, receiptEmail: 'nao-e-email' })
    expect(badEmail.status).toBe(400)

    const conflict = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authB)
      .set('Idempotency-Key', `ticket-${suffix}`)
      .send({ reservationId: created.body.id })
    expect(conflict.status).toBe(409)
  })
})

describe('Pagamento de pedido de ingresso (fluxo Pix mockado)', () => {
  it('PAID converte a reserva e decrementa a oferta (estoque vai no pagamento)', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const quantityBefore = (await prisma.offer.findUnique({ where: { id: fixture.offerId } }))!.quantity // 2
    const created = await reserve(authA, fixture.offerId)
    const reservationId = created.body.id

    const order = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-pay-${suffix}`)
      .send({ reservationId, receiptEmail: 'rui@recebimento.com' })
    expect(order.status).toBe(201)
    const orderCode = order.body.code

    createTransaction.mockResolvedValue({
      id: `tx-ticket-${suffix}`,
      amount: order.body.total,
      status: 'WAITING_PAYMENT',
      externalRef: 'GW-NSU-TESTE',
      metadata: JSON.stringify({ orderCode }),
      pix: { qrcode: '00020126EMV', expirationDate: new Date(Date.now() + 3600_000).toISOString() },
    })
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', authA)
      .set('Idempotency-Key', `pay-ticket-${suffix}`)
      .send({ orderCode, method: 'pix', payer: PAYER })
    expect(pay.status).toBe(201)
    expect(pay.body.pix.qrCode).toBe('00020126EMV')

    // gateway confirma → webhook (externalRef é NSU da gateway; vínculo é o metadata)
    getTransaction.mockResolvedValue({
      id: `tx-ticket-${suffix}`,
      amount: order.body.total,
      status: 'PAID',
      externalRef: 'GW-NSU-TESTE',
      metadata: JSON.stringify({ orderCode }),
      paidAt: new Date().toISOString(),
    })
    const hook = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-ticket-${suffix}`, data: { id: `tx-ticket-${suffix}`, status: 'PAID', amount: order.body.total } })
    expect(hook.status).toBe(200)

    const orderAfter = await prisma.order.findUnique({ where: { code: orderCode } })
    expect(orderAfter?.status).toBe('paid')
    expect((await prisma.payment.findUnique({ where: { id: pay.body.paymentId } }))?.status).toBe('PAID')
    expect((await prisma.reservation.findUnique({ where: { id: reservationId } }))?.status).toBe('converted')
    expect((await prisma.offer.findUnique({ where: { id: fixture.offerId } }))!.quantity).toBe(quantityBefore - 1)
  })

  it('reserva expirada + pagamento confirmado com estoque: baixa normal; sem estoque: paid + needsReview', async () => {
    // cenário A: expira mas há estoque → baixa normal (2 → 1)
    const fixtureA = await makeFixture({ quantity: 2 })
    const createdA = await reserve(authA, fixtureA.offerId)
    const orderA = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-exp-ok-${suffix}`)
      .send({ reservationId: createdA.body.id })
    expect(orderA.status).toBe(201)
    await prisma.reservation.update({
      where: { id: createdA.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    createTransaction.mockResolvedValue({
      id: `tx-exp-ok-${suffix}`,
      amount: orderA.body.total,
      status: 'WAITING_PAYMENT',
      externalRef: 'GW-NSU-TESTE',
      metadata: JSON.stringify({ orderCode: orderA.body.code }),
      pix: { qrcode: 'x', expirationDate: new Date(Date.now() + 3600_000).toISOString() },
    })
    await request(app)
      .post('/api/v1/payments')
      .set('Cookie', authA)
      .set('Idempotency-Key', `pay-exp-ok-${suffix}`)
      .send({ orderCode: orderA.body.code, method: 'pix', payer: PAYER })
    getTransaction.mockResolvedValue({
      id: `tx-exp-ok-${suffix}`,
      amount: orderA.body.total,
      status: 'PAID',
      externalRef: 'GW-NSU-TESTE',
      metadata: JSON.stringify({ orderCode: orderA.body.code }),
      paidAt: new Date().toISOString(),
    })
    await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-exp-ok-${suffix}`, data: { id: `tx-exp-ok-${suffix}`, status: 'PAID', amount: orderA.body.total } })
    const orderAAfter = await prisma.order.findUnique({ where: { code: orderA.body.code } })
    expect(orderAAfter?.status).toBe('paid')
    expect(orderAAfter?.needsReview).toBe(false)
    expect((await prisma.offer.findUnique({ where: { id: fixtureA.offerId } }))!.quantity).toBe(1)

    // cenário B: expira e SEM estoque → paid + needsReview (pagamento nunca perdido)
    const fixtureB = await makeFixture({ quantity: 1 })
    const createdB = await reserve(authA, fixtureB.offerId)
    const orderB = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ticket-exp-nr-${suffix}`)
      .send({ reservationId: createdB.body.id })
    expect(orderB.status).toBe(201)
    // zera o estoque disponível após o pedido (corrida entre reserva expirada e pagamento)
    await prisma.offer.update({ where: { id: fixtureB.offerId }, data: { quantity: 0 } })
    await prisma.reservation.update({
      where: { id: createdB.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    createTransaction.mockResolvedValue({
      id: `tx-exp-nr-${suffix}`,
      amount: orderB.body.total,
      status: 'WAITING_PAYMENT',
      externalRef: 'GW-NSU-TESTE',
      metadata: JSON.stringify({ orderCode: orderB.body.code }),
      pix: { qrcode: 'x', expirationDate: new Date(Date.now() + 3600_000).toISOString() },
    })
    await request(app)
      .post('/api/v1/payments')
      .set('Cookie', authA)
      .set('Idempotency-Key', `pay-exp-nr-${suffix}`)
      .send({ orderCode: orderB.body.code, method: 'pix', payer: PAYER })
    getTransaction.mockResolvedValue({
      id: `tx-exp-nr-${suffix}`,
      amount: orderB.body.total,
      status: 'PAID',
      externalRef: 'GW-NSU-TESTE',
      metadata: JSON.stringify({ orderCode: orderB.body.code }),
      paidAt: new Date().toISOString(),
    })
    await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-exp-nr-${suffix}`, data: { id: `tx-exp-nr-${suffix}`, status: 'PAID', amount: orderB.body.total } })
    const orderBAfter = await prisma.order.findUnique({ where: { code: orderB.body.code } })
    expect(orderBAfter?.status).toBe('paid')
    expect(orderBAfter?.needsReview).toBe(true)
  })
})
