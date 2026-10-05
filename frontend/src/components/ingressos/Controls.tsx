// Tema ingressos — controles e pills. Tokens auditados; textos são placeholders nossos.

import { useState, type InputHTMLAttributes, type ReactNode } from 'react'

// Chip: fundo primary-soft, texto primary, radius t-control
export function Chip({ children, selected = false, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-8 whitespace-nowrap rounded-t-control px-3 text-t-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline ${
        selected ? 'bg-ticket-primary text-on-ticket-white' : 'bg-ticket-primary-soft text-ticket-primary hover:bg-ticket-primary-tint'
      }`}
    >
      {children}
    </button>
  )
}

// StatusPill: pill 999 com estados de pedido
export function StatusPill({ status }: { status: 'confirmado' | 'pendente' | 'cancelado' | 'expirado' }) {
  const styles: Record<typeof status, string> = {
    confirmado: 'bg-ticket-accent-soft text-ticket-success',
    pendente: 'bg-ticket-caution-soft text-ticket-caution-text',
    cancelado: 'bg-ticket-danger-soft text-ticket-danger',
    expirado: 'bg-ticket-surface2 text-ticket-muted',
  }
  return <span className={`inline-flex items-center rounded-t-pill px-2.5 py-0.5 text-t-caption-strong ${styles[status]}`}>{status}</span>
}

// IconBadge: pill com ícone + texto (selo curto)
export function IconBadge({ icon, children, tone = 'soft' }: { icon: string; children: ReactNode; tone?: 'soft' | 'solid' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-t-pill px-3 py-1.5 text-t-caption-strong ${
        tone === 'solid' ? 'bg-ticket-primary text-on-ticket-white' : 'bg-ticket-primary-soft text-ticket-primary'
      }`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  )
}

// IconButton: alvo de toque 40×40, hover em primary-soft
export function IconButton({ icon, label, onClick, disabled = false }: { icon: string; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-t-circle border border-ticket-border bg-surface text-ticket-text transition-all duration-150 hover:bg-ticket-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline disabled:opacity-40"
      style={{ transitionTimingFunction: 'cubic-bezier(.2, 0, .2, 1)' }}
    >
      <span aria-hidden>{icon}</span>
    </button>
  )
}

// Field: label acima + input 16px, radius t-control, foco primary-outline
export function Field({ label, hint, error, ...inputProps }: { label: string; hint?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-t-label text-ticket-text">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        {...inputProps}
        className={`h-11 rounded-t-control border bg-surface px-3 text-t-body text-ticket-text placeholder:text-ticket-faint focus:outline-none focus:ring-2 ${
          error ? 'border-ticket-danger ring-2 ring-ticket-danger-soft' : 'border-ticket-border focus:border-ticket-primary focus:ring-ticket-primary-outline'
        }`}
      />
      {(error || hint) && (
        <p id={`${id}-desc`} className={`text-t-caption ${error ? 'text-ticket-danger' : 'text-ticket-muted'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

// CountdownPill: pill escura com dígitos Sora (numérico)
export function CountdownPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-t-pill bg-ticket-glass-strong px-3 py-1.5 text-on-ticket-white backdrop-blur-sm">
      <span aria-hidden>⏱</span>
      <span className="text-t-caption">{label}</span>
      <time className="font-sora text-t-label-strong" aria-label={`${label}: ${value}`}>
        {value}
      </time>
    </span>
  )
}

// Modal: scrim auditado + sheet radius t-sheet + shadow t-dialog
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div aria-hidden className="absolute inset-0 bg-[#14151A80]" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-t-sheet bg-surface p-5 shadow-t-dialog sm:rounded-t-t-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-lexend text-t-h2 text-ticket-text">{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-t-circle text-ticket-muted transition-colors hover:bg-ticket-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// DeadlineMeter: barra de progresso de prazo (trilha hairline, preenchimento accent)
export function DeadlineMeter({ label, percent, deadline }: { label: string; percent: number; deadline: string }) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-t-caption text-ticket-muted">
        <span>{label}</span>
        <span className="font-sora text-t-caption-strong text-ticket-text">{deadline}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-t-pill bg-ticket-hairline" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-t-pill bg-ticket-accent transition-[width] duration-200" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

// useDisclosure utilitário local para o showcase (estado de modal)
export function useModal() {
  const [open, setOpen] = useState(false)
  return { open, show: () => setOpen(true), hide: () => setOpen(false) }
}
