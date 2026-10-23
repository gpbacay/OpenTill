-- Cashier accounts: a User with role CASHIER belongs to one store (deleted with it) and is created by an admin.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD COLUMN "createdById" TEXT;
CREATE INDEX "User_createdById_idx" ON "User"("createdById");
