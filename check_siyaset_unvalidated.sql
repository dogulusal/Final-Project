SELECT h.id, h.baslik, h.ml_confidence 
FROM haberler h 
JOIN kategoriler k ON k.id=h.kategori_id 
LEFT JOIN (SELECT DISTINCT haber_id FROM manuel_validasyonlar) mv ON mv.haber_id=h.id 
WHERE k.ad='Siyaset' AND h.kategori_dogrulandi=true AND mv.haber_id IS NULL 
ORDER BY h.yayinlanma_tarihi DESC LIMIT 20;
