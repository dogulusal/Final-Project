-- ADIM 1: Backup tablosu oluştur, verified Siyaset sayısını doğrula
CREATE TABLE IF NOT EXISTS rollback_siyaset_trim_20260404_step2 AS
SELECT * FROM haberler WHERE kategori_id=4 AND kategori_dogrulandi=true LIMIT 0;

SELECT COUNT(*) as "Adim_1_Backup_Bos_Kontrol" FROM rollback_siyaset_trim_20260404_step2;
SELECT COUNT(*) as "Adim_1_Toplam_Siyaset_Verified" FROM haberler WHERE kategori_id=4 AND kategori_dogrulandi=true;

-- ADIM 2: Guard 1 - augmented olanları kaldır (sentetik/backfill)
INSERT INTO rollback_siyaset_trim_20260404_step2
SELECT * FROM haberler 
WHERE kategori_id=4 AND kategori_dogrulandi=true AND augmented_at IS NOT NULL;

DELETE FROM haberler 
WHERE kategori_id=4 AND kategori_dogrulandi=true AND augmented_at IS NOT NULL;

SELECT COUNT(*) as "Adim_2_Removed_Augmented" FROM rollback_siyaset_trim_20260404_step2;
SELECT COUNT(*) as "Adim_2_Remaining_After_Guard1" FROM haberler WHERE kategori_id=4 AND kategori_dogrulandi=true;

-- ADIM 3: Guard 2 - Low confidence kaldır (organik ama ml_confidence<0.80)
-- Dynamic: remaining * 35% sil (65% tut = ~100 kayıt)
INSERT INTO rollback_siyaset_trim_20260404_step2
SELECT * FROM haberler h
WHERE h.kategori_id=4 AND h.kategori_dogrulandi=true AND h.ml_confidence < 0.80
ORDER BY h.ml_confidence ASC
LIMIT (
  SELECT (COUNT(*) * 0.35)::INT FROM haberler 
  WHERE kategori_id=4 AND kategori_dogrulandi=true
);

DELETE FROM haberler h
WHERE h.kategori_id=4 AND h.kategori_dogrulandi=true AND h.ml_confidence < 0.80
AND h.id IN (
  SELECT id FROM haberler h2
  WHERE h2.kategori_id=4 AND h2.kategori_dogrulandi=true AND h2.ml_confidence < 0.80
  ORDER BY h2.ml_confidence ASC
  LIMIT (
    SELECT (COUNT(*) * 0.35)::INT FROM haberler 
    WHERE kategori_id=4 AND kategori_dogrulandi=true
  )
);

SELECT COUNT(*) as "Adim_3_Total_Removed_Backup" FROM rollback_siyaset_trim_20260404_step2;
SELECT COUNT(*) as "Adim_3_Remaining_Final" FROM haberler WHERE kategori_id=4 AND kategori_dogrulandi=true;

-- ADIM 4: Doğrulama - tek segmen, yüksek güven koruması
SELECT 
  COUNT(*) as "Adim_4_Final_Siyaset_Count",
  COALESCE(MIN(ml_confidence), 0) as "Adim_4_Min_Confidence",
  ROUND(COALESCE(AVG(ml_confidence), 0)::numeric, 4) as "Adim_4_Avg_Confidence",
  SUM(CASE WHEN augmented_at IS NOT NULL THEN 1 ELSE 0 END) as "Adim_4_Remaining_Augmented_CHECK"
FROM haberler 
WHERE kategori_id=4 AND kategori_dogrulandi=true;

SELECT '--- ADIM 5: Rollback Command (if needed) ---' as "ADIM_5";
SELECT '-- INSERT INTO haberler SELECT * FROM rollback_siyaset_trim_20260404_step2;' as "RESTORE";
