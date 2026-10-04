import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { AUTH_QUERY_KEY, fetchCurrentUser } from '../../lib/auth'
import { Container } from '../layout/Container'
import { Button } from './Button'
import { Card } from './Card'
import { Skeleton } from './Skeleton'

// Portão de login para páginas que exigem sessão (checkout, pedidos).
// Entrar/Criar conta voltam para a página atual via ?redirect= (só paths relativos).
export function AuthGate({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const location = useLocation()
  const meQuery = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchCurrentUser })
  const user = meQuery.data ?? null
  const redirect = `${location.pathname}${location.search}`

  if (meQuery.isPending) {
    return (
      <main>
        <Container className="py-8">
          <Skeleton className="h-48 w-full rounded-lg" />
        </Container>
      </main>
    )
  }

  if (!user) {
    return (
      <main>
        <Container className="flex justify-center py-10 md:py-16">
          <Card className="w-full max-w-md p-8 text-center">
            <h1 className="text-h3 text-foreground">{title}</h1>
            <p className="mt-2 text-body-small text-muted-foreground">{description}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button size="lg" to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                Entrar
              </Button>
            </div>
            <p className="mt-4 text-body-small text-muted-foreground">
              Não tem conta?{' '}
              <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-primary hover:underline">
                Criar conta
              </Link>
            </p>
          </Card>
        </Container>
      </main>
    )
  }

  return <>{children}</>
}
