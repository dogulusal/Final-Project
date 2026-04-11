-- ADIM 1: Backup tablosu oluştur, Siyaset sayısını doğrula
CREATE TABLE IF NOT EXISTS rollback_siyaset_trim_20260404 AS
SELECT * FROM verified_news WHERE category='Siyaset' LIMIT 0;

SELECT COUNT(*) as backup_initial FROM rollback_siyaset_trim_20260404;
SELECT COUNT(*) as total_siyaset_before FROM verified_news WHERE category='Siyaset';

-- ADIM 2: Guard 1 - augmented olanları kaldır (Siyaset sentetik/backfill)
WITH augmented_records AS (
  SELECT id FROM verified_news 
  WHERE category='Siyaset' AND augmented_at IS NOT NULL
)
INSERT INTO rollback_siyaset_trim_20260404
SELECT * FROM verified_news 
WHERE category='Siyaset' AND augmented_at IS NOT NULL;

DELETE FROM verified_news 
WHERE category='Siyaset' AND augmented_at IS NOT NULL;

SELECT COUNT(*) as removed_augmented FROM rollback_siyaset_trim_20260404;
SELECT COUNT(*) as remaining_after_guard1 FROM verified_news WHERE category='Siyaset';

-- ADIM 3: Guard 2 - Low confidence düşük güven kaldır ( organik ama confidence<0.80)
-- Dinamik LIMIT: remaining_verified * 0.65 (65 oranında tut, 35 sil)
WITH remaining_count AS (
  SELECT COUNT(*) as cnt FROM verified_news WHERE category='Siyaset'
),
low_conf_records AS (
  SELECT id FROM verified_news 
  WHERE category='Siyaset' AND ml_confidence < 0.80
  ORDER BY ml_confidence ASC
  LIMIT (SELECT (cnt * 0.35)::INT FROM remaining_count)
)
INSERT INTO rollback_siyaset_trim_20260404
SELECT * FROM verified_news 
WHERE id IN (SELECT id FROM low_conf_records);

DELETE FROM verified_news 
WHERE category='Siyaset' AND ml_confidence < 0.80
AND id IN (
  SELECT id FROM verified_news v
  WHERE v.category='Siyaset' AND v.ml_confidence < 0.80
  ORDER BY v.ml_confidence ASC
  LIMIT (
    SELECT (COUNT(*) * 0.35)::INT FROM verified_news 
    WHERE category='Siyaset'
  )
);

SELECT COUNT(*) as total_removed_backup FROM rollback_siyaset_trim_20260404;
SELECT COUNT(*) as remaining_final FROM verified_news WHERE category='Siyaset';

-- ADIM 4: Doğrulama - organik, yüksek güven koruması 
SELECT 
  COUNT(*) as final_siyaset_count,
  MIN(ml_confidence) as min_confidence,
  AVG(ml_confidence) as avg_confidence,
  SUM(CASE WHEN augmented_at IS NOT NULL THEN 1 ELSE 0 END) as remaining_augmented_CHECK
FROM verified_news 
WHERE category='Siyaset';

-- ADIM 5: Rollback command (ihtiyaç olursa - restore tüm Siyaset)
-- RESTORE: INSERT INTO verified_news SELECT * FROM rollback_siyaset_trim_20260404; TRUNCATE TABLE rollback_siyaset_trim_20260404;
