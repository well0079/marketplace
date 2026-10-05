import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import QRCodeSVG from 'react-qr-code'
import { ApiClientError } from '../../lib/api'
import { maskCpfInput, maskPhoneInput, validatePayerForm, type PayerValues } from '../../lib/payer'
import { paymentsApi, paymentQueryKey, pixQrCodeKind } from '../../lib/payments'
import { formatBRL } from '../../lib/format'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

// Bloco "Pagar com Pix": dados do pagador (pré-preenchidos) → cria o pagamento
// e navega para a tela do QR. Reutilizado em pedido-recebido e detalhe do pedido.
export function PixPaymentCard({ orderCode, total, defaultName }: { orderCode: string; total: number; defaultName: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<PayerValues>({ name: defaultName, document: '', phone: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  )

  const createMutation = useMutation({
    mutationFn: () => paymentsApi.create({ orderCode, method: 'pix', payer: values, idempotencyKey }),
    onSuccess: (payment) => {
      queryClient.setQueryData(paymentQueryKey(payment.paymentId), payment)
      navigate(`/payments/${payment.paymentId}`)
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields && Object.keys(error.fields).length > 0) {
        setFieldErrors(error.fields)
        setServerError(null)
      } else {
        setFieldErrors({})
        setServerError(error instanceof ApiClientError ? error.message : 'Não foi possível iniciar o pagamento.')
      }
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setServerError(null)
    const errors = validatePayerForm(values)
    setFieldErrors(errors ?? {})
    if (errors) return
    createMutation.mutate()
  }

  return (
    <section aria-label="Pagar com Pix" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 text-success" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12h8M8 12l3-3M8 12l3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="text-h4 text-foreground">Pagar com Pix</h2>
        <span className="text-body-small font-medium text-foreground">{formatBRL(total)}</span>
      </div>

      {serverError && (
        <Alert variant="error" title="Não foi possível iniciar o pagamento">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <Input
          label="Nome do pagador"
          autoComplete="name"
          value={values.name}
          error={fieldErrors.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="CPF"
            inputMode="numeric"
            autoComplete="cpf"
            placeholder="000.000.000-00"
            value={values.document}
            error={fieldErrors.document}
            onChange={(e) => setValues((v) => ({ ...v, document: maskCpfInput(e.target.value) }))}
          />
          <Input
            label="Telefone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 98765-4321"
            value={values.phone}
            error={fieldErrors.phone}
            onChange={(e) => setValues((v) => ({ ...v, phone: maskPhoneInput(e.target.value) }))}
          />
        </div>
        <Button type="submit" size="lg" loading={createMutation.isPending} className="w-full sm:self-start">
          Gerar QR Code Pix
        </Button>
      </form>
    </section>
  )
}

// Renderização defensiva do QR (doc confirma pix.qrcode; o exemplo vem como base64 PNG)
export function PixQrCode({ qrCode, size = 232 }: { qrCode: string; size?: number }) {
  const kind = pixQrCodeKind(qrCode)
  if (kind === 'image') {
    return <img src={`data:image/png;base64,${qrCode.replace(/^data:image\/\w+;base64,/, '')}`} alt="QR Code Pix" width={size} height={size} className="rounded border border-line bg-surface" />
  }
  if (kind === 'url') {
    return <img src={qrCode} alt="QR Code Pix" width={size} height={size} className="rounded border border-line bg-surface" />
  }
  return (
    <span className="rounded border border-line bg-surface p-2">
      <QRCodeSVG value={qrCode} size={size} />
    </span>
  )
}
