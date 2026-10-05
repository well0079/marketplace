import { PrismaClient } from '@prisma/client'

// Seed do tema INGRESSOS (branch ingressos). DESTRUTIVO: limpa eventos, reservas
// e também o catálogo legado de produtos físicos (que não é mais semeado aqui).
//
// Como limpar o seed: rodar `pnpm seed` novamente (recria tudo do zero) ou
// apagar manualmente as tabelas na ordem — Reservation → Offer → EventSession →
// Event — via SQL. Ver docs/DEPLOY.md.
//
// TUDO AQUI É FICTÍCIO (eventos, times, casas de espetáculo). Nada é copiado de
// site nenhum. sellerId nulo = venda pela plataforma.
//
// Regra de preços das categorias (documentada): Meia = 50% da Inteira;
// Solidário = 30% da Inteira (valores inteiros em centavos, round).

const prisma = new PrismaClient()

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

type SessionSpec = { daysFromNow: number; hour: number; city: string; uf: string; venue: string; withoutOffers?: boolean }
type EventSpec = {
  name: string
  category: string
  organizer: string
  description: string
  featured?: boolean
  basePriceCents: number
  sessions: SessionSpec[]
  /** tipos de área com multiplicador sobre a base (Pista 1x, VIP 2x, Camarote 3x) */
  types?: { name: string; multiplier: number; quantity: number }[]
}

const DEFAULT_TYPES = [
  { name: 'Pista', multiplier: 1, quantity: 8 },
  { name: 'Área VIP', multiplier: 2, quantity: 4 },
]

const CATEGORIES_MULTIPLIER: Record<string, number> = {
  Inteira: 1,
  Meia: 0.5,
  Solidário: 0.3,
}

const EVENTS: EventSpec[] = [
  {
    name: 'Festival Aurora 2026', category: 'Festivais', organizer: 'Produções Horizonte', featured: true,
    description: 'Doze horas de música ao vivo com artistas independentes de todo o país, praça de alimentação e área de convivência.',
    basePriceCents: 12000,
    sessions: [
      { daysFromNow: 21, hour: 14, city: 'São Paulo', uf: 'SP', venue: 'Parque Aurora' },
      { daysFromNow: 22, hour: 14, city: 'Rio de Janeiro', uf: 'RJ', venue: 'Arena Maré' },
    ],
    types: [...DEFAULT_TYPES, { name: 'Camarote', multiplier: 3, quantity: 2 }],
  },
  {
    name: 'Time Azul x Time Verde — Final Estadual', category: 'Futebol', organizer: 'Liga Fictícia de Futebol', featured: true,
    description: 'A decisão do estadual entre dois gigantes rivais. Mando de campo do Time Azul no estádio Municipal.',
    basePriceCents: 8000,
    sessions: [{ daysFromNow: 14, hour: 16, city: 'Campinas', uf: 'SP', venue: 'Estádio Municipal' }],
    types: [
      { name: 'Pista', multiplier: 1, quantity: 10 },
      { name: 'Área VIP', multiplier: 2, quantity: 5 },
    ],
  },
  {
    name: 'Clássico dos Rivais: Time Rubro x Time Celeste', category: 'Futebol', organizer: 'Liga Fictícia de Futebol',
    description: 'O clássico que paraliza a cidade. Rivalidade centenária em jogo único pela Copa Regional.',
    basePriceCents: 6000,
    sessions: [{ daysFromNow: 30, hour: 18, city: 'Belo Horizonte', uf: 'MG', venue: 'Arena do Vale' }],
  },
  {
    name: 'Turnê Nacional: Banda Farol', category: 'Shows', organizer: 'Casa de Shows Alvorada', featured: true,
    description: 'A turnê mais esperada do ano passa por três capitais com o álbum novo na íntegra.',
    basePriceCents: 15000,
    sessions: [
      { daysFromNow: 40, hour: 21, city: 'São Paulo', uf: 'SP', venue: 'Teatro Municipal' },
      { daysFromNow: 47, hour: 21, city: 'Curitiba', uf: 'PR', venue: 'Palco Estação' },
      { daysFromNow: 54, hour: 21, city: 'Porto Alegre', uf: 'RS', venue: 'La Sede', withoutOffers: true },
    ],
  },
  {
    name: 'A Comédia das Coisas', category: 'Teatro', organizer: 'Cia. Palco Livre',
    description: 'Comédia sobre a vida adulta, group chats e reuniões que podiam ser e-mails. 90 minutos sem intervalo.',
    basePriceCents: 5000,
    sessions: [
      { daysFromNow: 10, hour: 20, city: 'São Paulo', uf: 'SP', venue: 'Teatro da Esquina' },
      { daysFromNow: 11, hour: 20, city: 'São Paulo', uf: 'SP', venue: 'Teatro da Esquina' },
    ],
    types: [{ name: 'Pista', multiplier: 1, quantity: 6 }],
  },
  {
    name: 'Peça: O Último Trem', category: 'Teatro', organizer: 'Grupo Estação',
    description: 'Drama em um ato sobre despedidas e estações de trem que nunca chegam.',
    basePriceCents: 4000,
    sessions: [{ daysFromNow: 25, hour: 19, city: 'Recife', uf: 'PE', venue: 'Cais do Teatro' }],
  },
  {
    name: 'Festival Aurora — Edição Praia', category: 'Festivais', organizer: 'Produções Horizonte',
    description: 'A edição praieira do Festival Aurora, com pôr do sol, três palcos e food trucks.',
    basePriceCents: 10000,
    sessions: [{ daysFromNow: 60, hour: 15, city: 'Florianópolis', uf: 'SC', venue: 'Arena Duna' }],
  },
  {
    name: 'Vozes da Serra', category: 'Shows', organizer: 'Casa de Shows Alvorada',
    description: 'Noite de vozes femininas da música brasileira em formato acústico.',
    basePriceCents: 9000,
    sessions: [{ daysFromNow: 18, hour: 20, city: 'Campos do Jordão', uf: 'SP', venue: 'Auditório Serra' }],
  },
  {
    // sessão SEM ofertas: o frontend exibe "Indisponível"
    name: 'Time Azul x Time Verde — Copa Regional', category: 'Futebol', organizer: 'Liga Fictícia de Futebol',
    description: 'Jogo de estreia na Copa Regional. Vendas abrem em breve.',
    basePriceCents: 5000,
    sessions: [{ daysFromNow: 45, hour: 16, city: 'Santos', uf: 'SP', venue: 'Estádio Beira-Mar', withoutOffers: true }],
  },
  {
    name: 'Recital de Piano: Noite de Lua', category: 'Teatro', organizer: 'Conservatório Municipal',
    description: 'Recital solo com obras de compositores brasileiros. Sessão única de sala cheia.',
    basePriceCents: 7000,
    sessions: [{ daysFromNow: 33, hour: 20, city: 'Vitória', uf: 'ES', venue: 'Sala Lua Cheia', withoutOffers: true }],
  },
  {
    name: 'Garage Rock Night', category: 'Shows', organizer: 'Garage Coletivo',
    description: 'Três bandas do underground em uma noite de rock cru e alto.',
    basePriceCents: 3500,
    sessions: [
      { daysFromNow: 12, hour: 22, city: 'São Paulo', uf: 'SP', venue: 'Galpão 44' },
      { daysFromNow: 13, hour: 22, city: 'São Paulo', uf: 'SP', venue: 'Galpão 44' },
    ],
    types: [{ name: 'Pista', multiplier: 1, quantity: 12 }],
  },
  {
    // evento de teste do fluxo Pix com o MENOR valor possível (acima da taxa do gateway)
    name: 'Evento de teste Pix', category: 'Teste', organizer: 'Equipe Marketplace',
    description: 'Produto exclusivo para testar o fluxo de pagamento Pix com valor baixo (acima da taxa do gateway).',
    basePriceCents: 1000,
    sessions: [{ daysFromNow: 7, hour: 12, city: 'São Paulo', uf: 'SP', venue: 'Ambiente de Testes' }],
    types: [{ name: 'Pista', multiplier: 1, quantity: 5 }],
  },
]

