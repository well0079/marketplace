import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CheckoutPage } from './CheckoutPage'

// /checkout (tema ingressos, bloco 4): reserva ativa, cupom, e-mail de
// recebimento, CPF pagador e POST /orders + /payments sem valor no payload
// (o servidor calcula — o botão Pagar nunca envia total).

const USER = { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', cpfMasked: '***.111.222-**', isSeller: false }

const FUTURE = new Date(Date.now() + 10 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 1000).toISOString()

const ACTIVE_RESERVATION = [
  {
    id: 'r1',
    quantity: 2,
    expiresAt: FUTURE,
    offer: {
      id: 'offer1', ticketType: 'Inteira', ticketCategory: 'Pista', priceCents: 10000,
      session: { id: 's1', startsAt: '2026-11-14T17:00:00.000Z', city: 'São Paulo', venue: 'Autódromo' },
      event: { slug: 'festival-aurora-2026', name: 'Festival Aurora 2026' },
    },
  },
]

const OFFERS = [{ id: 'offer1', ticketType: 'Inteira', ticketCategory: 'Pista', priceCents: 10000, available: 5, seller: 'vendedor' }]

const SESSION = {
  id: 's1', startsAt: '2026-11-14T17:00:00.000Z', city: 'São Paulo', venue: 'Autódromo',
  event: { slug: 'festival-aurora-2026', name: 'Festival Aurora 2026' },
  categories: [], minPriceCents: 10000, hasOffers: true,
}

const COUPON_OK = { code: 'INGRESSO10', discountedPriceCents: 9000, serviceFeeCents: 900, totalCents: 9900 }

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Router padrão: mocks felizes (reserva ativa + oferta + sessão); cada teste
// sobrescreve o que precisa (cupom, pedidos, expiração).
function renderCheckout(opts: { reservation?: unknown; expiresAt?: string } = {}) {
  let reservation = opts.reservation !== undefined ? opts.reservation : ACTIVE_RESERVATION
  if (opts.expiresAt && Array.isArray(reservation) && reservation.length > 0) {
    reservation = [{ ...(reservation[0] as Record<string, unknown>), expiresAt: opts.expiresAt }]
  }
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url)
    if (u.includes('/auth/me')) return jsonResponse(USER)
    if (u.includes('/reservations/active')) return jsonResponse(reservation)
    if (u.includes('/sessions/s1/offers')) return jsonResponse(OFFERS)
    if (u.includes('/sessions/s1')) return jsonResponse(SESSION)
    return jsonResponse({}, 404)
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['auth', 'me'], USER)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/checkout?offer=offer1']}>
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payments/:paymentId" element={<div>PIX-PROBE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderAnonymous() {
  fetchMock.mockImplementation(async (url: string) => {
    const u = String(url)
    if (u.includes('/auth/me')) return jsonResponse({ error: { message: 'Não autenticado', code: 'UNAUTHENTICATED' } }, 401)
    return jsonResponse({}, 404)
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/checkout?offer=offer1']}>
        <Routes>
          <Route path="/checkout" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function addReceiptEmail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Adicionar e-mail de recebimento'))
  await user.type(screen.getByRole('textbox', { name: 'E-mail de recebimento' }), 'amigo@exemplo.com')
  await user.click(screen.getByRole('button', { name: 'Confirmar e-mail' }))
  await waitFor(() => expect(screen.getByText('amigo@exemplo.com')).toBeTruthy())
}

// ─── Acesso ───
describe('CheckoutPage — acesso', () => {
  it('anônimo vê convite para entrar com redirect de volta ao checkout', async () => {
    renderAnonymous()
    await waitFor(() => expect(screen.getByText('Entre para finalizar a compra')).toBeTruthy())
    const entrar = screen.getByRole('link', { name: 'Entrar' }) as HTMLAnchorElement
    expect(entrar.getAttribute('href')).toBe('/login?redirect=%2Fcheckout%3Foffer%3Doffer1')
  })
})

// ─── Sacola e valores ───
describe('CheckoutPage — sacola e valores', () => {
  it('mostra reserva ativa com contador e total = preço + taxa 10%', async () => {
    renderCheckout()
    await waitFor(() => expect(screen.getByText('Seu lugar está reservado')).toBeTruthy())
    expect(screen.getByText(/Depois disso, volta pra venda/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('R$ 110,00')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeTruthy()
  })

  it('reserva expirada: aviso ambar, sem cupom e Pagar desabilitado', async () => {
    renderCheckout({ expiresAt: PAST })
    await waitFor(() => expect(screen.getByText(/Sua reserva expirou/)).toBeTruthy())
    expect(screen.queryByText(/Tem cupom/)).toBeNull()
    expect((screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

// ─── Cupom ───
describe('CheckoutPage — cupom', () => {
  it('aplica cupom: mostra desconto e recalcula taxa sobre o valor com desconto (R$ 99,00)', async () => {
    const user = userEvent.setup()
    renderCheckout()
    await waitFor(() => expect(screen.getByText(/Tem cupom/)).toBeTruthy())
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const u = String(url)
      if (u.includes('/coupons/validate') && init?.method === 'POST') return jsonResponse(COUPON_OK)
      if (u.includes('/auth/me')) return jsonResponse(USER)
      if (u.includes('/reservations/active')) return jsonResponse(ACTIVE_RESERVATION)
      if (u.includes('/sessions/s1/offers')) return jsonResponse(OFFERS)
      if (u.includes('/sessions/s1')) return jsonResponse(SESSION)
      return jsonResponse({}, 404)
    })
    await user.click(screen.getByText(/Tem cupom/))
    await user.type(screen.getByLabelText('Código do cupom'), 'INGRESSO10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(screen.getByText(/Cupom INGRESSO10 −R\$ 10,00/)).toBeTruthy())
    // 9.000 com desconto + 900 de taxa (10% sobre o valor com desconto)
    expect(screen.getByText('R$ 99,00')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/coupons/validate') && String((i as { body?: string })?.body).includes('reservationId'))).toBe(true)
  })

  it('cupom inválido mostra a mensagem do servidor e não aplica', async () => {
    const user = userEvent.setup()
    renderCheckout()
    await waitFor(() => expect(screen.getByText(/Tem cupom/)).toBeTruthy())
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const u = String(url)
      if (u.includes('/coupons/validate') && init?.method === 'POST') {
        return jsonResponse({ error: { message: 'Cupom não encontrado ou expirado', code: 'COUPON_NOT_FOUND' } }, 422)
      }
      if (u.includes('/auth/me')) return jsonResponse(USER)
      if (u.includes('/reservations/active')) return jsonResponse(ACTIVE_RESERVATION)
      if (u.includes('/sessions/s1/offers')) return jsonResponse(OFFERS)
      if (u.includes('/sessions/s1')) return jsonResponse(SESSION)
      return jsonResponse({}, 404)
    })
    await user.click(screen.getByText(/Tem cupom/))
    await user.type(screen.getByLabelText('Código do cupom'), 'XPTO')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(screen.getByText('Cupom não encontrado ou expirado')).toBeTruthy())
    expect(screen.getByText('R$ 110,00')).toBeTruthy()
  })

  it('remover cupom restaura o total cheio', async () => {
    const user = userEvent.setup()
    renderCheckout()
    await waitFor(() => expect(screen.getByText(/Tem cupom/)).toBeTruthy())
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const u = String(url)
      if (u.includes('/coupons/validate') && init?.method === 'POST') return jsonResponse(COUPON_OK)
      if (u.includes('/auth/me')) return jsonResponse(USER)
      if (u.includes('/reservations/active')) return jsonResponse(ACTIVE_RESERVATION)
      if (u.includes('/sessions/s1/offers')) return jsonResponse(OFFERS)
      if (u.includes('/sessions/s1')) return jsonResponse(SESSION)
      return jsonResponse({}, 404)
    })
    await user.click(screen.getByText(/Tem cupom/))
    await user.type(screen.getByLabelText('Código do cupom'), 'INGRESSO10')
    await user.click(screen.getByRole('button', { name: 'Aplicar' }))
    await waitFor(() => expect(screen.getByText('R$ 99,00')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(screen.getByText('R$ 110,00')).toBeTruthy())
    expect(screen.queryByText(/Cupom INGRESSO10/)).toBeNull()
  })
})

// ─── Pagar: e-mail + CPF + payload sem valor ───
describe('CheckoutPage — fluxo Pagar', () => {
  it('Pagar desabilitado até confirmar e-mail; modal CPF bloqueia CPF inválido', async () => {
    const user = userEvent.setup()
    renderCheckout()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar' })).toBeTruthy())
    expect((screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement).disabled).toBe(true)

    await addReceiptEmail(user)
    expect((screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement).disabled).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Pagar' }))
    expect(screen.getByText('Confirme seu CPF para gerar o Pix')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Gerar Pix' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByRole('textbox', { name: 'CPF' }), '11144477735')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Gerar Pix' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('fluxo completo: POST /orders e /payments SEM valor no payload, com Idempotency-Key, e navega para o Pix', async () => {
    const user = userEvent.setup()
    renderCheckout()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pagar' })).toBeTruthy())
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const u = String(url)
      if (u.includes('/orders') && init?.method === 'POST') return jsonResponse({ code: 'RD-FLUXO1' }, 201)
      if (u.includes('/payments') && init?.method === 'POST') return jsonResponse({ paymentId: 'pay-1' }, 201)
      if (u.includes('/auth/me')) return jsonResponse(USER)
      if (u.includes('/reservations/active')) return jsonResponse(ACTIVE_RESERVATION)
      if (u.includes('/sessions/s1/offers')) return jsonResponse(OFFERS)
      if (u.includes('/sessions/s1')) return jsonResponse(SESSION)
      return jsonResponse({}, 404)
    })

    await addReceiptEmail(user)
    await user.click(screen.getByRole('button', { name: 'Pagar' }))
    await user.type(screen.getByRole('textbox', { name: 'CPF' }), '11144477735')
    await user.click(screen.getByRole('button', { name: 'Gerar Pix' }))

    await waitFor(() => expect(screen.getByText('PIX-PROBE')).toBeTruthy())

    const orderCall = fetchMock.mock.calls.find(([u, i]) => String(u).includes('/orders') && (i as { method?: string })?.method === 'POST')
    expect(orderCall).toBeTruthy()
    const [, orderInit] = orderCall as [string, { headers?: Record<string, string>; body?: string }]
    expect(orderInit.headers?.['Idempotency-Key']).toBeTruthy()
    const orderBody = JSON.parse(orderInit.body ?? '{}')
    expect(orderBody).toEqual({ reservationId: 'r1', receiptEmail: 'amigo@exemplo.com' })

    const payCall = fetchMock.mock.calls.find(([u, i]) => String(u).includes('/payments') && (i as { method?: string })?.method === 'POST')
    expect(payCall).toBeTruthy()
    const [, payInit] = payCall as [string, { headers?: Record<string, string>; body?: string }]
    expect(payInit.headers?.['Idempotency-Key']).toBeTruthy()
    const payBody = JSON.parse(payInit.body ?? '{}')
    expect(payBody).toEqual({ orderCode: 'RD-FLUXO1', method: 'pix', payer: { document: '11144477735' } })
    expect(Object.keys(payBody).some((k) => /amount|total|value/i.test(k))).toBe(false)
  })
})
