// Tema ingressos — cards, carrosséis e blocos de conteúdo. Tokens auditados;
// imagens/títulos são placeholders nossos (nada do site de referência é copiado).

import type { ReactNode } from 'react'
import { CountdownPill, StatusPill } from './Controls'

// SectionHeader: ícone + título Lexend + ação à direita ("Ver tudo →")
export function SectionHeader({ icon, title, actionLabel, onAction }: { icon: string; title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-lexend text-t-h2 text-ticket-text">
        <span aria-hidden>{icon}</span>
        {title}
      </h2>
      {actionLabel && (
        <button type="button" onClick={onAction} className="text-t-label text-ticket-primary transition-colors hover:text-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline">
          {actionLabel} →
        </button>
      )}
    </div>
  )
}

// CategoryTile: bloco de ícone ~58×80 com círculo primary-soft e legenda
export function CategoryTile({ icon, label, selected = false, onClick }: { icon: string; label: string; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline"
    >
      <span
        aria-hidden
        className={`flex h-14 w-14 items-center justify-center rounded-t-circle text-xl transition-transform duration-150 ${selected ? 'bg-ticket-primary text-on-ticket-white' : 'bg-ticket-primary-soft text-ticket-primary'} motion-safe:hover:scale-[1.15]`}
        style={{ transitionTimingFunction: 'cubic-bezier(.2, 0, .2, 1)' }}
      >
        {icon}
      </span>
      <span className={`text-t-caption ${selected ? 'font-semibold text-ticket-primary' : 'text-ticket-text'}`}>{label}</span>
    </button>
  )
}

// ScrollRail: trilha horizontal auditada (flex, gap 16, overflow-x auto, scroll-snap x)
export function ScrollRail({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} aria-label={ariaLabel}>
      <ul className="flex w-max snap-x gap-4 pr-4">{children}</ul>
    </div>
  )
}

export type TicketEventData = { id: string; title: string; date: string; venue: string; price: number; badge?: string; image?: string }

