# DEPLOY — Vercel + Neon (produção)

Arquitetura: **Opção A — dois projetos Vercel** (ver DECISIONS.md).
- **marketplace-api** → https://marketplace-api-alpha.vercel.app (Root Directory `backend/`, função serverless via Build Output API montado por `scripts/build-api-output.sh`)
- **marketplace-web** → https://marketplace-web-khaki.vercel.app (Root Directory `frontend/`, Vite; rewrite `/api/*` → API fixada em `frontend/vercel.json`)

## Divisão de papéis

### Manual (dono do projeto)
1. **Neon**: criar projeto; copiar as DUAS connection strings (pooled = host com `-pooler`; direct = sem pooler).
2. **Vercel → marketplace-api → Settings → Environment Variables (Production)**:
   - `DATABASE_URL` = pooled + `?sslmode=require&pgbouncer=true&connection_limit=1`
   - `DIRECT_DATABASE_URL` = direta (usada só em migrate/seed)
   - `FASTSOFT_SECRET_KEY` = a chave `sk_...` da FastSoft (nunca em commit/log)
   - ⚠️ O painel mostra `[SENSITIVE]` para valores já salvos — NÃO recopie da tela; cole do Neon/FastSoft.
3. **Painel FastSoft**: se exigir URL de postback cadastrada, usar
   `https://marketplace-api-alpha.vercel.app/api/v1/webhooks/fastsoft` (só HTTPS público).
4. **GitHub**: criar `VERCEL_TOKEN` (https://vercel.com/account/settings/tokens) e cadastrar em
   Secrets do repo para o workflow `deploy-api` redeployar no push para `main`.

### Automático (CLI / GitHub Actions)
- Deploy API: `bash scripts/build-api-output.sh && cd backend && vercel deploy --prebuilt --prod`
  (o `--prebuilt` é determinístico; o painel NÃO consegue redeployar um deployment prebuilt —
  use a CLI). O workflow `.github/workflows/deploy-api.yml` repete isso a cada push em `main`
  (requer o secret `VERCEL_TOKEN`).
- Deploy Web: `cd frontend && vercel --prod`.
- `vercel link` já feito nos dois (`backend/.vercel/`, `frontend/.vercel/` — fora do git).

## Migrations e seed em produção

NUNCA rodar contra a pooled (DDL via pgbouncer falha). Fluxo com a **direct**:

```bash
cd backend
vercel env pull .env.deploy --environment=production --yes   # arquivo gitignored; NUNCA imprimir
set -a; source .env.deploy; set +a
DATABASE_URL="$DIRECT_DATABASE_URL" pnpm exec prisma migrate deploy
DATABASE_URL="$DIRECT_DATABASE_URL" pnpm exec prisma db seed   # DESTRUTIVO: rodou UMA VEZ (05/10/2026)
rm .env.deploy
```

⚠️ **Seed já rodou exatamente uma vez em produção (05/10/2026)** — refazer apaga usuários,
pedidos e pagamentos reais. Não rodar de novo sem decissão explícita.

## Logs / diagnóstico

- Runtime: `cd backend && vercel logs <deployment-url>` (ou Dashboard → Deployments → Runtime Logs)
- **Se o pagamento Pix de R$ 10 não confirmar**: primeiro lugar = Runtime Logs da API
  (`[fastsoft]`/`[pagamento]`/`[webhook]`), depois `GET /payments/:id` (polling força consulta ao
  provedor), depois verificar se o postback está cadastrado no painel FastSoft.
- A confirmação em dev funciona por polling; o webhook exige o postback (PUBLIC_API_URL já
  configurada = URL da API).

## Redeploy (checklist rápido)

1. `git pull` (main)
2. `pnpm test && pnpm build`
3. API: `bash scripts/build-api-output.sh && cd backend && vercel deploy --prebuilt --prod --yes`
4. Web: `cd frontend && vercel --prod --yes`
