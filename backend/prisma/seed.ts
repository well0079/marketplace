import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const CATEGORIES: { name: string; slug: string; parent?: string }[] = [
  { name: 'Celulares e Telefones', slug: 'celulares-e-telefones' },
  { name: 'Smartphones', slug: 'smartphones', parent: 'celulares-e-telefones' },
  { name: 'Informática', slug: 'informatica' },
  { name: 'Notebooks', slug: 'notebooks', parent: 'informatica' },
  { name: 'Monitores', slug: 'monitores', parent: 'informatica' },
  { name: 'Eletrônicos, Áudio e Vídeo', slug: 'eletronicos-audio-e-video' },
  { name: 'TVs', slug: 'tvs', parent: 'eletronicos-audio-e-video' },
  { name: 'Áudio', slug: 'audio', parent: 'eletronicos-audio-e-video' },
  { name: 'Eletrodomésticos', slug: 'eletrodomesticos' },
  { name: 'Aspiradores', slug: 'aspiradores', parent: 'eletrodomesticos' },
  { name: 'Cozinha', slug: 'cozinha', parent: 'eletrodomesticos' },
  { name: 'Casa e Móveis', slug: 'casa-e-moveis' },
  { name: 'Móveis', slug: 'moveis', parent: 'casa-e-moveis' },
  { name: 'Esportes e Fitness', slug: 'esportes-e-fitness' },
  { name: 'Academia', slug: 'academia', parent: 'esportes-e-fitness' },
  { name: 'Ferramentas', slug: 'ferramentas' },
  // Categoria de teste (Pix). Para remover: apague estas 2 entradas
  // (categoria abaixo + produto em PRODUCTS) e rode `pnpm seed`.
  { name: 'Teste', slug: 'teste' },
]

type SeedVariant = { attributes: Record<string, string>; stock: number }
type SeedProduct = {
  title: string; brand: string; cat: string; price: number; orig?: number
  free?: boolean; rating: number; rc: number; sold: number; imgs: number
  desc: string; variants: SeedVariant[]
}
const v = (attributes: Record<string, string>, stock: number): SeedVariant => ({ attributes, stock })

