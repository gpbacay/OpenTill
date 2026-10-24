-- When a cashier last had the app open, so their admin can see who is active.
ALTER TABLE "User" ADD COLUMN "lastSeenAt" DATETIME;
