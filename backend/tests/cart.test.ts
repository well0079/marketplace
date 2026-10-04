import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

let variantId: string
let otherVariantId: string
let categoryTestId: string
let productTestId: string
const testSlug = `cart-test-produto-${Date.now()}`

function cartCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  const match = /cart_token=([^;]+)/.exec(cookie ?? '')
  if (!match) throw new Error('cookie cart_token não foi emitido')
  return `cart_token=${match[1]}`
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: 'Categoria Cart Test', slug: `cart-test-cat-${Date.now()}` },
  })
  categoryTestId = category.id
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      title: 'Produto Cart Test',
      slug: testSlug,
      description: 'Produto criado pelos testes de carrinho.',
      brand: 'TestBrand',
      price: 10000,
      status: 'active',
      variants: {
        create: [
          { attributes: { Cor: 'Azul' }, stock: 10 },
          { attributes: { Cor: 'Vermelha' }, priceOverride: 15000, stock: 2 },
        ],
      },
    },
    include: { variants: true },
  })
  productTestId = product.id
  variantId = product.variants[0].id
  otherVariantId = product.variants[1].id
})

afterAll(async () => {
  // CartItem.variantId é RESTRICT: limpar carrinhos antes do produto de teste
  await prisma.cartItem.deleteMany({ where: { variant: { productId: productTestId } } })
  await prisma.product.deleteMany({ where: { id: productTestId } })
  await prisma.category.deleteMany({ where: { id: categoryTestId } })
  await prisma.$disconnect()
})

describe('Cart API', () => {
  it('GET /cart sem cookie retorna carrinho vazio', async () => {
    const res = await request(app).get('/api/v1/cart')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], subtotal: 0, totalItems: 0 })
  })

  it('POST /cart/items cria carrinho, emite cookie httpOnly e calcula preço no banco', async () => {
    const res = await request(app).post('/api/v1/cart/items').send({ variantId, quantity: 2 })
    expect(res.status).toBe(201)
    const cookie = cartCookieFrom(res)
    expect(cookie).toMatch(/cart_token=[0-9a-f-]{36}/)
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      variantId,
      quantity: 2,
      unitPrice: 10000,
      lineTotal: 20000,
      stock: 10,
      product: { slug: testSlug, variantAttributes: { Cor: 'Azul' } },
    })
    expect(res.body.subtotal).toBe(20000)
    expect(res.body.totalItems).toBe(2)

    const read = await request(app).get('/api/v1/cart').set('Cookie', cookie)
    expect(read.body.items).toHaveLength(1)
  })

  it('POST da mesma variante soma quantidade em vez de duplicar', async () => {
    const first = await request(app).post('/api/v1/cart/items').send({ variantId, quantity: 2 })
    const cookie = cartCookieFrom(first)
    const second = await request(app).post('/api/v1/cart/items').set('Cookie', cookie).send({ variantId, quantity: 1 })
    expect(second.status).toBe(201)
    expect(second.body.items).toHaveLength(1)
    expect(second.body.items[0].quantity).toBe(3)
    expect(second.body.totalItems).toBe(3)
  })

  it('POST acima do estoque retorna 409 INSUFFICIENT_STOCK', async () => {
    const res = await request(app).post('/api/v1/cart/items').send({ variantId, quantity: 20 })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
  })

  it('POST com variantId inexistente retorna 404', async () => {
    const res = await request(app).post('/api/v1/cart/items').send({ variantId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('POST com quantidade inválida retorna 400', async () => {
    const res = await request(app).post('/api/v1/cart/items').send({ variantId, quantity: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
  })

  it('PATCH atualiza quantidade e recalcula subtotal no servidor (priceOverride)', async () => {
    const first = await request(app).post('/api/v1/cart/items').send({ variantId: otherVariantId, quantity: 1 })
    const cookie = cartCookieFrom(first)
    const itemId = first.body.items.find((i: { variantId: string }) => i.variantId === otherVariantId).id

    const res = await request(app).patch(`/api/v1/cart/items/${itemId}`).set('Cookie', cookie).send({ quantity: 2 })
    expect(res.status).toBe(200)
    const item = res.body.items.find((i: { variantId: string }) => i.variantId === otherVariantId)
    expect(item).toMatchObject({ quantity: 2, unitPrice: 15000, lineTotal: 30000 })
    // cada teste cria um carrinho novo: subtotal = apenas vermelha 2×15000 (priceOverride do banco)
    expect(res.body.subtotal).toBe(30000)
  })

  it('PATCH acima do estoque retorna 409', async () => {
    const created = await request(app).post('/api/v1/cart/items').send({ variantId: otherVariantId, quantity: 1 })
    const cookie = cartCookieFrom(created)
    const itemId = created.body.items.find((i: { variantId: string }) => i.variantId === otherVariantId).id
    const res = await request(app).patch(`/api/v1/cart/items/${itemId}`).set('Cookie', cookie).send({ quantity: 5 })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
  })

  it('PATCH/DELETE de item de outro carrinho retorna 404', async () => {
    const owner = await request(app).post('/api/v1/cart/items').send({ variantId, quantity: 1 })
    const ownerCookie = cartCookieFrom(owner)
    const itemId = owner.body.items[0].id

    const intruder = await request(app).post('/api/v1/cart/items').send({ variantId: otherVariantId, quantity: 1 })
    const intruderCookie = cartCookieFrom(intruder)

    const patched = await request(app).patch(`/api/v1/cart/items/${itemId}`).set('Cookie', intruderCookie).send({ quantity: 1 })
    expect(patched.status).toBe(404)

    const deleted = await request(app).delete(`/api/v1/cart/items/${itemId}`).set('Cookie', intruderCookie)
    expect(deleted.status).toBe(404)
    void ownerCookie
  })

  it('DELETE remove o item e recalcula o carrinho', async () => {
    const created = await request(app).post('/api/v1/cart/items').send({ variantId, quantity: 1 })
    const cookie = cartCookieFrom(created)
    const itemId = created.body.items.find((i: { variantId: string }) => i.variantId === variantId).id

    const res = await request(app).delete(`/api/v1/cart/items/${itemId}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.items.find((i: { id: string }) => i.id === itemId)).toBeUndefined()
  })

  it('PATCH/DELETE sem carrinho retornam 404', async () => {
    const patched = await request(app).patch('/api/v1/cart/items/qualquer').send({ quantity: 1 })
    expect(patched.status).toBe(404)
    const deleted = await request(app).delete('/api/v1/cart/items/qualquer')
    expect(deleted.status).toBe(404)
  })
})
