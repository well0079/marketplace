// Tema ingressos — tokens auditados em docs/DESIGN_AUDIT.md.
// Conteúdos são PLACEHOLDERS nossos (nada do site de referência é copiado).

type TopBarProps = {
  greeting?: string
  actionLabel?: string
  onAction?: () => void
}

// Header desktop 78px (66px no mobile): marca + busca + ações. Mobile mostra saudação.
export function TopBar({ greeting = 'Boa noite 👋', actionLabel = 'Anunciar', onAction }: TopBarProps) {
  return (
    <header className="min-h-[78px] md:min-h-[66px] bg-ticket-primary px-2">
      <div className="mx-auto flex max-w-[1200px] items-center gap-2.5 px-2 py-4">
        <a href="/" className="text-t-label-strong font-lexend text-on-ticket-white" aria-label="Ingressos — página inicial">
          <span className="text-t-h2">ingressos</span>
        </a>
        <div className="hidden flex-1 md:block">
          <SearchBar />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <span className="hidden flex-col text-on-ticket-white sm:flex">
            <span className="text-t-caption">{greeting}</span>
            <span className="text-t-label-strong">Acesse sua conta</span>
          </span>
          <button
            type="button"
            onClick={onAction}
            className="h-9 rounded-t-pill bg-on-ticket-white px-4 text-t-label-strong text-ticket-primary transition-colors hover:bg-ticket-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-ticket-white"
          >
            {actionLabel}
          </button>
        </div>
      </div>
      <div className="px-2 pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  )
}

import { useState } from 'react'

type SearchBarProps = {
  placeholder?: string
  onSubmit?: (term: string) => void
}

// Barra de busca: campo claro radius t-control sobre fundo primário; 236px de pista no desktop
export function SearchBar({ placeholder = 'Pesquisar eventos', onSubmit }: SearchBarProps) {
  const [term, setTerm] = useState('')
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(term.trim())
      }}
      className="relative w-full max-w-[420px]"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ticket-faint" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={placeholder}
        aria-label="Pesquisar eventos"
        className="h-10 w-full rounded-t-control border border-ticket-border bg-surface pl-9 pr-3 text-t-body text-ticket-text placeholder:text-ticket-faint focus:outline-none focus:ring-2 focus:ring-ticket-primary-outline"
      />
    </form>
  )
}

// Navegação inferior mobile: 80px, 5 destinos, ativo em ticket-primary
export function BottomNav({ items, active, onNavigate }: { items: { label: string; icon?: string }[]; active: string; onNavigate?: (label: string) => void }) {
  return (
    <nav aria-label="Navegação inferior" className="border-t border-ticket-hairline bg-surface md:hidden">
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-around px-1 py-1.5">
        {items.map((item) => {
          const isActive = item.label === active
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => onNavigate?.(item.label)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-16 flex-col items-center gap-0.5 rounded-t-control px-1 py-1 text-t-nano transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline ${isActive ? 'text-ticket-primary' : 'text-ticket-muted hover:text-ticket-text'}`}
              >
                <span aria-hidden className="text-base leading-6">{item.icon ?? '◆'}</span>
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Alternância de idioma: pill segmentado PT/EN
export function LanguageToggle({ value, onChange }: { value: 'PT' | 'EN'; onChange: (v: 'PT' | 'EN') => void }) {
  return (
    <div role="group" aria-label="Idioma" className="inline-flex rounded-t-pill bg-ticket-surface2 p-0.5 text-t-micro">
      {(['PT', 'EN'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={value === lang}
          onClick={() => onChange(lang)}
          className={`rounded-t-pill px-2.5 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline ${value === lang ? 'bg-surface text-ticket-text shadow-t-row' : 'text-ticket-muted hover:text-ticket-text'}`}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
