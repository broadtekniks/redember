-- Drop the legacy unique constraint/index on (productId, variantTypeId)
-- so a product can store multiple values per option type.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductVariantValue_productId_variantTypeId_key'
  ) THEN
    EXECUTE 'ALTER TABLE "ProductVariantValue" DROP CONSTRAINT "ProductVariantValue_productId_variantTypeId_key"';
  END IF;
END $$;

DROP INDEX IF EXISTS "ProductVariantValue_productId_variantTypeId_key";

-- Ensure the new unique index exists (matches current Prisma schema)
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariantValue_productId_variantTypeId_value_key"
  ON "ProductVariantValue"("productId", "variantTypeId", "value");
