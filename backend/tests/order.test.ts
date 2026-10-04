import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { shippingQuote } from '../src/services/shipping.service'

const suffix = Date.now()

const USER_A = { name: 'Ana Pedido', email: `ana.pedido.${suffix}@teste.com`, password: 'senha-segura-123' }
const USER_B = { name: 'Bruno Pedido', email: `bruno.pedido.${suffix}@teste.com`, password: 'senha-segura-123' }

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const match = /auth_token=([^;]+)/.exec(cookies.find((c) => c.startsWith('auth_token=')) ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

let authA: string
let authB: string
let addressAId: string
let addressBId: string
let freeVariantId: string
let paidVariantId: string
let cartAToken: string
const cleanupProductIds: string[] = []
const cleanupCategoryIds: string[] = []
const cleanupUserEmails = [USER_A.email, USER_B.email]
let orderCode: string

const ADDRESS_A = {
  recipient: 'Ana Pedido',
  zipCode: '01310-000',
  street: 'Avenida Paulista',
  number: '1000',
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
}

async function createProduct(title: string, price: number, freeShipping: boolean, stock: number) {
  const category = await prisma.category.create({
    data: { name: `Categoria Pedido ${suffix} ${title}`, slug: `pedido-${suffix}-${title.toLowerCase()}` },
  })
  cleanupCategoryIds.push(category.id)
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      title,
      slug: `pedido-${suffix}-${title.toLowerCase()}`,
      description: 'Produto dos testes de pedido.',
      price,
      freeShipping,
      status: 'active',
      images: {
        create: [{ url: `https://picsum.photos/seed/pedido-${title.toLowerCase()}/800/800`, alt: title, position: 0 }],
      },
      variants: { create: [{ attributes: { Cor: 'Azul' }, stock }] },
    },
    include: { variants: true },
  })
  cleanupProductIds.push(product.id)
  return product.variants[0]
}

