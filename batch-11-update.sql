BEGIN;

INSERT INTO manuel_validasyonlar (haber_id, eski_kategori_id, yeni_kategori_id, karar_turu, batch_id, olusturulma_tarihi)
VALUES
  (1737, 2, 4, 'verified', 'batch-11-20260408', NOW());

UPDATE haberler
SET kategori_id = 4, kategori_dogrulandi = true
WHERE id = 1737;

COMMIT;
