# Siyaset Support Tracking Report (Started 2026-04-07)

## Tracking rules
- Every update must include both DB verified count and latest benchmark support.
- Keep run metadata (command, mode, manual-only flag) in each benchmark row.
- No hard-negative changes while std(Siyaset F1) > 0.05.

## Hard-negative preflight snapshot (2026-04-08)
- Git commit hash: a950dff
- Baseline reference (Batch-9): Accuracy 71.75 +- 2.62, Macro-F1 0.727, Siyaset F1 0.693 +- 0.057, Support 24

## Snapshot 0 (initial)
- Date: 2026-04-07
- DB verified Siyaset count: 103
- Last 10x benchmark summary:
  - Accuracy: 68.27 +- 2.67 (65.33..73.33)
  - Macro-F1: 0.684 +- 0.026 (0.656..0.741)
  - Siyaset F1: 0.456 +- 0.098 (0.333..0.692)
  - Benchmark Siyaset support: 15.0 +- 0.0 (15..15)
- Decision: std=0.098 > 0.05 -> support expansion first.

## Update table
| update_no | date | action | db_verified_siyaset | benchmark_support | siyaset_f1_mean | siyaset_f1_std | decision |
|---|---|---|---:|---:|---:|---:|---|
| 0 | 2026-04-07 | Baseline created | 103 | 15 | 0.456 | 0.098 | Support-first |
| 1 | 2026-04-07 | Batch-1: 8 records verified (1574,1578,1656,1642,1678,1541,1516,1562); 1682 corrected to Dunya | 109 | - | - | - | Continue support growth, re-run 10x when benchmark support >= 25 |
| 2 | 2026-04-07 | Batch-2: 4 records verified (1565,1581,1669,1688); TotalDB=113; 10x benchmark post-batch-2 | 113 | 15 | 0.426 | 0.034 | ✅ STD GATE PASSED! std=0.034<0.05 achieved. Bigram coverage analysis next. |
| 3 | 2026-04-08 | Batch-3: 403 verified as Siyaset; 404 verified as Ekonomi (non-Siyaset) | 119 | - | - | - | Data growth continues; next step run 10x benchmark and check support drift |
| 4 | 2026-04-08 | Batch-4: Backfill 31 safe records to manuel_validasyonlar; reclassify 10 excluded records (3→Dunya, 2→Genel, 3→Teknoloji, 1→Ekonomi, 1→Spor) | 150 | 22 | 0.679 | 0.067 | Support jump 15→22! F1 improved 0.426→0.679. std=0.067>0.05 gate still pending. Continue data growth. |
| 5 | 2026-04-08 | Batch-5: 10 records validated (Siyaset: 1724,1720,1692; Genel:1530; Spor:1747,1746; Teknoloji:1708,1706; Dunya:1729; Ekonomi:1740) + manuel_validasyonlar insert | 107 | 22 | 0.674 | 0.056 | Accuracy up to 70.70 but support stayed 22. std improved 0.067->0.056; continue balanced data growth. |
| 6 | 2026-04-08 | Batch-6: 7 Siyaset records (963,1345,1327,1357,1749,1441,1366) + 1 Dunya (1738) verified + manuel_validasyonlar insert | 114 | 23 | 0.674 | 0.043 | 🎯 Support plateau BROKEN: 22→23! STD gate PASSED: std=0.043<0.05. Peak acc=73.58%, avg=69.25%. CURRENT STATE - Siyaset-only strategy confirmed. Next: Batch-8 (3-5 more Siyaset records). |
| 7 | 2026-04-08 | Batch-8: Boundary review applied. 1711,1686 moved from Siyaset→Dunya; 450,642,692 reclassified to Siyaset (internal policy/government decision focus) | 117 | 24 | 0.706 | 0.046 | Support increased 23→24, Siyaset F1 improved to 0.706. Accuracy improved vs Batch-6 mean (69.25→70.69) but still below 72% target. |
| 8 | 2026-04-08 | Batch-9: only 2 records applied (420,477) Ekonomi→Siyaset as requested; no other additions | 119 | 24 | 0.693 | 0.057 | Accuracy reached 71.75 (+1.06 vs Batch-8) and Macro-F1 0.727, but support stayed 24 due split math and std rose above gate (0.057). |
| 9 | 2026-04-08 | Batch-11: only 1737 applied (Ekonomi→Siyaset), no other additions | 120 | 24 | 0.692 | 0.042 | Std gate recovered (<0.05) but support stayed 24 and accuracy mean 70.25 (<71 target for this test, <72 checklist target). |
| 10 | 2026-04-08 | Batch-12: Spor->Siyaset hard-negative denemesi (target=3) yapildi; 10x benchmarkta accuracy regresyonu nedeniyle rollback uygulandi | 120 | 24 | 0.678 | 0.039 | ❌ Gate fail: accuracy 68.56, Batch-11'e gore -1.69pp. Rollback ile pre-hardneg durumuna donuldu. |
| 11 | 2026-04-09 | Batch-13: genelSignals data-driven expansion smoke/mini test denendi; 10x benchmarkta regresyon goruldu ve rollback uygulandi | 120 | 24 | 0.674 | 0.037 | ❌ Gate fail: accuracy 68.75, Batch-11'e gore -1.50pp. 1-run ve 3-run umut verse de 10x'te kalici iyilesme dogrulanamadi. |
| 12 | 2026-04-09 | Batch-14: siyasetSignals keskinlestirme (jenerik->phrase) smoke testte denendi; gate gecemedi ve rollback uygulandi | 120 | 24 | 0.655 | 0.000 | ❌ Smoke gate fail: accuracy 68.75 (<70). Yan etki: hard-negative enjeksiyon 32->14 ve Genel->Siyaset pool etkisi sifirlandi. |
| 13 | 2026-04-09 | Batch-15: Türkçe-char phrase signals + threshold>=1 + injection 14->8; tüm kapılar geçildi, commit d08d0b7 | 120 | 24 | 0.687 | 0.045 | ✅ ALL GATES PASS: accuracy 71.31 (+1.06pp vs B11), std 0.045 (<0.05), 10/10 run success. |

