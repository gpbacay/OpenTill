-- Brand is a built-in product field. Stores that added their own "Brand" column keep its values; the column goes.
ALTER TABLE "Product" ADD COLUMN "brand" TEXT NOT NULL DEFAULT '';
UPDATE "Product" SET "brand" = COALESCE((
  SELECT json_extract("Product"."custom", '$."' || c."id" || '"') FROM "CustomColumn" c
  WHERE c."tenantId" = "Product"."tenantId" AND c."tableName" = 'products' AND lower(trim(c."label")) = 'brand'
  LIMIT 1
), '');
DELETE FROM "CustomColumn" WHERE "tableName" = 'products' AND lower(trim("label")) = 'brand';
