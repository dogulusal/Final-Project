WITH latest_per_news AS (
  SELECT DISTINCT ON (mv.haber_id)
    mv.haber_id,
    mv.yeni_kategori_id,
    mv.olusturulma_tarihi
  FROM manuel_validasyonlar mv
  ORDER BY mv.haber_id, mv.olusturulma_tarihi DESC
)
SELECT
  l.haber_id,
  k.ad AS manual_label,
  l.olusturulma_tarihi,
  LEFT(h.baslik, 70) AS baslik
FROM latest_per_news l
JOIN haberler h ON h.id = l.haber_id
JOIN kategoriler k ON k.id = l.yeni_kategori_id
ORDER BY l.olusturulma_tarihi DESC
LIMIT 30;
