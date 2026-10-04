import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { cartApi, CART_QUERY_KEY } from '../../lib/cart'
import { authApi, AUTH_QUERY_KEY, fetchCurrentUser } from '../../lib/auth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Separator } from '../ui/Separator'
import { Container } from './Container'
import { CartIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon } from './icons'

// Categorias e Ofertas recebem rotas provisórias do catálogo (FASE 5) até existirem páginas próprias
const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Categorias', to: '/search' },
  { label: 'Ofertas', to: '/search?sort=price_asc' },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded px-3 py-2 text-body-small transition-colors hover:bg-page hover:text-foreground',
    isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
  )
}

function actionLinkClass(hiddenUntilSm = false) {
  return cn(
    'flex h-10 w-10 items-center justify-center rounded text-foreground transition-colors hover:bg-page hover:text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    hiddenUntilSm && 'hidden sm:flex',
  )
}

function SearchForm({ inputId }: { inputId: string }) {
  const [term, setTerm] = useState('')
  const navigate = useNavigate()

  function submitSearch() {
    const q = term.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  // Enter tratado no keydown: submissão implícita de formulário não é garantida em todos os teclados virtuais
  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitSearch()
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submitSearch()
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="relative w-full">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={inputId}
        aria-label="Buscar produtos"
        placeholder="Buscar produtos, marcas e mais…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        inputClassName="pl-9 pr-11"
      />
      <Button
        type="submit"
        variant="secondary"
        size="icon"
        aria-label="Buscar"
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
      >
        <SearchIcon className="h-4 w-4" />
      </Button>
    </form>
  )
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cartQuery = useQuery({ queryKey: CART_QUERY_KEY, queryFn: cartApi.get })
  const totalItems = cartQuery.data?.totalItems ?? 0
  const meQuery = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchCurrentUser })
  const user = meQuery.data

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })
      navigate('/')
    },
  })

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <Container className="flex h-16 items-center gap-3 md:gap-4">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(actionLinkClass(), 'lg:hidden')}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        <Link to="/" aria-label="Marketplace — página inicial" className="text-h4 tracking-tight text-foreground">
          <span className="font-bold">market</span>
          <span className="font-bold text-primary">place</span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center lg:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden max-w-xl flex-1 md:block">
          <SearchForm inputId="header-search-desktop" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <div className="hidden items-center gap-1 sm:flex">
              <span className="max-w-[120px] truncate px-2 text-body-small text-foreground">
                Olá, {user.name.split(' ')[0]}
              </span>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="px-2 py-2 text-body-small text-muted-foreground transition-colors hover:text-foreground"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden items-center px-2 py-2 text-body-small font-medium text-foreground transition-colors hover:text-primary sm:flex"
            >
              Entrar
            </Link>
          )}
          <Link to="/favorites" aria-label="Favoritos" className={actionLinkClass(true)}>
            <HeartIcon />
          </Link>
          <Link to="/cart" aria-label="Carrinho" className={cn(actionLinkClass(), 'relative')}>
            <CartIcon />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-caption font-medium text-primary-foreground">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </Container>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden className="absolute inset-0 animate-fade-in bg-foreground/50" onClick={closeMenu} />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] animate-slide-in-right flex-col gap-4 overflow-y-auto bg-surface p-5 shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-h4 text-foreground">Menu</span>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Fechar menu"
                onClick={closeMenu}
                className={actionLinkClass()}
              >
                <CloseIcon />
              </button>
            </div>

            <SearchForm inputId="header-search-mobile" />
            <Separator />

            {user ? (
              <div className="flex flex-col gap-2">
                <span className="px-3 text-body-small font-medium text-foreground">
                  Olá, {user.name.split(' ')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    logoutMutation.mutate()
                  }}
                  disabled={logoutMutation.isPending}
                  className="rounded px-3 py-2 text-left text-body-small text-muted-foreground transition-colors hover:bg-page hover:text-foreground"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={closeMenu}
                className="rounded bg-primary px-3 py-2.5 text-center text-body-small font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Entrar
              </Link>
            )}

            <nav aria-label="Menu mobile" className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={closeMenu} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <Separator />

            <nav aria-label="Ações do usuário" className="flex flex-col gap-1">
              <Link
                to="/favorites"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded px-3 py-2 text-body-small text-foreground transition-colors hover:bg-page"
              >
                <HeartIcon className="text-muted-foreground" />
                Favoritos
              </Link>
              <Link
                to="/cart"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded px-3 py-2 text-body-small text-foreground transition-colors hover:bg-page"
              >
                <CartIcon className="text-muted-foreground" />
                Carrinho
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