const PRODUCTS: SeedProduct[] = [
  { title: 'Smartphone Samsung Galaxy A15 5G 128GB Azul Escuro 4GB Ram', brand: 'Samsung', cat: 'smartphones', price: 74900, orig: 99900, free: true, rating: 4.6, rc: 1843, sold: 12500, imgs: 5, desc: 'Tela Super AMOLED de 6.5 polegadas, câmera tripla de 50MP, bateria de 5000mAh e carregamento rápido de 25W.', variants: [v({ Cor: 'Azul escuro' }, 32), v({ Cor: 'Preto' }, 18)] },
  { title: 'Smartphone Xiaomi Redmi Note 13 Pro 256GB 8GB Ram Preto', brand: 'Xiaomi', cat: 'smartphones', price: 109900, orig: 129900, free: true, rating: 4.7, rc: 2210, sold: 8400, imgs: 5, desc: 'Câmera de 108MP, tela AMOLED 120Hz de 6.67 polegadas e bateria de 5100mAh com carregamento de 33W.', variants: [v({ Cor: 'Preto' }, 25), v({ Cor: 'Azul' }, 14)] },
  { title: 'Smartphone Motorola Moto G04 128GB 4GB Ram Verde', brand: 'Motorola', cat: 'smartphones', price: 59900, rating: 4.4, rc: 980, sold: 5100, imgs: 4, desc: 'Tela de 6.6 polegadas 90Hz, processador Snapdragon 680 e bateria que dura mais de um dia.', variants: [v({ Cor: 'Verde' }, 40), v({ Cor: 'Preto' }, 22)] },
  { title: 'Apple iPhone 13 128GB Meia-noite', brand: 'Apple', cat: 'smartphones', price: 319900, orig: 359900, free: true, rating: 4.9, rc: 5320, sold: 21000, imgs: 6, desc: 'Chip A15 Bionic, tela OLED Super Retina XDR de 6.1 polegadas, câmera dupla de 12MP e resistência à água IP68.', variants: [v({ Cor: 'Meia-noite' }, 15), v({ Cor: 'Starlight' }, 9), v({ Cor: 'Azul' }, 6)] },
  { title: 'Smartphone Realme C67 128GB 6GB Ram Azul', brand: 'Realme', cat: 'smartphones', price: 69900, rating: 4.5, rc: 640, sold: 3300, imgs: 4, desc: 'Design ultrafino, câmera de 108MP e bateria de 5000mAh com carregamento de 33W.', variants: [v({ Cor: 'Azul' }, 28)] },
  { title: 'Notebook Lenovo IdeaPad 3i 15.6 Polegadas Intel Core i5 8GB 256GB SSD', brand: 'Lenovo', cat: 'notebooks', price: 219900, orig: 259900, free: true, rating: 4.5, rc: 1520, sold: 4700, imgs: 5, desc: 'Notebook para o dia a dia com Intel Core i5, tela antirreflexo de 15.6 polegadas e Windows 11.', variants: [v({ Cor: 'Cinza' }, 17)] },
  { title: 'Notebook Acer Aspire 5 Ryzen 5 16GB 512GB SSD', brand: 'Acer', cat: 'notebooks', price: 249900, free: true, rating: 4.6, rc: 890, sold: 2600, imgs: 4, desc: 'Ryzen 5, 16GB de RAM e SSD de 512GB para trabalho e estudos com desempenho sólido.', variants: [v({ Cor: 'Preto' }, 12)] },
  { title: 'Notebook Samsung Book3 15.6 Polegadas Intel Core i3 8GB 256GB', brand: 'Samsung', cat: 'notebooks', price: 189900, orig: 209900, rating: 4.3, rc: 510, sold: 1900, imgs: 4, desc: 'Fino e leve, com Intel Core i3, teclado numérico e bateria de longa duração.', variants: [v({ Cor: 'Prata' }, 9)] },
  { title: 'Monitor LG 24 Polegadas Full HD IPS 75Hz', brand: 'LG', cat: 'monitores', price: 49900, rating: 4.6, rc: 1120, sold: 3800, imgs: 4, desc: 'Monitor IPS Full HD com cores fiéis e bordas finas, ideal para home office.', variants: [v({}, 26)] },
  { title: 'Monitor AOC 27 Polegadas QHD 165Hz Gamer', brand: 'AOC', cat: 'monitores', price: 89900, orig: 109900, free: true, rating: 4.7, rc: 780, sold: 1500, imgs: 4, desc: 'Monitor gamer QHD de 27 polegadas com 165Hz, 1ms e FreeSync Premium.', variants: [v({}, 11)] },
  { title: 'Smart TV Samsung 50 Polegadas Crystal UHD 4K', brand: 'Samsung', cat: 'tvs', price: 199900, orig: 249900, free: true, rating: 4.7, rc: 3450, sold: 9800, imgs: 5, desc: 'Smart TV 4K com processador Crystal 4K, Tizen OS e design sem molduras.', variants: [v({}, 23)] },
  { title: 'Smart TV LG 55 Polegadas OLED evo C4 4K', brand: 'LG', cat: 'tvs', price: 499900, free: true, rating: 4.9, rc: 620, sold: 890, imgs: 5, desc: 'OLED evo com negro perfeito, 120Hz, Dolby Vision e webOS com magic remote.', variants: [v({}, 7)] },
  { title: 'Smart TV TCL 43 Polegadas QLED 4K', brand: 'TCL', cat: 'tvs', price: 139900, free: true, rating: 4.5, rc: 940, sold: 3100, imgs: 4, desc: 'QLED 4K com HDR10+, Google TV e áudio Dolby Atmos.', variants: [v({}, 19)] },
  { title: 'Fone de Ouvido Bluetooth JBL Tune 520BT', brand: 'JBL', cat: 'audio', price: 24900, orig: 32900, rating: 4.6, rc: 4210, sold: 15600, imgs: 4, desc: 'Fone Bluetooth com até 57 horas de bateria e JBL Pure Bass.', variants: [v({ Cor: 'Preto' }, 52), v({ Cor: 'Azul' }, 31), v({ Cor: 'Branco' }, 24)] },
  { title: 'Caixa de Som Bluetooth JBL Charge 5', brand: 'JBL', cat: 'audio', price: 89900, free: true, rating: 4.8, rc: 2870, sold: 7300, imgs: 5, desc: 'Caixa à prova de água IP67 com 20 horas de bateria e som JBL Pro.', variants: [v({ Cor: 'Preto' }, 20), v({ Cor: 'Azul' }, 13), v({ Cor: 'Vermelho' }, 8)] },
  { title: 'Fone de Ouvido Xiaomi Redmi Buds 5', brand: 'Xiaomi', cat: 'audio', price: 12900, rating: 4.4, rc: 1730, sold: 9200, imgs: 3, desc: 'Fones true wireless com cancelamento de ruído de até 46dB e bateria de 40 horas com estojo.', variants: [v({ Cor: 'Preto' }, 64), v({ Cor: 'Branco' }, 48)] },
  { title: 'Aspirador De Pó E Água Wap Gtw 10 10l Amarelo E Preto 127v', brand: 'Wap', cat: 'aspiradores', price: 25990, orig: 39900, free: true, rating: 4.8, rc: 450, sold: 100000, imgs: 6, desc: 'Aspirador de pó e água de 1400W com tanque de 10 litros, mangueira de 1,5m e filtro permanente. Inclui acessórios.', variants: [v({ Voltagem: '127V' }, 51), v({ Voltagem: '220V' }, 38)] },
  { title: 'Aspirador Robô Xiaomi Robot Vacuum S10', brand: 'Xiaomi', cat: 'aspiradores', price: 129900, free: true, rating: 4.6, rc: 810, sold: 2100, imgs: 5, desc: 'Aspirador robô com navegação LDS, aspiração de 4000Pa e bateria para até 130 minutos.', variants: [v({ Cor: 'Preto' }, 12)] },
  { title: 'Aspirador de Pó Vertical Electrolux ERV15 2 em 1', brand: 'Electrolux', cat: 'aspiradores', price: 39900, rating: 4.3, rc: 320, sold: 1400, imgs: 4, desc: 'Aspirador vertical 2 em 1 com tecnologia Cyclone e bateria recarregável.', variants: [v({}, 18)] },
  { title: 'Air Fryer Mondial Family 8 Litros Preta', brand: 'Mondial', cat: 'cozinha', price: 39900, orig: 49900, free: true, rating: 4.7, rc: 3960, sold: 14200, imgs: 5, desc: 'Air fryer familiar de 8 litros com 7 programas, cesto antiaderente e painel digital.', variants: [v({ Cor: 'Preta' }, 44), v({ Cor: 'Vermelha' }, 12)] },
  { title: 'Micro-ondas LG 30 Litros Smart Inovador Prata', brand: 'LG', cat: 'cozinha', price: 59900, free: true, rating: 4.5, rc: 1140, sold: 3600, imgs: 4, desc: 'Micro-ondas de 30 litros com tecnologia Smart Inverter e fácil limpeza interna.', variants: [v({ Cor: 'Prata' }, 16)] },
  { title: 'Cafeteira Espresso Nespresso Essenza Mini', brand: 'Nespresso', cat: 'cozinha', price: 44900, orig: 49900, rating: 4.6, rc: 2450, sold: 8700, imgs: 4, desc: 'Cafeteira espresso compacta com pressão de 19 bar e aquecimento rápido em 25 segundos.', variants: [v({ Cor: 'Vermelho' }, 23), v({ Cor: 'Preto' }, 19)] },
  { title: 'Liquidificador Philips Walita Pro 700W Preto', brand: 'Philips', cat: 'cozinha', price: 19900, rating: 4.5, rc: 1830, sold: 7400, imgs: 3, desc: 'Liquidificador com 700W, copo de 2,1 litros e 4 lâminas inox duráveis.', variants: [v({ Cor: 'Preto' }, 58)] },
  { title: 'Cadeira Gamer ThunderX3 EC3 Reclinável', brand: 'ThunderX3', cat: 'moveis', price: 99900, orig: 129900, free: true, rating: 4.6, rc: 1290, sold: 4100, imgs: 5, desc: 'Cadeira gamer com reclinagem de 180 graus, apoio lombar ajustável e almofadas removíveis.', variants: [v({ Cor: 'Preto' }, 14), v({ Cor: 'Preto e vermelho' }, 9)] },
  { title: 'Escrivaninha Madesa 120cm Com Gaveta', brand: 'Madesa', cat: 'moveis', price: 29900, rating: 4.4, rc: 720, sold: 2900, imgs: 4, desc: 'Escrivaninha de 120cm com gaveta, pés com regulagem e acabamento UV.', variants: [v({ Cor: 'Branco' }, 21), v({ Cor: 'Imbuia' }, 17)] },
  { title: 'Sofá Retrátil e Reclinável 3 Lugares Suede Cinza', brand: 'Genérico', cat: 'moveis', price: 89900, free: true, rating: 4.5, rc: 890, sold: 1600, imgs: 5, desc: 'Sofá retrátil e reclinável de 3 lugares em suede, com estrutura em madeira maciça.', variants: [v({ Cor: 'Cinza' }, 7)] },
  { title: 'Par de Halteres Emborrachados 20kg', brand: 'Genérico', cat: 'academia', price: 15900, rating: 4.6, rc: 640, sold: 3800, imgs: 3, desc: 'Par de halteres de 20kg emborrachados, antiderrapantes e com encaixe firme.', variants: [v({}, 35)] },
  { title: 'Bicicleta Ergométrica Moveland Speed Bike', brand: 'Moveland', cat: 'academia', price: 89900, free: true, rating: 4.4, rc: 310, sold: 780, imgs: 4, desc: 'Bicicleta ergométrica com 8 níveis de resistência, monitor digital e assento ajustável.', variants: [v({}, 8)] },
  { title: 'Tapete de Yoga 6mm Antiderrapante', brand: 'Genérico', cat: 'academia', price: 7900, rating: 4.7, rc: 1560, sold: 11200, imgs: 3, desc: 'Tapete de yoga de 6mm dupla face antiderrapante com straps de transporte.', variants: [v({ Cor: 'Azul' }, 70), v({ Cor: 'Roxo' }, 45), v({ Cor: 'Preto' }, 60)] },
  { title: 'Parafusadeira Bosch Go 3,6V Com Bits Automáticos', brand: 'Bosch', cat: 'ferramentas', price: 32900, rating: 4.8, rc: 2210, sold: 6800, imgs: 4, desc: 'Parafusadeira elétrica com bits automáticos, torque eletrônico e case.', variants: [v({}, 26)] },
  { title: 'Kit Chaves de Fenda Tramontina 6 Peças', brand: 'Tramontina', cat: 'ferramentas', price: 5900, rating: 4.7, rc: 980, sold: 5200, imgs: 3, desc: 'Kit com 6 chaves de fenda e phillips em aço cromo vanádio com cabo emborrachado.', variants: [v({}, 48)] },
  // Produto de teste Pix (R$ 10,00) — para remover: apague esta entrada e a categoria
  // "Teste" acima e rode `pnpm seed`; ou delete direto no banco:
  //   DELETE FROM "Product" WHERE slug = 'produto-de-teste-pix';
  //   DELETE FROM "Category" WHERE slug = 'teste';
  { title: 'Produto de teste Pix', brand: 'Teste', cat: 'teste', price: 1000, free: true, rating: 5, rc: 0, sold: 0, imgs: 1, desc: 'Produto exclusivo para testar o fluxo de pagamento Pix com o menor valor possível.', variants: [v({}, 5)] },
]

