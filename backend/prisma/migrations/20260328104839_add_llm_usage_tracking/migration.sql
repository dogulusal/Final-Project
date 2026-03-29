-- CreateTable
CREATE TABLE "llm_kullanm" (
    "id" SERIAL NOT NULL,
    "saglayici" TEXT NOT NULL,
    "giris_token_sayisi" INTEGER NOT NULL,
    "cikis_token_sayisi" INTEGER NOT NULL,
    "tahmini_maliyet" DOUBLE PRECISION,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durum" TEXT NOT NULL DEFAULT 'basarili',
    "hata_mesaji" TEXT,

    CONSTRAINT "llm_kullanm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_kullanm_saglayici_idx" ON "llm_kullanm"("saglayici");

-- CreateIndex
CREATE INDEX "llm_kullanm_tarih_idx" ON "llm_kullanm"("tarih" DESC);

-- CreateIndex
CREATE INDEX "llm_kullanm_saglayici_tarih_idx" ON "llm_kullanm"("saglayici", "tarih" DESC);

-- CreateIndex
CREATE INDEX "haberler_durum_idx" ON "haberler"("durum");

-- CreateIndex
CREATE INDEX "haberler_yayinlanma_tarihi_idx" ON "haberler"("yayinlanma_tarihi" DESC);

-- CreateIndex
CREATE INDEX "haberler_kategori_id_idx" ON "haberler"("kategori_id");

-- CreateIndex
CREATE INDEX "haberler_durum_yayinlanma_tarihi_idx" ON "haberler"("durum", "yayinlanma_tarihi" DESC);
