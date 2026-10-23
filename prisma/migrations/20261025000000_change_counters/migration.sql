-- A counter per store and topic that goes up on every change, so clients without a live stream can poll cheaply.
CREATE TABLE "Change" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "Change_tenantId_idx" ON "Change"("tenantId");
