-- Product mein "Landing price + GST" column — manually enter/save karne ke liye,
-- costPrice ("Landing price") field ke saath.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "landingPriceWithGst" DOUBLE PRECISION;
