import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

let freeVariantId: string
let paidVariantId: string
const suffix = Date.now()

function cartCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  const match = /cart_token=([^;]+)/.exec(cookie ?? '')
  if (!match) throw new Error('cookie cart_token não foi emitido')
  return `cart_token=${match[1]}`
}

async function createProduct(freeShipping: boolean) {
  const category = await prisma.category.create({
    data: { name: `Categoria Frete ${suffix} ${freeShipping}`, slug: `frete-${suffix}-${freeShipping ? 'free' : 'paid'}` },
  })
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      title: `Produto Frete Test ${freeShipping ? 'Grátis' : 'Pago'}`,
      slug: `frete-test-${suffix}-${freeShipping ? 'free' : 'paid'}`,
      description: 'Produto dos testes de frete.',
      price: 10000,
      freeShipping,
      status: 'active',
      variants: { create: [{ attributes: {}, stock: 5 }] },
    },
    include: { variants: true },
  })
  return { productId: product.id, categoryId: category.id, variantId: product.variants[0].id }
}

let freeRefs: { productId: string; categoryId: string; variantId: string }
let paidRefs: { productId: string; categoryId: string; variantId: string }

beforeAll(async () => {
  freeRefs = await createProduct(true)
  paidRefs = await createProduct(false)
  freeVariantId = freeRefs.variantId
  paidVariantId = paidRefs.variantId
})

afterAll(async () => {
  // CartItem.variantId é RESTRICT: limpar itens antes dos produtos de teste (carrinhos vazios sobram, como no cart.test.ts)
  await prisma.cartItem.deleteMany({ where: { variantId: { in: [freeVariantId, paidVariantId] } } })
  await prisma.product.deleteMany({ where: { id: { in: [freeRefs.productId, paidRefs.productId] } } })
  await prisma.category.deleteMany({ where: { id: { in: [freeRefs.categoryId, paidRefs.categoryId] } } })
  await prisma.$disconnect()
})

describe('Shipping API', () => {
  it('CEP inválido retorna 400 com field', async () => {
    const res = await request(app).get('/api/v1/shipping/options?zipCode=abc')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fields.zipCode).toBeTruthy()
  })

  it('sem carrinho: Normal pago e Expressa nunca grátis (região pelo prefixo do CEP)', async () => {
    const sp = await request(app).get('/api/v1/shipping/options?zipCode=01310-000')
    expect(sp.status).toBe(200)
    expect(sp.body.zipCode).toBe('01310000')
    expect(sp.body.region).toBe('Sudeste')
    expect(sp.body.options).toEqual([
      expect.objectContaining({ id: 'standard', price: 1990 }),
      expect.objectContaining({ id: 'express', price: 3990 }),
    ])

    const norte = await request(app).get('/api/v1/shipping/options?zipCode=60000000')
    expect(norte.body.region).toBe('Norte e Nordeste')
    expect(norte.body.options[0]).toMatchObject({ id: 'standard', price: 2990 })
    expect(norte.body.options[1]).toMatchObject({ id: 'express', price: 5990 })

    const sul = await request(app).get('/api/v1/shipping/options?zipCode=90000000')
    expect(sul.body.region).toBe('Sul e Centro-Oeste')
    expect(sul.body.options[0].price).toBe(2490)
  })

  it('carrinho só com itens de frete grátis: Normal sai de graça, Expressa continua paga', async () => {
    const add = await request(app).post('/api/v1/cart/items').send({ variantId: freeVariantId, quantity: 1 })
    expect(add.status).toBe(201)
    const cookie = cartCookieFrom(add)

    const res = await request(app).get('/api/v1/shipping/options?zipCode=01310000').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.options).toEqual([
      expect.objectContaining({ id: 'standard', price: 0 }),
      expect.objectContaining({ id: 'express', price: 3990 }),
    ])
    expect(res.body.options[0].description).toMatch(/dias úteis/)
  })

  it('carrinho misto (um item sem frete grátis): Normal volta a ser pago', async () => {
    // novo carrinho com um item pago e um grátis
    const add = await request(app).post('/api/v1/cart/items').send({ variantId: paidVariantId, quantity: 1 })
    const cookie = cartCookieFrom(add)
    await request(app).post('/api/v1/cart/items').set('Cookie', cookie).send({ variantId: freeVariantId, quantity: 2 })

    const res = await request(app).get('/api/v1/shipping/options?zipCode=01310000').set('Cookie', cookie)
    expect(res.body.options[0]).toMatchObject({ id: 'standard', price: 1990 })
    expect(res.body.options[1]).toMatchObject({ id: 'express', price: 3990 })
  })
})
