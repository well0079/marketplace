 - Passo 2 "código enviado por SMS": PHONE_VERIFICATION_MODE = off | demo | sms (padrão off). off pula o passo; demo mostra banner "Modo demonstração" com o código na tela; sms só documentado (sem provedor). Nunca fingir envio. Registrar em docs/DECISIONS.md.
 - Passo 3 "Complete sua conta": nome completo, CPF (dígito verificador; guardar só mascarado + hash para unicidade, como no Pix), caixa lilás explicando o CPF, e-mail, senha com olho (8+, 1 número, 1 maiúscula, 1 especial, sem espaço nas pontas, validada no front E no back), "Criar conta", checkbox opcional de novidades.
 - Backend: celular, e-mail e CPF únicos; rate limit; mensagens de erro sem vazar se o dado já existe quando possível.
 - Login no mesmo estilo (sem print: simples e consistente), com redirect de volta (?redirect=).
2. Header logado: avatar com inicial + nome truncado em dropdown (Ingressos, Sair) + botão "Anunciar". Deslogado: "Entrar" (cinza) e "Anunciar".
3. /tickets (auth): título "Ingressos", abas segmentadas "Meus anúncios N", "Comprados", "Vendidos". "Comprados" = pedidos pagos (OrderCard com StatusPill) e detalhe do pedido; estado vazio com texto e botão primário "Anunciar ingresso".
4. Rodapé completo: bloco de garantia com 3 itens e nome próprio ("Compra Garantida", sem selos de terceiros), colunas "Precisa de ajuda?" e "Políticas", redes (X, Instagram, TikTok, links configuráveis), linhas legais pequenas (revenda de terceiros, preço definido pelos vendedores). Páginas /terms e /privacy simples.
 
BLOCO 4 — CHECKOUT COM RESERVA (/checkout?offer=ID)
1. Header próprio: botão outline "Voltar" à esquerda e marca centralizada; faixas de aviso legal e amarela acima.
2. Modal ao entrar (cria a Reserva de 10 min): ícone de cadeado em quadrado lilás, "Você tem 10 minutos para completar sua compra!", "O preço do ingresso estará reservado durante esse tempo.", caixa de aviso de plataforma de revenda, "Continuar" (pílula primária) e "Cancelar" (link).
3. "Sacola": faixa lilás "Seu lugar está reservado / Depois disso, volta pra venda" com contador mm:ss (baseado em expiresAt do servidor) e link "Cancelar reserva".
4. "Quem recebe o ingresso": botão tracejado "Adicionar e-mail de recebimento / Toque para informar quem recebe seu ingresso" que abre Modal/campo com validação. Sem provedor de e-mail: não afirmar que enviou; em /tickets o ingresso mostra "Aguardando transferência para x@…". Documentar.
5. "Como você vai pagar": cards radio. PIX (selo "Recomendado", "Aprovação automática · sem taxa") = fluxo FastSoft atual. Cartão de crédito ("Parcele em até 12x") visível porém DESABILITADO com selo "Em breve".
6. Aviso âmbar de revenda; botão "Pagar" (desabilitado até e-mail + pagamento escolhidos); texto legal com links.
7. Coluna direita (card): imagem pequena, título truncado, cidade/local, bloco de data (dia grande, dia da semana, mês em pílula escura); "Sobre este ingresso" (Categoria, Tipo, Organizador); "Resumo da compra": Ingresso, "Taxa de serviço (10%)" com ícone de info e tooltip, "Valor total" em verde; linha "Tem cupom? Adicionar cupom" (1 cupom de seed validado no servidor; prioridade baixa, pode ficar pendente).
8. "Pagar" = POST /orders (Idempotency-Key) + POST /payments e vai para /payments/:id reestilizada com tokens ticket.* (sem mudar QR/polling). /checkout/success reestilizado. Reserva vira "converted".
9. Reserva expirada: se o contador zerar, desabilitar o pagamento, mostrar aviso e botão "Voltar ao evento". Se já existe Pix gerado, não cancelar o pagamento por causa do contador.
 
BLOCO 5 — VENDER E ANUNCIAR (/sellers/verify, auth)
1. "Confirme sua identidade": "Por segurança: aqui ninguém é anônimo. Protegemos você e quem compra.", 2 checks ("Verificação só na sua primeira vez anunciando", "É rápido e fácil"), caixa cinza com cadeado "CPF: <MASCARADO> — Este é o CPF vinculado à sua conta e recebimento de PIX." (nunca mostrar CPF completo), checkbox "Li e concordo com a verificação de identidade (Política de dados LGPD)", botões fixos no rodapé "Confirmar identidade" e "Cancelar" (outline).
2. "Endereço de cobrança" (seta de voltar no título): "Entra na nota do seu repasse. Digite o CEP e a gente preenche o resto." CEP, UF (select) + Município, Bairro, Endereço + Nº, Complemento (opcional), "Continuar" fixo. Preencher por CEP só se já existir lookup no projeto; senão manual.
3. KYC/biometria de terceiro: NÃO implementar nem simular. Gravar vendedor com verificação "básica" e registrar em DECISIONS/TODO que KYC e repasse (saque) estão pendentes.
4. Formulário "Anunciar ingresso": evento → data → tipo → categoria → quantidade → preço (centavos). Cria Oferta do vendedor; "Meus anúncios" lista e permite cancelar; "Vendidos" lista ofertas vendidas. Sem repasse financeiro.
 
TESTES MÍNIMOS
Reserva concorrente (último ingresso), expiração, taxa 10% no servidor, preço da oferta vs. cliente (ignorar valor do cliente), idempotência do pedido, cadastro (senha, CPF, unicidade, modos de verificação), rotas protegidas, filtros de /events.
 
ENTREGA FINAL
Atualizar CHANGELOG, DECISIONS, TODO, API_REFERENCE. Relatório curto: o que foi feito por bloco, o que ficou pendente, hashes dos commits.
