# TODO — Próximas fases

- [x] FASE 7 — Carrinho: endpoints + `/cart` real + integração PDP + badge no Header.
- [x] FASE 8 — Auth: register/login/logout/me com scrypt + cookie de sessão assinado;
      carrinho de visitante vinculado/mesclado no login; Header reflete sessão.
- [ ] FASE 9 — Checkout: `/checkout` (stub pronto; o botão "Finalizar compra" do carrinho já
      navega para ele); exige usuário autenticado (sessão pronta na FASE 8); endereços
      (`Address` no schema); Frete real (carrinho hoje mostra "frete calculado no checkout").
- [ ] FASE 10 — Pedidos: `/orders` (stub pronto); `Order`/`OrderItem`/`Payment` já no schema;
      converter carrinho em pedido (status do Cart: active → converted).
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
