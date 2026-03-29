-- CreateTable
CREATE TABLE "model_state" (
    "id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "model_data" JSONB NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "trained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sample_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "model_state_pkey" PRIMARY KEY ("id")
);
