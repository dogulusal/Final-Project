# TF-IDF + Logistic Regression A/B Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe A/B path for `logistic-regression` in ML service, benchmark against Batch-16 Naive Bayes baseline, and make a data-driven go/no-go decision.

**Architecture:** Keep current NB path unchanged and introduce LR path under `ML_MODEL_TYPE` routing. Reuse existing preprocessing + training data pipeline (including hard-negative injection), and add explicit latency measurement harness because current benchmark does not compute inference p95.

**Phase-1 scope note:** Despite the plan title, phase-1 does not implement an explicit TF-IDF adapter layer. Phase-1 validates LR boundary behavior using existing tokenizer + n-gram features. TF-IDF adapter remains a follow-up path only if phase-1 evidence requires it.

**Tech Stack:** TypeScript, NestJS backend, natural (`BayesClassifier`, `LogisticRegressionClassifier`), Prisma, existing benchmark scripts.

---

## Scope and Constraints

- Keep NB Batch-16 behavior intact.
- LR mode: no keyword bonus and no asayis shield in phase-1.
- No schema changes.
- Follow `.agent/agency-meta-rules.md` ML constraints and `comprehensive-review` expectations.
- Verification-before-completion is mandatory before any completion claim.

## Files

### Modify
- `backend/src/modules/ml/ml.service.ts`
- `backend/scripts/benchmark-10x-tokenizer.ts`

### Create
- `backend/scripts/benchmark-inference-latency.ts`
- `backend/scripts/validate-lr-api-compat.ts`
- `backend/scripts/compare-benchmark-stats.ts`

### Test/Validation Artifacts
- `batchXX_nb_10x_*.txt`
- `batchXX_lr_10x_*.txt`
- `batchXX_nb_latency_*.txt`
- `batchXX_lr_latency_*.txt`

---

### Task 1: Assumption Gate (API + persistence compatibility)

**Files:**
- Create: `backend/scripts/validate-lr-api-compat.ts`
- Modify: `backend/src/modules/ml/ml.service.ts` (only if compatibility shims needed)

- [ ] **Step 1: Write failing checks in script for LR API surface**
- [ ] **Step 2: Validate `addDocument/train/classify/getClassifications` availability**
- [ ] **Step 3: Validate LR save/restore path used by current model persistence**
- [ ] **Step 4: Run script and capture pass/fail output**
- [ ] **Step 5: If fail, stop and return to spec redesign decision**

**Governance (Task 1 gate):**
- Decision owner: ML maintainer prepares report, project owner gives final go/no-go.
- Gate verdict SLA: same day as validation output.
- If FAIL: stop LR implementation tasks (Task 2+ for LR path), continue only NB-safe diagnostics/hardening tasks.

**Notes (Task 1 FAIL path - concrete alternatives):**
- **F1: LR API missing/incompatible** (`addDocument`/`getClassifications` not usable):
	- Stop LR implementation immediately.
	- Keep NB as default and execute only latency harness + confusion diagnostics for NB hardening.
	- Open a follow-up spec for "classifier adapter layer" (model-agnostic interface) before retrying LR.
- **F2: LR persistence/restore incompatible** (train works, restore fails):
	- Run LR in non-persistent experiment mode only (`persist: false`) for A/B evidence collection.
	- Do not allow production promotion.
	- Add follow-up task: LR-specific serialization strategy or dual-model state schema.
- **F3: LR trains but confidence API degenerate** (empty/unstable scores):
	- Gate LR as research-only branch.
	- Keep rollout path on NB.
	- Trigger phase-2 redesign focused on explicit TF-IDF adapter + calibrated score mapping.

### Task 2: Model routing hardening (`ML_MODEL_TYPE`)

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`

- [ ] **Step 1: Add explicit env-driven model selection with default `naive-bayes`**
- [ ] **Step 2: Ensure unsupported value falls back to NB with warning log**
- [ ] **Step 3: Add runtime fail-safe from LR to NB on init failure**
- [ ] **Step 4: Add single-request fallback from LR inference exceptions to NB**
- [ ] **Step 5: Run type check (`npx tsc --noEmit`)**

### Task 3: LR inference contract alignment

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`

- [ ] **Step 1: Implement LR score normalization to `allScores` sum=1**
- [ ] **Step 2: Handle edge case score vectors (negative/zero/empty) with deterministic fallback**
- [ ] **Step 3: Ensure `confidence=max(allScores)` parity with NB contract**
- [ ] **Step 4: Ensure LR path bypasses keyword bonus + asayis shield logic**
- [ ] **Step 5: Add/adjust unit tests for score normalization edge cases**

