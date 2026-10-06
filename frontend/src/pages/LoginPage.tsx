import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AUTH_QUERY_KEY } from '../lib/auth'
import { safeRedirect } from '../lib/auth'
import { authApi } from '../lib/auth'
import { ApiClientError } from '../lib/api'
import { isValidPhone, maskPhoneInput } from '../lib/payer'
import { Field } from '../components/ingressos/Controls'
import { BrandLogo } from '../components/ingressos/BrandLogo'

// Login do tema ingressos: e-mail OU celular + senha. Mesmo contrato do backend
// (mensagem genérica). Redirect validado (só caminho interno relativo).
export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const isPhone = identifier.includes('@') === false && identifier.replace(/\D/g, '').length > 0
  const identifierValid = identifier.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim()) : isValidPhone(identifier)

  const loginMutation = useMutation({
    mutationFn: () =>
      authApi.login(
        isPhone ? identifier : identifier.trim().toLowerCase(),
        password,
      ),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user)
      navigate(redirect)
    },
    onError: (error) => setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível entrar.'),
  })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setServerError(null)
    if (!identifierValid) {
      setServerError('Informe um e-mail ou celular válidos.')
      return
    }
    loginMutation.mutate()
  }

  return (
    <main className="min-h-screen bg-ticket-surface-muted font-hanken">
      <div className="flex flex-col items-center px-4 pb-10 pt-8">
        <BrandLogo tone="dark" />
        <div className="mt-8 w-full max-w-[320px]">
          <h1 className="font-lexend text-t-h1 text-ticket-text">Entrar</h1>
          <p className="mt-1 text-t-body-s text-ticket-muted">Bem-vindo de volta — falta pouco.</p>

          {serverError && (
            <div role="alert" className="mt-4 rounded-t-control bg-ticket-danger-soft px-3 py-2 text-t-caption text-ticket-danger">
              {serverError}
            </div>
          )}

          <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
            <Field
              label="E-mail ou celular"
              autoComplete="username"
              placeholder="voce@exemplo.com ou (11) 99999-9999"
              value={identifier}
              onChange={(e) => setIdentifier(identifier.includes('@') ? e.target.value : maskPhoneInput(e.target.value))}
            />
            <div className="relative">
              <Field
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[38px] text-t-caption text-ticket-muted"
              >
                <span aria-hidden>{showPassword ? '🙈' : '👁️'}</span>
              </button>
            </div>
            <button
              type="button"
              disabled
              title="Em breve"
              className="self-start text-t-caption text-ticket-faint"
            >
              Esqueci a senha (em breve)
            </button>
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="mt-2 h-12 w-full rounded-t-pill bg-ticket-primary text-t-label-strong text-on-ticket-white transition-colors hover:bg-ticket-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ticket-primary-outline disabled:opacity-50"
            >
              {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="mt-4 text-center text-t-caption text-ticket-muted">
            Não tem conta?{' '}
            <Link to={`/signup${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="font-medium text-ticket-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
