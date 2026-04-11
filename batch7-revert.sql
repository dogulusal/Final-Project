BEGIN;

-- Batch-7 kayıtlarını manuel_validasyonlar'dan sil
DELETE FROM manuel_validasyonlar WHERE batch_id = 'batch-7-20260408';

-- kategori_dogrulandi back to false for those 10 records
UPDATE haberler SET kategori_dogrulandi=false WHERE id IN (770, 966, 671, 483, 395, 486, 682, 468, 233, 221);

-- Reclassified records back to their original categories
UPDATE haberler SET kategori_id=7 WHERE id IN (966, 682);  -- Back to Genel (7)
UPDATE haberler SET kategori_id=3 WHERE id = 486;  -- Back to Teknoloji (3)

COMMIT;
