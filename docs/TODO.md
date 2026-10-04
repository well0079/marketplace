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
- [ ] FASE 11+ — Pagamento: tela de pagamento do pedido pending (FastSoft é a última fase,
      server-side); decremento de estoque na confirmação; status paid/shipped/delivered.
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
