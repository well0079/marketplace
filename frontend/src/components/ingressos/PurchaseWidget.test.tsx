import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PurchaseWidget } from './PurchaseWidget'

// Widget "Compra em andamento": aparece com reserva ativa em rotas de ingressos,
// oculto em /checkout, /payments/* e /checkout/success; expira → toast; correção
// de relógio pelo header Date; sincroniza abas via storage event (fallback BC).

const RESERVATION = {
  id: 'r1',
  quantity: 2,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  offer: {
    id: 'offer1', ticketType: 'Inteira', ticketCategory: 'Pista', priceCents: 10000,
    session: { id: 's1', startsAt: '2026-11-14T17:00:00.000Z', city: 'São Paulo', venue: 'Autódromo' },
    event: { slug: 'festival-aurora-2026', name: 'Festival Aurora 2026' },
  },
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

function resWith(body: unknown, dateHeader?: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'date' && dateHeader ? dateHeader : null) },
    json: async () => body,
  }
}

function renderWidgetAt(path = '/tickets') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <PurchaseWidget>
              <div>CHILD-CONTENT</div>
            </PurchaseWidget>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PurchaseWidget', () => {
  it('com reserva ativa: region, evento, contador e link correto para o checkout', async () => {
    fetchMock.mockResolvedValue(resWith([RESERVATION]))
    renderWidgetAt('/tickets')
    const region = await screen.findByRole('region', { name: 'Compra em andamento' })
    expect(region).toBeTruthy()
    expect(screen.getByText('Festival Aurora 2026')).toBeTruthy()
    expect(screen.getByText(/R\$ 100/)).toBeTruthy()
    const time = screen.getByText(/\d{2}:\d{2}/)
    expect(time).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Voltar ao checkout →' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/checkout?offer=offer1')
    expect(screen.getByText('CHILD-CONTENT')).toBeTruthy()
  })

  it('oculto em /checkout, /payments/:id e /checkout/success (children continuam)', () => {
    fetchMock.mockResolvedValue(resWith([RESERVATION]))
    for (const path of ['/checkout?offer=offer1', '/payments/pay-1', '/checkout/success']) {
      const { unmount } = renderWidgetAt(path)
      expect(screen.queryByRole('region', { name: 'Compra em andamento' })).toBeNull()
      expect(screen.getByText('CHILD-CONTENT')).toBeTruthy()
      unmount()
    }
  })

  it('sem reserva ativa: não renderiza nada além dos children', async () => {
    fetchMock.mockResolvedValue(resWith([]))
    renderWidgetAt('/tickets')
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Compra em andamento' })).toBeNull()
    expect(screen.queryByText('Sua reserva expirou')).toBeNull()
  })

  it('reserva expirada: widget some e mostra toast "Sua reserva expirou"', async () => {
    fetchMock.mockResolvedValue(resWith([{ ...RESERVATION, expiresAt: new Date(Date.now() - 1000).toISOString() }]))
    renderWidgetAt('/tickets')
    const toast = await screen.findByText('Sua reserva expirou')
    expect(toast).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Compra em andamento' })).toBeNull()
  })

  it('corrige relógio pelo header Date (servidor 5 min à frente)', async () => {
    // expiresAt está a ~30s do relógio LOCAL, mas o servidor está 5 min à frente:
    // o widget deve mostrar ~05:30, não 00:29.
    const serverNow = Date.now() + 5 * 60 * 1000
    fetchMock.mockResolvedValue(resWith([{ ...RESERVATION, expiresAt: new Date(Date.now() + 30 * 1000).toISOString() }], new Date(serverNow).toUTCString()))
    renderWidgetAt('/tickets')
    const time = await screen.findByText(/0[45]:\d{2}/)
    expect(time.textContent).toMatch(/^0[45]:\d{2}$/)
  })

  it('storage event reservation-cancelled (outra aba): widget some', async () => {
    fetchMock.mockResolvedValue(resWith([RESERVATION]))
    renderWidgetAt('/tickets')
    await screen.findByRole('region', { name: 'Compra em andamento' })
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'ingressos-reservation',
      newValue: JSON.stringify({ type: 'reservation-cancelled' }),
    }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Compra em andamento' })).toBeNull())
    expect(screen.queryByText('Sua reserva expirou')).toBeNull()
  })
})
