import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SearchPage } from './SearchPage'

// /search do tema ingressos: URL como fonte da verdade, chips ⇄ select de Data
// compartilham estado, Limpar filtro preserva o q, Carregar mais pagina pela URL.

const fetchMock = vi.fn()

const EVENT_PAGE_1 = {
  items: [
    { id: 'e1', slug: 'festival-aurora-2026', name: 'Festival Aurora 2026', category: 'Festivais', city: 'São Paulo', nextSessionAt: '2026-11-14T17:00:00.000Z', minPriceCents: 6000, featured: true, imageUrl: null },
  ],
  page: 1, limit: 12, total: 14, totalPages: 2,
}

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

function LocationProbe() {
  const loc = useLocation()
  return <div>URL:{loc.pathname}{loc.search}</div>
}

function renderSearch(initial: string, eventsBody: unknown = EVENT_PAGE_1, status = 200) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/api/v1/events')) return jsonResponse(eventsBody, status)
    return jsonResponse({}, 404)
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/search" element={<><LocationProbe /><SearchPage /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SearchPage — estado na URL', () => {
  it('chip "Neste fim de semana" grava period=weekend na URL e marca o select de Data', async () => {
    const user = userEvent.setup()
    renderSearch('/search?q=aurora')
    await waitFor(() => expect(screen.getByText('URL:/search?q=aurora')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /Neste fim de semana/ }))
    expect(screen.getByText('URL:/search?q=aurora&period=weekend')).toBeTruthy()

    const dataSelect = screen.getByLabelText('Data') as HTMLSelectElement
    await waitFor(() => expect(dataSelect.value).toBe('weekend'))
    expect(screen.getByRole('button', { name: /Neste fim de semana/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('select de Data escolhe "Este mês": URL period=month e chip correspondente pressionado', async () => {
    const user = userEvent.setup()
    renderSearch('/search')
    await waitFor(() => expect(screen.getByText('URL:/search')).toBeTruthy())

    await user.selectOptions(screen.getByLabelText('Data'), 'month')
    expect(screen.getByText('URL:/search?period=month')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Este mês/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('Limpar filtro mantém o q e remove category/period/sort', async () => {
    const user = userEvent.setup()
    renderSearch('/search?q=aurora&category=Shows&period=month&sort=date')
    await waitFor(() => expect(screen.getByText(/URL:\/search\?q=aurora&category=Shows/)).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Limpar filtro' }))
    expect(screen.getByText('URL:/search?q=aurora')).toBeTruthy()
  })

  it('Carregar mais pagina pela URL (?page=2) e refetch usa page=2', async () => {
    const user = userEvent.setup()
    renderSearch('/search')
    await waitFor(() => expect(screen.getByText('Festival Aurora 2026')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(screen.getByText('URL:/search?page=2')).toBeTruthy()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('page=2'))).toBe(true))
  })

  it('sem resultados mostra empty state', async () => {
    renderSearch('/search?q=nada', { items: [], page: 1, limit: 12, total: 0, totalPages: 1 })
    await waitFor(() => expect(screen.getByText('Nenhum evento encontrado')).toBeTruthy())
    expect(screen.getByText(/Não achamos eventos para "nada"/)).toBeTruthy()
  })

  it('erro na busca mostra ErrorState com Tentar novamente', async () => {
    renderSearch('/search', { error: { message: 'boom', code: 'INTERNAL' } }, 500)
    await waitFor(() => expect(screen.getByText('Não conseguimos buscar os eventos.')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
  })
})
