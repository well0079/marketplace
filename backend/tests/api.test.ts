import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'

const WAP_SLUG = 'aspirador-de-po-e-agua-wap-gtw-10-10l-amarelo-e-preto-127v'

describe('GET /api/v1/health', () => {
  it('retorna ok com banco no ar', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('GET /api/v1/products', () => {
  it('lista produtos com paginação', async () => {
    const res = await request(app).get('/api/v1/products?limit=5')
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(5)
    expect(res.body.total).toBeGreaterThanOrEqual(20)
  })

  it('filtra por q', async () => {
    const res = await request(app).get('/api/v1/products?q=aspirador')
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(3)
  })

  it('ordena por preço crescente', async () => {
    const res = await request(app).get('/api/v1/products?sort=price_asc&limit=10')
    const prices = res.body.items.map((i: { price: number }) => i.price)
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b))
  })
})

describe('GET /api/v1/products/:slug', () => {
  it('retorna detalhe com imagens, variantes e breadcrumb', async () => {
    const res = await request(app).get(`/api/v1/products/${WAP_SLUG}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ brand: 'Wap', price: 25990 })
    expect(res.body.images.length).toBeGreaterThanOrEqual(4)
    expect(res.body.variants.length).toBe(2)
    expect(res.body.category.breadcrumb.length).toBeGreaterThanOrEqual(2)
  })

  it('retorna 404 para slug inexistente', async () => {
    const res = await request(app).get('/api/v1/products/nao-existe-123')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /api/v1/categories', () => {
  it('retorna árvore de categorias', async () => {
    const res = await request(app).get('/api/v1/categories')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(5)
    expect(res.body[0].children).toBeDefined()
  })
})
