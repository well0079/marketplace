import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

const suffix = Date.now()
let categoryTestId: string
let productTestId: string
let variantAId: string
let variantBId: string

const USER = { name: 'Maria Teste', email: `maria.${suffix}@teste.com`, password: 'senha-segura-123' }

function cookieFrom(res: request.Response, name: string): string {
  const setCookie = res.headers['set-cookie']
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie
  const match = new RegExp(`${name}=([^;]+)`).exec(cookie ?? '')
  if (!match) throw new Error(`cookie ${name} não foi emitido`)
  return `${name}=${match[1]}`
}

function setCookieArray(res: request.Response): string[] {
  const value = res.headers['set-cookie']
  return Array.isArray(value) ? value : [value as string]
}

function extractToken(cookieHeader: string): string {
  const match = /=([^;]+)/.exec(cookieHeader)
  if (!match) throw new Error('token ausente')
  return match[1]
}

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: 'Categoria Auth Test', slug: `auth-test-cat-${suffix}` },
  })
  categoryTestId = category.id
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      title: 'Produto Auth Test',
      slug: `auth-test-produto-${suffix}`,
      description: 'Produto dos testes de autenticação.',
      price: 20000,
      status: 'active',
      variants: {
        create: [
          { attributes: { Tamanho: 'P' }, stock: 3 },
          { attributes: { Tamanho: 'M' }, stock: 5 },
        ],
      },
    },
    include: { variants: true },
  })
  productTestId = product.id
  variantAId = product.variants[0].id
  variantBId = product.variants[1].id
})

afterAll(async () => {
  await prisma.cartItem.deleteMany({ where: { variant: { productId: productTestId } } })
  await prisma.cart.deleteMany({ where: { user: { email: USER.email } } })
  await prisma.user.deleteMany({ where: { email: USER.email } })
  await prisma.product.deleteMany({ where: { id: productTestId } })
  await prisma.category.deleteMany({ where: { id: categoryTestId } })
  await prisma.$disconnect()
})

