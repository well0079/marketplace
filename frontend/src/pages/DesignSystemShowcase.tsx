import type { ReactNode } from 'react'
import { Container } from '../components/layout/Container'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Breadcrumb } from '../components/ui/Breadcrumb'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card'
import { Checkbox } from '../components/ui/Checkbox'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Input } from '../components/ui/Input'
import { Radio } from '../components/ui/Radio'
import { Select } from '../components/ui/Select'
import { Separator } from '../components/ui/Separator'
import { Skeleton, SkeletonText } from '../components/ui/Skeleton'
import { CategoryCard } from '../components/ecommerce/CategoryCard'
import { Price } from '../components/ecommerce/Price'
import { ProductCard, ProductCardSkeleton, type ProductCardData } from '../components/ecommerce/ProductCard'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2 text-foreground">{title}</h2>
      {children}
    </section>
  )
}

const COLORS: { name: string; className: string; border?: boolean }[] = [
  { name: 'background', className: 'bg-background', border: true },
  { name: 'surface', className: 'bg-surface', border: true },
  { name: 'primary', className: 'bg-primary' },
  { name: 'primary-hover', className: 'bg-primary-hover' },
  { name: 'secondary', className: 'bg-secondary', border: true },
  { name: 'success', className: 'bg-success' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'destructive', className: 'bg-destructive' },
  { name: 'info', className: 'bg-info' },
  { name: 'success-soft', className: 'bg-success-soft' },
  { name: 'warning-soft', className: 'bg-warning-soft' },
  { name: 'destructive-soft', className: 'bg-destructive-soft' },
]

const SAMPLE_PRODUCT: ProductCardData = {
  id: 'p1',
  slug: 'smartphone-samsung-galaxy-a15-5g-128gb-azul-escuro-4gb-ram',
  title: 'Smartphone Samsung Galaxy A15 5G 128GB Azul Escuro 4GB Ram',
  price: 74900,
  originalPrice: 99900,
  discountPercent: 25,
  freeShipping: true,
  thumbnail: 'https://picsum.photos/seed/ds-galaxy-a15/800/800',
  rating: { average: 4.6, count: 1843 },
}

const OUT_OF_STOCK_PRODUCT: ProductCardData = {
  id: 'p2',
  slug: 'smart-tv-lg-55-polegadas-oled-evo-c4-4k',
  title: 'Smart TV LG 55 Polegadas OLED evo C4 4K',
  price: 499900,
  freeShipping: true,
  thumbnail: null,
  outOfStock: true,
}

