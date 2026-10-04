import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { authApi, AUTH_QUERY_KEY, validateLoginForm } from '../lib/auth'
import { CART_QUERY_KEY } from '../lib/cart'
import { Container } from '../components/layout/Container'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [values, setValues] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const redirectParam = searchParams.get('redirect')
  const redirectTo = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/'

  useEffect(() => {
    document.title = 'Entrar | Marketplace'
  }, [])

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(values.email.trim().toLowerCase(), values.password),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user)
      // o login pode ter mesclado/vinculado o carrinho de visitante
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })
      navigate(redirectTo)
    },
    onError: (error) => {
      setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível entrar.')
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setServerError(null)
    const errors = validateLoginForm(values)
    setFieldErrors(errors ?? {})
    if (errors) return
    loginMutation.mutate()
  }

  return (
    <main>
      <Container className="flex justify-center py-10 md:py-16">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-h2 text-foreground">Entrar</h1>
          <p className="mt-1 text-body-small text-muted-foreground">
            Acesse sua conta para acompanhar seus pedidos.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            {serverError && (
              <Alert variant="error" title="Não foi possível entrar">
                {serverError}
              </Alert>
            )}
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={values.email}
              error={fieldErrors.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={values.password}
              error={fieldErrors.password}
              onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
            />
            <Button type="submit" size="lg" className="mt-2 w-full" loading={loginMutation.isPending}>
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-body-small text-muted-foreground">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </Card>
      </Container>
    </main>
  )
}
