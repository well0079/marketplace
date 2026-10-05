import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { router } from './routes'
import { ApiError } from './lib/errors'

export const app = express()

// Produção roda atrás do proxy da Vercel: sem isso req.ip/protocol chegam errados
// e o cookie Secure não é reconhecido como conexão segura
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }))
app.use(express.json())
app.use('/api/v1', router)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Corpo JSON malformado: erro do cliente (400), não falha do servidor
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Corpo da requisição não é um JSON válido' } })
    return
  }
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    })
    return
  }
  console.error('[erro]', err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno do servidor' } })
})
