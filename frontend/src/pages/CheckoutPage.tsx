import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AUTH_QUERY_KEY, fetchCurrentUser } from '../lib/auth'
import {
  eventsApi,
  cancelReservationApi,
} from '../lib/events'
import { formatBRL } from '../lib/format'
import { isValidCpf, maskCpfInput } from '../lib/payer'
import { BrandLogo } from '../components/ingressos/BrandLogo'
import { LegalStrip, AlertBanner } from '../components/ingressos/Footer'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ingressos/Controls'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ingressos/Controls'

// /checkout?offer=ID — exige login. Modal de reserva ao entrar, sacola com
// contador, e-mail de recebimento, CPF (modal), pagamento Pix.
export function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const offer = searchParams.get('offer') ?? ''
  const meQuery = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchCurrentUser })
  const user = meQuery.data ?? null

  useEffect(() => {
    document.title = 'Finalizar compra | Ingressos'
  }, [])

  if (meQuery.isPending) {
    return (
      <div className="flex min-h-screen flex-col bg-ticket-surface-muted">
        <LegalStrip /><AlertBanner />
        <TicketCheckoutHeader eventSlug="" />
        <div className="mx-auto w-full max-w-[720px] px-4 py-8"><Skeleton className="h-64 w-full rounded-t-card" /></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-ticket-surface-muted">
        <LegalStrip /><AlertBanner />
        <TicketCheckoutHeader eventSlug="" />
        <div className="mx-auto max-w-[600px] px-4 py-16">
          <EmptyState
            title="Entre para finalizar a compra"
            description={`Você precisa de uma conta para comprar ingressos. ${offer ? 'Seu ingresso está reservado e esperando.' : ''}`}
            action={<Button size="sm" to={`/login?redirect=${encodeURIComponent(`/checkout?offer=${offer ?? ''}`)}`}>Entrar</Button>}
          />
        </div>
      </div>
    )
  }

  return <CheckoutContent offerId={offer ?? ''} />
}

// ─── Conteúdo interno (autenticado) ───

type CheckoutContentProps = { offerId: string }

