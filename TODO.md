# TODO — Deferred Technical Debt

Items identified during pre-push review (2026-05-01).

## 🔴 High Priority

### 1. `ml.service.ts` — God Method `loadAndTrainFromDB()`
- Cyclomatic complexity > 40, ~300 lines
- Mix of data fetching, validation, training, guard layers, and caching
- **Action:** Extract into smaller methods: `fetchTrainingData()`, `applyGuardLayers()`, `trainClassifiers()`, `persistModel()`

### 2. `ml.controller.ts` — Hardcoded Mock Endpoints
- `/evaluate` and `/roc-auc` return static placeholder data
- **Action:** Wire these to real evaluation logic or clearly mark as dev-only with feature flag

### 3. `llm-consensus-worker.ts` — No Timeout + Sequential Processing
- Gemini API calls lack timeout/abort controller
- Batch items processed sequentially (no concurrency limit)
- **Action:** Add AbortController with 30s timeout; use `p-limit` for bounded parallelism

### 4. `rss-scheduler.ts` — God Method `runCycle()`
- ~140 lines, mixes feed parsing, deduplication, categorization, and persistence
- **Action:** Extract `parseFeed()`, `deduplicateItems()`, `categorizeAndPersist()`

## 🟡 Medium Priority

### 5. Magic Numbers in ML Service
- Confidence thresholds (0.35, 0.55, 0.70) scattered as literals
- **Action:** Extract to named constants or config

### 6. DRY Violations in Keyword Lists
- `spikeKeywords`, `boundaryGuardKeywords` duplicated across methods
- **Action:** Consolidate into single keyword registry module
