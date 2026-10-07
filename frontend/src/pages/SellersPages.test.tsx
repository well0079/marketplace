import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SellersVerifyPage } from './SellersVerifyPage'
import { SellersNewPage } from './SellersNewPage'
import { eventQueryKey } from '../lib/events'

// /sellers/verify: consentimento obrigatório, máscara de CEP, ViaCEP com
// fallback manual. /sellers/new: validações de preço/quantidade e mensagem
// de pending_review (AUTO_APPROVE=false).

const USER = { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', cpfMasked: '***.111.222-**', isSeller: false }

const EVENTS_PAGE = {
  items: [
    { id: 'e1', slug: 'festival-aurora-2026', name: 'Festival Aurora 2026', category: 'Festivais', city: 'São Paulo', nextSessionAt: '2026-11-14T17:00:00.000Z', minPriceCents: 6000, featured: true, imageUrl: null },
  ],
  page: 1, limit: 12, total: 1, totalPages: 1,
}

const EVENT_DETAIL = {
  id: 'e1', slug: 'festival-aurora-2026', name: 'Festival Aurora 2026', category: 'Festivais',
  organizer: 'Produções Horizonte', description: 'Doze horas.', imageUrl: null, featured: true,
  createdAt: '2026-10-05T12:00:00.000Z',
  sessions: [
    { id: 's1', startsAt: '2026-11-14T17:00:00.000Z', city: 'São Paulo', uf: 'SP', venue: 'Parque Aurora', hasOffers: true, minPriceCents: 6000 },
  ],
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

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }
}

function clientFor(user: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } })
  client.setQueryData(['auth', 'me'], user)
  return client
}

function Probe({ tag }: { tag: string }) {
  return <div>PROBE:{tag}</div>
}