## Hard-negative configuration (post Batch-12 rollback)
- Active pairs:
  - Genel->Siyaset: 14
  - Siyaset->Genel: 10
  - Siyaset->Teknoloji: 8
  - Siyaset->Dunya: 0
  - Siyaset->Ekonomi: 0
  - Spor->Siyaset: 0 (Batch-12 attempt rolled back)
- Total injected per run: 32
- Batch-12 attempt notes:
  - Pre-check: spor_with_pol_signal=3 -> conservative target=3 applied.
  - mac false-positive check in Spor sample: no Apple-context collision observed.
  - 10x benchmark result: Accuracy 68.56 +- 2.93, Siyaset F1 0.678 +- 0.039, Support 24.
  - Rollback reason: accuracy regression exceeded gate (more than -1pp vs Batch-11 mean 70.25).
- Batch-13 attempt notes:
  - Added candidate genelSignals for smoke test: adli kontrol, adliyeye sevk, cumhuriyet bassavciligi, toki kura, isci alimi, dogum izni.
  - Smoke (1-run) and mini (3-run) produced mixed but occasionally positive snapshots.
  - 10x benchmark result: Accuracy 68.75 +- 1.59, Macro-F1 0.694, Siyaset F1 0.674 +- 0.037, Support 24.
  - Rollback reason: mean accuracy regression exceeded gate (more than -1pp vs Batch-11 mean 70.25).
- Batch-14 attempt notes:
  - Toxic triggers in Genel confusion pool ranked: oy (37), bakan (26), yasa (21), tutuk (14), belediye (10), mahkeme (10).
  - Refined list replaced generic singles with phrase signals (belediye baskani, parti baskani, meclis toplantisi, kabine toplantisi, kanun teklifi, yerel/genel/erken secim).
  - Smoke (1-run) result: Accuracy 68.75, Macro-F1 0.697, Siyaset F1 0.655.
  - Critical side effect: hard-negative injected total dropped 32->14 (Genel->Siyaset=0, Siyaset->Genel=8, Siyaset->Teknoloji=6).
  - Rollback reason: smoke gate not met and injection coverage collapsed.
