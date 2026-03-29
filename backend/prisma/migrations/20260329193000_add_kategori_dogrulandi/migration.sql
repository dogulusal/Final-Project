-- Add explicit category verification flag to break ML self-training feedback loop
ALTER TABLE "haberler"
ADD COLUMN IF NOT EXISTS "kategori_dogrulandi" BOOLEAN NOT NULL DEFAULT false;

-- Useful for future verified-sample queries used by ML training
CREATE INDEX IF NOT EXISTS "haberler_kategori_dogrulandi_idx"
ON "haberler"("kategori_dogrulandi");
