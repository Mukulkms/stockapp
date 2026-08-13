-- PurchaseInvoice: GST inclusive flag (true = item rate mein GST already included hai,
-- false = taxAmount alag se upar add ho raha hai)
ALTER TABLE "PurchaseInvoice"
  ADD COLUMN IF NOT EXISTS "gstInclusive" BOOLEAN NOT NULL DEFAULT false;

-- MonthlySales: har company/group ke liye month-wise manually entered sales total,
-- isi se month-wise profit (sales - purchase - expenses) calculate/save hota hai
CREATE TABLE IF NOT EXISTS "MonthlySales" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "salesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MonthlySales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlySales_groupId_year_month_key" ON "MonthlySales"("groupId", "year", "month");
CREATE INDEX IF NOT EXISTS "MonthlySales_groupId_idx" ON "MonthlySales"("groupId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'MonthlySales_groupId_fkey'
  ) THEN
    ALTER TABLE "MonthlySales"
      ADD CONSTRAINT "MonthlySales_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "BillingGroup"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
