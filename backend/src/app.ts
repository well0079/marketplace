import 'dotenv/config'
import express, { type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import { router } from './routes'
import { ApiError } from './lib/errors'

export const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }))
app.use(express.json())
app.use('/api/v1', router)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    })
    return
  }
  console.error('[erro]', err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno do servidor' } })
})
