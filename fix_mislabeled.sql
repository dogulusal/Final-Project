-- Fix obvious mislabeled records identified in Chunk 2/1.5 audit
-- 1271: Wi-Fi teknolojisi -> Teknoloji (id=3)
-- 1568: MSB engelli kamu alımı -> Genel (id=7) 
-- 1647: Roketsan TSK füze -> Dünya/Savunma -> keep Siyaset (defense procurement is state policy)

UPDATE haberler SET kategori_id=3, kategori_dogrulandi=false WHERE id=1271;
UPDATE haberler SET kategori_id=7, kategori_dogrulandi=false WHERE id=1568;
SELECT id, baslik, kategori_id FROM haberler WHERE id IN (1271, 1568);