// Carrinho direto no banco (token conhecido vira cookie nos requests)
async function createCartForUser(userId: string, items: { variantId: string; quantity: number }[]) {
  const cart = await prisma.cart.create({
    data: {
      token: `cart-pedido-${suffix}-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      items: { create: items },
    },
  })
  return cart
}

beforeAll(async () => {
  const registerA = await request(app).post('/api/v1/auth/register').send(USER_A)
  authA = authCookieFrom(registerA)
  const registerB = await request(app).post('/api/v1/auth/register').send(USER_B)
  authB = authCookieFrom(registerB)

  const address = await request(app).post('/api/v1/addresses').set('Cookie', authA).send(ADDRESS_A)
  addressAId = address.body.id
  const addressB = await request(app).post('/api/v1/addresses').set('Cookie', authB).send({
    ...ADDRESS_A,
    recipient: 'Bruno Pedido',
    zipCode: '22250-040',
    city: 'Rio de Janeiro',
    state: 'RJ',
  })
  addressBId = addressB.body.id

  freeVariantId = (await createProduct('Item Frete Grátis', 10000, true, 5)).id
  paidVariantId = (await createProduct('Item Frete Pago', 20000, false, 5)).id
})

afterAll(async () => {
  // CartItem.variantId e OrderItem.variantId são RESTRICT: limpar antes dos produtos
  await prisma.cartItem.deleteMany({ where: { variant: { productId: { in: cleanupProductIds } } } })
  await prisma.orderItem.deleteMany({ where: { variantId: { in: [freeVariantId, paidVariantId] } } })
  await prisma.cart.deleteMany({ where: { user: { email: { in: cleanupUserEmails } } } })
  await prisma.order.deleteMany({ where: { user: { email: { in: cleanupUserEmails } } } })
  await prisma.address.deleteMany({ where: { user: { email: { in: cleanupUserEmails } } } })
  await prisma.product.deleteMany({ where: { id: { in: cleanupProductIds } } })
  await prisma.category.deleteMany({ where: { id: { in: cleanupCategoryIds } } })
  await prisma.user.deleteMany({ where: { email: { in: cleanupUserEmails } } })
  await prisma.$disconnect()
})

describe('POST /orders — criação', () => {
  it('Idempotency-Key ausente → 400', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authA}; cart_token=inexistente`)
      .send({ addressId: addressAId, deliveryOption: 'standard' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })

  it('sem sessão → 401', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Idempotency-Key', `key-${suffix}-anon`)
      .send({ addressId: addressAId, deliveryOption: 'standard' })
    expect(res.status).toBe(401)
  })

  it('cria pedido com totais do servidor, snapshot e carrinho converted', async () => {
    const cart = await createCartForUser((await prisma.user.findUnique({ where: { email: USER_A.email } }))!.id, [
      { variantId: freeVariantId, quantity: 2 },
      { variantId: paidVariantId, quantity: 1 },
    ])
    cartAToken = cart.token

    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authA}; cart_token=${cartAToken}`)
      .set('Idempotency-Key', `key-${suffix}-cria`)
      // campos de preço enviados pelo cliente DEVEM ser ignorados
      .send({ addressId: addressAId, deliveryOption: 'standard', subtotal: 1, shippingCost: 1, total: 1 })

    expect(res.status).toBe(201)
    expect(res.body.code).toMatch(/^RD-[A-Z0-9]{8}$/)
    expect(res.body.status).toBe('pending')
    expect(res.body.paymentPending).toBe(true)
    // subtotal = 2×10000 + 20000 = 40000; frete standard: carrinho misto → pago (1990, Sudeste)
    expect(res.body.subtotal).toBe(40000)
    expect(res.body.shippingCost).toBe(shippingQuote('01310000', [{ freeShipping: true }, { freeShipping: false }]).options[0].price)
    expect(res.body.total).toBe(res.body.subtotal + res.body.shippingCost)
    // snapshot do endereço e da entrega
    expect(res.body.shippingAddress).toMatchObject({ recipient: 'Ana Pedido', zipCode: '01310000', city: 'São Paulo' })
    expect(res.body.deliveryOption).toMatchObject({ id: 'standard', region: 'Sudeste' })
    // snapshot dos itens
    expect(res.body.items).toHaveLength(2)
    expect(res.body.items[0]).toMatchObject({
      title: 'Item Frete Grátis',
      unitPrice: 10000,
      quantity: 2,
      lineTotal: 20000,
      attributes: { Cor: 'Azul' },
    })
    orderCode = res.body.code

    // carrinho virou converted e perdeu os itens
    const converted = await prisma.cart.findUnique({ where: { token: cartAToken }, include: { items: true } })
    expect(converted?.status).toBe('converted')
    expect(converted?.items).toHaveLength(0)

    // pedido gravado com o userId certo
    const dbOrder = await prisma.order.findUnique({ where: { code: orderCode }, include: { items: true } })
    expect(dbOrder?.userId).toBe((await prisma.user.findUnique({ where: { email: USER_A.email } }))!.id)
    expect(dbOrder?.items).toHaveLength(2)
  })

  it('mesma Idempotency-Key + mesmo usuário → devolve o pedido original (200, sem duplicar)', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authA}; cart_token=${cartAToken}`)
      .set('Idempotency-Key', `key-${suffix}-cria`)
      .send({ addressId: addressAId, deliveryOption: 'express' }) // tentativa com body diferente
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(orderCode)
    // frete NÃO muda para express: é o pedido original
    expect(res.body.deliveryOption.id).toBe('standard')

    const user = await prisma.user.findUnique({ where: { email: USER_A.email } })
    const count = await prisma.order.count({ where: { userId: user!.id } })
    expect(count).toBe(1)
  })

  it('Idempotency-Key repetida de OUTRO usuário → 409', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authB)
      .set('Idempotency-Key', `key-${suffix}-cria`)
      .send({ addressId: addressAId, deliveryOption: 'standard' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('carrinho vazio/inexistente → 422 CART_EMPTY', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', authB)
      .set('Idempotency-Key', `key-${suffix}-vazio`)
      .send({ addressId: addressBId, deliveryOption: 'standard' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('CART_EMPTY')
  })

  it('endereço de outro usuário → 404', async () => {
    const cart = await createCartForUser((await prisma.user.findUnique({ where: { email: USER_B.email } }))!.id, [
      { variantId: freeVariantId, quantity: 1 },
    ])
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authB}; cart_token=${cart.token}`)
      .set('Idempotency-Key', `key-${suffix}-alheio`)
      .send({ addressId: addressAId, deliveryOption: 'standard' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('estoque insuficiente → 422 STOCK_INSUFFICIENT indicando o item', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER_B.email } })
    const cart = await createCartForUser(user!.id, [{ variantId: paidVariantId, quantity: 50 }])
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authB}; cart_token=${cart.token}`)
      .set('Idempotency-Key', `key-${suffix}-estoque`)
      .send({ addressId: addressBId, deliveryOption: 'standard' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('STOCK_INSUFFICIENT')
    expect(JSON.stringify(res.body.error.fields)).toContain('apenas 5')
  })

  it('deliveryOption inválida → 400', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER_B.email } })
    const cart = await createCartForUser(user!.id, [{ variantId: freeVariantId, quantity: 1 }])
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authB}; cart_token=${cart.token}`)
      .set('Idempotency-Key', `key-${suffix}-opt`)
      .send({ addressId: addressBId, deliveryOption: 'turbo' })
    expect(res.status).toBe(400)
  })

  it('frete grátis do pedido: carrinho 100% frete grátis + standard → shippingCost 0', async () => {
    const user = await prisma.user.findUnique({ where: { email: USER_B.email } })
    const cart = await createCartForUser(user!.id, [{ variantId: freeVariantId, quantity: 1 }])
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Cookie', `${authB}; cart_token=${cart.token}`)
      .set('Idempotency-Key', `key-${suffix}-gratis`)
      .send({ addressId: addressBId, deliveryOption: 'standard' })
    expect(res.status).toBe(201)
    expect(res.body.shippingCost).toBe(0)
    expect(res.body.total).toBe(res.body.subtotal)
  })

  it('snapshot permanece igual após mudar o preço do produto', async () => {
    const before = await request(app).get(`/api/v1/orders/${orderCode}`).set('Cookie', authA)
    const variant = await prisma.productVariant.findUnique({ where: { id: freeVariantId }, include: { product: true } })
    const originalPrice = variant!.product.price
    await prisma.product.update({ where: { id: variant!.productId }, data: { price: originalPrice + 5000 } })

    const after = await request(app).get(`/api/v1/orders/${orderCode}`).set('Cookie', authA)
    expect(after.body.items[0].unitPrice).toBe(before.body.items[0].unitPrice)
    expect(after.body.total).toBe(before.body.total)

    // restaura para não sujar outros testes
    await prisma.product.update({ where: { id: variant!.productId }, data: { price: originalPrice } })
  })
})

describe('GET /orders — listagem', () => {
  it('só pedidos do próprio usuário, mais recentes primeiro, com paginação', async () => {
    const resA = await request(app).get('/api/v1/orders').set('Cookie', authA)
    expect(resA.status).toBe(200)
    expect(resA.body.total).toBe(1)
    expect(resA.body.items[0]).toMatchObject({ code: orderCode, status: 'pending' })
    expect(typeof resA.body.items[0].firstItemImage).toBe('string')
    expect(resA.body.items[0].itemsCount).toBe(3)

    const resB = await request(app).get('/api/v1/orders').set('Cookie', authB)
    expect(resB.body.total).toBe(1)
    expect(resB.body.items[0].code).not.toBe(orderCode)

    const paginated = await request(app).get('/api/v1/orders?page=1&limit=1').set('Cookie', authB)
    expect(paginated.body.items).toHaveLength(1)
    expect(paginated.body.totalPages).toBe(1)
  })

  it('sem sessão → 401', async () => {
    const res = await request(app).get('/api/v1/orders')
    expect(res.status).toBe(401)
  })
})

describe('GET /orders/:code — detalhe', () => {
  it('dono vê o pedido completo; outro usuário recebe 404', async () => {
    const owner = await request(app).get(`/api/v1/orders/${orderCode}`).set('Cookie', authA)
    expect(owner.status).toBe(200)
    expect(owner.body.items).toHaveLength(2)
    expect(owner.body.deliveryOption).toMatchObject({ id: 'standard' })

    const other = await request(app).get(`/api/v1/orders/${orderCode}`).set('Cookie', authB)
    expect(other.status).toBe(404)

    const missing = await request(app).get('/api/v1/orders/RD-XXXXXXXX').set('Cookie', authA)
    expect(missing.status).toBe(404)
  })
})

describe('POST /orders/:code/cancel — cancelamento', () => {
  it('outro usuário não cancela (404)', async () => {
    const res = await request(app).post(`/api/v1/orders/${orderCode}/cancel`).set('Cookie', authB)
    expect(res.status).toBe(404)
  })

  it('dono cancela pedido pending; cancelar de novo → 422', async () => {
    const res = await request(app).post(`/api/v1/orders/${orderCode}/cancel`).set('Cookie', authA)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    expect(res.body.paymentPending).toBe(false)
    expect(res.body.cancelledAt).toBeTruthy()

    const again = await request(app).post(`/api/v1/orders/${orderCode}/cancel`).set('Cookie', authA)
    expect(again.status).toBe(422)
    expect(again.body.error.code).toBe('INVALID_STATUS')
  })
})
