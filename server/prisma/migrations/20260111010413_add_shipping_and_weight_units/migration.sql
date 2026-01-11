-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "volumeMl" DOUBLE PRECISION,
ADD COLUMN     "weightG" DOUBLE PRECISION,
ADD COLUMN     "weightOz" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "freeShippingMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightTier" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "minWeightG" INTEGER NOT NULL,
    "maxWeightG" INTEGER NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingZone_enabled_idx" ON "ShippingZone"("enabled");

-- CreateIndex
CREATE INDEX "WeightTier_zoneId_minWeightG_idx" ON "WeightTier"("zoneId", "minWeightG");

-- AddForeignKey
ALTER TABLE "WeightTier" ADD CONSTRAINT "WeightTier_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
