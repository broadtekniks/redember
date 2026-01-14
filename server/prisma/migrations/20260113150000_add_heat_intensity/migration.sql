-- This migration is intentionally written to be safe to apply on a DB that
-- already has the connect-pg-simple session table.
--
-- It also adds Product.heatIntensity without requiring a DB reset.

-- Baseline for connect-pg-simple table (prevents Prisma drift prompts)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Add heatIntensity to Product
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "heatIntensity" INTEGER NOT NULL DEFAULT 50;
