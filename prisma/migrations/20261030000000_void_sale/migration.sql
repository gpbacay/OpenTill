-- A void stays on the sale: who voided it, when, and why. Stock goes back through a VOID movement.
ALTER TABLE "Order" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "voidedByName" TEXT;
