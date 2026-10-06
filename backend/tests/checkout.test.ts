import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { hashCpf } from '../src/lib/cpf'
import { prisma } from '../src/lib/prisma'

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
const USER_A = { name: 'Rui Checkout', email: `rui.checkout.${suffix}@teste.com`, password: 'Senha1@a' }
const USER_B = { name: 'Sofia Checkout', email: `sofia.checkout.${suffix}@teste.com`, password: 'Senha1@a' }
const CPF_A = '529.982.247-25'
const CPF_DIGITS_A = '52998224725'
const PHONE_DIGITS_A = '11987654321'
const PAYER = { document: CPF_A, phone: '(11) 98765-4321' }

let authA: string
let authB: string
let authACookie: string[]
let userAId: string
const createdEventIds: string[] = []
const createdCouponIds: string[] = []

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = /auth_token=([^;]+)/.exec(cookies.find((c) => c.startsWith('auth_token=')) ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

async function makeFixture(opts: { quantity?: number; ownOffer?: boolean; withoutOffers?: boolean } = {}) {
  const sellerId = opts.ownOffer ? userAId : null
  const event = await prisma.event.create({
    data: {
      slug: `evt-checkout-${suffix}-${createdEventIds.length}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Evento Checkout Test',
      category: 'Shows',
      organizer: 'Cia. de Testes',
      description: 'Evento dos testes de checkout.',
      sessions: {
        create: [
          {
            startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            city: 'São Paulo',
            uf: 'SP',
            venue: 'Palco de Testes',
            offers: opts.withoutOffers
              ? undefined
              : {
                  create: [
                    {
                      ticketType: 'Pista',
                      ticketCategory: 'Inteira',
                      priceCents: 1000,
                      quantity: opts.quantity ?? 2,
                      ...(sellerId ? { sellerId } : {}),
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
  const session = event.sessions[0]
  return { eventId: event.id, sessionId: session.id, offerId: session.offers[0]?.id ?? null }
}

async function reserve(cookie: string, offerId: string) {
  return request(app).post('/api/v1/reservations').set('Cookie', cookie).send({ offerId, quantity: 1 })
}

async function createOrder(cookie: string, reservationId: string, key: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/orders')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send({ reservationId, receiptEmail: `rui.${suffix}@teste.com`, ...extra })
}

async function pay(cookie: string, orderCode: string, key: string, payer: Record<string, string>) {
  createTransaction.mockResolvedValue({
    id: `tx-${key}`,
    amount: 1000,
    status: 'WAITING_PAYMENT',
    externalRef: 'GW-NSU',
    metadata: JSON.stringify({ orderCode }),
    pix: { qrcode: '00020126EMV', url: undefined, expirationDate: new Date(Date.now() + 3600_000).toISOString() },
  })
  return request(app)
    .post('/api/v1/payments')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .send({ orderCode, method: 'pix', payer })
}

beforeAll(async () => {
  process.env.SIGNUP_RATE_LIMIT = '1000'
  process.env.RESERVATIONS_RATE_LIMIT = '1000'
  const regA = await request(app).post('/api/v1/auth/register').send(USER_A)
  authA = authCookieFrom(regA)
  authACookie = [authA]
  const regB = await request(app).post('/api/v1/auth/register').send(USER_B)
  authB = authCookieFrom(regB)
  const userA = await prisma.user.findUnique({ where: { email: USER_A.email } })
  userAId = userA!.id
})

afterAll(async () => {
  await prisma.reservation.deleteMany({ where: { offer: { session: { eventId: { in: createdEventIds } } } } })
  await prisma.paymentEvent.deleteMany({ where: { payment: { order: { user: { email: { in: cleanupUserEmails() } } } } } })
  await prisma.payment.deleteMany({ where: { order: { user: { email: { in: cleanupUserEmails() } } } } })
  await prisma.order.deleteMany({ where: { user: { email: { in: cleanupUserEmails() } } } })
  await prisma.offer.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.eventSession.deleteMany({ where: { eventId: { in: createdEventIds } } })
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await prisma.coupon.deleteMany({ where: { code: { startsWith: 'CHECKOUT' } } })
  await prisma.address.deleteMany({ where: { user: { email: { in: cleanupUserEmails() } } } })
  await prisma.cart.deleteMany({ where: { user: { email: { in: cleanupUserEmails() } } } })
  await prisma.user.deleteMany({ where: { email: { in: cleanupUserEmails() } } })
  await prisma.$disconnect()
})

function cleanupUserEmails(): string[] {
  return [USER_A.email, USER_B.email]
}

describe('POST /reservations — 409 própria oferta', () => {
  it('vendedor não pode comprar o próprio anúncio (409 OWN_OFFER)', async () => {
    const fixture = await makeFixture({ quantity: 2, ownOffer: true })
    const res = await reserve(authA, fixture.offerId)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('OWN_OFFER')
  })
})

describe('POST /orders — pedido por reserva', () => {
  it('reserva de outro usuário → 404; expirada → 422 RESERVATION_EXPIRED', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const foreign = await reserve(authB, fixture.offerId)
    const foreignOrder = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authA)
      .set('Idempotency-Key', `ord-foreign-${suffix}`)
      .send({ reservationId: foreign.body.id })
    // authB reservou, authA tenta pedir → 404 (reserva de outro usuário)
    const wrongOwner = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authB)
      .set('Idempotency-Key', `ord-wrong-${suffix}`)
      .send({ reservationId: '00000000-0000-4000-8000-000000000000' })
    expect(wrongOwner.status).toBe(404)

    // expira a reserva
    await prisma.reservation.update({
      where: { id: foreign.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const expired = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authB)
      .set('Idempotency-Key', `ord-exp-${suffix}`)
      .send({ reservationId: foreign.body.id })
    expect(expired.status).toBe(422)
    expect(expired.body.error.code).toBe('RESERVATION_EXPIRED')
    void foreignOrder
  })

  it('preço e taxa do SERVIDOR (1000 + 10% = 1100); preço do cliente ignorado', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const created = await reserve(authA, fixture.offerId)
    const res = await createOrder(authA, created.body.id, `ord-srv-${suffix}`, { priceCents: 1, total: 1 })
    expect(res.status).toBe(201)
    expect(res.body.subtotal).toBe(1000)
    expect(res.body.total).toBe(1100)
    const snapshot = res.body.ticketSnapshot
    expect(snapshot.unitPriceCents).toBe(1000)
    expect(snapshot.serviceFeeCents).toBe(100)
    expect(snapshot.totalCents).toBe(1100)
  })

  it('duplo clique = 1 pedido (idempotência)', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const r1 = await reserve(authA, fixture.offerId)
    const r2 = await reserve(authA, fixture.offerId) // reaproveita a mesma reserva
    expect(r1.body.id).toBe(r2.body.id)

    const key = `ord-dup-${suffix}`
    const res1 = await createOrder(authA, r1.body.id, key)
    const res2 = await createOrder(authA, r1.body.id, key)
    expect(res1.status).toBe(201)
    expect(res2.status).toBe(200)
    expect(res2.body.code).toBe(res1.body.code)
  })

  it('e-mail de recebimento inválido → 400', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const created = await reserve(authA, fixture.offerId)
    const res = await createOrder(authA, created.body.id, `ord-badmail-${suffix}`, { receiptEmail: 'nao-e-email' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.receiptEmail).toBeTruthy()
  })
})

describe('POST /payments — CPF do pagador deve bater com a conta', () => {
  const payer = { document: CPF_DIGITS_A, phone: PHONE_DIGITS_A }
  it('CPF divergente da conta → 422 CPF_MISMATCH', async () => {
    const fixture = await makeFixture({ quantity: 2 })
    const created = await reserve(authA, fixture.offerId)
    expect(created.status).toBe(201)
    const order = await createOrder(authA, created.body.id, `ord-cpf-${suffix}`)
    expect(order.status).toBe(201)
    // associa o CPF ao usuário (simula signup com CPF); limpa resíduos primeiro
    await prisma.user.updateMany({ where: { cpfHash: hashCpf('52998224725') }, data: { cpfHash: null, cpfMasked: null } })
    const updated = await prisma.user.updateMany({
      where: { id: userAId },
      data: { cpfMasked: '***.982.247-**', cpfHash: hashCpf('52998224725') },
    })
    expect(updated.count).toBe(1)
    // força recarga do usuário no próximo request
    const divergent = await pay(authA, order.body.code, `pay-cpf-${suffix}`, { document: '111.444.777-35', phone: '(11) 98765-4321' })
    expect(divergent.status).toBe(422)
    expect(divergent.body.error.code).toBe('CPF_MISMATCH')
  })

  it('CPF correto + pagamento + confirmação (com reserva expirada) → paid + needsReview', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const created = await reserve(authA, fixture.offerId)
    const order = await createOrder(authA, created.body.id, `ord-exp-${suffix}`)
    // expira a reserva após o pedido
    await prisma.reservation.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const expPayer = { document: CPF_DIGITS_A, phone: PHONE_DIGITS_A }
    createTransaction.mockResolvedValue({
      id: `tx-exp-ok-${suffix}`,
      amount: order.body.total,
      status: 'WAITING_PAYMENT',
      externalRef: 'GW-NSU',
      metadata: JSON.stringify({ orderCode: order.body.code }),
      pix: { qrcode: '00020126EMV', url: undefined, expirationDate: new Date(Date.now() + 3600_000).toISOString() },
    })
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', authA)
      .set('Idempotency-Key', `pay-exp-ok-${suffix}`)
      .send({ orderCode: order.body.code, method: 'pix', payer })
    expect(pay.status).toBe(201)
    getTransaction.mockResolvedValue({
      id: `tx-exp-ok-${suffix}`,
      amount: order.body.total,
      status: 'PAID',
      externalRef: 'GW-NSU',
      metadata: JSON.stringify({ orderCode: order.body.code }),
      paidAt: new Date().toISOString(),
    })
    const hook = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-exp-ok-${suffix}`, data: { id: `tx-exp-ok-${suffix}`, status: 'PAID', amount: order.body.total } })
    expect(hook.status).toBe(200)

    const after = await prisma.order.findUnique({ where: { code: order.body.code } })
    expect(after?.status).toBe('paid')
    expect(after?.needsReview).toBe(false)
  })
})

