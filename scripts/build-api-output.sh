#!/usr/bin/env bash
# Monta o Build Output API (.vercel/output) do backend para deploy na Vercel.
# Determinístico: bundle esbuild do adapter + client Prisma (com engine rhel) embutido.
# Uso: bash scripts/build-api-output.sh   (da raiz do repo)
# Depois: cd backend && vercel deploy --prebuilt --prod
set -euo pipefail
cd "$(dirname "$0")/../backend"

FUNC=".vercel/output/functions/api/v1.func"
rm -rf .vercel/output
mkdir -p "$FUNC/node_modules"

# 1) bundle do adapter (Express app): @prisma/client fica externo e vai embutido no passo 2
pnpm exec esbuild "api/[...path].ts" \
  --bundle --platform=node --format=cjs \
  --outfile="$FUNC/index.js" \
  --external:@prisma/client --external:.prisma

# 2) client Prisma gerado + engine rhel (runtime Vercel = Amazon Linux 2023)
# resolve o arquivo default.js e sobe dois níveis: .../node_modules/.pnpm/<hash>/node_modules
RESOLVED=$(node -e "console.log(require.resolve('@prisma/client/default.js'))")
CLIENT_SRC=$(dirname "$RESOLVED")
PRISMA_MODULES=$(dirname "$(dirname "$CLIENT_SRC")")
mkdir -p "$FUNC/node_modules/@prisma" "$FUNC/node_modules/.prisma"
cp -rL "$CLIENT_SRC/." "$FUNC/node_modules/@prisma/client/"
cp -rL "$PRISMA_MODULES/.prisma/client/." "$FUNC/node_modules/.prisma/client/"
# trim: mantém só os engines nativos declarados no generator (native + rhel)
find "$FUNC/node_modules/.prisma/client" -name "libquery_engine-*" ! -name "*rhel-openssl-3.0.x*" ! -name "*debian*" -delete 2>/dev/null || true
find "$FUNC/node_modules/.prisma/client" -name "libquery_engine-*" ! -name "*rhel-openssl-3.0.x*" ! -name "*linux-microsoft*" -delete 2>/dev/null || true

# 3) config da função + rotas (sub-paths de /api/v1 vão para a função)
printf '{"runtime":"nodejs22.x","handler":"index.js","maxDuration":60}' > "$FUNC/.vc-config.json"
printf '{"version":3,"routes":[{"src":"/api/v1(/.*)?","dest":"/api/v1"}]}' > .vercel/output/config.json

echo "Build Output pronto: $FUNC ($(du -sh "$FUNC" | cut -f1))"
