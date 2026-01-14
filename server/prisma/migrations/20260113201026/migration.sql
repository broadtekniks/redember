-- Add heatProfile column (guarded by IF NOT EXISTS)
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "heatProfile" TEXT NOT NULL DEFAULT 'standard';

-- Create index that supports queries over scopes and ordering
CREATE INDEX "ProductVariantType_scope_displayOrder_idx" ON "ProductVariantType"("scope", "displayOrder");
