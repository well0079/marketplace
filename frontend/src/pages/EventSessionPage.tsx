import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { AUTH_QUERY_KEY, fetchCurrentUser } from '../lib/auth'
import {
  categoryGradient,
  eventsApi,
  formatEventFullDate,
  sessionOffersQueryKey,
  sessionQueryKey,
} from '../lib/events'
import { formatBRL } from '../lib/format'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'

// Banner "Não perca nenhuma novidade": link configurável por env (vazio = esconde)
const COMMUNITY_URL = (import.meta.env.VITE_COMMUNITY_URL as string | undefined) ?? ''

// Página pública da sessão: mesma arte desfocada, card pequeno da imagem, título,
// organizador/data com ícones, pills outlined e o card "Selecione o ingresso".
export function EventSessionPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>()

  useEffect(() => {
    document.title = 'Sessão | Ingressos'
  }, [])

  const sessionQuery = useQuery({
    queryKey: sessionQueryKey(id ?? ''),
    queryFn: () => eventsApi.session(id ?? ''),
    enabled: !!id,
    retry: false,
  })

  const [typeChosen, setTypeChosen] = useState('')
  const [categoryChosen, setCategoryChosen] = useState('')

  // todos os hooks ANTES dos returns condicionais (regra do React)
  useEffect(() => {
    document.title = sessionQuery.data ? `${sessionQuery.data.event.name} — ingressos | Ingressos` : 'Sessão | Ingressos'
  }, [sessionQuery.data])
  // valor efetivo: a escolha do usuário vence; sem escolha, o 1º item da API
  // (derivado — funciona no SSR, onde useEffect não roda)
  const type = typeChosen !== '' ? typeChosen : (sessionQuery.data?.types[0]?.value ?? '')
  const category = categoryChosen !== '' ? categoryChosen : (sessionQuery.data?.categories[0]?.value ?? '')

  if (sessionQuery.isPending || !id || !slug) {
    return (
      <main className="min-h-screen bg-ticket-surface-muted">
        <div className="h-96 w-full bg-ticket-surface2" aria-hidden />
        <div className="mx-auto -mt-64 w-full max-w-[420px] px-4">
          <Skeleton className="aspect-[3/4] w-full rounded-t-card" />
          <Skeleton className="mx-auto mt-6 h-8 w-2/3" />
          <Skeleton className="mx-auto mt-3 h-5 w-56" />
          <Skeleton className="mt-8 h-72 w-full rounded-t-card" />
        </div>
      </main>
    )
  }

  if (sessionQuery.isError) {
    const notFound = sessionQuery.error instanceof ApiClientError && sessionQuery.error.status === 404
    return (
      <main className="min-h-screen bg-ticket-surface-muted">
        <div className="mx-auto max-w-[600px] px-4 py-16">
          {notFound ? (
            <EmptyState
              title="Sessão não encontrada"
              description="Esta sessão não existe ou foi removida."
              action={
                <Button size="sm" to={`/event/${slug}`}>
                  Voltar para o evento
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Não conseguimos carregar a sessão."
              description="Verifique sua conexão e tente novamente."
              action={
                <Button size="sm" onClick={() => sessionQuery.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          )}
        </div>
      </main>
    )
  }

  const session = sessionQuery.data
  const gradient = categoryGradient(session.event.category)

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      {/* fundo hero desfocado (gradiente por categoria) */}
      <div className="relative h-[420px] w-full overflow-hidden">
        <div aria-hidden className="absolute inset-0 scale-110 grayscale blur-2xl" style={{ background: gradient }} />
        <div aria-hidden className="absolute inset-0 bg-ticket-scrim/40" />
        <div className="relative mx-auto w-full max-w-[420px] px-4 pt-12">
          <div
            className="aspect-[3/4] w-full rounded-t-card shadow-t-hover"
            style={{ background: gradient }}
            role="img"
            aria-label={`Imagem do evento ${session.event.name}`}
          />
          <div className="mt-4 text-center">
            <h1 className="font-lexend text-t-display text-on-ticket-white">{session.event.name}</h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-on-ticket-white/90">
              <span className="flex items-center gap-1.5 text-t-body-s">
                <span aria-hidden>🏢</span>
                {session.event.organizer}
              </span>
              <span className="flex items-center gap-1.5 text-t-body-s">
                <span aria-hidden>📅</span>
                {formatEventFullDate(session.startsAt)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {session.event.category && (
                <span className="rounded-t-pill border border-on-ticket-white/70 px-3 py-1 text-t-caption-strong text-on-ticket-white">
                  {session.event.category}
                </span>
              )}
              <span className="rounded-t-pill border border-on-ticket-white/70 px-3 py-1 text-t-caption-strong text-on-ticket-white">
                {session.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[600px] px-4 pb-12">
        {COMMUNITY_URL && (
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center gap-3 rounded-t-card border-2 border-ticket-primary-outline bg-surface p-3 transition-colors hover:bg-ticket-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
          >
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-t-control bg-ticket-primary text-on-ticket-white">
              🔔
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-t-label-strong text-ticket-text">Não perca nenhuma novidade</span>
              <span className="block text-t-caption text-ticket-muted">Entre no canal oficial do evento</span>
            </span>
            <span aria-hidden className="text-ticket-primary">→</span>
          </a>
        )}

        <section aria-label="Selecione o ingresso" className="mt-4 rounded-t-card bg-surface p-5 shadow-t-panel">
          <h2 className="font-lexend text-t-title text-ticket-text">Selecione o ingresso</h2>

          {!session.hasOffers ? (
            <div className="mt-4 rounded-t-control bg-ticket-surface2 p-4 text-center">
              <p className="text-t-body-strong text-ticket-text">Indisponível</p>
              <p className="mt-1 text-t-caption text-ticket-muted">
                Ainda não há ingressos à venda para esta sessão. Volte em breve.
              </p>
              <Button size="sm" variant="outline" className="mt-3" to="/sellers/verify">
                Vender
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <Select
                label="Tipo de Ingresso"
                value={type}
                onChange={(e) => setTypeChosen(e.target.value)}
              >
                {session.types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value} — a partir de {formatBRL(t.minPriceCents)}
                  </option>
                ))}
              </Select>
              <Select
                label="Categoria"
                value={category}
                onChange={(e) => setCategoryChosen(e.target.value)}
              >
                {session.categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} — a partir de {formatBRL(c.minPriceCents)}
                  </option>
                ))}
              </Select>
              <SessionOffers sessionId={session.id} type={type} category={category} />
              <Link
                to="/sellers/verify"
                className="flex h-11 w-full items-center justify-center rounded-t-control bg-[#14151A] text-t-label-strong text-on-ticket-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
              >
                Vender
              </Link>
              <p className="text-center text-t-caption text-ticket-muted">
                Quer revender? Anuncie seu ingresso nesta sessão.
              </p>
            </div>
          )}
        </section>

        <a
          href="/guia-de-transferencia"
          className="mt-4 flex items-center gap-3 rounded-t-card border border-ticket-border bg-surface p-3 shadow-t-row transition-colors hover:bg-ticket-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary"
        >
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-t-control bg-ticket-primary-soft text-ticket-primary">
            🔁
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-t-label-strong text-ticket-text">Guia de transferência</span>
            <span className="block text-t-caption text-ticket-muted">Como transferir seu ingresso com segurança</span>
          </span>
          <span aria-hidden className="text-ticket-primary">→</span>
        </a>

        <section aria-label="Descrição" className="mt-4 rounded-t-card bg-surface p-5 shadow-t-panel">
          <h2 className="font-lexend text-t-title text-ticket-text">Descrição</h2>
          <div className="mt-3 flex flex-col gap-4">
            <EmojiSection
              icon="ℹ️"
              title="Sobre o evento"
              text={
                session.event.description.trim() !== ''
                  ? session.event.description
                  : eventDescription(session.event.name, session.event.category, session.event.organizer, session.city, session.venue)
              }
            />
            <EmojiSection
              icon="🔁"
              title="Regras de transferência"
              text="Você pode transferir seu ingresso para outra pessoa pela área Meus ingressos até 2 horas antes do início da sessão. O ingresso transferido fica inválido para quem transferiu."
            />
            <EmojiSection
              icon="🚫"
              title="Restrições"
              text="Proibida a entrada de menores de 16 anos desacompanhados. É obrigatória a apresentação de documento oficial com foto. Não é permitida a entrada com copos, garrafas ou objetos cortantes."
            />
            <EmojiSection
              icon="💰"
              title="Como funcionam os preços"
              text="Os preços são definidos pelos vendedores e podem variar conforme a demanda. Além do preço do ingresso, é cobrada uma taxa de serviço de 10% sobre o valor, exibida antes da confirmação."
            />
          </div>
        </section>
      </div>
    </main>
  )
}

