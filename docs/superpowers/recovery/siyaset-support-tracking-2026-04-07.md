# Siyaset Support Tracking Report (Started 2026-04-07)

## Tracking rules
- Every update must include both DB verified count and latest benchmark support.
- Keep run metadata (command, mode, manual-only flag) in each benchmark row.
- No hard-negative changes while std(Siyaset F1) > 0.05.

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
| 6 | 2026-04-08 | Batch-6: 7 Siyaset records (963,1345,1327,1357,1749,1441,1366) + 1 Dunya (1738) verified + manuel_validasyonlar insert | 114 | *pending* | *pending* | *pending* | Siyaset-focused expansion (hazir/yayinda durum filtered) to breach support=22 plateau |
