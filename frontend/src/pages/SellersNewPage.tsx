import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { eventsApi } from '../lib/events'
import { BrandLogo } from '../components/ingressos/BrandLogo'
import { cn } from '../lib/cn'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ingressos/Controls'

// /sellers/new "Anunciar ingresso": evento → sessão → tipo → categoria → quantidade → preço.
// Após publicar: se pending_review → aviso de análise; se active → link para a sessão.
export function SellersNewPage() {
  const [result, setResult] = useState<{ status: string } | null>(null)

  // formulário
  const [selectedEvent, setSelectedEvent] = useState<{ slug: string; name: string } | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [ticketType, setTicketType] = useState('')
  const [ticketCategory, setTicketCategory] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [priceReais, setPriceReais] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const eventsQuery = useQuery({ queryKey: ['events', 'list', 1], queryFn: () => eventsApi.list({ page: 1 }) })
  const sessionQuery = useQuery({
    queryKey: ['events', 'detail', selectedEvent?.slug ?? ''],
    queryFn: () => eventsApi.bySlug(selectedEvent!.slug),
    enabled: !!selectedEvent?.slug,
  })

  const priceCents = useMemo(() => {
    const reais = Number.parseFloat(priceReais.replace(',', '.'))
    return Number.isFinite(reais) ? Math.round(reais * 100) : 0
  }, [priceReais])

  const publishMutation = useMutation({
    mutationFn: () =>
      fetch('/api/v1/listings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ticketType, ticketCategory, quantity, priceCents }),
      }).then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? 'Erro'), { status: r.status, code: body?.error?.code })
        return body as { status: string }
      }),
    onSuccess: (result) => { setResult(result) },
    onError: (error) => setServerError(error instanceof Error ? error.message : 'Erro ao publicar anúncio.'),
  })

  function publish() {
    setServerError(null)
    const errors: Record<string, string> = {}
    if (!selectedEvent) errors.event = 'Selecione um evento.'
    if (!sessionId) errors.session = 'Selecione uma data.'
    if (!ticketType) errors.ticketType = 'Selecione o tipo.'
    if (!ticketCategory) errors.ticketCategory = 'Selecione a categoria.'
    if (quantity < 1) errors.quantity = 'Mínimo 1.'
    if (priceCents < 500) errors.price = 'Preço mínimo R$ 5,00.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    publishMutation.mutate()
  }

  if (result) {
    const isPending = result.status === 'pending_review'
    return (
      <main className="min-h-screen bg-ticket-surface-muted font-hanken">
        <div className="mx-auto max-w-[420px] px-4 py-16">
          <EmptyState
            title={isPending ? 'Anúncio em análise' : 'Anúncio publicado!'}
            description={isPending
              ? 'Seu anúncio está em análise e ainda não aparece para compradores. Você será notificado quando for aprovado.'
              : 'Seu ingresso já está visível na página da sessão.'}
            action={
              isPending
                ? <Button size="sm" to="/tickets">Ver meus anúncios</Button>
                : <Button size="sm" to={`/event/${selectedEvent?.slug ?? ''}`}>Ver na sessão</Button>
            }
          />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="mx-auto max-w-[420px] px-4 pb-20 pt-6">
        <BrandLogo tone="dark" />
        <h1 className="mt-6 font-lexend text-t-h1 text-ticket-text">Anunciar ingresso</h1>

        {serverError && (
          <div role="alert" className="mt-4 rounded-t-control bg-ticket-danger-soft px-3 py-2 text-t-caption text-ticket-danger">{serverError}</div>
        )}

        <form className="mt-5 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); publish() }} noValidate>
          {/* evento */}
          {eventsQuery.data && (
            <div className="flex flex-col gap-1.5">
              <span className="text-t-label text-ticket-text">Evento</span>
              <div className="flex flex-col gap-1">
                {eventsQuery.data.items.map((event) => (
                  <button
                    key={event.slug}
                    type="button"
                    onClick={() => { setSelectedEvent({ slug: event.slug, name: event.name }); setSessionId('') }}
                    className={cn(
                      'rounded-t-control border px-3 py-2 text-left text-t-body-s transition-colors',
                      selectedEvent?.slug === event.slug ? 'border-ticket-primary bg-ticket-primary-soft text-ticket-primary' : 'border-ticket-border bg-surface text-ticket-text hover:bg-ticket-surface2',
                    )}
                  >
                    {event.name}
                  </button>
                ))}
              </div>
              {fieldErrors.event && <p className="text-t-caption text-ticket-danger">{fieldErrors.event}</p>}
            </div>
          )}

          {/* sessão */}
          {selectedEvent && sessionQuery.data && (
            <div className="flex flex-col gap-1.5">
              <span className="text-t-label text-ticket-text">Data</span>
              {sessionQuery.data.sessions.length === 0 ? (
                <p className="text-t-caption text-ticket-faint">Nenhuma sessão disponível.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {sessionQuery.data.sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!s.hasOffers && s.minPriceCents === null}
                      onClick={() => setSessionId(s.id)}
                      className={cn(
                        'rounded-t-control border px-3 py-2 text-left text-t-caption transition-colors',
                        sessionId === s.id ? 'border-ticket-primary bg-ticket-primary-soft text-ticket-primary' : 'border-ticket-border bg-surface text-ticket-text hover:bg-ticket-surface2',
                      )}
                    >
                      {s.city} · {s.venue}
                    </button>
                  ))}
                </div>
              )}
              {fieldErrors.session && <p className="text-t-caption text-ticket-danger">{fieldErrors.session}</p>}
            </div>
          )}

          {/* tipo */}
          <Field label="Tipo de ingresso" value={ticketType} error={fieldErrors.ticketType} onChange={(e) => setTicketType(e.target.value)} placeholder="Pista, Área VIP ou Camarote" />

          {/* categoria */}
          <div className="flex flex-col gap-1.5">
            <span className="text-t-label text-ticket-text">Categoria</span>
            <div className="flex gap-2">
              {['Inteira', 'Meia', 'Solidário'].map((cat) => (
                <button key={cat} type="button" onClick={() => setTicketCategory(cat)}
                  className={cn('flex-1 rounded-t-control border py-2 text-t-caption transition-colors',
                    ticketCategory === cat ? 'border-ticket-primary bg-ticket-primary-soft text-ticket-primary' : 'border-ticket-border bg-surface text-ticket-text hover:bg-ticket-surface2')}>
                  {cat}
                </button>
              ))}
            </div>
            {fieldErrors.ticketCategory && <p className="text-t-caption text-ticket-danger">{fieldErrors.ticketCategory}</p>}
          </div>

          {/* quantidade */}
          <Field label="Quantidade" inputMode="numeric" value={String(quantity)} error={fieldErrors.quantity}
            onChange={(e) => setQuantity(Number.parseInt(e.target.value, 10) || 0)} />

          {/* preço */}
          <Field label="Preço por ingresso (R$)" inputMode="decimal" placeholder="0,00" value={priceReais} error={fieldErrors.price}
            onChange={(e) => setPriceReais(e.target.value)} />
          <p className="text-t-caption text-ticket-muted">O comprador paga +10% de taxa de serviço.</p>

          <SubmitButton label="Publicar anúncio" disabled={publishMutation.isPending} />
          <Link to="/tickets" className="text-center text-t-caption text-ticket-muted underline">← Voltar para Ingressos</Link>
        </form>
      </div>
    </main>
  )
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button type="submit" disabled={disabled}
      className="mt-2 h-12 w-full rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press disabled:opacity-50">
      {label}
    </button>
  )
}

