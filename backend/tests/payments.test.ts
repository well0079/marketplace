import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

// MOCK do client FastSoft — nenhuma chamada real nos testes automatizados
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
// rate limit alto para a suíte (o limite de produção segue em 10/min)
process.env.PAYMENTS_RATE_LIMIT = '1000'
const USER = { name: 'Hugo Pagante', email: `hugo.pagante.${suffix}@teste.com`, password: 'senha-segura-123' }
const OTHER = { name: 'Ivy Alheia', email: `ivy.alheia.${suffix}@teste.com`, password: 'senha-segura-123' }
const PAYER = { name: 'Hugo Pagante', document: '529.982.247-25', phone: '(11) 98765-4321' } // CPF válido de teste

let auth: string
let otherAuth: string
let orderCode: string
let cancelledOrderCode: string
let variantId: string
let orderVariantId: string // variante do pedido principal (usada nas asserções de estoque)
const cleanup: { products: string[]; categories: string[]; users: string[] } = { products: [], categories: [], users: [] }


// Transação como a gateway REAL devolve: externalRef é NSU gerado por ELA; nosso
// vínculo ao pedido vive em metadata (descoberta de produção)
const gwTransaction = (overrides: Partial<Record<string, unknown>> = {}, orderCodeArg = orderCode) => ({
  ...FASTSOFT_CREATED,
  externalRef: `GW-${suffix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  metadata: JSON.stringify({ orderCode: orderCodeArg }),
  ...overrides,
})

const FASTSOFT_CREATED = {
  id: `tx-${suffix}`,
  amount: 0,
  status: 'WAITING_PAYMENT',
  externalRef: '',
  pix: { qrcode: '00020126EMV-COPIA-E-COLA', url: 'https://pix.example.com/qr/1', expirationDate: new Date(Date.now() + 3600_000).toISOString() },
}

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = /auth_token=([^;]+)/.exec(cookies.find((c) => c.startsWith('auth_token=')) ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

async function createOrderFor(userId: string, withItems = true) {
  const category = await prisma.category.create({ data: { name: `Cat Pay ${suffix}`, slug: `pay-${suffix}-${Math.random().toString(36).slice(2, 8)}` } })
  cleanup.categories.push(category.id)
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      title: 'Produto Pagamento Test',
      slug: `pay-${suffix}-${Math.random().toString(36).slice(2, 8)}`,
      description: 'Produto dos testes de pagamento.',
      price: 15000,
      freeShipping: true,
      status: 'active',
      images: { create: [{ url: 'https://picsum.photos/seed/pay/800/800', alt: 'img', position: 0 }] },
      variants: { create: [{ attributes: { Cor: 'Azul' }, stock: 3 }] },
    },
    include: { variants: true },
  })
  cleanup.products.push(product.id)
  variantId = product.variants[0].id

  const code = `RD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  const order = await prisma.order.create({
    data: {
      code,
      userId,
      status: 'pending',
      subtotal: 15000,
      shippingCost: 0,
      total: 15000,
      shippingAddress: { recipient: USER.name, zipCode: '01310000', street: 'Av Paulista', number: '1', district: 'Bela Vista', city: 'São Paulo', state: 'SP' },
      deliveryOption: { id: 'standard', label: 'Normal', description: 'Chega entre 3 e 6 dias úteis', region: 'Sudeste', price: 0 },
      idempotencyKey: `order-key-${suffix}-${Math.random().toString(36).slice(2)}`,
      items: withItems
        ? {
            create: [
              {
                variantId: product.variants[0].id,
                productSnapshot: { productId: product.id, slug: product.slug, title: product.title, thumbnail: 'https://picsum.photos/seed/pay/800/800', attributes: { Cor: 'Azul' } },
                unitPrice: 15000,
                quantity: 1,
                lineTotal: 15000,
              },
            ],
          }
        : undefined,
    },
  })
  return order
}

beforeAll(async () => {
  const registerA = await request(app).post('/api/v1/auth/register').send(USER)
  auth = authCookieFrom(registerA)
  const registerB = await request(app).post('/api/v1/auth/register').send(OTHER)
  otherAuth = authCookieFrom(registerB)
  cleanup.users = [USER.email, OTHER.email]

  const address = await request(app).post('/api/v1/addresses').set('Cookie', auth).send({
    recipient: USER.name, zipCode: '01310-000', street: 'Av Paulista', number: '1', district: 'Bela Vista', city: 'São Paulo', state: 'SP',
  })
  expect(address.status).toBe(201)

  const user = await prisma.user.findUnique({ where: { email: USER.email } })
  const order = await createOrderFor(user!.id)
  orderCode = order.code
  orderVariantId = (await prisma.orderItem.findFirst({ where: { orderId: order.id } }))!.variantId

  const cancelled = await createOrderFor(user!.id, false)
  await prisma.order.update({ where: { id: cancelled.id }, data: { status: 'cancelled' } })
  cancelledOrderCode = cancelled.code
})

beforeEach(() => {
  createTransaction.mockReset()
  getTransaction.mockReset()
})

afterAll(async () => {
  await prisma.paymentEvent.deleteMany({ where: { payment: { order: { user: { email: { in: cleanup.users } } } } } })
  await prisma.payment.deleteMany({ where: { order: { user: { email: { in: cleanup.users } } } } })
  await prisma.order.deleteMany({ where: { user: { email: { in: cleanup.users } } } })
  await prisma.cart.deleteMany({ where: { user: { email: { in: cleanup.users } } } })
  await prisma.address.deleteMany({ where: { user: { email: { in: cleanup.users } } } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: cleanup.products } } })
  await prisma.productImage.deleteMany({ where: { productId: { in: cleanup.products } } })
  await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } })
  await prisma.category.deleteMany({ where: { id: { in: cleanup.categories } } })
  await prisma.user.deleteMany({ where: { email: { in: cleanup.users } } })
  await prisma.$disconnect()
})

