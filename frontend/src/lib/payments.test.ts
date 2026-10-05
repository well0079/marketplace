import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatCountdown,
  isActivePaymentStatus,
  paymentRefetchInterval,
  paymentStatusMeta,
  pixQrCodeKind,
  secondsUntil,
  type PaymentDetail,
} from './payments'

const WAITING: PaymentDetail = {
  paymentId: 'p1',
  status: 'WAITING_PAYMENT',
  paid: false,
  orderCode: 'RD-AB12CD34',
  amount: 15000,
  pix: { qrCode: '00020126...', qrImageUrl: null, expiresAt: '2099-01-01T00:00:00Z' },
}

describe('paymentRefetchInterval', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const hidden = (value: boolean) => {
    vi.stubGlobal('document', { hidden: value })
  }

  it('polling ativo em WAITING_PAYMENT com aba visível', () => {
    hidden(false)
    expect(paymentRefetchInterval({ state: { data: WAITING, fetchStatus: 'idle' } })).toBe(4000)
  })

  it('pausa com aba oculta e para quando pago/refusado', () => {
    hidden(true)
    expect(paymentRefetchInterval({ state: { data: WAITING, fetchStatus: 'idle' } })).toBe(false)
    hidden(false)
    expect(paymentRefetchInterval({ state: { data: { ...WAITING, status: 'PAID' }, fetchStatus: 'idle' } })).toBe(false)
    expect(paymentRefetchInterval({ state: { data: null, fetchStatus: 'fetching' } })).toBe(false)
  })
})

describe('secondsUntil / formatCountdown', () => {
  it('conta segundos restantes; null sem data válida', () => {
    const now = Date.parse('2026-10-05T12:00:00Z')
    expect(secondsUntil('2026-10-05T12:01:00Z', now)).toBe(60)
    expect(secondsUntil('2026-10-05T11:00:00Z', now)).toBeLessThan(0)
    expect(secondsUntil(null, now)).toBeNull()
    expect(secondsUntil('not-a-date', now)).toBeNull()
  })

  it('formato mm:ss e nunca negativo', () => {
    expect(formatCountdown(60)).toBe('01:00')
    expect(formatCountdown(5)).toBe('00:05')
    expect(formatCountdown(-10)).toBe('00:00')
  })
})

describe('pixQrCodeKind', () => {
  it('classifica base64 PNG, URL e texto EMV', () => {
    expect(pixQrCodeKind('iVBORw0KGgoAAA')).toBe('image')
    expect(pixQrCodeKind('data:image/png;base64,xx')).toBe('image')
    expect(pixQrCodeKind('https://pix.example.com/qr/1')).toBe('url')
    expect(pixQrCodeKind('00020126580052BR...')).toBe('text')
    expect(pixQrCodeKind(null)).toBeNull()
  })
})

describe('paymentStatusMeta / isActivePaymentStatus', () => {
  it('mapeia rótulos por status', () => {
    expect(paymentStatusMeta('PAID').tone).toBe('paid')
    expect(paymentStatusMeta('REFUSED').tone).toBe('refused')
    expect(paymentStatusMeta('CANCELED').tone).toBe('refused')
    expect(paymentStatusMeta('WAITING_PAYMENT').tone).toBe('waiting')
    expect(isActivePaymentStatus('PROCESSING')).toBe(true)
    expect(isActivePaymentStatus('PAID')).toBe(false)
  })
})
