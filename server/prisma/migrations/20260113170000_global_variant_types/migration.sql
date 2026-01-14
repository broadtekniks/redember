-- Make variant types optionally global (not tied to ProductGroup) and allow multi-value chips per type.

-- ProductVariantType: allow groupId null + add scope/isDefault + unique scope/name
ALTER TABLE "ProductVariantType" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'global';
ALTER TABLE "ProductVariantType" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "ProductVariantType" ALTER COLUMN "groupId" DROP NOT NULL;

UPDATE "ProductVariantType" SET "scope" = 'group' WHERE "groupId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariantType_scope_name_key"
  ON "ProductVariantType" ("scope", "name");

-- ProductVariantValue: allow multiple values per product/type
ALTER TABLE "ProductVariantValue" DROP CONSTRAINT IF EXISTS "ProductVariantValue_productId_variantTypeId_key";
ALTER TABLE "ProductVariantValue" ADD CONSTRAINT "ProductVariantValue_productId_variantTypeId_value_key"
  UNIQUE ("productId", "variantTypeId", "value");