// ─── /sellers/verify ───
describe('SellersVerifyPage', () => {
  function renderVerify() {
    return render(
      <QueryClientProvider client={clientFor(USER)}>
        <MemoryRouter initialEntries={['/sellers/verify']}>
          <Routes>
            <Route path="/sellers/verify" element={<SellersVerifyPage />} />
            <Route path="/sellers/new" element={<Probe tag="NEW" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('desabilita "Confirmar identidade" sem consentimento; marca e avança', async () => {
    const user = userEvent.setup()
    renderVerify()
    const confirm = screen.getByRole('button', { name: 'Confirmar identidade' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(screen.getByText('***.111.222-**')).toBeTruthy()

    await user.click(screen.getByRole('checkbox'))
    expect(confirm.disabled).toBe(false)
    await user.click(confirm)
    await waitFor(() => expect(screen.getByText('Endereço de cobrança')).toBeTruthy())
  })

  it('máscara de CEP: digita só dígitos e formata 00000-000; Buscar habilita com 8', async () => {
    const user = userEvent.setup()
    renderVerify()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar identidade' }))
    await waitFor(() => expect(screen.getByLabelText('CEP')).toBeTruthy())

    const cep = screen.getByLabelText('CEP') as HTMLInputElement
    const buscar = screen.getByRole('button', { name: 'Buscar' }) as HTMLButtonElement
    expect(buscar.disabled).toBe(true)

    await user.type(cep, '01310100')
    expect(cep.value).toBe('01310-100')
    expect(buscar.disabled).toBe(false)
  })

  it('ViaCEP offline: mensagem de fallback e preenchimento manual segue valendo', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('viacep.com.br')) throw new TypeError('network down')
      return jsonResponse({}, 404)
    })
    renderVerify()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar identidade' }))
    await waitFor(() => expect(screen.getByLabelText('CEP')).toBeTruthy())

    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(screen.getByText('Não foi possível consultar o CEP. Preencha manualmente.')).toBeTruthy())

    // fallback manual: campos continuam editáveis e o submit funciona
    await user.type(screen.getByLabelText('Município'), 'São Paulo')
    expect((screen.getByLabelText('Município') as HTMLInputElement).value).toBe('São Paulo')
  })

  it('ViaCEP ok: preenche UF, município, bairro e rua', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('viacep.com.br')) {
        return jsonResponse({ uf: 'RJ', localidade: 'Rio de Janeiro', bairro: 'Centro', logradouro: 'Avenida Rio Branco' })
      }
      return jsonResponse({}, 404)
    })
    renderVerify()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar identidade' }))
    await waitFor(() => expect(screen.getByLabelText('CEP')).toBeTruthy())

    await user.type(screen.getByLabelText('CEP'), '20040901')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect((screen.getByLabelText('Município') as HTMLInputElement).value).toBe('Rio de Janeiro'))
    expect((screen.getByLabelText('Bairro') as HTMLInputElement).value).toBe('Centro')
    expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe('Avenida Rio Branco')
    expect((screen.getByLabelText('UF') as HTMLInputElement).value).toBe('RJ')
  })

  it('submit do passo 2: POST /sellers/verify com consent+endereço e navega para /sellers/new', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes('/sellers/verify') && init?.method === 'POST') return jsonResponse({ verificationLevel: 'basic' })
      if (String(url).includes('viacep.com.br')) throw new TypeError('network down')
      return jsonResponse({}, 404)
    })
    renderVerify()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar identidade' }))
    await waitFor(() => expect(screen.getByLabelText('CEP')).toBeTruthy())

    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Município'), 'São Paulo')
    await user.type(screen.getByLabelText('Bairro'), 'Bela Vista')
    await user.type(screen.getByLabelText('Endereço'), 'Avenida Paulista')
    await user.type(screen.getByLabelText('Nº'), '1000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(screen.getByText('PROBE:NEW')).toBeTruthy())
    const call = fetchMock.mock.calls.find(([u, i]) => String(u).includes('/sellers/verify') && (i as { method?: string })?.method === 'POST')
    const body = JSON.parse((call?.[1] as { body?: string })?.body ?? '{}')
    expect(body.consent).toBe(true)
    expect(body.address.cep).toBe('01310-100')
    expect(body.address.city).toBe('São Paulo')
  })

  it('erro do servidor no submit mostra role=alert com a mensagem', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes('/sellers/verify') && init?.method === 'POST') {
        return jsonResponse({ error: { message: 'Endereço inválido', code: 'VALIDATION' } }, 400)
      }
      return jsonResponse({}, 404)
    })
    renderVerify()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Confirmar identidade' }))
    await waitFor(() => expect(screen.getByLabelText('CEP')).toBeTruthy())

    await user.type(screen.getByLabelText('CEP'), '01310100')
    await user.type(screen.getByLabelText('Município'), 'São Paulo')
    await user.type(screen.getByLabelText('Bairro'), 'Bela Vista')
    await user.type(screen.getByLabelText('Endereço'), 'Avenida Paulista')
    await user.type(screen.getByLabelText('Nº'), '1000')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('Endereço inválido')).toBeTruthy()
  })
})

