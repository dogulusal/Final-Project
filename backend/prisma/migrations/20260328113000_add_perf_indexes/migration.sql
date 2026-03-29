-- Performance indexes for read-heavy filters and admin sentiment aggregations
CREATE INDEX IF NOT EXISTS "haberler_kategori_id_durum_yayinlanma_tarihi_idx"
ON "haberler" ("kategori_id", "durum", "yayinlanma_tarihi" DESC);

CREATE INDEX IF NOT EXISTS "haberler_durum_sentiment_yayinlanma_tarihi_idx"
ON "haberler" ("durum", "sentiment", "yayinlanma_tarihi" DESC);
