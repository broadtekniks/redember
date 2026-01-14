-- Add variant attributes system
-- This allows products to have configurable variant types (Size, Color, etc.)

-- ProductVariantType: Defines the type of variant (e.g., "Size", "Color", "Material")
CREATE TABLE "ProductVariantType" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariantType_pkey" PRIMARY KEY ("id")
);

-- ProductVariantValue: Stores the actual values for each variant (e.g., "Small", "Red", "Cotton")
CREATE TABLE "ProductVariantValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantTypeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantValue_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ProductVariantType_groupId_displayOrder_idx" ON "ProductVariantType"("groupId", "displayOrder");
CREATE INDEX "ProductVariantValue_productId_idx" ON "ProductVariantValue"("productId");
CREATE INDEX "ProductVariantValue_variantTypeId_idx" ON "ProductVariantValue"("variantTypeId");
CREATE UNIQUE INDEX "ProductVariantValue_productId_variantTypeId_key" ON "ProductVariantValue"("productId", "variantTypeId");

-- Foreign keys
ALTER TABLE "ProductVariantType" ADD CONSTRAINT "ProductVariantType_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantValue" ADD CONSTRAINT "ProductVariantValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantValue" ADD CONSTRAINT "ProductVariantValue_variantTypeId_fkey" FOREIGN KEY ("variantTypeId") REFERENCES "ProductVariantType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