describe('Auth API', () => {
  it('cadastro válido: 201, usuário público e cookie de sessão httpOnly', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(USER)
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ id: expect.any(String), name: USER.name, email: USER.email })
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
    expect(JSON.stringify(res.body)).not.toContain('scrypt')
    const authCookie = setCookieArray(res).find((c) => c.startsWith('auth_token='))
    expect(authCookie).toMatch(/HttpOnly/i)
  })

  it('email duplicado retorna 409', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(USER)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_IN_USE')
  })

  it('senha inválida e campos ausentes retornam 400 com fields', async () => {
    const short = await request(app).post('/api/v1/auth/register').send({ name: 'Ana', email: `ana.${suffix}@teste.com`, password: '1234567' })
    expect(short.status).toBe(400)
    expect(short.body.error.fields?.password).toBeDefined()

    const missing = await request(app).post('/api/v1/auth/register').send({ email: 'sem-nome@teste.com', password: '12345678' })
    expect(missing.status).toBe(400)
    expect(missing.body.error.fields?.name).toBeDefined()
  })

  it('login válido retorna usuário e cookie; senha nunca aparece', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    expect(res.status).toBe(200)
    expect(res.body.email).toBe(USER.email)
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
    expect(setCookieArray(res).find((c) => c.startsWith('auth_token='))).toBeDefined()
  })

  it('login inválido retorna 401 com mensagem genérica', async () => {
    const wrongPassword = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: 'errada-12345' })
    expect(wrongPassword.status).toBe(401)
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(wrongPassword.body.error.message).toBe('E-mail ou senha inválidos.')

    const unknownEmail = await request(app).post('/api/v1/auth/login').send({ email: `nobody.${suffix}@teste.com`, password: 'qualquer-123' })
    expect(unknownEmail.status).toBe(401)
    expect(unknownEmail.body.error.message).toBe('E-mail ou senha inválidos.')
  })

  it('/auth/me autenticado retorna dados públicos; sem sessão retorna 401', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const authCookie = cookieFrom(login, 'auth_token')

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', authCookie)
    expect(me.status).toBe(200)
    expect(me.body).toEqual({ id: expect.any(String), name: USER.name, email: USER.email })

    const anonymous = await request(app).get('/api/v1/auth/me')
    expect(anonymous.status).toBe(401)
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('logout expira o cookie de sessão (sessão stateless: revogação no cliente)', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const authCookie = cookieFrom(login, 'auth_token')

    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', authCookie)
    expect(out.status).toBe(200)
    const cleared = setCookieArray(out).find((c) => c.startsWith('auth_token='))
    // cookie de limpeza: Max-Age=0 ou Expires no passado
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/)
  })

  it('carrinho de visitante é vinculado ao usuário no login', async () => {
    // usuário existe (registro limpo) e faz logout para virar visitante
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Ana Vinculo', email: `ana.vinculo.${suffix}@teste.com`, password: 'senha-segura-123',
    })
    const userId = register.body.id
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookieFrom(register, 'auth_token'))

    // visitante adiciona item (novo carrinho, novo cart_token)
    const guestAdd = await request(app).post('/api/v1/cart/items').send({ variantId: variantAId, quantity: 1 })
    const cartCookie = cookieFrom(guestAdd, 'cart_token')

    // login COM o cookie do carrinho de visitante
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', cartCookie)
      .send({ email: `ana.vinculo.${suffix}@teste.com`, password: 'senha-segura-123' })
    expect(login.status).toBe(200)

    // o carrinho apontado pelo cart_token agora pertence ao usuário
    const cart = await prisma.cart.findUnique({ where: { token: extractToken(cartCookie) } })
    expect(cart?.userId).toBe(userId)

    // GET /cart com o mesmo cookie continua mostrando os itens
    const read = await request(app).get('/api/v1/cart').set('Cookie', cartCookie)
    expect(read.status).toBe(200)
    expect(read.body.items).toHaveLength(1)
    expect(read.body.totalItems).toBe(1)
  })

  it('merge de carrinhos: mesma variante soma e estoque é respeitado', async () => {
    // usuário com carrinho próprio: registra (sem carrinho de visitante) e adiciona variante A x2 (estoque 3)
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'João Merge', email: `joao.${suffix}@teste.com`, password: 'senha-segura-123',
    })
    const authCookie = cookieFrom(register, 'auth_token')
    const userId = register.body.id

    const userAdd = await request(app).post('/api/v1/cart/items').set('Cookie', authCookie).send({ variantId: variantAId, quantity: 2 })
    const userCartCookie = cookieFrom(userAdd, 'cart_token')

    // logout (auth some; cart_token do usuário permanece) e novo carrinho de visitante com A x2 + B x1
    await request(app).post('/api/v1/auth/logout').set('Cookie', authCookie)
    const guestAdd = await request(app).post('/api/v1/cart/items').send({ variantId: variantAId, quantity: 2 })
    const guestCookie = cookieFrom(guestAdd, 'cart_token')
    await request(app).post('/api/v1/cart/items').set('Cookie', guestCookie).send({ variantId: variantBId, quantity: 1 })

    // login novamente COM o carrinho de visitante → mescla no carrinho do usuário
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', guestCookie)
      .send({ email: `joao.${suffix}@teste.com`, password: 'senha-segura-123' })
    expect(login.status).toBe(200)

    // cookie de carrinho da resposta aponta para o carrinho do usuário
    const mergedCartCookie = cookieFrom(login, 'cart_token')
    const merged = await request(app).get('/api/v1/cart').set('Cookie', mergedCartCookie)

    const itemA = merged.body.items.find((i: { variantId: string }) => i.variantId === variantAId)
    const itemB = merged.body.items.find((i: { variantId: string }) => i.variantId === variantBId)
    expect(itemA.quantity).toBe(3) // 2 + 2 = 4 → clampado ao estoque 3
    expect(itemB.quantity).toBe(1) // variante diferente foi movida sem duplicar
    expect(merged.body.items).toHaveLength(2)

    // carrinho do visitante foi removido e o remanescente pertence ao usuário
    const guestCartAfter = await prisma.cart.findUnique({ where: { token: extractToken(guestCookie) } })
    expect(guestCartAfter).toBeNull()
    const userCartAfter = await prisma.cart.findUnique({ where: { token: extractToken(userCartCookie) } })
    expect(userCartAfter?.userId).toBe(userId)
  })
})
