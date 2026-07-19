/*
  Warnings:

  - Added the required column `updatedAt` to the `PurchaseInvoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vendorAddress" TEXT,
ADD COLUMN     "vendorGSTIN" TEXT,
ADD COLUMN     "vendorPhone" TEXT;
