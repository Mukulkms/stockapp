-- ProfitCalculation: har company/group ke liye ek period (from-month se to-month tak)
-- ka saved profit calculation — total sale, total cheque amount, us waqt ka bacha
-- hua stock value, aur unn sabse nikla hua net profit. Har period ek alag saved
-- record hai taaki purana calculation history mein rahe.
CREATE TABLE IF NOT EXISTS "ProfitCalculation" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "periodType" TEXT NOT NULL DEFAULT 'monthly',
  "fromMonth" TEXT NOT NULL,
  "toMonth" TEXT NOT NULL,
  "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCheques" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stockValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProfitCalculation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfitCalculation_groupId_fromMonth_toMonth_key" ON "ProfitCalculation"("groupId", "fromMonth", "toMonth");
CREATE INDEX IF NOT EXISTS "ProfitCalculation_groupId_idx" ON "ProfitCalculation"("groupId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ProfitCalculation_groupId_fkey'
  ) THEN
    ALTER TABLE "ProfitCalculation"
      ADD CONSTRAINT "ProfitCalculation_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "BillingGroup"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
