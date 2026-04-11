# Tokenizer Unicode-Aware Checkpoint (2026-04-07)

## Branch and rollback tag
- Branch: feature/tokenizer-unicode-aware
- Recovery tag: recovery-pre-tokenizer-20260407_222628

## Recovery artifacts
- DB dump: backups/pre_tokenizer_unicode_20260407_222653.dump
- Model state snapshot: backups/model_state_pre_tokenizer_20260407_222659.csv
- Benchmark output (post-patch): backend/benchmark_tokenizer_unicode_after_20260407_utf8.txt
- Token coverage output (post-patch): backend/tokenizer_coverage_20260407_utf8.txt

## Code changes in this branch
- backend/src/modules/ml/ml.service.ts
  - preprocessText tokenizer switched from word-boundary w regex to Unicode-aware letter/number regex.
  - New logic:
    - normalized = text.toLowerCase().normalize('NFC').trim()
    - tokens = normalized.match(/[\p{L}\p{N}]+/gu) || []

- Added analysis script:
  - backend/scripts/analyze-siyaset-tokenizer-coverage.ts
  - Purpose: compare legacy vs unicode tokenizer signal hits and print top unigram/bigram coverage for Siyaset.

## A/B benchmark notes (non-persist runs)
- Pre-patch run observed:
  - Accuracy: 67.33
  - Macro-F1: 0.674
  - Siyaset F1: 0.364
  - Support: 15

- Post-patch runs observed (stochastic split):
  - Run A: Accuracy 67.33, Macro-F1 0.677, Siyaset F1 0.500, Support 15
  - Run B: Accuracy 66.67, Macro-F1 0.678, Siyaset F1 0.500, Support 15

## Coverage findings (Siyaset)
- Unicode tokenizer recovered key Turkish tokens that were lost by legacy tokenizer:
  - secim vs secim with diacritics: secim legacy 0, secim(diatrics) unicode 7
  - cumhurbaskani vs cumhurbaskani with diacritics: legacy 0, unicode 8
- Legacy tokenizer produced fragmented artifacts (single letters and broken pieces), reducing signal quality for Turkish words.

## Quick restore playbook
1. Code rollback
   - git checkout recovery-pre-tokenizer-20260407_222628

2. DB rollback (full)
   - docker compose exec -T postgres dropdb -U postgres news_db
   - docker compose exec -T postgres createdb -U postgres news_db
   - docker compose exec -T postgres pg_restore -U postgres -d news_db < backups/pre_tokenizer_unicode_20260407_222653.dump

3. Verify model state after restore
   - docker compose exec -T postgres psql -U postgres -d news_db -c "SELECT id, version, accuracy, sample_count, trained_at FROM model_state ORDER BY id;"

## Safety note
- Benchmark command path uses non-persist diagnostics workflow, but guard checks are still active; failed guard means no model save.
- Keep this branch isolated until tokenizer-only effect is accepted.
