import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Outlet, useNavigate } from 'react-router-dom'
import { AUTH_QUERY_KEY, authApi, fetchCurrentUser } from '../../lib/auth'
import { AlertBanner, Footer, LegalStrip } from './Footer'
import { TopBar as TopBarAccount } from './TopBarAccount'

// Shell das rotas do tema ingressos: faixa legal + alerta por env + TopBar com
// sessão real + <Outlet/> + rodapé completo (padding para a BottomNav futura).
export function TicketShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchCurrentUser })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
      navigate('/')
    },
  })

  return (
    <div className="flex min-h-screen flex-col bg-ticket-surface-muted">
      <LegalStrip />
      <AlertBanner />
      <TopBarAccount
        user={meQuery.data ? { name: meQuery.data.name, email: meQuery.data.email } : null}
        onLogout={() => logoutMutation.mutate()}
      />
      <div className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </div>
      <div className="pb-16 md:pb-0">
        <Footer />
      </div>
    </div>
  )
}
