-- Optional pictures, stored as small data: URLs resized in the browser.
ALTER TABLE "User" ADD COLUMN "avatar" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "image" TEXT NOT NULL DEFAULT '';
