import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import { authApi, AUTH_QUERY_KEY, validateRegisterForm } from '../lib/auth'
import { CART_QUERY_KEY } from '../lib/cart'
import { Container } from '../components/layout/Container'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function Register() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Criar conta | Marketplace'
  }, [])

  const registerMutation = useMutation({
    mutationFn: () => authApi.register(values.name.trim(), values.email.trim().toLowerCase(), values.password),
    onSuccess: (user) => {
      // a API autentica no registro (cookie de sessão) e vincula o carrinho de visitante
      queryClient.setQueryData(AUTH_QUERY_KEY, user)
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY })
      navigate('/')
    },
    onError: (error) => {
      setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível criar a conta.')
    },
  })

  function setField(name: keyof typeof values) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [name]: event.target.value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setServerError(null)
    const errors = validateRegisterForm(values)
    setFieldErrors(errors ?? {})
    if (errors) return
    registerMutation.mutate()
  }

  return (
    <main>
      <Container className="flex justify-center py-10 md:py-16">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-h2 text-foreground">Criar conta</h1>
          <p className="mt-1 text-body-small text-muted-foreground">
            Cadastre-se para comprar e acompanhar seus pedidos.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
            {serverError && (
              <Alert variant="error" title="Não foi possível criar a conta">
                {serverError}
              </Alert>
            )}
            <Input
              label="Nome"
              autoComplete="name"
              placeholder="Seu nome"
              value={values.name}
              error={fieldErrors.name}
              onChange={setField('name')}
            />
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={values.email}
              error={fieldErrors.email}
              onChange={setField('email')}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              value={values.password}
              error={fieldErrors.password}
              onChange={setField('password')}
            />
            <Input
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={values.confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={setField('confirmPassword')}
            />
            <Button type="submit" size="lg" className="mt-2 w-full" loading={registerMutation.isPending}>
              Criar conta
            </Button>
          </form>

          <p className="mt-6 text-center text-body-small text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </Card>
      </Container>
    </main>
  )
}
