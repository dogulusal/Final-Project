-- Task 2.4 Step 3: Add LR model data column for NB+LR ensemble persistence
ALTER TABLE "model_state" ADD COLUMN IF NOT EXISTS "lr_model_data" JSONB;
