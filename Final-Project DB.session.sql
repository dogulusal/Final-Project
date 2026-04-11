SELECT k.ad, COUNT(*) FROM haberler h 
JOIN kategoriler k ON h.kategori_id=k.id 
WHERE kategori_dogrulandi=true 
AND h.durum IN ('hazir','yayinda')
AND k.ad IN ('Sağlık','Siyaset','Ekonomi')
GROUP BY k.ad;