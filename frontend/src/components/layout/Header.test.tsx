import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './Header'
import type { PublicUser } from '../../lib/auth'

const USER: PublicUser = { id: 'u1', name: 'Maria Silva', email: 'maria@teste.com' }

const render = (options?: { me?: PublicUser }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (options?.me) client.setQueryData(['auth', 'me'], options.me)
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Header', () => {
  it('renderiza header semântico com logo apontando para /', () => {
    const html = render()
    expect(html).toContain('<header')
    expect(html).toMatch(/aria-label="Marketplace — página inicial"/)
    expect(html).toMatch(/href="\/"/)
    expect(html).toContain('market')
  })

  it('possui navegação principal com Home, Categorias e Ofertas', () => {
    const html = render()
    expect(html).toContain('aria-label="Navegação principal"')
    for (const label of ['Home', 'Categorias', 'Ofertas']) {
      expect(html).toContain(`>${label}</a>`)
    }
  })

  it('possui busca com role=search e campo rotulado', () => {
    const html = render()
    expect(html).toContain('role="search"')
    expect(html).toContain('aria-label="Buscar produtos"')
    expect(html).toContain('aria-label="Buscar"')
  })

  it('possui links de favoritos e carrinho com aria-label', () => {
    const html = render()
    expect(html).toMatch(/href="\/favorites"/)
    expect(html).toContain('aria-label="Favoritos"')
    expect(html).toMatch(/href="\/cart"/)
    expect(html).toContain('aria-label="Carrinho"')
  })

  it('menu mobile inicia fechado (aria-expanded=false, painel ausente)', () => {
    const html = render()
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="mobile-menu"')
    expect(html).not.toContain('id="mobile-menu"')
  })

  it('visitante vê o link Entrar', () => {
    const html = render()
    expect(html).toMatch(/href="\/login"/)
    expect(html).toContain('Entrar')
  })

  it('usuário autenticado vê saudação e Sair, sem link Entrar', () => {
    const html = render({ me: USER })
    expect(html).toContain('Olá, Maria')
    expect(html).toContain('Sair')
    expect(html).not.toMatch(/href="\/login"/)
  })
})