describe('POST /payments — criação', () => {
  it('CPF inválido (dígito verificador) → 400 por campo', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-cpf`)
      .send({ orderCode, method: 'pix', payer: { ...PAYER, document: '111.111.111-11' } })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.document).toBeTruthy()
  })

  it('sem Idempotency-Key → 400; sem sessão → 401', async () => {
    const noKey = await request(app).post('/api/v1/payments').set('Cookie', auth).send({ orderCode, method: 'pix', payer: PAYER })
    expect(noKey.status).toBe(400)
    const anon = await request(app)
      .post('/api/v1/payments')
      .set('Idempotency-Key', `pay-${suffix}-anon`)
      .send({ orderCode, method: 'pix', payer: PAYER })
    expect(anon.status).toBe(401)
  })

  it('pedido de outro usuário → 404; pedido cancelado → 422', async () => {
    const stranger = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', otherAuth)
      .set('Idempotency-Key', `pay-${suffix}-stranger`)
      .send({ orderCode, method: 'pix', payer: PAYER })
    expect(stranger.status).toBe(404)

    const cancelled = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-cancel`)
      .send({ orderCode: cancelledOrderCode, method: 'pix', payer: PAYER })
    expect(cancelled.status).toBe(422)
    expect(cancelled.body.error.code).toBe('INVALID_STATUS')
  })

  it('cria pagamento: 201, amount do banco, payload correto à FastSoft, CPF só mascarado no banco', async () => {
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, amount: 15000, externalRef: orderCode })

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-cria`)
      // valores malignos no body DEVEM ser ignorados
      .send({ orderCode, method: 'pix', payer: PAYER, amount: 1, total: 1 })

    expect(res.status).toBe(201)
    expect(res.body.paymentId).toBeTruthy()
    expect(res.body.orderCode).toBe(orderCode)
    expect(res.body.status).toBe('WAITING_PAYMENT')
    expect(res.body.pix.qrCode).toBe('00020126EMV-COPIA-E-COLA')
    expect(res.body.pix.expiresAt).toBeTruthy()
    expect(createTransaction).toHaveBeenCalledTimes(1)

    const sent = createTransaction.mock.calls[0][0]
    expect(sent.amount).toBe(15000) // total do banco, não do cliente
    // vínculo pedido↔transação vai em metadata (API real rejeita externalRef raiz)
    expect(sent.metadata).toContain(orderCode)
    expect(JSON.parse(sent.metadata)).toEqual({ orderCode })
    expect(sent.currency).toBe('BRL')
    expect(sent.paymentMethod).toBe('PIX')
    // CPF e telefone SÓ com dígitos (validação real do provedor)
    expect(sent.customer.document).toEqual({ number: '52998224725', type: 'CPF' })
    expect(sent.customer.phone).toBe('11987654321')
    expect(sent.shipping.fee).toBe(0)
    expect(sent.items[0]).toMatchObject({ unitPrice: 15000, quantity: 1, tangible: true })

    const dbPayment = await prisma.payment.findUnique({ where: { idempotencyKey: `pay-${suffix}-cria` } })
    expect(dbPayment?.payerDocumentMasked).toBe('***.982.247-**')
    expect(JSON.stringify(dbPayment)).not.toContain('52998224725') // CPF completo nunca persistido
    expect(dbPayment?.requestPayload).toBeNull()
  })

  it('mesma Idempotency-Key devolve o pagamento original sem nova cobrança', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const ownOrder = await createOrderFor(user!.id)
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-dup`, amount: 15000, externalRef: ownOrder.code })
    const first = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-dup`)
      .send({ orderCode: ownOrder.code, method: 'pix', payer: PAYER })
    const second = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-dup`)
      .send({ orderCode: ownOrder.code, method: 'pix', payer: PAYER })
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.paymentId).toBe(first.body.paymentId)
    expect(createTransaction).toHaveBeenCalledTimes(1)
  })

  it('pagamento ativo não expirado é devolvido (nunca dois Pix vivos); expirado gera novo', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const ownOrder = await createOrderFor(user!.id)
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-ativo`, amount: 15000, externalRef: ownOrder.code })
    const first = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-ativo`)
      .send({ orderCode: ownOrder.code, method: 'pix', payer: PAYER })
    const again = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-ativo-2`)
      .send({ orderCode: ownOrder.code, method: 'pix', payer: PAYER })
    expect(again.status).toBe(200)
    expect(again.body.paymentId).toBe(first.body.paymentId)
    expect(createTransaction).toHaveBeenCalledTimes(1)

    // expira o Pix: novo pagamento é criado
    await prisma.payment.update({ where: { id: first.body.paymentId }, data: { pixExpiresAt: new Date(Date.now() - 1000) } })
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-novo`, amount: 15000, externalRef: ownOrder.code })
    const renewed = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-ativo-3`)
      .send({ orderCode: ownOrder.code, method: 'pix', payer: PAYER })
    expect(renewed.status).toBe(201)
    expect(renewed.body.paymentId).not.toBe(first.body.paymentId)
    expect(createTransaction).toHaveBeenCalledTimes(2)
  })
})

describe('Webhook + sincronização', () => {
  let paymentId: string

  beforeAll(async () => {
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, amount: 15000, externalRef: orderCode })
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-webhook`)
      .send({ orderCode, method: 'pix', payer: PAYER })
    paymentId = res.body.paymentId
  })

  const webhookBody = (status = 'PAID', amount = 15000) => ({
    type: 'transaction',
    objectId: FASTSOFT_CREATED.id,
    data: { id: FASTSOFT_CREATED.id, status, amount, externalRef: orderCode, pix: { qrcode: 'x', expirationDate: '2099-01-01T00:00:00Z' }, paidAt: '2026-10-05T00:00:00Z' },
  })

  it('payload malformado → 400; transação desconhecida → 200 ignorado', async () => {
    const bad = await request(app).post('/api/v1/webhooks/fastsoft').send({ foo: 'bar' })
    expect(bad.status).toBe(400)

    getTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: 'tx-desconhecida', amount: 100, status: 'PAID', externalRef: 'RD-XXXX' })
    const unknown = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: 'tx-desconhecida', data: { id: 'tx-desconhecida', status: 'PAID', amount: 100 } })
    expect(unknown.status).toBe(200)
    expect(unknown.body.applied).toBe(false)
  })

  it('evento PAID: consulta a FastSoft, confere valor/ref, marca pago e DECREMENTA estoque', async () => {
    getTransaction.mockResolvedValue(gwTransaction({ amount: 15000, status: 'PAID' }))
    const res = await request(app).post('/api/v1/webhooks/fastsoft').send(webhookBody())
    expect(res.status).toBe(200)

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment?.status).toBe('PAID')
    expect(payment?.paidAt).toBeTruthy()
    const order = await prisma.order.findUnique({ where: { code: orderCode } })
    expect(order?.status).toBe('paid')
    const variant = await prisma.productVariant.findUnique({ where: { id: orderVariantId } })
    expect(variant?.stock).toBe(2) // 3 - 1

    // cancelar pedido pago → 422
    const cancel = await request(app).post(`/api/v1/orders/${orderCode}/cancel`).set('Cookie', auth)
    expect(cancel.status).toBe(422)
  })

  it('evento duplicado (mesmo payload) é ignorado sem reprocessar', async () => {
    const stockBefore = (await prisma.productVariant.findUnique({ where: { id: variantId } }))!.stock
    const res = await request(app).post('/api/v1/webhooks/fastsoft').send(webhookBody())
    expect(res.status).toBe(200)
    expect(res.body.reason ?? '').toContain('duplicate')
    const stockAfter = (await prisma.productVariant.findUnique({ where: { id: variantId } }))!.stock
    expect(stockAfter).toBe(stockBefore)
    expect(getTransaction).not.toHaveBeenCalled() // dedupe vem ANTES da consulta ao provedor
  })

  it('nunca regride: PAID não volta para WAITING_PAYMENT', async () => {
    getTransaction.mockResolvedValue(gwTransaction({ amount: 15000, status: 'WAITING_PAYMENT' }))
    // webhook de regressão chega com payload divergente do provedor? consulta manda: WAITING após PAID → guarda bloqueia
    const res = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send(webhookBody('WAITING_PAYMENT'))
    expect(res.status).toBe(200)
    expect((await prisma.payment.findUnique({ where: { id: paymentId } }))?.status).toBe('PAID')
  })

  it('payload com valor divergente da consulta é rejeitado (não aplica)', async () => {
    // segundo pedido, pago em dinheiro... cria outro pedido pending com pagamento
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const order2 = await createOrderFor(user!.id)
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-b`, amount: 15000, externalRef: order2.code })
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-divergente`)
      .send({ orderCode: order2.code, method: 'pix', payer: PAYER })

    getTransaction.mockResolvedValue(gwTransaction({ id: `tx-${suffix}-b`, amount: 999, status: 'PAID' }, order2.code))
    const res = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-${suffix}-b`, data: { id: `tx-${suffix}-b`, status: 'PAID', amount: 15000, externalRef: order2.code } })
    expect(res.status).toBe(200)
    expect((await prisma.payment.findUnique({ where: { id: pay.body.paymentId } }))?.status).toBe('WAITING_PAYMENT')
    expect((await prisma.order.findUnique({ where: { id: order2.id } }))?.status).toBe('pending')
  })

  it('REGRESSÃO: metadata divergente → PAID não aplicado mesmo com valor batendo', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const orderR = await createOrderFor(user!.id)
    createTransaction.mockResolvedValue(gwTransaction({ id: `tx-${suffix}-r`, amount: 15000 }, orderR.code))
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-regmeta`)
      .send({ orderCode: orderR.code, method: 'pix', payer: PAYER })

    // consulta devolve PAID com amount correto, mas metadata aponta para OUTRO pedido
    getTransaction.mockResolvedValue(gwTransaction({ id: `tx-${suffix}-r`, amount: 15000, status: 'PAID' }, 'RD-OUTRO Pedido'))
    await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-${suffix}-r`, data: { id: `tx-${suffix}-r`, status: 'PAID', amount: 15000 } })

    expect((await prisma.payment.findUnique({ where: { id: pay.body.paymentId } }))?.status).toBe('WAITING_PAYMENT')
    expect((await prisma.order.findUnique({ where: { id: orderR.id } }))?.status).toBe('pending')
  })

  it('estoque insuficiente na confirmação: pedido fica paid com needsReview (pagamento não perdido)', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const order3 = await createOrderFor(user!.id)
    const item = await prisma.orderItem.findFirst({ where: { orderId: order3.id } })
    // zera o estoque da variante após o pedido (corrida entre pedido e pagamento)
    await prisma.productVariant.update({ where: { id: item!.variantId }, data: { stock: 0 } })

    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-c`, amount: 15000, externalRef: order3.code })
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-semestoque`)
      .send({ orderCode: order3.code, method: 'pix', payer: PAYER })

    getTransaction.mockResolvedValue(gwTransaction({ id: `tx-${suffix}-c`, amount: 15000, status: 'PAID' }, order3.code))
    await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-${suffix}-c`, data: { id: `tx-${suffix}-c`, status: 'PAID', amount: 15000, externalRef: order3.code } })

    const order = await prisma.order.findUnique({ where: { id: order3.id } })
    expect(order?.status).toBe('paid')
    expect(order?.needsReview).toBe(true)
    expect((await prisma.payment.findUnique({ where: { id: pay.body.paymentId } }))?.status).toBe('PAID')
    expect((await prisma.productVariant.findUnique({ where: { id: item!.variantId } }))!.stock).toBe(0)
  })

  it('consulta à FastSoft falhando → 5xx para a FastSoft reenviar', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const order4 = await createOrderFor(user!.id)
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-d`, amount: 15000, externalRef: order4.code })
    await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-falha`)
      .send({ orderCode: order4.code, method: 'pix', payer: PAYER })

    getTransaction.mockRejectedValue(new fastsoft.FastSoftError('FastSoft respondeu 500', 500))
    const res = await request(app)
      .post('/api/v1/webhooks/fastsoft')
      .send({ type: 'transaction', objectId: `tx-${suffix}-d`, data: { id: `tx-${suffix}-d`, status: 'PAID', amount: 15000, externalRef: order4.code } })
    expect(res.status).toBe(502)
  })
})

describe('GET /payments/:id', () => {
  it('pagamento de outro usuário → 404', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER.email } })
    const order5 = await createOrderFor(user!.id)
    createTransaction.mockResolvedValue({ ...FASTSOFT_CREATED, id: `tx-${suffix}-e`, amount: 15000, externalRef: order5.code })
    const pay = await request(app)
      .post('/api/v1/payments')
      .set('Cookie', auth)
      .set('Idempotency-Key', `pay-${suffix}-get`)
      .send({ orderCode: order5.code, method: 'pix', payer: PAYER })

    const stranger = await request(app).get(`/api/v1/payments/${pay.body.paymentId}`).set('Cookie', otherAuth)
    expect(stranger.status).toBe(404)

    const owner = await request(app).get(`/api/v1/payments/${pay.body.paymentId}`).set('Cookie', auth)
    expect(owner.status).toBe(200)
    expect(owner.body.orderCode).toBe(order5.code)
    expect(owner.body.pix.qrCode).toBe('00020126EMV-COPIA-E-COLA')
  })
})
