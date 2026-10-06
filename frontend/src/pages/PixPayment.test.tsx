import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PixPayment } from './PixPayment'
import { CheckoutSuccess } from './CheckoutSuccess'
import { paymentQueryKey, type PaymentDetail } from '../lib/payments'
import { orderQueryKey, type OrderDetail } from '../lib/orders'
import { ApiClientError } from '../lib/api'
import type { PublicUser } from '../lib/auth'
import { seedErrorState } from '../test/query-test-utils'

const USER: PublicUser = { id: 'u1', name: 'Ana Silva', email: 'ana@teste.com' }

const WAITING: PaymentDetail = {
  paymentId: 'pay-1',
  status: 'WAITING_PAYMENT',
  paid: false,
  orderCode: 'RD-AB12CD34',
  amount: 15000,
  pix: { qrCode: '00020126COPIA-E-COLA', qrImageUrl: null, expiresAt: '2099-01-01T00:00:00Z' },
}

const ORDER_PAID: OrderDetail = {
  code: 'RD-AB12CD34',
  status: 'paid',
  paymentPending: false,
  subtotal: 15000,
  shippingCost: 0,
  discount: 0,
  total: 15000,
  deliveryOption: null,
  shippingAddress: { recipient: 'Ana Silva', street: 'Av Paulista', number: '1' },
  items: [],
  createdAt: '2026-10-05T12:00:00.000Z',
  ticketSnapshot: null,
  activePaymentId: null,
  cancelledAt: null,
}

const NOT_FOUND = new ApiClientError('Pagamento não encontrado', 'NOT_FOUND', 404)

function renderWith(
  element: ReactElement,
  seeds: { payment?: PaymentDetail | 'error'; order?: OrderDetail | 'error'; path: string },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
  })
  client.setQueryData(['auth', 'me'], USER)
  if (seeds.payment === 'error') seedErrorState(client, paymentQueryKey('pay-1'), NOT_FOUND)
  else if (seeds.payment) client.setQueryData(paymentQueryKey('pay-1'), seeds.payment)
  if (seeds.order === 'error') seedErrorState(client, orderQueryKey('RD-AB12CD34'), NOT_FOUND)
  else if (seeds.order) client.setQueryData(orderQueryKey('RD-AB12CD34'), seeds.order)

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[seeds.path]}>
        <Routes>
          <Route path="/payments/:id" element={element} />
          <Route path="/checkout/success" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PixPayment — estados', () => {
  it('carregando exibe skeleton', () => {
    const html = renderWith(<PixPayment />, { path: '/payments/pay-1' })
    expect((html.match(/animate-pulse/g) ?? []).length).toBeGreaterThan(2)
  })

  it('404 mostra estado vazio', () => {
    const html = renderWith(<PixPayment />, { payment: 'error', path: '/payments/pay-1' })
    expect(html).toContain('Pagamento não encontrado')
  })

  it('aguardando: QR do copia e cola, valor, validade e botão copiar', () => {
    const html = renderWith(<PixPayment />, { payment: WAITING, path: '/payments/pay-1' })
    expect(html).toContain('Pagamento Pix')
    expect(html).toContain('RD-AB12CD34')
    expect(html).toContain('R$ 150,00')
    expect(html).toContain('Copiar código Pix')
    expect(html).toContain('Escaneie o código')
    expect(html).toContain('Expira em')
  })

  it('QR em base64 PNG renderiza como imagem (formato do example da doc)', () => {
    const html = renderWith(<PixPayment />, {
      payment: { ...WAITING, pix: { qrCode: 'iVBORw0KGgoAAAANSUhEUgAA', qrImageUrl: null, expiresAt: null } },
      path: '/payments/pay-1',
    })
    expect(html).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA')
    expect(html).not.toContain('Copiar código Pix')
  })

  it('expirado mostra aviso e botão de novo Pix', () => {
    const html = renderWith(<PixPayment />, {
      payment: { ...WAITING, pix: { qrCode: '00020126', qrImageUrl: null, expiresAt: '2020-01-01T00:00:00Z' } },
      path: '/payments/pay-1',
    })
    expect(html).toContain('QR Code expirado')
    expect(html).toContain('Gerar novo Pix')
  })

  it('recusado mostra mensagem e caminho de volta', () => {
    const html = renderWith(<PixPayment />, { payment: { ...WAITING, status: 'REFUSED' }, path: '/payments/pay-1' })
    expect(html).toContain('Pagamento não concluído')
    expect(html).toContain('Voltar para o pedido')
  })
})

describe('CheckoutSuccess — só success com pedido pago', () => {
  it('pedido pago mostra confirmação', () => {
    const html = renderWith(<CheckoutSuccess />, { order: ORDER_PAID, path: '/checkout/success?order=RD-AB12CD34' })
    expect(html).toContain('Pagamento confirmado!')
    expect(html).toContain('Pago')
    expect(html).toContain('R$ 150,00')
  })

  it('pedido NÃO pago é bloqueado: sem "confirmado", com link para o pedido', () => {
    const html = renderWith(<CheckoutSuccess />, {
      order: { ...ORDER_PAID, status: 'pending' as const },
      path: '/checkout/success?order=RD-AB12CD34',
    })
    expect(html).toContain('Pagamento ainda pendente')
    expect(html).not.toContain('Pagamento confirmado!')
  })

  it('sem order na URL mostra skeleton (nada de sucesso falso)', () => {
    const html = renderWith(<CheckoutSuccess />, { path: '/checkout/success' })
    expect(html).not.toContain('Pagamento confirmado')
  })

  it('pedido inexistente mostra estado vazio', () => {
    const html = renderWith(<CheckoutSuccess />, { order: 'error', path: '/checkout/success?order=RD-AB12CD34' })
    expect(html).toContain('Pedido não encontrado')
  })
})
