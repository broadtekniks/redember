-- Add heat profile copy metadata
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "heatProfileDescriptions" JSONB;
