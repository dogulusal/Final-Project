-- Check low-confidence Siyaset records overall
SELECT
  h.id,
  h.baslik,
  h.ml_confidence,
  h.augmented_at,
  h.kategori_dogrulandi
FROM haberler h
JOIN kategoriler k ON k.id = h.kategori_id
WHERE k.ad = 'Siyaset'
  AND h.ml_confidence < 0.5
  AND h.kategori_dogrulandi = true
ORDER BY h.ml_confidence ASC
LIMIT 20;