async function main() {
  // limpeza: reservas/ofertas/sessões/eventos + catálogo legado de produtos físicos
  // (o tema ingressos não semeia mais produtos; os DELETEs mantêm o seed re-executável)
  await prisma.reservation.deleteMany()
  await prisma.offer.deleteMany()
  await prisma.eventSession.deleteMany()
  await prisma.event.deleteMany()
  await prisma.paymentEvent.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.review.deleteMany()
  await prisma.question.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.productImage.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.address.deleteMany()
  await prisma.user.deleteMany()

  let offerCount = 0
  let sessionCount = 0
  for (const spec of EVENTS) {
    const event = await prisma.event.create({
      data: {
        slug: slugify(spec.name),
        name: spec.name,
        category: spec.category,
        organizer: spec.organizer,
        description: spec.description,
        featured: spec.featured ?? false,
      },
    })
    for (const sessionSpec of spec.sessions) {
      const startsAt = new Date()
      startsAt.setDate(startsAt.getDate() + sessionSpec.daysFromNow)
      startsAt.setHours(sessionSpec.hour, 0, 0, 0)
      const session = await prisma.eventSession.create({
        data: {
          eventId: event.id,
          startsAt,
          city: sessionSpec.city,
          uf: sessionSpec.uf,
          venue: sessionSpec.venue,
        },
      })
      sessionCount += 1
      if (sessionSpec.withoutOffers) continue

      const types = spec.types ?? DEFAULT_TYPES
      for (const type of types) {
        for (const [category, multiplier] of Object.entries(CATEGORIES_MULTIPLIER)) {
          await prisma.offer.create({
            data: {
              sessionId: session.id,
              ticketType: type.name,
              ticketCategory: category,
              priceCents: Math.round(spec.basePriceCents * type.multiplier * multiplier),
              quantity: type.quantity,
              // sellerId nulo = plataforma
            },
          })
          offerCount += 1
        }
      }
    }
  }

  console.log(`Seed ingressos concluído: ${EVENTS.length} eventos, ${sessionCount} sessões, ${offerCount} ofertas.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
