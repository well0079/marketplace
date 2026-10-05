import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

// Fixture própria: o tema ingressos não semeia mais produtos físicos, então o
// teste de catálogo cria os seus dados (categoria raiz+filha e 3 produtos)
const suffix = Date.now()
let categoryId: string
let childCategoryId: string
const createdProductIds: string[] = []
const SLUG_A = `cat-test-produto-a-${suffix}`
const SLUG_B = `cat-test-produto-b-${suffix}`
const SLUG_C = `cat-test-produto-c-${suffix}`

beforeAll(async () => {
  const category = await prisma.category.create({ data: { name: `Categoria Cat Test ${suffix}`, slug: `cat-test-${suffix}` } })
  categoryId = category.id
  const child = await prisma.category.create({ data: { name: 'Filha', slug: `cat-test-filha-${suffix}`, parentId: category.id } })
  childCategoryId = child.id
  const createProduct = async (slug: string, name: string, price: number, variants: number, images: number) => {
    const product = await prisma.product.create({
      data: {
        categoryId: childCategoryId,
        title: name,
        slug,
        description: 'Produto criado pelos testes de catálogo.',
        brand: 'TestBrand',
        price,
        status: 'active',
        images: { create: Array.from({ length: images }, (_, i) => ({ url: `https://picsum.photos/seed/${slug}-${i}/800/800`, alt: name, position: i })) },
        variants: { create: Array.from({ length: variants }, (_, i) => ({ attributes: { Cor: `Cor ${i + 1}` }, stock: 5 })) },
      },
    })
    createdProductIds.push(product.id)
  }
  await createProduct(SLUG_A, 'Produto Cat Test A', 10000, 2, 4)
  await createProduct(SLUG_B, 'Produto Cat Test B', 5000, 1, 2)
  await createProduct(SLUG_C, 'Produto Cat Test C', 20000, 1, 2)
})

afterAll(async () => {
  // OrderItem tem FK para variante: limpar antes das variantes
  await prisma.orderItem.deleteMany({ where: { variant: { productId: { in: createdProductIds } } } })
  await prisma.cartItem.deleteMany({ where: { variant: { productId: { in: createdProductIds } } } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: createdProductIds } } })
  await prisma.productImage.deleteMany({ where: { productId: { in: createdProductIds } } })
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } })
  await prisma.category.deleteMany({ where: { id: { in: [categoryId, childCategoryId] } } })
  await prisma.$disconnect()
})

describe('GET /api/v1/health', () => {
  it('retorna ok com banco no ar', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /api/v1/products', () => {
  it('lista produtos com paginação (fixture própria)', async () => {
    const res = await request(app).get('/api/v1/products?q=Cat Test&limit=5')
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(3)
    expect(res.body.total).toBe(3)
  })

  it('filtra por q', async () => {
    const res = await request(app).get('/api/v1/products?q=Produto Cat Test A')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0].slug).toBe(SLUG_A)
  })

  it('ordena por preço crescente', async () => {
    const res = await request(app).get('/api/v1/products?q=Cat Test&sort=price_asc')
    const prices = res.body.items.map((i: { price: number }) => i.price)
    expect(prices).toEqual([5000, 10000, 20000])
  })
})

describe('GET /api/v1/products/:slug', () => {
  it('retorna detalhe com imagens, variantes e breadcrumb', async () => {
    const res = await request(app).get(`/api/v1/products/${SLUG_A}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ brand: 'TestBrand', price: 10000 })
    expect(res.body.images).toHaveLength(4)
    expect(res.body.variants).toHaveLength(2)
    expect(res.body.category.breadcrumb.length).toBeGreaterThanOrEqual(2)
  })

  it('retorna 404 para slug inexistente', async () => {
    const res = await request(app).get('/api/v1/products/nao-existe-123')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /api/v1/categories', () => {
  it('retorna árvore de categorias com filhos', async () => {
    const res = await request(app).get('/api/v1/categories')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
    const mine = res.body.find((c: { slug: string }) => c.slug === `cat-test-${suffix}`)
    expect(mine?.children).toBeDefined()
    expect(mine.children.length).toBe(1)
  })
})
