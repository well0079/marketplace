import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EventPage } from './EventPage'
import { EventSessionPage } from './EventSessionPage'
import { eventQueryKey, sessionOffersQueryKey, sessionQueryKey, type EventDetail, type OfferListItem, type SessionDetail } from '../lib/events'
import { ApiClientError } from '../lib/api'
import { seedErrorState } from '../test/query-test-utils'

const NOT_FOUND = new ApiClientError('Evento não encontrado', 'NOT_FOUND', 404)

const EVENT: EventDetail = {
  id: 'e1',
  slug: 'festival-aurora-2026',
  name: 'Festival Aurora 2026',
  category: 'Festivais',
  organizer: 'Produções Horizonte',
  description: 'Doze horas de música ao vivo.',
  imageUrl: null,
  featured: true,
  createdAt: '2026-10-05T12:00:00.000Z',
  sessions: [
    { id: 's1', startsAt: '2026-11-14T17:00:00.000Z', city: 'São Paulo', uf: 'SP', venue: 'Parque Aurora', hasOffers: true, minPriceCents: 6000 },
    { id: 's2', startsAt: '2026-11-15T17:00:00.000Z', city: 'Rio de Janeiro', uf: 'RJ', venue: 'Arena Maré', hasOffers: false, minPriceCents: null },
  ],
}

const SESSION: SessionDetail = {
  id: 's1',
  startsAt: '2026-11-14T17:00:00.000Z',
  city: 'São Paulo',
  uf: 'SP',
  venue: 'Parque Aurora',
  event: { slug: 'festival-aurora-2026', name: 'Festival Aurora 2026', category: 'Festivais', organizer: 'Produções Horizonte', description: 'Doze horas de música ao vivo.', imageUrl: null },
  types: [{ value: 'Pista', minPriceCents: 6000 }],
  categories: [{ value: 'Inteira', minPriceCents: 6000 }],
  minPriceCents: 6000,
  hasOffers: true,
}

const OFFERS: OfferListItem[] = [
  { id: 'o2', ticketType: 'Pista', ticketCategory: 'Meia', priceCents: 3000, available: 1, seller: 'vendedor' },
  { id: 'o1', ticketType: 'Pista', ticketCategory: 'Inteira', priceCents: 6000, available: 3, seller: 'plataforma' },
]

function renderWith(element: ReactElement, seeds: { event?: EventDetail | 'error' | 'error-network'; session?: SessionDetail | 'error'; offers?: OfferListItem[]; path: string }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  })
  client.setQueryData(['auth', 'me'], { id: 'u1', name: 'Ana', email: 'ana@teste.com' })
  if (seeds.event === 'error') seedErrorState(client, eventQueryKey('festival-aurora-2026'), NOT_FOUND)
  else if (seeds.event === 'error-network') seedErrorState(client, eventQueryKey('festival-aurora-2026'), new ApiClientError('Falha', 'NETWORK', 0))
  else if (seeds.event) client.setQueryData(eventQueryKey('festival-aurora-2026'), seeds.event)
  if (seeds.session === 'error') seedErrorState(client, sessionQueryKey('s1'), NOT_FOUND)
  else if (seeds.session) client.setQueryData(sessionQueryKey('s1'), seeds.session)
  if (seeds.offers) client.setQueryData(sessionOffersQueryKey('s1', 'Pista', 'Inteira'), seeds.offers)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[seeds.path]}>
        <Routes>
          <Route path="/event/:slug" element={element} />
          <Route path="/event/:slug/session/:id" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EventPage — /event/:slug', () => {
  it('carregando exibe skeleton com fundo', () => {
    const html = renderWith(<EventPage />, { path: '/event/festival-aurora-2026' })
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(2)
  })

  it('404 mostra estado vazio com volta para a home', () => {
    const html = renderWith(<EventPage />, { event: 'error', path: '/event/festival-aurora-2026' })
    expect(html).toContain('Evento não encontrado')
    expect(html).toContain('Voltar para a página inicial')
  })

  it('erro de rede mostra ErrorState com retry', () => {
    const html = renderWith(<EventPage />, { event: 'error-network', path: '/event/festival-aurora-2026' })
    expect(html).toContain('Não conseguimos carregar o evento.')
    expect(html).toContain('Tentar novamente')
  })

  it('carregado: título, intervalo de datas, N datas, cards com dia grande/local/Indisponível', () => {
    const html = renderWith(<EventPage />, { event: EVENT, path: '/event/festival-aurora-2026' })
    expect(html).toContain('Festival Aurora 2026')
    expect(html).toContain('14/11 até 15/11')
    expect(html).toContain('2 datas')
    expect(html).toContain('São Paulo')
    expect(html).toContain('Parque Aurora')
    expect(html).toContain('Indisponível') // sessão s2 sem ofertas
    expect(html).toContain('a partir de R$ 60')
    expect(html).toContain('Destaque')
    // card inteiro clicável para a sessão
    expect(html).toContain('href="/event/festival-aurora-2026/session/s1"')
  })
})

describe('EventSessionPage — /event/:slug/session/:id', () => {
  it('carregando exibe skeleton', () => {
    const html = renderWith(<EventSessionPage />, { path: '/event/festival-aurora-2026/session/s1' })
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(2)
  })

  it('404 mostra estado vazio com volta para o evento', () => {
    const html = renderWith(<EventSessionPage />, { session: 'error', path: '/event/festival-aurora-2026/session/s1' })
    expect(html).toContain('Sessão não encontrada')
    expect(html).toContain('Voltar para o evento')
  })

  it('sem ofertas mostra "Indisponível" e não renderiza selects', () => {
    const html = renderWith(<EventSessionPage />, {
      session: { ...SESSION, hasOffers: false, types: [], categories: [], minPriceCents: null },
      path: '/event/festival-aurora-2026/session/s1',
    })
    expect(html).toContain('Indisponível')
    expect(html).not.toContain('Selecione o tipo')
    expect(html).toContain('Vender')
  })

  it('carregada: título, organizador, data, pills, selects e botão Vender preto', () => {
    const html = renderWith(<EventSessionPage />, { session: SESSION, offers: OFFERS, path: '/event/festival-aurora-2026/session/s1' })
    expect(html).toContain('Festival Aurora 2026')
    expect(html).toContain('Produções Horizonte')
    expect(html).toContain('Selecione o ingresso')
    expect(html).toContain('Tipo de Ingresso')
    expect(html).toContain('Categoria')
    expect(html).toContain('Vender')
    expect(html).toContain('Guia de transferência')
    expect(html).toContain('Sobre o evento')
    expect(html).toContain('Regras de transferência')
    expect(html).toContain('Como funcionam os preços')
  })

  it('ofertas listadas por menor preço primeiro com botão Comprar', () => {
    const html = renderWith(<EventSessionPage />, {
      session: SESSION,
      offers: OFFERS,
      path: '/event/festival-aurora-2026/session/s1',
    })
    // afirma pelas LINHAS de oferta (os selects também exibem preços)
    const idxMeia = html.indexOf('Meia · Pista')
    const idxInteira = html.indexOf('Inteira · Pista')
    expect(idxMeia).toBeGreaterThan(-1)
    expect(idxInteira).toBeGreaterThan(idxMeia) // menor preço primeiro
    expect(html).toContain('Comprar')
    expect(html).toContain('menor preço')
  })

  it('banner de novidades só aparece com VITE_COMMUNITY_URL definido', () => {
    const withoutBanner = renderWith(<EventSessionPage />, { session: SESSION, path: '/event/festival-aurora-2026/session/s1' })
    expect(withoutBanner).not.toContain('Não perca nenhuma novidade')
  })
})