// ─── /sellers/new ───
describe('SellersNewPage', () => {
  function renderNew(listingsResponse?: (url: string, init?: { method?: string }) => unknown) {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (listingsResponse) return listingsResponse(String(url), init)
      return jsonResponse({}, 404)
    })
    const client = clientFor(USER)
    client.setQueryData(['events', 'list', 1], EVENTS_PAGE)
    client.setQueryData(eventQueryKey('festival-aurora-2026'), EVENT_DETAIL)
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/sellers/new']}>
          <Routes>
            <Route path="/sellers/new" element={<SellersNewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Festival Aurora 2026' }))
    await user.click(screen.getByRole('button', { name: /Parque Aurora/ }))
    await user.type(screen.getByLabelText('Tipo de ingresso'), 'Pista')
    await user.click(screen.getByRole('button', { name: 'Inteira' }))
    await user.clear(screen.getByLabelText('Quantidade'))
    await user.type(screen.getByLabelText('Quantidade'), '2')
    await user.type(screen.getByLabelText('Preço por ingresso (R$)'), '50,00')
  }

  it('submit vazio: erros de evento, tipo, categoria e preço mínimo', async () => {
    const user = userEvent.setup()
    renderNew()
    await user.click(screen.getByRole('button', { name: 'Publicar anúncio' }))
    expect(screen.getByText('Selecione um evento.')).toBeTruthy()
    expect(screen.getByText('Selecione o tipo.')).toBeTruthy()
    expect(screen.getByText('Selecione a categoria.')).toBeTruthy()
    expect(screen.getByText('Preço mínimo R$ 5,00.')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/listings') && (i as { method?: string })?.method === 'POST')).toBe(false)
  })

  it('preço abaixo do mínimo (R$ 4,00) e quantidade 0 bloqueiam o envio', async () => {
    const user = userEvent.setup()
    renderNew()
    await user.click(screen.getByRole('button', { name: 'Festival Aurora 2026' }))
    await user.click(screen.getByRole('button', { name: /Parque Aurora/ }))
    await user.type(screen.getByLabelText('Tipo de ingresso'), 'Pista')
    await user.click(screen.getByRole('button', { name: 'Inteira' }))
    await user.clear(screen.getByLabelText('Quantidade'))
    await user.type(screen.getByLabelText('Quantidade'), '0')
    await user.type(screen.getByLabelText('Preço por ingresso (R$)'), '4,00')
    await user.click(screen.getByRole('button', { name: 'Publicar anúncio' }))
    expect(screen.getByText('Mínimo 1.')).toBeTruthy()
    expect(screen.getByText('Preço mínimo R$ 5,00.')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/listings') && (i as { method?: string })?.method === 'POST')).toBe(false)
  })

  it('publicado com AUTO_APPROVE=false → "Anúncio em análise" e payload correto', async () => {
    const user = userEvent.setup()
    renderNew((url, init) => {
      if (String(url).includes('/listings') && init?.method === 'POST') return jsonResponse({ id: 'l1', status: 'pending_review' }, 201)
      return jsonResponse({}, 404)
    })
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Publicar anúncio' }))

    await waitFor(() => expect(screen.getByText('Anúncio em análise')).toBeTruthy())
    expect(screen.getByText(/ainda não aparece para compradores/)).toBeTruthy()
    const call = fetchMock.mock.calls.find(([u, i]) => String(u).includes('/listings') && (i as { method?: string })?.method === 'POST')
    expect(JSON.parse((call?.[1] as { body?: string })?.body ?? '{}')).toEqual({
      sessionId: 's1', ticketType: 'Pista', ticketCategory: 'Inteira', quantity: 2, priceCents: 5000,
    })
  })

  it('publicado com AUTO_APPROVE=true → "Anúncio publicado!" com link para a sessão', async () => {
    const user = userEvent.setup()
    renderNew((url, init) => {
      if (String(url).includes('/listings') && init?.method === 'POST') return jsonResponse({ id: 'l2', status: 'active' }, 201)
      return jsonResponse({}, 404)
    })
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Publicar anúncio' }))

    await waitFor(() => expect(screen.getByText('Anúncio publicado!')).toBeTruthy())
    expect(screen.getByText(/já está visível na página da sessão/)).toBeTruthy()
  })

  it('erro do servidor (422 sessão passada) mostra a mensagem e mantém o formulário', async () => {
    const user = userEvent.setup()
    renderNew((url, init) => {
      if (String(url).includes('/listings') && init?.method === 'POST') {
        return jsonResponse({ error: { message: 'Não é possível anunciar ingressos para sessões passadas.', code: 'SESSION_PAST' } }, 422)
      }
      return jsonResponse({}, 404)
    })
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Publicar anúncio' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText(/sessões passadas/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Publicar anúncio' })).toBeTruthy()
  })
})