### Task 4: Hard-negative injection parity verification

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`

- [ ] **Step 1: Keep existing injection stage before classifier training for both models**
- [ ] **Step 2: Keep log keys identical for NB and LR runs**
- [ ] **Step 3: Add assertion/log to prove injection is applied in LR runs**
- [ ] **Step 4: Run one smoke benchmark for each model and verify injection logs**

### Task 5: Benchmark script support checks

**Files:**
- Modify: `backend/scripts/benchmark-10x-tokenizer.ts`

- [ ] **Step 1: Verify `--model=logistic-regression` path works end-to-end**
- [ ] **Step 2: Keep output schema stable (Run lines + Summary lines)**
- [ ] **Step 3: Ensure run `success` semantics align with Guard4 definition**
- [ ] **Step 4: Run NB 1x and LR 1x smoke commands**

### Task 6: Add inference latency p95 harness (missing mechanism)

**Files:**
- Create: `backend/scripts/benchmark-inference-latency.ts`

- [ ] **Step 1: Implement script to load trained model once and run N classify calls**
- [ ] **Step 2: Measure per-call inference latency in ms (high-resolution timer)**
- [ ] **Step 3: Compute p50/p95/p99 and mean/std**
- [ ] **Step 4: Output summary in parseable format for NB and LR**
- [ ] **Step 5: Add CLI flags (`--model`, `--samples`, `--manual-only`)**
- [ ] **Step 6: Run NB and LR latency benchmarks with same sample set**

**Latency harness dependency contract:**
- Harness must measure latency on the model instance trained in the same run context.
- Primary gate evidence cannot depend on previously persisted production model state.
- Optional secondary check may run on persisted state for operational confidence only.

### Task 7: Statistical comparison utility

**Files:**
- Create: `backend/scripts/compare-benchmark-stats.ts`

- [ ] **Step 1: Parse two 10x benchmark output files**
- [ ] **Step 2: Compute mean deltas for accuracy, macro-F1, Siyaset F1**
- [ ] **Step 3: Compute paired t-test p-value for accuracy delta**
- [ ] **Step 4: Parse `Genel -> Siyaset` pair counts and compare averages**
- [ ] **Step 5: Emit pass/fail report against Section 6.2 gates**

### Task 8: Execute A/B benchmark campaign

**Files:**
- Test only; no code changes expected

---

## EXECUTION OUTCOME — 2026-04-11

### Task 1–8 Execution Status

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Assumption Gate | ✅ EXECUTED | LR API compatible; persistence restore BLOCKED |
| Task 2: Model Routing | ✅ COMPLETED | env-based fallback hardening added |
| Task 3: Inference Contract | ✅ COMPLETED | Score normalization aligned |
| Task 4: Hard-Negative Parity | ✅ COMPLETED | Both models use same injection logic |
| Task 5: Benchmark Script Support | ✅ COMPLETED | `--model=logistic-regression` flag working |
| Task 6: Latency Harness | ✅ COMPLETED | `benchmark-inference-latency.ts` created and functional |
| Task 7: Statistical Comparison | ✅ COMPLETED | `compare-benchmark-stats.ts` gate evaluator written |
| Task 8: Campaign Execution | ✅ COMPLETED | NB 10x + LR 10x F2 non-persistent runs executed 2026-04-11 |
| **Task 10: Final Decision** | **❌ PROMOTION BLOCKED** | See closure section below |

### Campaign Closure — 2026-04-11

**Executive Summary:**

Logistic Regression A/B testing campaign completed. **LR promotion is BLOCKED** due to three combined failure vectors:

1. **Persistence/Restore Incompatibility (Technical Blocker)**
   - LR save/restore path is not compatible with current model state schema
   - LR confined to non-persistent F2 experiment mode only
   - Cannot satisfy production deployment requirements

2. **Benchmark Performance Regression (Accuracy)**
   - LR F2 Campaign: 60.79% mean accuracy (std 3.18%)
   - NB Batch-16 Baseline: 71.80% mean accuracy (std 1.79%)
   - **Delta: -11.01 percentage points** — unrecoverable gap for phase-1 scope
   - All primary metrics (accuracy, macro-F1, Siyaset F1) significantly worse in LR

3. **Siyaset F1 Instability (Variance Blocker)**
   - Siyaset F1 std: 0.095 (LR) vs 0.045 (NB baseline)
   - Exceeds tolerance threshold of 0.05 by 90%
   - Precludes reliable hard-negative injection feedback for future optimization phases

**Decision:**

- **NB Batch-16 remains production default** — no model switch
- **LR codebase remains in repo** for reference/research only
- **Production inference workflow unchanged** — continues using NB path
- **Future work:** if LR re-evaluation desired, requires explicit feature-engineering redesign (TF-IDF, domain features, or category architecture audit)

**Campaign Artifacts:**

- Spec Appendix: [2026-04-09-tfidf-logreg-ab-test-design.md](2026-04-09-tfidf-logreg-ab-test-design.md) — "APPENDIX: Promotion Decision"
- NB Control Benchmark: `batch_f2_nb_10x_20260411.txt` (10 runs, controlled sampling)
- LR Experimental Benchmark: `batch_f2_lr_10x_20260411.txt` (10 runs, F2 non-persistent, controlled sampling)
- Controlled Data State Snapshots: `backups/benchmark_state/20260411_113537/`

**Lessons Learned:**

1. Naive Bayes tokenizer boundary is near-optimal for current unigram-bigram feature space
2. LR requires explicit feature engineering (not just boundary shift) to beat NB on this corpus
3. Temporal split creates inherent sample variance for minority categories (Siyaset support=5) — future A/B work should use stratified cross-validation or category-balanced splits
4. Category overlap (Genel↔Siyaset) is a data-definition issue, not merely an algorithm issue

**Next Steps (Out of Scope):**

- Defer LR to future research branch if funding/resources permit explicit TF-IDF adapter work
- Consider category-architecture audit to reduce Genel↔Siyaset lexical overlap at source
- Continue NB hardening work (bigram tuning, domain tokens) as independent optimization track

- [ ] **Step 1: Snapshot current benchmark-relevant data state (target IDs + category distribution)**
- [ ] **Step 2: Enforce Batch-16 baseline data state before A/B commands**
- [ ] **Step 3: Run NB 10x benchmark and store output file**
- [ ] **Step 4: Run LR 10x benchmark and store output file**
- [ ] **Step 5: Run NB latency harness and store output file**
- [ ] **Step 6: Run LR latency harness and store output file**
- [ ] **Step 7: Run comparison utility on NB vs LR benchmark files**
- [ ] **Step 8: Verify all promotion gates with evidence**

### Task 9: Required verification gates (go/no-go)

**Files:**
- Test only; no code changes expected

- [ ] **Step 1: Run assumption validation script and confirm PASS**
- [ ] **Step 2: Run `npx tsc --noEmit` and confirm zero errors**
- [ ] **Step 3: Verify benchmark commands exited successfully**
- [ ] **Step 4: Verify no critical guard failure (`success=N` or calibration < 70%)**
- [ ] **Step 5: Verify confusion metric `Genel -> Siyaset` improved vs baseline**
- [ ] **Step 6: Verify latency gate (`p95_LR <= p95_NB * 1.10`)**
- [ ] **Step 7: Verify NB mode still reproduces Batch-16 envelope**

### Task 10: Decision and rollout preparation

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` (only if promotion approved)