// descrição do evento: usa o texto real da API quando existir; placeholder nosso caso contrário
function eventDescription(name: string, category: string, organizer: string, city: string, venue: string): string {
  return `${name} é um evento de ${category.toLowerCase()} apresentado por ${organizer}. A sessão acontece em ${venue}, em ${city}. Chegue com antecedência: a portaria abre 1 hora antes do horário marcado.`
}

function EmojiSection({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <h3 className="text-t-label-strong text-ticket-text">{title}</h3>
        <p className="mt-0.5 text-t-body-s text-ticket-muted">{text}</p>
      </div>
    </div>
  )
}

// Lista de ofertas da combinação tipo+categoria, menor preço primeiro.
// "Comprar" cria a reserva (auth) e vai para o checkout; desabilitado sem ofertas.
function SessionOffers({ sessionId, type, category }: { sessionId: string; type: string; category: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const offersQuery = useQuery({
    queryKey: sessionOffersQueryKey(sessionId, type, category),
    queryFn: () => eventsApi.offers(sessionId, { type, category }),
    enabled: type !== '' && category !== '',
  })

  const meQuery = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchCurrentUser })

  const buyMutation = useMutation({
    mutationFn: (offerId: string) => eventsApi.reserve(offerId, 1),
    onSuccess: (reservation) => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      navigate(`/checkout?offer=${encodeURIComponent(reservation.offer.id)}`)
    },
  })

  const buyError = buyMutation.error instanceof ApiClientError ? buyMutation.error : null

  if (type === '' || category === '') {
    return (
      <p className="rounded-t-control bg-ticket-surface2 p-3 text-center text-t-caption text-ticket-muted">
        Escolha o tipo e a categoria para ver os ingressos disponíveis.
      </p>
    )
  }

  if (offersQuery.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-16 w-full rounded-t-control" />
        <Skeleton className="h-16 w-full rounded-t-control" />
      </div>
    )
  }

  if (offersQuery.isError) {
    return (
      <ErrorState
        title="Não conseguimos carregar os ingressos."
        action={
          <Button size="sm" onClick={() => offersQuery.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    )
  }

  const offers = offersQuery.data ?? []
  if (offers.length === 0) {
    return (
      <div className="rounded-t-control bg-ticket-surface2 p-4 text-center">
        <p className="text-t-body-strong text-ticket-text">Indisponível</p>
        <p className="mt-1 text-t-caption text-ticket-muted">Não há ingressos desta combinação à venda agora.</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          to="/sellers/verify"
        >
          Vender
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {buyError && (
        <p role="alert" className="rounded-t-control bg-ticket-danger-soft px-3 py-2 text-t-caption text-ticket-danger">
          {buyError.message}
        </p>
      )}
      {offers.map((offer, index) => {
        const isPlatform = offer.seller === 'plataforma'
        return (
          <div
            key={offer.id}
            className="flex items-center gap-3 rounded-t-control border border-ticket-border bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-t-label-strong text-ticket-text">
                {offer.ticketCategory} · {offer.ticketType}
              </p>
              <p className="text-t-caption text-ticket-muted">
                {isPlatform ? 'Vendido pela plataforma' : 'Anunciado por vendedor'} · {offer.available} disponíve{offer.available === 1 ? 'l' : 'is'}
                {index === 0 && <span className="ml-1 font-medium text-ticket-primary">· menor preço</span>}
              </p>
            </div>
            <div className="text-right">
              <p className="font-sora text-t-price-m text-ticket-text">{formatBRL(offer.priceCents)}</p>
              <button
                type="button"
                disabled={buyMutation.isPending}
                onClick={() => buyMutation.mutate(offer.id)}
                className="mt-0.5 rounded-t-control bg-ticket-primary px-4 py-1.5 text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline disabled:opacity-50"
              >
                {buyMutation.isPending && buyMutation.variables === offer.id ? 'Reservando…' : 'Comprar'}
              </button>
            </div>
          </div>
        )
      })}
      {/* anônimo: compra exige conta (mesma regra do checkout) */}
      {meQuery.data === null && (
        <p className="text-center text-t-caption text-ticket-muted">
          Para comprar, você precisa estar logado — o botão pedirá sua conta.
        </p>
      )}
    </div>
  )
}
