-- Cashier sign-in links: a hash of the link token, how many devices it may sign in, and the devices that already used it.
ALTER TABLE "User" ADD COLUMN "inviteHash" TEXT;
ALTER TABLE "User" ADD COLUMN "inviteMaxUses" INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX "User_inviteHash_key" ON "User"("inviteHash");

CREATE TABLE "InviteDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InviteDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InviteDevice_userId_deviceHash_key" ON "InviteDevice"("userId", "deviceHash");
