// Adapter serverless da Vercel (Opção A — projeto marketplace-api, Root Directory = backend/).
// bodyParser: false é OBRIGATÓRIO: sem ele a Vercel consome o body antes do Express e o
// webhook perde o corpo bruto (dedupe por hash do corpo ficaria instável). O Express
// parseia o corpo normalmente (express.json no app). req.url chega com o caminho
// completo (/api/v1/...), que casa com as rotas existentes.
import { app } from '../src/app'
import { assertProductionEnv } from '../src/lib/env'

assertProductionEnv()

export default app

export const config = {
  api: {
    bodyParser: false,
  },
  // A chamada à FastSoft usa timeout de 15s — a função precisa comportar isso
  maxDuration: 60,
}