- [ ] **Step 1: If gates fail, set/keep default model as NB and document reason**
- [ ] **Step 2: If gates pass, prepare canary config (`ML_MODEL_TYPE=logistic-regression`)**
- [ ] **Step 3: Run health-check workflow in canary environment**
- [ ] **Step 4: Collect 24h canary stability evidence**
- [ ] **Step 5: Decide promote vs rollback according to decision matrix**

---

## Command Checklist

- `cd backend; npx tsc --noEmit`
- `cd ..; docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend npx ts-node scripts/benchmark-10x-tokenizer.ts --runs=10 --manual-only --model=naive-bayes`
- `cd ..; docker compose exec -e FORCE_DISK_FALLBACK=0 -e ML_DISK_SUPPLEMENT_LIMIT=0 -T backend npx ts-node scripts/benchmark-10x-tokenizer.ts --runs=10 --manual-only --model=logistic-regression`
- `cd ..; docker compose exec -T backend npx ts-node scripts/benchmark-inference-latency.ts --model=naive-bayes --samples=1000 --manual-only`
- `cd ..; docker compose exec -T backend npx ts-node scripts/benchmark-inference-latency.ts --model=logistic-regression --samples=1000 --manual-only`
- `cd backend; npx ts-node scripts/compare-benchmark-stats.ts --nb=<file> --lr=<file>`

## Completion Criteria

The work is complete only if:
- All Task 9 go/no-go steps are checked with command evidence.
- A clear promotion decision is documented (promote LR or retain NB).
- If retain NB, rollback is immediate via model selector with zero code regressions.
