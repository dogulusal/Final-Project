-- CreateTable
CREATE TABLE "kullanicilar" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "sifre_hash" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tercih_kategorileri" TEXT[],
    "olusturulma_tarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kullanicilar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategoriler" (
    "id" SERIAL NOT NULL,
    "ad" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "renk_kodu" TEXT NOT NULL,
    "ikon" TEXT,

    CONSTRAINT "kategoriler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "haberler" (
    "id" SERIAL NOT NULL,
    "baslik" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "meta_aciklama" TEXT,
    "icerik" TEXT,
    "kategori_id" INTEGER NOT NULL,
    "kaynak_url" TEXT,
    "gorsel_url" TEXT,
    "sentiment" TEXT,
    "okuma_suresi_dakika" DOUBLE PRECISION,
    "yayinlanma_tarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goruntulenme_sayisi" INTEGER NOT NULL DEFAULT 0,
    "durum" TEXT NOT NULL DEFAULT 'ham',
    "ml_confidence" DOUBLE PRECISION,
    "llm_provider" TEXT,

    CONSTRAINT "haberler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerez_tercihleri" (
    "id" SERIAL NOT NULL,
    "kullanici_id" INTEGER NOT NULL,
    "analitik_izni" BOOLEAN NOT NULL DEFAULT false,
    "kisisellesirme_izni" BOOLEAN NOT NULL DEFAULT false,
    "guncelleme_tarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cerez_tercihleri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okuma_gecmisi" (
    "id" SERIAL NOT NULL,
    "kullanici_id" INTEGER NOT NULL,
    "haber_id" INTEGER NOT NULL,
    "okuma_tarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okuma_gecmisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dead_letter_queue" (
    "id" SERIAL NOT NULL,
    "workflow_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kullanicilar_email_key" ON "kullanicilar"("email");

-- CreateIndex
CREATE UNIQUE INDEX "kategoriler_ad_key" ON "kategoriler"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "kategoriler_slug_key" ON "kategoriler"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "haberler_slug_key" ON "haberler"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cerez_tercihleri_kullanici_id_key" ON "cerez_tercihleri"("kullanici_id");

-- AddForeignKey
ALTER TABLE "haberler" ADD CONSTRAINT "haberler_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "kategoriler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cerez_tercihleri" ADD CONSTRAINT "cerez_tercihleri_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "kullanicilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okuma_gecmisi" ADD CONSTRAINT "okuma_gecmisi_kullanici_id_fkey" FOREIGN KEY ("kullanici_id") REFERENCES "kullanicilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okuma_gecmisi" ADD CONSTRAINT "okuma_gecmisi_haber_id_fkey" FOREIGN KEY ("haber_id") REFERENCES "haberler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
