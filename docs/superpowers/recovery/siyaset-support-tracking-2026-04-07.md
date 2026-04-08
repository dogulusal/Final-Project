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
