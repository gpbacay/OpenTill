-- Which pages each cashier may open (JSON array of paths; NULL means all of them).
ALTER TABLE "User" ADD COLUMN "cashierPages" TEXT;

-- The cashier account that rang up a sale, so cashiers only see their own sales.
ALTER TABLE "Order" ADD COLUMN "cashierId" TEXT;
CREATE INDEX "Order_cashierId_idx" ON "Order"("cashierId");
