import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiClientError } from '../lib/api'
import {
  paymentQueryKey,
  paymentsApi,
  paymentRefetchInterval,
  paymentStatusMeta,
  secondsUntil,
  formatCountdown,
  isActivePaymentStatus,
} from '../lib/payments'
import { formatBRL } from '../lib/format'
import { Container } from '../components/layout/Container'
import { Alert } from '../components/ui/Alert'
import { AuthGate } from '../components/ui/AuthGate'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { PixQrCode } from '../components/ecommerce/PixPaymentCard'

// Tela do Pix: QR/copia e cola, validade e polling do status (4s, pausa em aba oculta).
// PAID → /checkout/success?order=RD-XXXX.
export function PixPayment() {
  const { id } = useParams<{ id: string }>()

  useEffect(() => {
    document.title = 'Pagamento Pix | Marketplace'
  }, [])

  return (
    <AuthGate title="Entre para ver seu pagamento" description="Entre na sua conta para continuar o pagamento.">
      <PixPaymentContent id={id ?? ''} />
    </AuthGate>
  )
}

function PixPaymentContent({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  const paymentQuery = useQuery({
    queryKey: paymentQueryKey(id),
    queryFn: () => paymentsApi.get(id),
    retry: false,
    refetchInterval: paymentRefetchInterval,
  })

  const payment = paymentQuery.data
  const status = payment?.status ?? ''

  // PAID → tela de sucesso (que reconfere o pedido na API)
  useEffect(() => {
    if (status === 'PAID') {
      navigate(`/checkout/success?order=${encodeURIComponent(payment?.orderCode ?? '')}`, { replace: true })
    }
  }, [status, payment?.orderCode, navigate])

  // relógio do contador (pausa natural em aba oculta por causa do polling; 1s é leve)
  useEffect(() => {
    if (!payment || !isActivePaymentStatus(status)) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [payment, status])

  const newPixMutation = useMutation({
    mutationFn: () => paymentsApi.get(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(paymentQueryKey(id), updated)
      queryClient.invalidateQueries({ queryKey: ['payments', id] })
    },
  })

  if (paymentQuery.isPending) {
    return (
      <main>
        <Container className="flex flex-col items-center gap-4 py-10">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-64 rounded-lg" />
          <Skeleton className="h-10 w-48" />
        </Container>
      </main>
    )
  }

  if (paymentQuery.isError) {
    const notFound = paymentQuery.error instanceof ApiClientError && paymentQuery.error.status === 404
    return (
      <main>
        <Container className="py-10">
          {notFound ? (
            <EmptyState
              title="Pagamento não encontrado"
              description="Este pagamento não existe ou pertence a outra conta."
              action={
                <Button size="sm" to="/orders">
                  Ver meus pedidos
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Não conseguimos carregar o pagamento."
              description="Verifique sua conexão e tente novamente."
              action={
                <Button size="sm" onClick={() => paymentQuery.refetch()}>
                  Tentar novamente
                </Button>
              }
            />
          )}
        </Container>
      </main>
    )
  }

  const meta = paymentStatusMeta(status)
  const qrCode = payment?.pix?.qrCode ?? null
  const expiresAt = payment?.pix?.expiresAt ?? null
  const remaining = secondsUntil(expiresAt, now)
  const expired = remaining !== null && remaining <= 0
  const isTextQr = qrCode !== null && !qrCode.startsWith('iVBORw') && !qrCode.startsWith('data:image') && !/^https?:\/\//i.test(qrCode)

  return (
    <main>
      <Container className="flex flex-col items-center gap-6 py-8">
        <header className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-h2 text-foreground">Pagamento Pix</h1>
          <p className="text-body-small text-muted-foreground">
            Pedido <span className="font-medium text-foreground">{payment?.orderCode}</span> ·{' '}
            {payment ? formatBRL(payment.amount) : ''}
          </p>
        </header>

        {expired && isActivePaymentStatus(status) && (
          <Alert variant="warning" title="QR Code expirado">
            Este Pix venceu. Gere um novo código para concluir o pagamento.
          </Alert>
        )}
        {meta.tone === 'refused' && (
          <Alert variant="error" title={meta.label}>
            O pagamento não foi concluído. Você pode gerar um novo Pix na página do pedido.
          </Alert>
        )}

        <Card className="flex w-full max-w-md flex-col items-center gap-4 p-6">
          {qrCode && !expired ? (
            <>
              <PixQrCode qrCode={qrCode} />
              {remaining !== null && isActivePaymentStatus(status) && (
                <p className="text-body-small text-muted-foreground" aria-live="polite">
                  Expira em <span className="font-medium text-foreground">{formatCountdown(remaining)}</span>
                </p>
              )}
              {isTextQr && (
                <div className="flex w-full flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      void navigator.clipboard?.writeText(qrCode)
                      setCopied(true)
                    }}
                  >
                    {copied ? 'Código copiado!' : 'Copiar código Pix'}
                  </Button>
                  <p className="break-all text-center text-caption text-muted-foreground" aria-hidden>
                    {qrCode.slice(0, 60)}…
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded border border-dashed border-line bg-page/50">
              <p className="text-body-small text-muted-foreground">
                {expired ? 'Este QR Code expirou.' : 'QR Code indisponível.'}
              </p>
              <Button size="sm" loading={newPixMutation.isPending} onClick={() => newPixMutation.mutate()}>
                Gerar novo Pix
              </Button>
            </div>
          )}

          <ol className="flex w-full flex-col gap-1 text-caption text-muted-foreground">
            <li>1. Abra o app do seu banco e escolha Pix &gt; Pagar com QR Code.</li>
            <li>2. Escaneie o código ou use o Pix copia e cola.</li>
            <li>3. A confirmação aparece aqui automaticamente em alguns segundos.</li>
          </ol>
        </Card>

        <p className="text-center text-body-small text-muted-foreground" role="status" aria-live="polite">
          {isActivePaymentStatus(status) ? 'Aguardando a confirmação do pagamento…' : `Situação: ${meta.label}.`}
        </p>

        <Link to={`/orders/${payment?.orderCode ?? ''}`} className="text-body-small font-medium text-primary hover:underline">
          ← Voltar para o pedido
        </Link>
      </Container>
    </main>
  )
}
