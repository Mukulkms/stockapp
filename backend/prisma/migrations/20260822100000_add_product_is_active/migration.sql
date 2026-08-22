-- Product ko "delete" karte waqt agar wo kisi purchase/sales invoice mein use ho
-- chuka hai to hard-delete fail ho jata tha (billing history corrupt na ho isliye).
-- Ab is column se product ko "archive" (isActive=false) kiya ja sakta hai — Inventory
-- list se hat jayega, lekin purane invoices/reports intact rahenge.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");
