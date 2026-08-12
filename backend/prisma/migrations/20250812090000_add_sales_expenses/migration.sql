-- SalesInvoice: naye fields (GST, address, image, discount, tax, subtotal, updatedAt)
ALTER TABLE "SalesInvoice"
  ADD COLUMN IF NOT EXISTS "customerGSTIN" TEXT,
  ADD COLUMN IF NOT EXISTS "customerAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- SalesInvoiceItem: costPrice snapshot (profit calculation ke liye)
ALTER TABLE "SalesInvoiceItem"
  ADD COLUMN IF NOT EXISTS "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Purane SalesInvoiceItem rows ke liye costPrice ko product ki current costPrice se backfill karo
-- (purane bills ke exact-at-the-time cost pata nahi, isliye best available estimate use kar rahe hain)
UPDATE "SalesInvoiceItem" si
SET "costPrice" = p."costPrice"
FROM "Product" p
WHERE si."productId" = p.id AND si."costPrice" = 0;

-- Expense table
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "amount" DOUBLE PRECISION NOT NULL,
  "groupId" TEXT,
  "note" TEXT,
  "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Expense_groupId_idx" ON "Expense"("groupId");
CREATE INDEX IF NOT EXISTS "Expense_expenseDate_idx" ON "Expense"("expenseDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Expense_groupId_fkey'
  ) THEN
    ALTER TABLE "Expense"
      ADD CONSTRAINT "Expense_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "BillingGroup"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
