import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EventSessionPage } from './EventSessionPage'
import { TopBar as TopBarAccount } from '../components/ingressos/TopBarAccount'
import { eventQueryKey, sessionOffersQueryKey, sessionQueryKey, type EventDetail, type OfferListItem, type SessionDetail } from '../lib/events'

// Gates de compra/venda/anúncio:
// - Comprar anônimo → /login?redirect=de volta à sessão; logado → /checkout?offer=
// - Vender (sem ofertas) → /sellers/verify
// - Anunciar (TopBar) → /sellers/verify

const SESSION: SessionDetail = {
  id: 's1',
  startsAt: '2026-11-14T17:00:00.000Z',
  city: 'São Paulo',
  uf: 'SP',
  venue: 'Parque Aurora',
  event: { slug: 'festival-aurora-2026', name: 'Festival Aurora 2026', category: 'Festivais', organizer: 'Produções Horizonte', description: 'Doze horas.', imageUrl: null },
  types: [{ value: 'Pista', minPriceCents: 6000 }],
  categories: [{ value: 'Inteira', minPriceCents: 6000 }],
  minPriceCents: 6000,
  hasOffers: true,
}

const OFFERS: OfferListItem[] = [
  { id: 'o1', ticketType: 'Pista', ticketCategory: 'Inteira', priceCents: 6000, available: 3, seller: 'plataforma' },
]

function Probe({ tag }: { tag: string }) {
  const loc = useLocation()
  return <div>PROBE:{tag}:{loc.pathname}{loc.search}</div>
}

function renderRoutes(path: string, user: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } })
  client.setQueryData(['auth', 'me'], user)
  client.setQueryData(eventQueryKey('festival-aurora-2026'), { id: 'e1', slug: 'festival-aurora-2026', name: 'Festival Aurora 2026' } as unknown as EventDetail)
  client.setQueryData(sessionQueryKey('s1'), SESSION)
  client.setQueryData(sessionOffersQueryKey('s1', 'Pista', 'Inteira'), OFFERS)
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/event/:slug/session/:id" element={<EventSessionPage />} />
          <Route path="/login" element={<Probe tag="LOGIN" />} />
          <Route path="/checkout" element={<Probe tag="CHECKOUT" />} />
          <Route path="/sellers/verify" element={<Probe tag="VERIFY" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => cleanup())

describe('Gates — Comprar (EventSessionPage)', () => {
  it('anônimo: Comprar leva para /login com redirect de volta à sessão', async () => {
    const user = userEvent.setup()
    renderRoutes('/event/festival-aurora-2026/session/s1', null)
    const comprar = await screen.findByRole('button', { name: 'Comprar' })
    expect(screen.getByText(/Para comprar ou vender você precisa entrar/)).toBeTruthy()
    await user.click(comprar)
    await waitFor(() => expect(screen.getByText(/PROBE:LOGIN:/)).toBeTruthy())
    expect(screen.getByText(/redirect=%2Fevent%2Ffestival-aurora-2026%2Fsession%2Fs1/)).toBeTruthy()
  })

  it('logado: Comprar navega para o checkout com a oferta escolhida', async () => {
    const user = userEvent.setup()
    renderRoutes('/event/festival-aurora-2026/session/s1', { id: 'u1', name: 'Ana', email: 'a@b.c' })
    const comprar = await screen.findByRole('button', { name: 'Comprar' })
    expect(screen.queryByText(/Para comprar ou vender você precisa entrar/)).toBeNull()
    await user.click(comprar)
    await waitFor(() => expect(screen.getByText(/PROBE:CHECKOUT:/)).toBeTruthy())
    expect(screen.getByText('PROBE:CHECKOUT:/checkout?offer=o1')).toBeTruthy()
  })

  it('sem ofertas: CTA Vender aponta para /sellers/verify', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } } })
    client.setQueryData(['auth', 'me'], null)
    client.setQueryData(eventQueryKey('festival-aurora-2026'), { id: 'e1', slug: 'festival-aurora-2026', name: 'Festival Aurora 2026' } as unknown as EventDetail)
    client.setQueryData(sessionQueryKey('s1'), SESSION)
    client.setQueryData(sessionOffersQueryKey('s1', 'Pista', 'Inteira'), [])
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/event/festival-aurora-2026/session/s1']}>
          <Routes>
            <Route path="/event/:slug/session/:id" element={<EventSessionPage />} />
            <Route path="/sellers/verify" element={<Probe tag="VERIFY" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const venderLinks = await screen.findAllByRole('link', { name: 'Vender' }) as HTMLAnchorElement[]
    const hrefs = venderLinks.map((a) => a.getAttribute('href'))
    // CTA principal vai para a verificação de vendedor; anônimo também tem o
    // gate "Vender" que pede login antes (de volta à sessão)
    expect(hrefs).toContain('/sellers/verify')
    expect(hrefs).toContain('/login?redirect=%2Fevent%2Ffestival-aurora-2026%2Fsession%2Fs1')
    expect(screen.queryByRole('button', { name: 'Comprar' })).toBeNull()
  })
})

describe('Gates — Anunciar (TopBar)', () => {
  it('deslogado: Anunciar leva para /sellers/verify (gate de vendedor)', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route path="*" element={<TopBarAccount user={null} />} />
          <Route path="/sellers/verify" element={<Probe tag="VERIFY" />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Entrar')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Anunciar' }))
    await waitFor(() => expect(screen.getByText('PROBE:VERIFY:/sellers/verify')).toBeTruthy())
  })

  it('logado: Anunciar também vai para /sellers/verify', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route path="*" element={<TopBarAccount user={{ name: 'Ana', email: 'a@b.c' }} />} />
          <Route path="/sellers/verify" element={<Probe tag="VERIFY" />} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Anunciar' }))
    await waitFor(() => expect(screen.getByText('PROBE:VERIFY:/sellers/verify')).toBeTruthy())
  })
})
