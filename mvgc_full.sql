SELECT
  l.haber_id,
  k.ad AS manual_label,
  h.baslik,
  SUBSTRING(h.icerik, 1, 500) AS icerik_preview
FROM (
  SELECT DISTINCT ON (mv.haber_id)
    mv.haber_id,
    mv.yeni_kategori_id,
    mv.olusturulma_tarihi
  FROM manuel_validasyonlar mv
  ORDER BY mv.haber_id, mv.olusturulma_tarihi DESC
) l
JOIN haberler h ON h.id = l.haber_id
JOIN kategoriler k ON k.id = l.yeni_kategori_id
ORDER BY l.olusturulma_tarihi DESC
LIMIT 30;
