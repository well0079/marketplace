import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

const suffix = Date.now()
const USER_A = { name: 'Vendedor Teste', email: `vendedor.${suffix}@teste.com`, password: 'Senha1@a' }
const USER_B = { name: 'Comprador Teste', email: `comprador.${suffix}@teste.com`, password: 'Senha1@a' }

let authA: string
let authB: string
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

async function makeEvent(withOffers = true) {
  const event = await prisma.event.create({
    data: {
      slug: `evt-seller-${suffix}-${createdEventIds.length}`,
      name: 'Evento Seller Test',
      category: 'Shows',
      organizer: 'Cia. Teste',
      description: 'Evento dos testes de vendedor.',
      sessions: {
        create: [{
          startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          city: 'São Paulo', uf: 'SP', venue: 'Palco de Testes',
          ...(withOffers ? { offers: { create: [{ ticketType: 'Pista', ticketCategory: 'Inteira', priceCents: 1000, quantity: 5 }] } } : {}),
        }],
      },
    },
    include: { sessions: { include: { offers: true } } },
  })
  createdEventIds.push(event.id)
  return event
}

const ADDRESS = {
  cep: '01310-100', uf: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista',
  street: 'Avenida Paulista', number: '1000', complement: '',
}

beforeAll(async () => {
  process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
  process.env.SIGNUP_RATE_LIMIT = '1000'
  process.env.RESERVATIONS_RATE_LIMIT = '1000'
  const regA = await request(app).post('/api/v1/auth/register').send(USER_A)
  authA = authCookieFrom(regA)
  const regB = await request(app).post('/api/v1/auth/register').send(USER_B)
  authB = authCookieFrom(regB)
  userAId = (await prisma.user.findUnique({ where: { email: USER_A.email } }))!.id
})

afterAll(async () => {
  process.env.SELLER_OFFERS_AUTO_APPROVE = undefined
  // limpar dependências na ordem
  await prisma.reservation.deleteMany({ where: { offer: { session: { eventId: { in: createdEventIds } } } } })
  await prisma.offer.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.listing.deleteMany({ where: { session: { eventId: { in: createdEventIds } } } })
  await prisma.eventSession.deleteMany({ where: { eventId: { in: createdEventIds } } })
  await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } })
  await prisma.coupon.deleteMany({ where: { code: { startsWith: 'SELLER' } } })
  await prisma.signupChallenge.deleteMany({ where: { phone: { startsWith: '+5511' } } })
  await prisma.address.deleteMany({ where: { user: { email: { in: [USER_A.email, USER_B.email] } } } })
  await prisma.cart.deleteMany({ where: { user: { email: { in: [USER_A.email, USER_B.email] } } } })
  await prisma.user.deleteMany({ where: { email: { in: [USER_A.email, USER_B.email] } } })
  await prisma.$disconnect()
})

// ─── GET /sellers/me ───

describe('GET /sellers/me', () => {
  it('sem sessão → 401; com sessão sem perfil → null', async () => {
    const anon = await request(app).get('/api/v1/sellers/me')
    expect(anon.status).toBe(401)
    const empty = await request(app).get('/api/v1/sellers/me').set('Cookie', authA)
    expect(empty.status).toBe(200)
    expect(empty.body).toBeNull()
  })
})

// ─── POST /sellers/verify ───

describe('POST /sellers/verify', () => {
  it('sem consentimento → 400', async () => {
    const res = await request(app).post('/api/v1/sellers/verify').set('Cookie', authA).send({
      consent: false, address: { ...ADDRESS, cep: '01310100' },
    })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.consent).toBeTruthy()
  })

  it('CEP inválido → 400 por campo', async () => {
    const res = await request(app).post('/api/v1/sellers/verify').set('Cookie', authA).send({
      consent: true, address: { ...ADDRESS, cep: '123' },
    })
    expect(res.status).toBe(400)
    expect(res.body.error.fields['address.cep']).toBeTruthy()
  })

  it('UF inválida → 400', async () => {
    const res = await request(app).post('/api/v1/sellers/verify').set('Cookie', authA).send({
      consent: true, address: { ...ADDRESS, cep: '01310100', uf: 'XX' },
    })
    expect(res.status).toBe(400)
  })

  it('verificação bem-sucedida → verificationLevel basic; idempotente (refazer atualiza)', async () => {
    const res1 = await request(app).post('/api/v1/sellers/verify').set('Cookie', authA).send({
      consent: true, address: { ...ADDRESS, cep: '01310100' },
    })
    expect(res1.status).toBe(200)
    expect(res1.body.verificationLevel).toBe('basic')

    // refazer (idempotente): atualiza o endereço
    const res2 = await request(app).post('/api/v1/sellers/verify').set('Cookie', authA).send({
      consent: true, address: { ...ADDRESS, cep: '01310100', street: 'Nova Rua', number: '200' },
    })
    expect(res2.status).toBe(200)
    const profile = await prisma.sellerProfile.findUnique({ where: { userId: userAId } })
    expect(profile?.street).toBe('Nova Rua')
    expect(profile?.number).toBe('200')
  })
})

// ─── POST /listings ───

