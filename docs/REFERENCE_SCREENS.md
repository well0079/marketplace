# REFERENCE_SCREENS — buyticketbrasil.com (telas públicas auditadas)

Descrição estrutural de cada tela pública alcançável em 2026-10-05 (1366px e 390px).
**Nada do conteúdo do site foi copiado** — títulos/imagens/textos abaixo são apenas estrutura
e rótulos de interface; no projeto usamos placeholders nossos. Screenshots em `.reference/`
(ignorado pelo git): `home-1366.png`, `evento-1366.png`, `home-390.png`.

## Home (/, 1366px)
Ordem das seções:
1. **Faixa informativa** (texto legal, fonte pequena) — no projeto: faixa neutra com aviso institucional nosso
2. **Barra de avisos** amarela (caution) — no projeto: Alert de sistema
3. **Header roxo 78px**: logo (esquerda) · busca (pista 236px, centrada) · "Entrar" (ghost claro) · "Anunciar" (botão claro sólido)
4. **Hero com imagem** (colagem/foto à direita, título display 2 linhas + subtítulo, setas de carrossel circulares nas laterais)
5. **Atalhos "Eventos hoje / Refine sua busca"** — dois cartões compactos com ícone
6. **"Eventos em destaque"** — SectionHeader (ícone + título) + carrossel de cards com setas
7. Rodapé institucional (não auditado em detalhe — conteúdo próprio nosso)

## Home (/, 390px)
1. Faixa legal + barra de avisos amarela (2 linhas)
2. Header roxo 66px: logo quadrado + "Boa noite 👋 / Acesse sua conta" + botão "Anunciar" claro
3. **Busca largura total** (radius control, lupa)
4. **Categorias**: rail horizontal de tiles (5 visíveis: ícone circular soft + legenda; ~58×80)
5. **Carrossel hero** com setas e indicadores
6. **"Eventos em destaque"** + "Ver tudo →" + lista/carrossel de rows
7. **BottomNav fixo** 80px: Descobrir (ativo, roxo) · Pesquisar · Ingressos · Conversas · Entrar

## Página de evento (/event/:slug, 1366px)
1. Header global (igual à Home)
2. **Hero/capa** do evento (imagem grande full-width, ~529px, cantos retos na versão auditada) com IconButtons sobrepostos (favoritar/compartilhar)
3. **Título** (28px/700 Hanken) + linha de data com ícone (ex.: "1 datas")
4. **Lista de datas**: card por data com calendário (dia grande + mês) à esquerda, local (cidade + venue) ao centro, seta de ação à direita — carrossel horizontal
5. Seções seguintes (descrição/detalhes) abaixo da dobra
6. CTA de compra dentro do fluxo de seleção (**exige interação de compra — fora do escopo**)

## Busca / categoria
- A home usa **filtros rápidos** (chips: hoje/amanhã/localização) + busca por texto + tiles de
  categoria como entrada para listagens. A listagem resultante reutiliza EventCard/EventRow
  (mesmos padrões da Home). Nenhuma URL de categoria foi exposta como link público na Home
  auditada (os tiles são o caminho).

## Fluxo de compra / conta
**Pendente: aguardando prints do usuário** (exige login e checkout real):
- Seleção de ingressos (setores/lotes) · carrinho · pagamento · confirmação · "Meus pedidos" ·
  conta/perfil. NÃO inventamos essas telas.

## Padrões de interface observados (rótulos curtos)
- Botões: "Entrar", "Anunciar", "Ver tudo →", "Entendi"
- Campos: "Pesquisar eventos"
- Estados: badge "últimos ingressos" sobre o pôster; preços "a partir de R$ X"
- Linguagem: saudação por horário no header ("Boa noite 👋")
