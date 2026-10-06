import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

// /sellers/verify: fluxo completo de verificação chega no bloco 5.
export function SellersVerifySoonPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-[600px] items-center px-4">
      <EmptyState
        title="Em breve"
        description="A verificação de identidade para anunciar ingressos está chegando. Você poderá anunciar seus ingressos por aqui."
        action={
          <Button size="sm" to="/tickets">
            Voltar para Ingressos
          </Button>
        }
      />
    </main>
  )
}
