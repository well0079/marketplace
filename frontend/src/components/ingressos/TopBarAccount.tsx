import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { BrandLogo } from './BrandLogo'

// TopBar do tema ingressos: 78px desktop / 66px mobile (medidas do audit,
// docs/DESIGN_AUDIT.md; ajustado no bloco 4a conforme instrução).
// Deslogado: "Entrar" (cinza) + "Anunciar" (primário). Logado: avatar com inicial
// + nome truncado em dropdown acessível (Esc/setas/clique fora, foco devolvido).
export function TopBar({ user, onLogout }: { user: { name: string; email: string } | null; onLogout?: () => void }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const avatarButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        avatarButtonRef.current?.focus()
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('a, button') ?? [])]
        if (items.length === 0) return
        const index = items.indexOf(document.activeElement as HTMLElement)
        const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length
        items[next].focus()
      }
    }
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !avatarButtonRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onClickOutside)
    }
  }, [menuOpen])

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? ''

  return (
    <header className="bg-ticket-primary md:min-h-[78px]">
      <div className="mx-auto flex min-h-[66px] max-w-[1200px] items-center gap-2.5 px-2 py-2 md:min-h-[78px]">
        <BrandLogo />
        <form
          role="search"
          className="hidden max-w-[420px] flex-1 md:block"
          onSubmit={(e) => {
            e.preventDefault()
            navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`)
          }}
        >
          <input
            type="search"
            aria-label="Pesquisar eventos"
            placeholder="Pesquisar eventos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-t-control border border-ticket-border bg-surface px-3 text-t-body text-ticket-text placeholder:text-ticket-faint focus:outline-none focus:ring-2 focus:ring-ticket-primary-outline"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                ref={avatarButtonRef}
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-t-control px-2 py-1.5 text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-ticket-white"
              >
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-t-circle bg-on-ticket-white text-ticket-primary">
                  {initial}
                </span>
                <span className="hidden max-w-[120px] truncate text-t-label sm:block">{user.name}</span>
                <span aria-hidden className="text-t-caption">{menuOpen ? '▲' : '▼'}</span>
              </button>
              {menuOpen && (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="Menu da conta"
                  className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-t-control border border-ticket-border bg-surface shadow-t-dialog"
                >
                  <a role="menuitem" href="/tickets" className="block px-4 py-2.5 text-t-label text-ticket-text transition-colors hover:bg-ticket-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ticket-primary">
                    Ingressos
                  </a>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout?.()
                    }}
                    className="block w-full px-4 py-2.5 text-left text-t-label text-ticket-muted transition-colors hover:bg-ticket-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ticket-primary"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className={cn(
                'flex h-9 items-center rounded-t-control px-3 text-t-label-strong text-on-ticket-white/90 transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-ticket-white',
              )}
            >
              Entrar
            </Link>
          )}
          <button
            type="button"
            onClick={() => navigate('/sellers/verify')}
            className="flex h-9 items-center rounded-t-pill bg-on-ticket-white px-4 text-t-label-strong text-ticket-primary transition-colors hover:bg-ticket-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-ticket-white"
          >
            Anunciar
          </button>
        </div>
      </div>
    </header>
  )
}
