BEGIN;

INSERT INTO manuel_validasyonlar (haber_id, eski_kategori_id, yeni_kategori_id, karar_turu, batch_id, olusturulma_tarihi)
VALUES
  (1711, 4, 5, 'verified', 'batch-8-20260408', NOW()),
  (1686, 4, 5, 'verified', 'batch-8-20260408', NOW()),
  (450, 2, 4, 'verified', 'batch-8-20260408', NOW()),
  (642, 3, 4, 'verified', 'batch-8-20260408', NOW()),
  (692, 2, 4, 'verified', 'batch-8-20260408', NOW());

UPDATE haberler
SET kategori_id = 5, kategori_dogrulandi = true
WHERE id IN (1711, 1686);

UPDATE haberler
SET kategori_id = 4, kategori_dogrulandi = true
WHERE id IN (450, 642, 692);

COMMIT;
