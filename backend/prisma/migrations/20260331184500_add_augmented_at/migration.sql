-- Add augmented timestamp for LLM-enriched/re-labeled items to support leakage-safe temporal split
ALTER TABLE "haberler"
ADD COLUMN IF NOT EXISTS "augmented_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "haberler_augmented_at_idx"
ON "haberler"("augmented_at");
