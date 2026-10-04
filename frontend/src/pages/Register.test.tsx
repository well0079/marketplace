import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Register } from './Register'

function renderRegister() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Register — renderização', () => {
  it('renderiza os quatro campos, botão e link para login', () => {
    const html = renderRegister()
    expect(html).toContain('>Criar conta</h1>')
    expect(html).toContain('Nome')
    expect(html).toContain('E-mail')
    expect(html).toContain('Senha')
    expect(html).toContain('Confirmar senha')
    expect(html).toMatch(/href="\/login"/)
    expect(html).not.toContain('Este e-mail já está cadastrado')
  })
})
