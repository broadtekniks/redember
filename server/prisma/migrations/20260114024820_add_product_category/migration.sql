/*
  Warnings:

  - You are about to drop the column `groupId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `ProductImage` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `ProductVariantType` table. All the data in the column will be lost.
  - The primary key for the `session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `ProductGroup` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `categoryId` to the `ProductImage` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_groupId_fkey";

-- DropForeignKey
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_groupId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariantType" DROP CONSTRAINT "ProductVariantType_groupId_fkey";

-- DropIndex
DROP INDEX "ProductImage_groupId_sortOrder_idx";

-- DropIndex
DROP INDEX "ProductVariantType_groupId_displayOrder_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "groupId",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "groupId",
ADD COLUMN     "categoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariantType" DROP COLUMN "groupId",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "session" DROP CONSTRAINT "session_pkey",
ALTER COLUMN "sid" SET DATA TYPE TEXT,
ALTER COLUMN "sess" SET DATA TYPE JSONB,
ALTER COLUMN "expire" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");

-- DropTable
DROP TABLE "ProductGroup";

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_handle_key" ON "ProductCategory"("handle");

-- CreateIndex
CREATE INDEX "ProductImage_categoryId_sortOrder_idx" ON "ProductImage"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductVariantType_categoryId_displayOrder_idx" ON "ProductVariantType"("categoryId", "displayOrder");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantType" ADD CONSTRAINT "ProductVariantType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
