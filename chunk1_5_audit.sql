-- Chunk 1.5: Low-confidence Siyaset records around Apr 4 backfill
-- Find Siyaset records added/modified around Apr 4 with low confidence or from augmented_at backfill
SELECT
  h.id,
  h.baslik,
  h.kategori_dogrulandi,
  h.yayinlanma_tarihi,
  h.augmented_at,
  h.ml_confidence,
  k.ad AS kategori,
  SUBSTRING(h.icerik, 1, 200) AS icerik_preview
FROM haberler h
JOIN kategoriler k ON k.id = h.kategori_id
WHERE k.ad = 'Siyaset'
  AND (
    (h.augmented_at IS NOT NULL AND h.augmented_at >= '2026-04-03' AND h.augmented_at < '2026-04-06')
    OR
    (h.yayinlanma_tarihi >= '2026-04-03' AND h.yayinlanma_tarihi < '2026-04-06')
  )
  AND h.kategori_dogrulandi = true
ORDER BY h.yayinlanma_tarihi DESC
LIMIT 40;
