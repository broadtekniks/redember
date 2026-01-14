/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `ProductImage` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `ProductVariantType` table. All the data in the column will be lost.
  - You are about to drop the `ProductCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariantType" DROP CONSTRAINT "ProductVariantType_categoryId_fkey";

-- DropIndex
DROP INDEX "ProductImage_categoryId_sortOrder_idx";

-- DropIndex
DROP INDEX "ProductVariantType_categoryId_displayOrder_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "categoryId",
ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "categoryId",
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "isMain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "ProductVariantType" DROP COLUMN "categoryId",
ADD COLUMN     "groupId" TEXT;

-- DropTable
DROP TABLE "ProductCategory";

-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_handle_key" ON "ProductGroup"("handle");

-- CreateIndex
CREATE INDEX "ProductImage_groupId_sortOrder_idx" ON "ProductImage"("groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductVariantType_groupId_displayOrder_idx" ON "ProductVariantType"("groupId", "displayOrder");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantType" ADD CONSTRAINT "ProductVariantType_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
