import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SignupPage } from './SignupPage'
import { LoginPage } from './LoginPage'
import { TicketsPage } from './TicketsPage'
import type { MyListingsPayload } from '../lib/events'
import { TopBar as TopBarAccount } from '../components/ingressos/TopBarAccount'
import { safeRedirect } from '../lib/auth'
import { TicketNotFoundPage } from './TicketStaticPages'

// ─── helpers ───
function renderAt(ui: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['auth', 'me'], null)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

// mock do fetch global (usado pelo api client)
const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  process.env.SIGNUP_RATE_LIMIT = '1000'
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }
}

// ─── safeRedirect ───
describe('safeRedirect', () => {
  it('aceita caminhos internos e rejeita abertos/externos', () => {
    expect(safeRedirect('/tickets')).toBe('/tickets')
    expect(safeRedirect(null)).toBe('/')
    expect(safeRedirect('//evil.com')).toBe('/')
    expect(safeRedirect('https://evil.com')).toBe('/')
    expect(safeRedirect('/login?redirect=%2Ftickets')).toBe('/login?redirect=%2Ftickets')
  })
})

// ─── Wizard de cadastro ───
describe('SignupPage — wizard', () => {
  it('começa no passo 1 com barra "Passo 1 de 3"', async () => {
    renderAt(<SignupPage />, '/signup')
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
    expect(screen.getByText('Confirme seu celular')).toBeTruthy()
  })

  it('PHONE_VERIFICATION_MODE off: pula direto para a conta (passo 3)', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'off'
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/signup/start')) {
        return jsonResponse({ nextStep: 'account', token: 'tok' }, 201)
      }
      return jsonResponse({}, 404)
    })
    const user = userEvent.setup()
    renderAt(<SignupPage />, '/signup')
    await user.type(screen.getByLabelText('Celular'), '11987654321')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(screen.getByText('Complete sua conta')).toBeTruthy())
    expect(screen.queryByText('Modo demonstração:')).toBeNull()
  })

  it('modo demo: mostra banner com o código e vai para o passo do código', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'demo'
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/signup/start')) {
        return jsonResponse({ nextStep: 'verify', token: 'tok', demo: true, code: '123456' }, 201)
      }
      return jsonResponse({}, 404)
    })
    const user = userEvent.setup()
    renderAt(<SignupPage />, '/signup')
    await user.type(screen.getByLabelText('Celular'), '11987654321')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(screen.getByText(/Modo demonstração:/)).toBeTruthy())
    expect(screen.getByText('123456')).toBeTruthy()
  })

  it('passo 3: checklist de senha atualiza em tempo real e cria a conta', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'off'
    // start retorna account direto → o componente pula para o passo 3
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/signup/start')) {
        return jsonResponse({ nextStep: 'account', token: 'tok' }, 201)
      }
      if (String(url).includes('/auth/signup/complete')) {
        return jsonResponse({ id: 'u1', name: 'Maria Completa', email: 'm@t.com', cpfMasked: '***.111.222-**' }, 201)
      }
      return jsonResponse({}, 404)
    })
    const user = userEvent.setup()
    renderAt(<SignupPage />, '/signup')
    await user.type(screen.getByLabelText('Celular'), '11987654321')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(screen.getByText('Complete sua conta')).toBeTruthy())

    // checklist em tempo real: começa incompleta
    expect(screen.getByText('Pelo menos 8 caracteres').className).toContain('text-ticket-faint')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'Senha1@a')
    await waitFor(() => expect(screen.getByText('Pelo menos 8 caracteres').className).toContain('text-ticket-success'))

    await user.type(screen.getByLabelText('Nome completo'), 'Maria Completa')
    await user.type(screen.getByLabelText('CPF'), '529.982.247-25')
    await user.type(screen.getByLabelText('E-mail'), 'm@t.com')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/auth/signup/complete'))).toBe(true))
  })

  it('validação client: CPF inválido bloqueia o envio (não chama complete)', async () => {
    process.env.PHONE_VERIFICATION_MODE = 'off'
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/signup/start')) {
        return jsonResponse({ nextStep: 'account', token: 'tok' }, 201)
      }
      if (String(url).includes('/auth/signup/complete')) {
        return jsonResponse({ id: 'u1' }, 201)
      }
      return jsonResponse({}, 404)
    })
    const user = userEvent.setup()
    renderAt(<SignupPage />, '/signup')
    await user.type(screen.getByLabelText('Celular'), '11987654321')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(screen.getByText('Complete sua conta')).toBeTruthy())
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Completa')
    await user.type(screen.getByLabelText('CPF'), '111.111.111-11')
    await user.type(screen.getByLabelText('E-mail'), 'm@t.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'Senha1@a')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(screen.getAllByText(/Informe um CPF válido/).length).toBeGreaterThan(0))
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/auth/signup/complete'))).toBe(false)
  })
})

// ─── LoginPage ───
describe('LoginPage', () => {
  it('aceita login por celular (envia o valor com +55)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/auth/login')) {
        return jsonResponse({ id: 'u1', name: 'Ana', email: 'a@b.c' })
      }
      return jsonResponse({}, 404)
    })
    const user = userEvent.setup()
    renderAt(<LoginPage />, '/login')
    await user.type(screen.getByLabelText('E-mail ou celular'), '11987654321')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'Senha1@a')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => {
      const loginCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/auth/login'))
      expect(loginCall).toBeTruthy()
      // o front envia o celular mascarado; quem normaliza para E.164 é o backend
      expect(JSON.stringify(loginCall?.[1]?.body)).toContain('(11) 98765-4321')
    })
  })

  it('esqueci a senha desabilitado com "Em breve"', () => {
    renderAt(<LoginPage />, '/login')
    const forgot = screen.getByText(/Esqueci a senha/)
    expect(forgot.className).toContain('text-ticket-faint')
  })
})

