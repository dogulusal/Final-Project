-- DropIndex
DROP INDEX "haberler_kategori_dogrulandi_idx";

-- CreateTable
CREATE TABLE "manuel_validasyonlar" (
    "id" SERIAL NOT NULL,
    "haber_id" INTEGER NOT NULL,
    "eski_kategori_id" INTEGER,
    "yeni_kategori_id" INTEGER NOT NULL,
    "dogrulayan_email" TEXT,
    "karar_turu" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "olusturulma_tarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notlar" TEXT,

    CONSTRAINT "manuel_validasyonlar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manuel_validasyonlar_batch_id_idx" ON "manuel_validasyonlar"("batch_id");

-- CreateIndex
CREATE INDEX "manuel_validasyonlar_olusturulma_tarihi_idx" ON "manuel_validasyonlar"("olusturulma_tarihi" DESC);

-- CreateIndex
CREATE INDEX "manuel_validasyonlar_haber_id_idx" ON "manuel_validasyonlar"("haber_id");

-- AddForeignKey
ALTER TABLE "manuel_validasyonlar" ADD CONSTRAINT "manuel_validasyonlar_haber_id_fkey" FOREIGN KEY ("haber_id") REFERENCES "haberler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuel_validasyonlar" ADD CONSTRAINT "manuel_validasyonlar_yeni_kategori_id_fkey" FOREIGN KEY ("yeni_kategori_id") REFERENCES "kategoriler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
