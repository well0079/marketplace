-- ETAPA 2+3 bloco 1: eventos, sessões, ofertas, reservas + pedido de ingresso
-- (Order.shippingAddress passa a aceitar nulo: pedidos de ingresso não têm endereço)

-- CreateTable Event
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable EventSession
CREATE TABLE "EventSession" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "city" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "venue" TEXT NOT NULL,

    CONSTRAINT "EventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable Offer
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "ticketType" TEXT NOT NULL,
    "ticketCategory" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sellerId" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable Reservation
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_featured_createdAt_idx" ON "Event"("featured", "createdAt");
CREATE INDEX "EventSession_eventId_startsAt_idx" ON "EventSession"("eventId", "startsAt");
CREATE INDEX "Offer_sessionId_status_priceCents_idx" ON "Offer"("sessionId", "status", "priceCents");
CREATE INDEX "Reservation_offerId_status_expiresAt_idx" ON "Reservation"("offerId", "status", "expiresAt");
CREATE INDEX "Reservation_userId_status_expiresAt_idx" ON "Reservation"("userId", "status", "expiresAt");

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pedido de ingresso: variantId do item é opcional; Order ganha snapshot + vínculo da reserva
ALTER TABLE "OrderItem" ALTER COLUMN "variantId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "ticketSnapshot" JSONB;
ALTER TABLE "Order" ADD COLUMN "reservationId" UUID;
CREATE INDEX "Order_reservationId_idx" ON "Order"("reservationId");
ALTER TABLE "Order" ALTER COLUMN "shippingAddress" DROP NOT NULL;
