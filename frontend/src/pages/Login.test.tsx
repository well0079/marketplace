import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Login } from './Login'
import { validateLoginForm, validateRegisterForm, type PublicUser } from '../lib/auth'
import { seedErrorState } from '../test/query-test-utils'

const USER: PublicUser = { id: 'u1', name: 'Maria Teste', email: 'maria@teste.com' }

function renderLogin(options?: { me?: PublicUser | null; loginError?: boolean }) {
  const seedingError = options?.loginError
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, ...(seedingError && { enabled: false }) } },
  })
  if (options?.me) client.setQueryData(['auth', 'me'], options.me)
  if (options?.loginError) seedErrorState(client, ['auth', 'me'])

  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Login — renderização', () => {
  it('renderiza formulário com campos, botão e link para cadastro', () => {
    const html = renderLogin()
    expect(html).toContain('>Entrar</h1>')
    expect(html).toContain('E-mail')
    expect(html).toContain('Senha')
    expect(html).toContain('Criar conta')
    expect(html).toMatch(/href="\/register"/)
  })

  it('não mostra erro de servidor antes de enviar', () => {
    const html = renderLogin()
    expect(html).not.toContain('E-mail ou senha inválidos')
  })
})

describe('Login — sessão', () => {
  it('usuário logado continua renderizando a página de login', () => {
    const html = renderLogin({ me: USER })
    expect(html).toContain('>Entrar</h1>')
  })
})

describe('validações de autenticação', () => {
  it('validateLoginForm exige e-mail válido e senha preenchida', () => {
    expect(validateLoginForm({ email: 'maria@teste.com', password: 'x' })).toBeNull()
    const errors = validateLoginForm({ email: 'invalido', password: '' })
    expect(errors?.email).toBeDefined()
    expect(errors?.password).toBeDefined()
  })

  it('validateRegisterForm valida nome, e-mail, senha e confirmação', () => {
    expect(
      validateRegisterForm({ name: 'Maria', email: 'maria@teste.com', password: '12345678', confirmPassword: '12345678' }),
    ).toBeNull()

    const errors = validateRegisterForm({ name: 'A', email: 'x', password: '1234567', confirmPassword: 'x' })
    expect(errors?.name).toBeDefined()
    expect(errors?.email).toBeDefined()
    expect(errors?.password).toBeDefined()
    expect(errors?.confirmPassword).toBeDefined()
  })
})
