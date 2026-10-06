import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

// 404 no tema ingressos (usado dentro do TicketShell)
export function TicketNotFoundPage() {
  return (
    <main className="mx-auto max-w-[600px] px-4 py-16">
      <EmptyState
        title="Página não encontrada"
        description="O endereço que você abriu não existe ou mudou de lugar."
        action={
          <Button size="sm" to="/">
            Voltar para a página inicial
          </Button>
        }
      />
    </main>
  )
}

import { DemoLegalPage } from '../components/ingressos/Footer'

export function TermsPage() {
  return (
    <DemoLegalPage title="Termos de uso">
      <p>
        Este é um marketplace demonstrativo de revenda de ingressos. Os ingressos anunciados
        pertencem a vendedores independentes e os preços são definidos por eles.
      </p>
      <p>
        Ao criar uma conta você concorda em usar a plataforma de boa-fé, respeitar os eventos e as
        regras de transferência de ingressos e manter seus dados de acesso seguros.
      </p>
    </DemoLegalPage>
  )
}

export function PrivacyPage() {
  return (
    <DemoLegalPage title="Privacidade">
      <p>
        Coletamos apenas os dados necessários para operar a compra e venda de ingressos: nome,
        e-mail, celular e CPF (guardado de forma protegida, nunca exibido completo).
      </p>
      <p>
        Não vendemos seus dados para terceiros. Este texto é demonstrativo e será substituído pela
        política oficial antes de qualquer operação real.
      </p>
    </DemoLegalPage>
  )
}
