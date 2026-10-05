/*
  Warnings:
  - Added unique constraint on nullable column "providerTransactionId" (Payment) — múltiplos NULLs são permitidos no Postgres.
  - Added unique constraint on nullable column "dedupeKey" (PaymentEvent) — idem.
*/
-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN "pixQrCode" TEXT,
  ADD COLUMN "pixExpiresAt" TIMESTAMP(3),
  ADD COLUMN "payerDocumentMasked" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

-- AlterTable PaymentEvent
ALTER TABLE "PaymentEvent" ADD COLUMN "providerTransactionId" TEXT,
  ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "PaymentEvent_dedupeKey_key" ON "PaymentEvent"("dedupeKey");

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