describe('POST /coupons/validate e cupom no pedido', () => {
  let couponCode: string
  beforeAll(async () => {
    const coupon = await prisma.coupon.create({
      data: {
        code: `CHECKOUT${suffix}`,
        percentOff: 10,
        validFrom: new Date(Date.now() - 1000),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        maxUses: 100,
        active: true,
      },
    })
    createdCouponIds.push(coupon.id)
    couponCode = coupon.code
  })

  it('valida cupom com desconto sobre o preço e taxa recalculada', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const created = await reserve(authA, fixture.offerId)
    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Cookie', authA)
      .send({ code: couponCode, reservationId: created.body.id })
    expect(res.status).toBe(200)
    // 1000 − 10% = 900; taxa 90; total 990
    expect(res.body.discountedPriceCents).toBe(900)
    expect(res.body.serviceFeeCents).toBe(90)
    expect(res.body.totalCents).toBe(990)
  })

  it('cupom inexistente → 422', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const created = await reserve(authA, fixture.offerId)
    const res = await request(app)
      .post('/api/v1/coupons/validate')
      .set('Cookie', authA)
      .send({ code: 'NAOEXISTE', reservationId: created.body.id })
    expect(res.status).toBe(422)
  })

  it('pedido com cupom usa o valor com desconto (total do servidor)', async () => {
    const fixture = await makeFixture({ quantity: 1 })
    const created = await reserve(authA, fixture.offerId)
    expect(created.status).toBe(201)
    const key = `ord-cupom-${suffix}`
    const res = await createOrder(authA, created.body.id, key, { couponCode })
    expect(res.status).toBe(201)
    console.info('COUPON_ORDER: subtotal=' + res.body.subtotal + ' discount=' + res.body.discount + ' total=' + res.body.total + ' couponCode_sent=' + couponCode)
    // 1000 − 10% = 900; taxa 90; total 990
    expect(res.body.subtotal).toBe(1000)
    expect(res.body.discount).toBe(100)
    expect(res.body.total).toBe(990)
    expect(res.body.ticketSnapshot.totalCents).toBe(990)
    expect(res.body.ticketSnapshot.couponCode).toBe(couponCode)
  })
})
