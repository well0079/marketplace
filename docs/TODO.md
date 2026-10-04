# TODO — Próximas fases

- [x] FASE 7 — Carrinho: endpoints + `/cart` real + integração PDP + badge no Header.
- [x] FASE 8 — Auth: register/login/logout/me com scrypt + cookie de sessão assinado;
      carrinho de visitante vinculado/mesclado no login; Header reflete sessão.
- [x] FASE 9 — Checkout: `/checkout` real (portão de login, endereços CRUD autenticado,
      frete por região com citação do carrinho, resumo com total; pagamento é Alert
      informativo até a FASE 10).
- [ ] FASE 10 — Pedidos: `/orders` (stub pronto); `Order`/`OrderItem`/`Payment` já no schema;
      converter carrinho em pedido (status do Cart: active → converted). O checkout já coleta
      endereço selecionado + opção de frete (standard/express) para virar o payload do pedido;
      regra "Normal grátis para carrinho 100% frete grátis" está em `shipping.service.ts` e
      deve ser reusada no cálculo de `shippingCost` do Order.
- [ ] Sessão: stateless — revogação server-side de tokens (ex.: tabela Session) se exigido;
      "Minha conta" não existe (nenhuma rota — não inventada na FASE 8).
- [ ] Estoque insuficiente via UI: QuantitySelector já limita ao estoque; o 409 do servidor só
      acontece em corrida (duas abas) — tratar com feedback inline na PDP quando ocorrer.
- [ ] Produção: cookies são same-origin (proxy Vite). Cross-origin exigirá
      `credentials: 'include'` no fetch e CORS com credentials; definir AUTH_SECRET forte.
- [ ] PDP (P2 pendente): vendedor (sem dados na API), perguntas e avaliações detalhadas
      (sem endpoints — `Question`/`Review` já modelados no Prisma para fases futuras),
      zoom na galeria.
- [ ] Catálogo: filtros por preço/faixa se a API vier a suportar; hoje apenas q/category/sort.
- [ ] Infra: `docker-compose.yml` está pronto mas a máquina de dev usa PostgreSQL embarcado
      (ver memória do projeto); `pnpm db:up` funciona apenas com Docker instalado.