// EventCard: pôster 4:3 radius t-card + badge opcional + título + meta + preço (Sora)
export function EventCard({ event }: { event: TicketEventData }) {
  return (
    <li className="w-56 snap-start">
      <a href={`/evento/${event.id}`} className="group block overflow-hidden rounded-t-card bg-surface shadow-t-card transition-shadow duration-150 hover:shadow-t-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary">
        <div className="relative aspect-[4/3] bg-ticket-surface2">
          {event.image ? (
            <img src={event.image} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div aria-hidden className="flex h-full w-full items-center justify-center bg-ticket-primary-soft text-3xl">🎟️</div>
          )}
          {event.badge && (
            <span className="absolute left-2 top-2 inline-flex rounded-t-pill bg-ticket-glass-strong px-2 py-0.5 text-t-micro text-on-ticket-white backdrop-blur-sm">
              {event.badge}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <h3 className="line-clamp-2 font-lexend text-t-title text-ticket-text group-hover:text-ticket-primary">{event.title}</h3>
          <p className="text-t-caption text-ticket-muted">{event.date}</p>
          <p className="text-t-caption text-ticket-muted">{event.venue}</p>
          <p className="mt-1 font-sora text-t-price-m text-ticket-primary">{event.price > 0 ? `a partir de R$ ${event.price}` : 'grátis'}</p>
        </div>
      </a>
    </li>
  )
}

// EventCarousel: ScrollRail + setas (desktop) — navegação por scroll-snap
export function EventCarousel({ events }: { events: TicketEventData[] }) {
  return (
    <div className="relative">
      <ScrollRail ariaLabel="Eventos em destaque">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </ScrollRail>
    </div>
  )
}

// EventRow: linha de lista (thumb quadrada + título + data + local + preço à direita)
export function EventRow({ event }: { event: TicketEventData }) {
  return (
    <li>
      <a href={`/evento/${event.id}`} className="flex items-center gap-3 rounded-t-card bg-surface p-3 shadow-t-row transition-shadow duration-150 hover:shadow-t-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary">
        <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-t-tile bg-ticket-primary-soft text-2xl">
          {event.image ? <img src={event.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : '🎟️'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 font-lexend text-t-label-strong text-ticket-text">{event.title}</h3>
          <p className="text-t-caption text-ticket-muted">
            {event.date} · {event.venue}
          </p>
        </div>
        <p className="font-sora text-t-price-m text-ticket-primary">{event.price > 0 ? `R$ ${event.price}` : 'grátis'}</p>
      </a>
    </li>
  )
}

// OfferRow: destaque de oferta com selo de desconto e preço riscado
export function OfferRow({ title, price, originalPrice, deadline }: { title: string; price: number; originalPrice?: number; deadline?: string }) {
  const off = originalPrice ? Math.round((1 - price / originalPrice) * 100) : null
  return (
    <div className="flex items-center justify-between gap-3 rounded-t-card border border-ticket-border bg-surface p-4 shadow-t-row">
      <div className="min-w-0">
        <p className="line-clamp-1 text-t-body-strong text-ticket-text">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-sora text-t-price-l text-ticket-primary">R$ {price}</span>
          {originalPrice && <s className="text-t-caption text-ticket-faint">R$ {originalPrice}</s>}
          {off !== null && off > 0 && <IconBadgeSmall off={off} />}
        </div>
        {deadline && <p className="mt-1 text-t-caption text-ticket-warn">⏳ {deadline}</p>}
      </div>
    </div>
  )
}

function IconBadgeSmall({ off }: { off: number }) {
  return (
    <span className="rounded-t-pill bg-ticket-accent-soft px-1.5 py-0.5 font-sora text-t-micro text-ticket-success">-{off}%</span>
  )
}

// StepRail: passos numerados horizontais (ativo, completo, futuro)
export function StepRail({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso">
      {steps.map((step, i) => {
        const state = i < current ? 'completo' : i === current ? 'ativo' : 'futuro'
        return (
          <li key={step} className="flex items-center gap-2" aria-current={state === 'ativo' ? 'step' : undefined}>
            <span
              aria-hidden
              className={`flex h-6 w-6 items-center justify-center rounded-t-circle font-sora text-t-micro ${
                state === 'completo' ? 'bg-ticket-accent text-on-ticket-white' : state === 'ativo' ? 'bg-ticket-primary text-on-ticket-white' : 'bg-ticket-surface2 text-ticket-faint'
              }`}
            >
              {state === 'completo' ? '✓' : i + 1}
            </span>
            <span className={`text-t-caption ${state === 'futuro' ? 'text-ticket-faint' : 'text-ticket-text'}`}>{step}</span>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-ticket-border" />}
          </li>
        )
      })}
    </ol>
  )
}

// OrderSummary: resumo com total em Sora (numérico)
export function OrderSummary({ rows, total }: { rows: { label: string; value: string }[]; total: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-t-card bg-surface p-4 shadow-t-panel">
      <h3 className="font-lexend text-t-title text-ticket-text">Resumo</h3>
      <dl className="flex flex-col gap-1.5 text-t-body-s text-ticket-muted">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt>{row.label}</dt>
            <dd className="text-ticket-text">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between border-t border-ticket-hairline pt-2">
        <span className="text-t-label">Total</span>
        <span className="font-sora text-t-total text-ticket-primary">{total}</span>
      </div>
    </div>
  )
}

// OrderCard: card de pedido com StatusPill e meta
export function OrderCard({ code, eventTitle, date, total, status }: { code: string; eventTitle: string; date: string; total: string; status: 'confirmado' | 'pendente' | 'cancelado' | 'expirado' }) {
  return (
    <article className="flex flex-col gap-2 rounded-t-card bg-surface p-4 shadow-t-card">
      <div className="flex items-center justify-between gap-2">
        <span className="font-sora text-t-caption-strong text-ticket-muted">#{code}</span>
        <StatusPill status={status} />
      </div>
      <h3 className="line-clamp-1 font-lexend text-t-title text-ticket-text">{eventTitle}</h3>
      <p className="text-t-caption text-ticket-muted">{date}</p>
      <div className="flex items-baseline justify-between border-t border-ticket-hairline pt-2">
        <span className="text-t-caption text-ticket-muted">Total</span>
        <span className="font-sora text-t-price-m text-ticket-text">{total}</span>
      </div>
    </article>
  )
}

// Par de helpers reexportados para o showcase compor estados variados
export function CountdownExamples() {
  return (
    <div className="flex flex-wrap gap-2">
      <CountdownPill label="vende em" value="02:14:09" />
      <CountdownPill label="encerra em" value="00:00:45" />
    </div>
  )
}
