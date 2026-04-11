# Siyaset Data Growth Checklist (2026-04-07)

## Scope (approved)
- Goal: stabilize Siyaset F1 variance by increasing manually verified Siyaset data before any hard-negative changes.
- Rule: only manually verified data is allowed.
- Rule: no auto-labeled additions.

## Fixed labeling-note format (mandatory)
- Format must be exact and pipe-delimited:
- `haber_id | baslik | neden_siyaset | etiketleyen | tarih`
- Free-text notes outside this structure are not allowed.

## Current baseline
- Verified Siyaset support (DB, kategori_id=4 and kategori_dogrulandi=true): 103
- Last-30d unlabeled pool (all categories): 409
- Last-30d unlabeled in current Siyaset bucket: 5

## Checklist
- [x] Baseline support snapshot recorded.
- [x] Candidate pool for `kategori_dogrulandi=false` in Siyaset extracted.
- [x] Last-30d unlabeled candidate pool extracted.
- [ ] Manually review Siyaset-bucket pending items (5 records currently).
- [ ] Manually triage last-30d unlabeled list for additional true-Siyaset records.
- [ ] After each manual validation batch, append structured note rows to labeling log.
- [ ] After each batch, update support tracking report.
- [ ] Stop when benchmark Siyaset support reaches >=25.
- [ ] Re-run 10x benchmark and decide next step by std threshold.

## Candidate queue (Siyaset bucket, pending verification)
- 1682 | İran'dan Trump'a yanıt: Bütün bölge ve Suudi Arabistan karanlığa gömülür
- 1656 | İşte doğum izni düzenlemesinin detayları
- 1642 | Milas Köylüleri Ankara'da: Acele Kamulaştırmaya Karşı Mücadele
- 1578 | Tutuklu Tanju Özcan'dan yeni mesaj: 'Yüzlerce kişi dinlediler, bir açık bulamadılar...'
- 1574 | Cumhurbaşkanlığı Kabinesi toplandı

## 10x benchmark gate (approved)
- If std(Siyaset F1) > 0.05: continue data/support work, do not move to hard negatives.
- If std(Siyaset F1) <= 0.05: continue with bigram-list driven improvements.