async function main() {
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

  const catMap = new Map<string, string>()
  for (const [i, c] of CATEGORIES.entries()) {
    const cat = await prisma.category.create({
      data: { name: c.name, slug: c.slug, position: i, parentId: c.parent ? catMap.get(c.parent)! : null },
    })
    catMap.set(c.slug, cat.id)
  }

  for (const p of PRODUCTS) {
    const slug = slugify(p.title)
    await prisma.product.create({
      data: {
        title: p.title, slug, description: p.desc, brand: p.brand,
        price: p.price, originalPrice: p.orig ?? null,
        freeShipping: p.free ?? false, condition: 'new', status: 'active',
        ratingAvg: p.rating, ratingCount: p.rc, soldCount: p.sold,
        categoryId: catMap.get(p.cat)!,
        images: {
          create: Array.from({ length: p.imgs }, (_, i) => ({
            url: `https://picsum.photos/seed/${slug}-${i + 1}/800/800`,
            alt: `${p.title} — imagem ${i + 1} de ${p.imgs}`,
            position: i,
          })),
        },
        variants: { create: p.variants.map((x) => ({ attributes: x.attributes, stock: x.stock })) },
      },
    })
  }

  console.log(`Seed concluído: ${CATEGORIES.length} categorias, ${PRODUCTS.length} produtos.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
