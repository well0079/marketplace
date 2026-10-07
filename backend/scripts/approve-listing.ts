// C1: aprovação manual de anúncio (pending_review → active) SEM painel admin.
// Uso: pnpm approve-listing <listingId>
// O log de auditoria vai para o stdout (capturado pelos logs do servidor).
import { approveListing } from '../src/services/seller.service'
import { prisma } from '../src/lib/prisma'

async function main() {
  const listingId = process.argv[2]
  if (!listingId) {
    console.error('Uso: pnpm approve-listing <listingId>')
    process.exit(1)
  }
  try {
    const result = await approveListing(listingId, 'cli:approve-listing')
    console.log(`Anúncio aprovado: ${result.id} → ${result.status}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Falha ao aprovar: ${message}`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

void main()
