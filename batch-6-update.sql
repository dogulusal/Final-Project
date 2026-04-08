BEGIN;

-- Batch-6 Siyaset (7 records)
INSERT INTO manuel_validasyonlar (haber_id, eski_kategori_id, yeni_kategori_id, karar_turu, batch_id, olusturulma_tarihi)
VALUES
  (963, 2, 4, 'verified', 'batch-6-20260408', NOW()),
  (1345, 7, 4, 'verified', 'batch-6-20260408', NOW()),
  (1327, 7, 4, 'verified', 'batch-6-20260408', NOW()),
  (1357, 7, 4, 'verified', 'batch-6-20260408', NOW()),
  (1749, 7, 4, 'verified', 'batch-6-20260408', NOW()),
  (1441, 7, 4, 'verified', 'batch-6-20260408', NOW()),
  (1366, 7, 4, 'verified', 'batch-6-20260408', NOW()),
  (1738, 7, 3, 'verified', 'batch-6-20260408', NOW());

-- Update haberler: Siyaset (kategori_id=4)
UPDATE haberler SET kategori_id=4, kategori_dogrulandi=true WHERE id IN (963, 1345, 1327, 1357, 1749, 1441, 1366);

-- Update haberler: Dunya (kategori_id=3)
UPDATE haberler SET kategori_id=3, kategori_dogrulandi=true WHERE id = 1738;

COMMIT;