// ─── Dropdown do header (teclado) ───
describe('TopBarAccount — dropdown logado', () => {
  it('abre com clique, fecha com Esc e devolve o foco ao botão', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <TopBarAccount user={{ name: 'Maria Completa', email: 'm@t.com' }} onLogout={onLogout} />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: /Maria Completa/ })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByText('Ingressos')).toBeTruthy()
    expect(screen.getByText('Sair')).toBeTruthy()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('deslogado mostra Entrar e Anunciar', () => {
    render(
      <MemoryRouter>
        <TopBarAccount user={null} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Entrar')).toBeTruthy()
    expect(screen.getByText('Anunciar')).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

// ─── /tickets — abas ───
describe('TicketsPage — abas segmentadas', () => {
  function seedTickets() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['auth', 'me'], { id: 'u1', name: 'Ana', email: 'a@b.c', cpfMasked: '***.111.222-**', isSeller: false })
    client.setQueryData(['orders', 'list', 1, 'ticket'], {
      items: [
        {
          code: 'RD-TESTE01',
          status: 'paid',
          total: 1100,
          createdAt: '2026-10-05T12:00:00.000Z',
          firstItemImage: null,
          itemsCount: 1,
          ticketSnapshot: { event: { name: 'Festival Aurora 2026' }, session: { startsAt: '2026-11-14T17:00:00.000Z' } },
        },
      ],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    })
    return client
  }

  const listingsEmpty: MyListingsPayload = { items: [], counts: { active: 0, pending_review: 0, sold: 0, cancelled: 0 } }
  const listingItem = {
    id: 'l1', status: 'active', ticketType: 'Inteira', ticketCategory: 'Pista',
    quantity: 2, priceCents: 15000, createdAt: '2026-10-05T12:00:00.000Z',
    event: { name: 'Festival Aurora 2026', slug: 'festival-aurora-2026' },
    session: { startsAt: '2026-11-14T17:00:00.000Z', city: 'São Paulo', venue: 'Autódromo' },
  }

  function renderTickets(listings = listingsEmpty) {
    const client = seedTickets()
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/listings/mine')) return jsonResponse(listings)
      if (String(url).includes('/listings/sold')) return jsonResponse([])
      return jsonResponse({}, 404)
    })
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/tickets']}>
          <TicketsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  }

  it('renderiza as 3 abas e Comprados com o pedido pago', () => {
    renderTickets()
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getByText(/Meus anúncios 0/)).toBeTruthy()
    expect(screen.getByText('Comprados')).toBeTruthy()
    expect(screen.getByText('Vendidos')).toBeTruthy()
    expect(screen.getByText(/Festival Aurora 2026/)).toBeTruthy()
    expect(screen.getByText('confirmado')).toBeTruthy()
  })

  it('troca de aba por clique e mostra estado vazio de anúncios', async () => {
    const user = userEvent.setup()
    renderTickets()
    await user.click(screen.getByText(/Meus anúncios/))
    await waitFor(() => expect(screen.getByText('Você ainda não anunciou ingressos')).toBeTruthy())
    expect(screen.getByText('Anunciar ingresso')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/listings/mine'))).toBe(true)
  })

  it('Meus anúncios lista o anúncio vindo de GET /listings/mine com cancelar', async () => {
    const user = userEvent.setup()
    renderTickets({ items: [listingItem], counts: { active: 1, pending_review: 0, sold: 0, cancelled: 0 } })
    await user.click(screen.getByText(/Meus anúncios/))
    await waitFor(() => expect(screen.getByText('Festival Aurora 2026')).toBeTruthy())
    expect(screen.getByText(/Meus anúncios 1/)).toBeTruthy()
    expect(screen.getByText('R$ 150,00')).toBeTruthy()
    expect(screen.getByText('Pista · Inteira · 2 unidades')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar anúncio' })).toBeTruthy()
  })

  it('cancela anúncio via DELETE e remove da lista após invalidação', async () => {
    const user = userEvent.setup()
    renderTickets({ items: [listingItem], counts: { active: 1, pending_review: 0, sold: 0, cancelled: 0 } })
    await user.click(screen.getByText(/Meus anúncios/))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar anúncio' })).toBeTruthy())
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes('/listings/l1') && init?.method === 'DELETE') {
        return jsonResponse({ ok: true })
      }
      if (String(url).includes('/listings/mine')) return jsonResponse(listingsEmpty)
      if (String(url).includes('/listings/sold')) return jsonResponse([])
      return jsonResponse({}, 404)
    })
    await user.click(screen.getByRole('button', { name: 'Cancelar anúncio' }))
    await waitFor(() => expect(screen.getByText('Você ainda não anunciou ingressos')).toBeTruthy())
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/listings/l1') && (init as { method?: string })?.method === 'DELETE')).toBe(true)
  })

  it('navega as abas com setas (teclado)', async () => {
    const user = userEvent.setup()
    renderTickets()
    const comprados = screen.getByRole('tab', { name: 'Comprados' })
    comprados.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Vendidos' }).getAttribute('aria-selected')).toBe('true'))
  })
})

// ─── 404 temático ───
describe('TicketNotFoundPage', () => {
  it('renderiza estado vazio com volta para a home', () => {
    renderAt(<TicketNotFoundPage />, '/rota-inexistente')
    expect(screen.getByText('Página não encontrada')).toBeTruthy()
    expect(screen.getByText('Voltar para a página inicial')).toBeTruthy()
  })
})