function CheckoutContent({ offerId }: CheckoutContentProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Reserva ativa do usuário para esta oferta (reaproveita do bloco 2)
  const [reservation, setReservation] = useState<{
    id: string; quantity: number; expiresAt: string;
    offer: { id: string; ticketType: string; ticketCategory: string; priceCents: number;
      session: { id: string; startsAt: string; city: string; venue: string };
      event: { slug: string; name: string } }
  } | null>(null)

  const activeResQuery = useQuery({
    queryKey: ['reservations', 'active', offerId],
    queryFn: () => fetch('/api/v1/reservations/active', { headers: { Accept: 'application/json' } }).then((r) => r.json()) as Promise<Array<{ id: string; offer: { id: string }; expiresAt: string; quantity: number }>>,
    enabled: !!offerId,
  })

  useEffect(() => {
    if (!activeResQuery.data || !offerId) return
    const match = (activeResQuery.data as Array<{ id: string; offer: { id: string }; expiresAt: string; quantity: number }>).find(
      (r) => r.offer.id === offerId,
    )
    if (match) {
      setReservation(match as never)
    }
  }, [activeResQuery.data, offerId])

  // dados da oferta via sessão (quando a reserva existe)
  const sessionId = reservation?.offer.session.id
  const sessionQuery = useQuery({
    queryKey: ['events', 'session', sessionId ?? ''],
    queryFn: () => eventsApi.session(sessionId ?? ''),
    enabled: !!sessionId,
  })
  const eventSlug = sessionQuery.data?.event.slug ?? ''

  // oferta específica: preço/tipo/categoria (usar GET /sessions/:id/offers para buscar por ID)
  const offersQuery = useQuery({
    queryKey: ['checkout', 'offers', sessionId ?? ''],
    queryFn: () => eventsApi.offers(sessionId ?? '', {}),
    enabled: !!sessionId,
  })
  const offerData = useMemo(() => {
    if (!offersQuery.data || !offerId) return null
    return offersQuery.data.find((o) => o.id === offerId) ?? null
  }, [offersQuery.data, offerId])

  // ── Estado do checkout ──
  const [receiptEmail, setReceiptEmail] = useState<string | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [cpfModalOpen, setCpfModalOpen] = useState(false)
  const [cpfInput, setCpfInput] = useState('')
  const [cpfError, setCpfError] = useState<string | null>(null)
  const [couponOpen, setCouponOpen] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountCents: number } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const expiresAt = reservation?.expiresAt ? new Date(reservation.expiresAt).getTime() : null
  const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null
  const expired = secondsLeft !== null && secondsLeft <= 0

  // relógio (1s)
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  // ── Ordem + pagamento ──
  const idempotencyKey = useMemo(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now()}-${Math.random()}`
  }, [receiptEmail]) // nova key se o e-mail mudar

  const orderMutation = useMutation({
    mutationFn: () =>
      fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ reservationId: reservation?.id, receiptEmail, couponCode: couponApplied?.code }),
      }).then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? 'Erro'), { status: r.status, code: body?.error?.code })
        return body as { code: string }
      }),
  })

  const paymentMutation = useMutation({
    mutationFn: (orderCode: string) =>
      fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ orderCode, method: 'pix', payer: { document: cpfInput.replace(/\D/g, '') } }),
      }).then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? 'Erro'), { status: r.status, code: body?.error?.code })
        return body as { paymentId: string }
      }),
  })

  const couponMutation = useMutation({
    mutationFn: () =>
      fetch('/api/v1/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), reservationId: reservation?.id }),
      }).then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? 'Cupom inválido'), { status: r.status })
        return body as { code: string; discountedPriceCents: number; serviceFeeCents: number; totalCents: number }
      }),
    onSuccess: (data) => {
      setCouponApplied({ code: data.code, discountCents: priceCents - data.discountedPriceCents })
      setCouponError(null)
    },
    onError: (error) => setCouponError(error instanceof Error ? error.message : 'Cupom inválido.'),
  })

  function removeCoupon() {
    setCouponApplied(null)
    setCouponInput('')
    setCouponError(null)
  }

  async function handlePay() {
    if (!reservation || !receiptEmail) return
    setCpfModalOpen(false)
    try {
      const order = await orderMutation.mutateAsync()
      const payment = await paymentMutation.mutateAsync(order.code)
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      navigate(`/payments/${payment.paymentId}`)
    } catch {
      // erro tratado abaixo
    }
  }

  async function cancelReservation() {
    if (!reservation) return
    await cancelReservationApi(reservation.id)
    queryClient.invalidateQueries({ queryKey: ['reservations'] })
    navigate(eventSlug ? `/event/${eventSlug}` : '/')
  }

  // ── Render ──
  const payError = orderMutation.error ?? paymentMutation.error
  const payErrorMessage = payError instanceof Error ? payError.message : ''
  const isPaying = orderMutation.isPending || paymentMutation.isPending
  const canPay = !!receiptEmail && !expired && !isPaying

  // cálculo de valores (com cupom quando ativo)
  const priceCents = offerData?.priceCents ?? reservation?.offer.priceCents ?? 0
  const discountedPrice = couponApplied ? priceCents - couponApplied.discountCents : priceCents
  const fee = Math.round(discountedPrice * 0.1)
  const total = discountedPrice + fee

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-12 font-hanken">
      {/* SACOLA */}
      {reservation && !expired && secondsLeft !== null && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-t-card bg-ticket-primary-soft px-4 py-3">
          <div className="text-t-caption text-ticket-primary">
            <p className="font-semibold">Seu lugar está reservado</p>
            <p aria-live={secondsLeft <= 60 ? 'polite' : 'off'}>Depois disso, volta pra venda — {formatCountdown(secondsLeft)}</p>
          </div>
          <button type="button" onClick={() => void cancelReservation()} className="text-t-caption text-ticket-primary underline hover:no-underline">
            Cancelar reserva
          </button>
        </div>
      )}

      {expired && (
        <div className="mt-4 rounded-t-card bg-ticket-warn-soft p-4 text-center">
          <p className="text-t-body-strong text-ticket-warn">Sua reserva expirou: o Pix só será confirmado se ainda houver ingresso.</p>
          <Link to={eventSlug ? `/event/${eventSlug}` : '/'} className="mt-2 inline-block text-t-caption text-ticket-primary underline">Voltar ao evento</Link>
        </div>
      )}

      {/* QUEM RECEBE O INGRESSO */}
      <section aria-label="Quem recebe o ingresso" className="mt-6">
        <h2 className="font-lexend text-t-title text-ticket-text">Quem recebe o ingresso</h2>
        {receiptEmail ? (
          <div className="mt-2 flex items-center justify-between rounded-t-control border border-ticket-border bg-surface p-3">
            <span className="text-t-body-s text-ticket-text">{receiptEmail}</span>
            <button type="button" onClick={() => setEmailModalOpen(true)} className="text-t-caption text-ticket-primary underline">Alterar</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-t-control border-2 border-dashed border-ticket-primary-outline bg-ticket-primary-tint px-4 py-6 text-center transition-colors hover:bg-ticket-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
          >
            <span className="text-t-label-strong text-ticket-primary">Adicionar e-mail de recebimento</span>
            <span className="text-t-caption text-ticket-muted">Toque para informar quem recebe seu ingresso</span>
          </button>
        )}
      </section>

      {/* COMO VOCÊ VAI PAGAR */}
      <section aria-label="Como você vai pagar" className="mt-6">
        <h2 className="font-lexend text-t-title text-ticket-text">Como você vai pagar</h2>
        <div className="mt-3 flex flex-col gap-3">
          {/* PIX */}
          <div className="flex items-center gap-3 rounded-t-card border-2 border-ticket-primary bg-ticket-primary-soft p-4">
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-t-circle bg-ticket-pix text-on-ticket-white font-sora text-t-micro">Pix</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-t-label-strong text-ticket-text">Pix</span>
                <span className="rounded-t-pill bg-ticket-accent-soft px-2 py-0.5 text-t-nano text-ticket-success">Recomendado</span>
              </div>
              <p className="text-t-caption text-ticket-muted">Aprovação automática · sem taxa</p>
            </div>
            <span aria-hidden className="text-ticket-primary">●</span>
          </div>
          {/* CARTÃO */}
          <div className="flex items-center gap-3 rounded-t-card border border-ticket-border bg-surface p-4 opacity-50">
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-t-circle bg-ticket-surface2 text-ticket-muted">💳</span>
            <div className="flex-1">
              <span className="text-t-label text-ticket-muted">Cartão de crédito</span>
              <p className="text-t-caption text-ticket-faint">Parcele em até 12x</p>
            </div>
            <span className="rounded-t-pill bg-ticket-surface2 px-2 py-0.5 text-t-nano text-ticket-faint">Em breve</span>
          </div>
        </div>
      </section>

      {/* CUPOM */}
      {reservation && !expired && (
        <div className="mt-4">
          {couponApplied ? (
            <div className="flex items-center justify-between rounded-t-control bg-ticket-accent-soft px-3 py-2">
              <span className="text-t-caption-strong text-ticket-success">
                Cupom {couponApplied.code} −{formatBRL(couponApplied.discountCents)}
              </span>
              <button type="button" onClick={removeCoupon} className="text-t-caption text-ticket-danger underline">
                Remover
              </button>
            </div>
          ) : couponOpen ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Código do cupom"
                  aria-label="Código do cupom"
                  className="h-10 flex-1 rounded-t-control border border-ticket-border bg-surface px-3 text-t-body-s text-ticket-text uppercase placeholder:text-ticket-faint focus:outline-none focus:ring-2 focus:ring-ticket-primary-outline"
                />
                <button
                  type="button"
                  disabled={!couponInput.trim() || couponMutation.isPending}
                  onClick={() => couponMutation.mutate()}
                  className="h-10 rounded-t-control bg-ticket-primary px-3 text-t-caption-strong text-on-ticket-white disabled:opacity-50"
                >
                  {couponMutation.isPending ? '…' : 'Aplicar'}
                </button>
              </div>
              {couponError && <p className="text-t-caption text-ticket-danger">{couponError}</p>}
              <button type="button" onClick={() => setCouponOpen(false)} className="self-start text-t-caption text-ticket-muted underline">
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setCouponOpen(true)} className="text-t-caption text-ticket-primary underline">
              Tem cupom? Adicionar cupom
            </button>
          )}
        </div>
      )}

      {/* RESUMO SIMPLES */}
      <div className="mt-4 flex items-baseline justify-between rounded-t-control bg-surface px-3 py-2 shadow-t-row">
        <span className="text-t-label">Valor total</span>
        <span className="font-sora text-t-total text-ticket-primary">{formatBRL(total)}</span>
      </div>

      {/* AVISO AMBAR + BOTÃO PAGAR */}
      <div className="mt-6 rounded-t-card bg-ticket-caution-soft p-3 text-t-caption text-ticket-caution-text">
        Marketplace de revenda: os ingressos são de vendedores independentes e os preços são definidos por eles.
      </div>
      <button
        type="button"
        disabled={!canPay}
        onClick={() => setCpfModalOpen(true)}
        className="mt-3 h-12 w-full rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPaying ? 'Processando…' : 'Pagar'}
      </button>
      <p className="mt-2 text-center text-t-nano text-ticket-faint">
        Ao pagar você concorda com os{' '}
        <Link to="/terms" className="underline">Termos de uso</Link> e a{' '}
        <Link to="/privacy" className="underline">Política de privacidade</Link>.
      </p>

      {/* ERROS */}
      {payErrorMessage && (
        <div role="alert" className="mt-4 rounded-t-card bg-ticket-danger-soft p-3 text-t-caption text-ticket-danger">
          {payErrorMessage.includes('RESERVATION_EXPIRED') || payErrorMessage.includes('expirou')
            ? 'Sua reserva expirou. Volte ao evento e tente novamente.'
            : payErrorMessage.includes('estoque') || payErrorMessage.includes('STOCK')
              ? 'Não há mais ingressos disponíveis. Volte ao evento.'
              : payErrorMessage}
          <Link to={eventSlug ? `/event/${eventSlug}` : '/'} className="ml-1 underline">Voltar ao evento</Link>
        </div>
      )}

      {/* MODAIS */}
      {emailModalOpen && (
        <Modal title="E-mail de recebimento" onClose={() => setEmailModalOpen(false)}>
          <Field
            label="E-mail de recebimento"
            type="email"
            placeholder="quem@recebe.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            hint="O ingresso será transferido para este e-mail."
          />
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)}
              onClick={() => {
                setReceiptEmail(emailInput.trim().toLowerCase())
                setEmailModalOpen(false)
              }}
              className="h-10 rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press disabled:opacity-50"
            >
              Confirmar e-mail
            </button>
            <button type="button" onClick={() => setEmailModalOpen(false)} className="text-t-caption text-ticket-muted underline">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {cpfModalOpen && (
        <Modal title="Confirme seu CPF para gerar o Pix" onClose={() => setCpfModalOpen(false)}>
          <p className="text-t-caption text-ticket-muted">
            O CPF precisa ser o mesmo da sua conta. Ele é usado para validar o pagamento.
          </p>
          <div className="mt-3">
            <Field
              label="CPF"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpfInput}
              error={cpfError ?? undefined}
              onChange={(e) => {
                setCpfInput(maskCpfInput(e.target.value))
                setCpfError(null)
              }}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={!isValidCpf(cpfInput) || isPaying}
              onClick={() => void handlePay()}
              className="h-11 rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press disabled:opacity-50"
            >
              {isPaying ? 'Gerando Pix…' : 'Gerar Pix'}
            </button>
            <button type="button" onClick={() => setCpfModalOpen(false)} className="text-t-caption text-ticket-muted underline">
              Voltar
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function TicketCheckoutHeader({ eventSlug }: { eventSlug: string }) {
  return (
    <header className="bg-ticket-primary">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center px-2">
        {eventSlug ? (
          <Link to={`/event/${eventSlug}`} className="flex h-9 items-center rounded-t-control border border-on-ticket-white/60 px-3 text-t-caption text-on-ticket-white transition-colors hover:bg-ticket-primary-press">
            ← Voltar
          </Link>
        ) : (
          <Link to="/" className="flex h-9 items-center rounded-t-control border border-on-ticket-white/60 px-3 text-t-caption text-on-ticket-white">← Voltar</Link>
        )}
        <div className="mx-auto"><BrandLogo /></div>
        <span className="w-16" aria-hidden />
      </div>
    </header>
  )
}

