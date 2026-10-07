import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'
import { prisma } from '../src/lib/prisma'

// Varredura 401: TODA rota protegida por sessão deve responder 401 sem cookie.
// Regressão do bug requireUser sem await: o Promise "truthy" passava pelo null
// check e a rota estourava 500 (ou pior, seguia) em vez de 401.

afterAll(async () => {
  await prisma.$disconnect()
})

const UUID = '00000000-0000-4000-8000-000000000000'

// [método, rota, body] — nenhuma rota deve depender de fixture: o 401 vem
// ANTES de qualquer validação/consulta.
const PROTECTED: Array<[string, string, object | undefined]> = [
  ['GET', '/auth/me', undefined],
  ['GET', '/addresses', undefined],
  ['POST', '/addresses', { label: 'Casa', recipient: 'X', cep: '01310100', uf: 'SP', city: 'São Paulo', neighborhood: 'Bela Vista', street: 'Paulista', number: '1' }],
  ['DELETE', `/addresses/${UUID}`, undefined],
  ['GET', '/orders', undefined],
  ['POST', '/orders', { reservationId: UUID }],
  ['GET', '/orders/RD-NAOEXISTE', undefined],
  ['POST', '/orders/RD-NAOEXISTE/cancel', undefined],
  ['POST', '/payments', { orderCode: 'RD-NAOEXISTE', method: 'pix', payer: { document: '11144477735' } }],
  ['GET', `/payments/${UUID}`, undefined],
  ['POST', '/reservations', { offerId: UUID, quantity: 1 }],
  ['GET', '/reservations/active', undefined],
  ['DELETE', `/reservations/${UUID}`, undefined],
  ['POST', '/coupons/validate', { code: 'X', reservationId: UUID }],
  ['GET', '/sellers/me', undefined],
  ['POST', '/sellers/verify', { consent: true, address: {} }],
  ['POST', '/listings', { sessionId: UUID, ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 1, priceCents: 1000 }],
  ['GET', '/listings/mine', undefined],
  ['DELETE', `/listings/${UUID}`, undefined],
  ['GET', '/listings/sold', undefined],
]

describe('Rotas protegidas — 401 sem sessão (varredura requireUser)', () => {
  for (const [method, route, body] of PROTECTED) {
    it(`${method} ${route} → 401 UNAUTHENTICATED sem cookie`, async () => {
      const res = await request(app)[method.toLowerCase() as 'get'](`/api/v1${route}`).send(body)
      expect(res.status).toBe(401)
      expect(res.body.error?.code ?? res.body.error).toBeTruthy()
    })
  }
})
