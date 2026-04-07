# Benchmark 10x Tokenizer Summary (2026-04-07)

## Command
- docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend sh -c "cd /app; npx ts-node scripts/benchmark-10x-tokenizer.ts --runs=10 --mode=unigram-bigram --manual-only"

## Per-run metrics captured
- Each run prints: Accuracy, Macro-F1, Siyaset F1, Support, Train, Test, Duration

## Aggregated statistics
- Accuracy: 68.27 +- 2.67 (min 65.33, max 73.33)
- Macro-F1: 0.684 +- 0.026 (min 0.656, max 0.741)
- Siyaset F1: 0.456 +- 0.098 (min 0.333, max 0.692)
- Siyaset Support: 15.0 +- 0.0 (min 15, max 15)

## Rule-based decision
- std(Siyaset F1) = 0.098 > 0.05
- Decision: first solve support/data problem; do not move to hard-negative stage yet.

## Artifacts
- Raw output: backend/benchmark_10x_tokenizer_20260407.txt
- Script: backend/scripts/benchmark-10x-tokenizer.ts