describe('POST /listings', () => {
  it('403 sem verificação (usuário B não verificado)', async () => {
    const event = await makeEvent()
    const sessionId = event.sessions[0].id
    const res = await request(app).post('/api/v1/listings').set('Cookie', authB).send({
      sessionId, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('SELLER_NOT_VERIFIED')
  })

  it('sessão passada → 422', async () => {
    const past = await prisma.event.create({
      data: {
        slug: `past-${suffix}`, name: 'Past', category: 'Shows', organizer: 'D', description: 'D',
        sessions: { create: [{ startsAt: new Date(Date.now() - 86400000), city: 'SP', uf: 'SP', venue: 'V' }] },
      },
      include: { sessions: true },
    })
    createdEventIds.push(past.id)
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: past.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('SESSION_PAST')
  })

  it('tipo de ingresso inválido → 400', async () => {
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Arquibancada', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.ticketType).toBeTruthy()
  })

  it('categoria inválida → 400', async () => {
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Estudante', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(400)
  })

  it('quantidade fora do limite → 400', async () => {
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 50, priceCents: 1000,
    })
    expect(res.status).toBe(400)
  })

  it('preço abaixo do mínimo → 400', async () => {
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 100,
    })
    expect(res.status).toBe(400)
  })

  it('anúncio com AUTO_APPROVE=true → status active', async () => {
    process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('active')
  })

  it('AUTO_APPROVE=false → status pending_review (invisível na sessão)', async () => {
    process.env.SELLER_OFFERS_AUTO_APPROVE = 'false'
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending_review')
    // invisível na sessão: GET /sessions/:id/offers não deve incluir
    const offers = await request(app).get(`/api/v1/sessions/${event.sessions[0].id}/offers`)
    expect(offers.body.every((o: { seller: string }) => o.seller === 'plataforma')).toBe(true)
    process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
  })

  it('rate limit → 429 na segunda chamada', async () => {
    process.env.SIGNUP_RATE_LIMIT = '1'
    const email = `rate.listing.${suffix}@teste.com`
    const reg = await request(app).post('/api/v1/auth/register').send({ name: 'Rate L', email, password: 'Senha1@a' })
    const rateCookie = authCookieFrom(reg)
    // verificar como vendedor
    await request(app).post('/api/v1/sellers/verify').set('Cookie', rateCookie).send({
      consent: true, address: { cep: '01310100', uf: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Av Paulista', number: '100' },
    })
    const event = await makeEvent()
    const res1 = await request(app).post('/api/v1/listings').set('Cookie', rateCookie).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res1.status).toBe(201)
    const res2 = await request(app).post('/api/v1/listings').set('Cookie', rateCookie).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 2000,
    })
    expect(res2.status).toBe(429)
    expect(res2.body.error.code).toBe('RATE_LIMITED')
    process.env.SIGNUP_RATE_LIMIT = '1000'
  })
})

// ─── GET /listings/mine ───

describe('GET /listings/mine', () => {
  it('lista anúncios do vendedor com contagem por status', async () => {
    const res = await request(app).get('/api/v1/listings/mine').set('Cookie', authA)
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(2)
    expect(res.body.counts).toBeDefined()
    expect(res.body.items[0].event.name).toBeTruthy()
    expect(res.body.items[0].session.city).toBeTruthy()
  })

  it('filtra por status', async () => {
    const res = await request(app).get('/api/v1/listings/mine?status=pending_review').set('Cookie', authA)
    expect(res.status).toBe(200)
    expect(res.body.items.every((i: { status: string }) => i.status === 'pending_review')).toBe(true)
  })
})

// ─── GET /listings/sold ───

describe('GET /listings/sold', () => {
  it('sem vendidos → lista vazia; NUNCA expõe dados do comprador', async () => {
    const res = await request(app).get('/api/v1/listings/sold').set('Cookie', authA)
    expect(res.status).toBe(200)
    for (const item of res.body) {
      const text = JSON.stringify(item)
      expect(text).not.toContain('"name":"')
      expect(text).not.toContain('"email":"')
      expect(text).not.toContain('"cpf')
      expect(text).not.toContain('"phone')
    }
  })
})

// ─── DELETE /listings/:id ───

describe('DELETE /listings/:id', () => {
  it('cancela anúncio próprio ativo', async () => {
    process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    expect(res.status).toBe(201)
    const listingId = res.body.id

    const del = await request(app).delete(`/api/v1/listings/${listingId}`).set('Cookie', authA)
    expect(del.status).toBe(200)
    const after = await prisma.listing.findUnique({ where: { id: listingId } })
    expect(after?.status).toBe('cancelled')
  })

  it('anúncio de outro usuário → 404', async () => {
    process.env.SELLER_OFFERS_AUTO_APPROVE = 'true'
    const event = await makeEvent()
    const res = await request(app).post('/api/v1/listings').set('Cookie', authA).send({
      sessionId: event.sessions[0].id, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000,
    })
    const listingId = res.body.id
    const del = await request(app).delete(`/api/v1/listings/${listingId}`).set('Cookie', authB)
    expect(del.status).toBe(404)
  })
})
