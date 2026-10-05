import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { DesignIngressosShowcase } from './DesignIngressosShowcase'

function renderShowcase() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/design-ingressos']}>
      <DesignIngressosShowcase />
    </MemoryRouter>,
  )
}

describe('DesignIngressosShowcase (tema ingressos)', () => {
  const html = renderShowcase()

  it('renderiza o título e a folha de estilos com fontes auditadas', () => {
    expect(html).toContain('Showcase — tema ingressos')
    expect(html).toContain('font-lexend')
    expect(html).toContain('font-sora')
    expect(html).toContain('font-hanken') // classes de fonte no documento
  })

  it('renderiza todos os grupos de componentes', () => {
    for (const label of ['Categorias', 'Filtros rápidos', 'Eventos em destaque', 'Ofertas', 'Contagem e prazos', 'Fluxo de compra', 'Campos', 'Pedidos']) {
      expect(html).toContain(label)
    }
  })

  it('renderiza componentes-chave com tokens do tema', () => {
    expect(html).toContain('Festival da Luz 2026')
    expect(html).toContain('t-pill') // StatusPill / badges
    expect(html).toContain('progressbar') // DeadlineMeter
    expect(html).toContain('Pesquisar eventos') // SearchBar
    expect(html).toContain('Navegação inferior') // BottomNav
  })

  it('botões reais e acessíveis (sem div clicável)', () => {
    expect((html.match(/<button /g) ?? []).length).toBeGreaterThan(10)
    expect(html).toContain('aria-pressed') // chips/categorias selecionáveis
  })
})
