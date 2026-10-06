# TODO — Próximas fases

- [x] FASE 7 — Carrinho: endpoints + `/cart` real + integração PDP + badge no Header.
- [x] FASE 8 — Auth: register/login/logout/me com scrypt + cookie de sessão assinado;
      carrinho de visitante vinculado/mesclado no login; Header reflete sessão.
- [x] FASE 9 — Checkout: `/checkout` real (portão de login, endereços CRUD autenticado,
      frete por região com citação do carrinho, resumo com total).
- [x] FASE 10 — Pedidos: POST /orders idempotente (snapshot de itens/endereço/entrega,
      totais recalculados no servidor, carrinho converted na mesma transação), estoque
      apenas validado (422), listagem paginada, detalhe e cancelamento (só pending);
      /orders + /orders/:code + /checkout/pedido-recebido/:code no frontend; etapa de
      Revisão no checkout com Idempotency-Key por tentativa; "Meus pedidos" no Header.
- [x] FASE 11 — Pagamento Pix (FastSoft): POST /payments idempotente + webhook verificado por
      reconsulta, PAID com baixa de estoque (needsReview se faltar), tela do QR com polling e
      /checkout/success confirmada pela API. Detalhes e pendências em docs/FASTSOFT.md.
- [ ] FASE 12+ — Pós-pagamento: tratamento de REFUNDED/CHARGEDBACK no pedido (hoje só o Payment
      muda), tela de "pagamento em análise" dedicada, notificação de confirmação; cartão/boleto
      (FastSoft suporta — documentado em FASTSOFT.md como pendente).
- [x] Deploy de produção (Vercel + Neon) — runbook em docs/DEPLOY.md; URLs em DECISIONS.md.
- [ ] SMS real (provedor) + "Esqueci a senha" (hoje desabilitado) + KYC/repasse do vendedor
      (bloco 5 grava verificação "básica") — ver DECISIONS.md do bloco 3.
- [ ] Pós-competição: ROTAR a FASTSOFT_SECRET_KEY e a SENHA DO NEON (a connection string
      direta foi colada no chat durante o deploy) e rotacionar AUTH_SECRET de produção.
- [ ] Cobrança real de R$ 10 em produção (paga pelo dono) para validar o webhook de ponta a ponta;
      se o painel da FastSoft exigir, cadastrar a URL de postback (docs/DEPLOY.md).
- [ ] Sessão: stateless — revogação server-side de tokens (ex.: tabela Session) se exigido;
      "Minha conta" (dados pessoais/endereços) ainda não existe como página própria.
- [ ] Estoque insuficiente via UI: QuantitySelector já limita ao estoque; o 409 do servidor só
      acontece em corrida (duas abas) — o checkout já mostra STOCK_INSUFFICIENT com link para o
      carrinho, mas a PDP ainda não tem feedback inline para o 409 de adicionar ao carrinho.
- [ ] Produção: cookies são same-origin (proxy Vite). Cross-origin exigirá
      `credentials: 'include'` no fetch e CORS com credentials; definir AUTH_SECRET forte.
- [ ] PDP (P2 pendente): vendedor (sem dados na API), perguntas e avaliações detalhadas
      (sem endpoints — `Question`/`Review` já modelados no Prisma para fases futuras),
      zoom na galeria.
- [ ] Catálogo: filtros por preço/faixa se a API vier a suportar; hoje apenas q/category/sort.
- [ ] Infra: `docker-compose.yml` está pronto mas a máquina de dev usa PostgreSQL embarcado
      (ver memória do projeto); `pnpm db:up` funciona apenas com Docker instalado.