export function DesignSystemShowcase() {
  return (
    <Container as="main" className="flex animate-fade-in flex-col gap-12 py-8 md:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-foreground">Design System</h1>
        <p className="text-body text-muted-foreground">
          Tokens e componentes reutilizáveis do marketplace — referência visual (FASE 2).
        </p>
      </header>

      <Section title="Cores">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className={`h-10 w-10 shrink-0 rounded ${c.className} ${c.border ? 'border border-line' : ''}`} />
              <span className="text-caption text-muted-foreground">{c.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografia">
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
          <p className="text-display text-foreground">Display 40px</p>
          <p className="text-h1 text-foreground">Heading 1 32px</p>
          <p className="text-h2 text-foreground">Heading 2 24px</p>
          <p className="text-h3 text-foreground">Heading 3 20px</p>
          <p className="text-h4 text-foreground">Heading 4 18px</p>
          <p className="text-body text-foreground">Body 16px — texto corrido de leitura confortável.</p>
          <p className="text-body-small text-foreground">Body small 14px — descrições e conteúdos secundários.</p>
          <p className="text-caption text-muted-foreground">Caption 12px — legendas e metadados.</p>
          <p className="text-label text-foreground">Label 14px medium — rótulos de formulário.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">sm</Button>
          <Button size="md">md</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" aria-label="Buscar">
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
            </svg>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button variant="outline" loading>
            Outline loading
          </Button>
        </div>
      </Section>

      <Section title="Inputs, Select, Checkbox e Radio">
        <div className="grid max-w-xl gap-4">
          <Input label="E-mail" type="email" placeholder="seu@email.com" helperText="Usaremos só para atualizar seu pedido." />
          <Input label="CEP" defaultValue="990" error="CEP inválido. Verifique os 8 dígitos." />
          <Input label="Somente leitura" disabled defaultValue="Não editável" />
          <Select label="Ordenar por" defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            <option>Mais vendidos</option>
            <option>Menor preço</option>
            <option>Lançamentos</option>
          </Select>
          <div className="flex flex-col gap-2">
            <Checkbox label="Aceito os termos e condições" defaultChecked />
            <Checkbox label="Quero receber promoções" />
            <Checkbox label="Opção indisponível" disabled />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-foreground">Entrega</legend>
            <Radio name="ds-shipping" label="Normal — até 5 dias úteis" defaultChecked />
            <Radio name="ds-shipping" label="Expresso — até 1 dia útil" />
            <Radio name="ds-shipping" label="Retirar na loja" disabled />
          </fieldset>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Título do card</CardTitle>
            <CardDescription>Descrição curta de apoio para o conteúdo do card.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-body-small text-foreground">
              Conteúdo do card. A estrutura Header/Title/Description/Content/Footer é reutilizável em qualquer página.
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Ação</Button>
            <Button size="sm" variant="ghost">
              Cancelar
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Skeleton (loading)">
        <div className="flex flex-wrap items-start gap-6">
          <ProductCardSkeleton className="w-56" />
          <div className="w-64 rounded-lg border border-line bg-surface p-4">
            <SkeletonText lines={4} />
            <Skeleton className="mt-4 h-24 w-full" />
          </div>
        </div>
      </Section>

      <Section title="Alerts">
        <div className="grid max-w-2xl gap-3">
          <Alert variant="info" title="Informação">
            Uma mensagem informativa para o usuário.
          </Alert>
          <Alert variant="success" title="Sucesso">
            Operação concluída com êxito.
          </Alert>
          <Alert variant="warning" title="Atenção">
            Verifique os dados antes de continuar.
          </Alert>
          <Alert variant="error" title="Erro">
            Não foi possível concluir a operação. Tente novamente.
          </Alert>
        </div>
      </Section>

      <Section title="Separator e Breadcrumb">
        <div className="max-w-2xl rounded-lg border border-line bg-surface p-6">
          <Breadcrumb
            items={[
              { label: 'Início', href: '/' },
              { label: 'Eletrodomésticos', href: '/c/eletrodomesticos' },
              { label: 'Aspiradores' },
            ]}
          />
          <Separator className="my-4" />
          <p className="text-body-small text-muted-foreground">Separator horizontal acima e vertical abaixo.</p>
          <div className="mt-4 flex h-10 items-stretch gap-4">
            <span className="text-body-small">Esquerda</span>
            <Separator orientation="vertical" />
            <span className="text-body-small">Direita</span>
          </div>
        </div>
      </Section>

      <Section title="Estados — vazio e erro">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" strokeLinecap="round" />
              </svg>
            }
            title="Nenhum resultado"
            description="Não encontramos produtos para os filtros escolhidos."
            action={<Button variant="outline" size="sm">Limpar filtros</Button>}
          />
          <ErrorState
            description="Não foi possível carregar os dados agora."
            action={<Button size="sm">Tentar novamente</Button>}
          />
        </div>
      </Section>

      <Section title="E-commerce">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <ProductCard product={SAMPLE_PRODUCT} />
          <ProductCard product={OUT_OF_STOCK_PRODUCT} />
          <ProductCardSkeleton />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CategoryCard
            name="Smartphones"
            count={5}
            image="https://picsum.photos/seed/ds-smartphones/200/200"
            href="/c/smartphones"
          />
          <CategoryCard name="Notebooks" description="Para trabalho e estudos" />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
          <Price cents={25990} size="sm" />
          <Price cents={74900} originalCents={99900} size="md" />
          <Price cents={319900} originalCents={359900} size="lg" />
        </div>
      </Section>
    </Container>
  )
}
