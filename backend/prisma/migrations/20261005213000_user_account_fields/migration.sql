-- ETAPA 2+3 bloco 3a: conta do tema ingressos
-- CPF completo NUNCA é guardado: apenas cpfMasked + cpfHash (sha256 + pepper).

-- CreateTable SignupChallenge
CREATE TABLE "SignupChallenge" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupChallenge_phone_idx" ON "SignupChallenge"("phone");

-- AlterTable User (usuários antigos continuam logando: tudo nullable)
-- "phone" já existe desde a fundação (FASE 1); aqui só ganha unique (E.164)
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "cpfMasked" TEXT;
ALTER TABLE "User" ADD COLUMN "cpfHash" TEXT;
ALTER TABLE "User" ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_cpfHash_key" ON "User"("cpfHash");
