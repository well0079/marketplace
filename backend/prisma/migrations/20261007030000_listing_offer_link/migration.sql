-- Vínculo Listing → Offer: o anúncio passa a criar uma oferta comprável.
-- offerId único e anulável (anúncios legados anteriores ao vínculo seguem
-- funcionando: cancelam sozinhos e não aparecem para compradores).
ALTER TABLE "Listing" ADD COLUMN "offerId" UUID;

CREATE UNIQUE INDEX "Listing_offerId_key" ON "Listing"("offerId");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- updatedAt marca a data da venda quando a oferta chega a 0 (status sold)
ALTER TABLE "Offer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
