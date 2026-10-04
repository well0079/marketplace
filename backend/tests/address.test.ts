import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

const suffix = Date.now()

const USER = { name: 'Ana Endereço', email: `ana.endereco.${suffix}@teste.com`, password: 'senha-segura-123' }
const OTHER = { name: 'Bruno Outro', email: `bruno.outro.${suffix}@teste.com`, password: 'senha-segura-123' }

const ADDRESS = {
  recipient: 'Ana Endereço',
  zipCode: '01310-000',
  street: 'Avenida Paulista',
  number: '1000',
  complement: 'Apto 42',
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
}

function authCookieFrom(res: request.Response): string {
  const setCookie = res.headers['set-cookie']
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter(Boolean) as string[]
  const cookie = cookies.find((c) => c.startsWith('auth_token='))
  const match = /auth_token=([^;]+)/.exec(cookie ?? '')
  if (!match) throw new Error('cookie auth_token não foi emitido')
  return `auth_token=${match[1]}`
}

const register = (user: typeof USER) =>
  request(app).post('/api/v1/auth/register').send(user)

afterAll(async () => {
  // Address tem cascade no User; carrinhos criados no registro precisam sair antes
  await prisma.cart.deleteMany({ where: { user: { email: { in: [USER.email, OTHER.email] } } } })
  await prisma.user.deleteMany({ where: { email: { in: [USER.email, OTHER.email] } } })
  await prisma.$disconnect()
})

describe('Address API', () => {
  it('GET /addresses sem sessão retorna 401', async () => {
    const res = await request(app).get('/api/v1/addresses')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('GET /addresses com sessão retorna lista vazia inicialmente', async () => {
    const auth = await register(USER)
    expect(auth.status).toBe(201)
    const cookie = authCookieFrom(auth)

    const res = await request(app).get('/api/v1/addresses').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('POST /addresses com campos inválidos retorna 400 com fields', async () => {
    const auth = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const cookie = authCookieFrom(auth)

    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ recipient: 'A', zipCode: '123', street: '', number: '', district: '', city: '', state: 'XX' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION')
    expect(res.body.error.fields).toMatchObject({
      recipient: expect.any(String),
      zipCode: expect.any(String),
      street: expect.any(String),
      number: expect.any(String),
      district: expect.any(String),
      city: expect.any(String),
      state: expect.any(String),
    })
  })

  it('POST /addresses cria endereço válido; primeiro nasce padrão e CEP é normalizado', async () => {
    const auth = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const cookie = authCookieFrom(auth)

    const res = await request(app).post('/api/v1/addresses').set('Cookie', cookie).send(ADDRESS)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      recipient: 'Ana Endereço',
      zipCode: '01310000',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 42',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      isDefault: true,
    })
    expect(res.body.id).toBeTruthy()
  })

  it('POST segundo endereço com isDefault promove o padrão corretamente', async () => {
    const auth = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const cookie = authCookieFrom(auth)

    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({
        recipient: 'Ana Endereço',
        zipCode: '22250040',
        street: 'Avenida Atlântica',
        number: '500',
        district: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
        isDefault: true,
      })
    expect(res.status).toBe(201)
    expect(res.body.isDefault).toBe(true)

    const list = await request(app).get('/api/v1/addresses').set('Cookie', cookie)
    expect(list.body).toHaveLength(2)
    const defaults = list.body.filter((a: { isDefault: boolean }) => a.isDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].zipCode).toBe('22250040')
  })

  it('usuário não vê nem apaga endereço de outro usuário', async () => {
    const ownerAuth = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const ownerList = await request(app).get('/api/v1/addresses').set('Cookie', authCookieFrom(ownerAuth))
    const targetId = ownerList.body[0].id

    await register(OTHER)
    const otherAuth = await request(app).post('/api/v1/auth/login').send({ email: OTHER.email, password: OTHER.password })
    const otherCookie = authCookieFrom(otherAuth)

    const otherList = await request(app).get('/api/v1/addresses').set('Cookie', otherCookie)
    expect(otherList.body).toEqual([])

    const res = await request(app).delete(`/api/v1/addresses/${targetId}`).set('Cookie', otherCookie)
    expect(res.status).toBe(404)
  })

  it('DELETE remove endereço próprio e promove o mais recente a padrão', async () => {
    const auth = await request(app).post('/api/v1/auth/login').send({ email: USER.email, password: USER.password })
    const cookie = authCookieFrom(auth)
    const list = await request(app).get('/api/v1/addresses').set('Cookie', cookie)
    // remove o padrão (RJ, criado por último e promovido)
    const defaultAddress = list.body.find((a: { isDefault: boolean }) => a.isDefault)

    const res = await request(app).delete(`/api/v1/addresses/${defaultAddress.id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })

    const after = await request(app).get('/api/v1/addresses').set('Cookie', cookie)
    expect(after.body).toHaveLength(1)
    expect(after.body[0].isDefault).toBe(true)
    expect(after.body[0].zipCode).toBe('01310000')
  })
})
