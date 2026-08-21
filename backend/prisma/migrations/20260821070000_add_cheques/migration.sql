-- Cheque: har company/group ke liye diye gaye cheques ka record — cheque number,
-- bank, amount, date, aur status (pending/cleared/bounced) track karta hai.
CREATE TABLE IF NOT EXISTS "Cheque" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "chequeNumber" TEXT NOT NULL,
  "bankName" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "chequeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Cheque_groupId_idx" ON "Cheque"("groupId");
CREATE INDEX IF NOT EXISTS "Cheque_chequeDate_idx" ON "Cheque"("chequeDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Cheque_groupId_fkey'
  ) THEN
    ALTER TABLE "Cheque"
      ADD CONSTRAINT "Cheque_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "BillingGroup"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
