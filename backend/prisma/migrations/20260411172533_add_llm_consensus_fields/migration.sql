-- AlterTable: Add consensus pipeline fields to haberler
ALTER TABLE "haberler" ADD COLUMN "nb_kategori_id" INTEGER REFERENCES "kategoriler"("id");
ALTER TABLE "haberler" ADD COLUMN "llm_kategori_id" INTEGER REFERENCES "kategoriler"("id");
ALTER TABLE "haberler" ADD COLUMN "llm_retry_count" INTEGER NOT NULL DEFAULT 0;

-- Backfill: mevcut tüm kayıtları legacy olarak işaretle (durum değişmez)
UPDATE "haberler" SET "llm_provider" = 'none' WHERE "llm_provider" IS NULL OR "llm_provider" NOT IN ('pending','gemini','ollama','failed','dead');

-- Index: consensus worker batch query (partial indexes for performance)
CREATE INDEX "idx_haberler_llm_pending" ON "haberler"("llm_provider") WHERE "llm_provider" = 'pending';
CREATE INDEX "idx_haberler_llm_failed" ON "haberler"("llm_provider", "llm_retry_count") WHERE "llm_provider" = 'failed';
