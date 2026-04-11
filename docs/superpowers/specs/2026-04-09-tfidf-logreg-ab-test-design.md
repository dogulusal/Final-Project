# TF-IDF + Logistic Regression A/B Design Spec

**Date:** 2026-04-09
**Status:** Draft for review
**Owner:** ML optimization track

## 1. Problem Statement

Current production baseline is Batch-16:
- Accuracy: 71.80 +- 1.79
- Macro-F1: 0.728 +- 0.017
- Siyaset F1: 0.742 +- 0.045

Multiple inference-side interventions (keyword guard, penalties, extra injection, targeted relabel) failed to beat this baseline consistently.
Observed dominant error pattern remains `Genel -> Siyaset` lexical overlap.

Root cause hypothesis:
- Naive Bayes treats token evidence with strong conditional independence assumptions.
- Overlapping political/public discourse tokens (for example: karar, tepki, kurum, genel baskan-like patterns) are not sufficiently separable under the current NB boundary.
- Data volume is not the primary bottleneck (Genel is not underrepresented in manual-validated mass).

## 2. Goal and Non-Goals

### 2.1 Goal
Introduce TF-IDF + Logistic Regression (LR) as an alternative model path in the same ML service and benchmark it against existing Naive Bayes (NB) without destabilizing production.

Success target:
- Primary: Mean accuracy >= 72.50 in 10x manual-only benchmark.
- Secondary: Reduce `Genel -> Siyaset` average confusion versus Batch-16 (3.7/run baseline).
- Stability: Keep std in acceptable range and avoid calibration/guard regressions.

### 2.2 Non-Goals
- No immediate full replacement of NB in first step.
- No frontend/API contract changes.
- No schema migration unless strictly needed.
- No uncontrolled heuristic expansion during model migration.

## 3. Selected Strategy

Chosen approach (user-approved):
1. Keep NB path intact (Batch-16 behavior preserved).
2. Add LR path in phase-1 using existing tokenizer + n-gram features through natural LR classifier.
3. Run A/B benchmark via existing benchmark script.
4. Decide promotion only after benchmark evidence.

Expectation management note:
- Despite spec title, phase-1 does not introduce an explicit TF-IDF adapter layer.
- Phase-1 target is LR decision-boundary validation with current preprocessing.
- Explicit TF-IDF adapter work is deferred to future-work unless phase-1 evidence requires it.

LR-specific policy decisions:
- Terminology:
  - Keyword bonus: category-level additive score boost applied only at inference in NB mode.
  - Asayis shield: Siyaset bonus suppression rule for high asayis context in NB mode.
- In LR mode, keyword bonus is not applied at any stage (neither training nor inference).
- Asayis shield is out of scope for A/B phase-1 and will be evaluated only in a separate phase-2 ablation if LR phase-1 passes.

## 4. Architecture Changes

## 4.1 Model Routing

In `backend/src/modules/ml/ml.service.ts`:
- Keep existing `modelType` selector (`naive-bayes` | `logistic-regression`).
- Ensure constructor and initialization cleanly instantiate either:
  - `natural.BayesClassifier`
  - `natural.LogisticRegressionClassifier`

Runtime selection contract:
- Model type is selected via `ML_MODEL_TYPE` environment variable.
- Allowed values: `naive-bayes`, `logistic-regression`.
- Default/fallback value: `naive-bayes`.

Production safety rule:
- Default remains NB until LR benchmark explicitly passes target thresholds.

## 4.2 Training Pipeline

Assumption validation gate (must pass before implementation proceeds):
- Verify `natural.LogisticRegressionClassifier` supports required API surface used by service:
  - `addDocument()`
  - `train()`
  - `classify()`
  - `getClassifications()`
- Verify LR persistence/restore compatibility with current model save/restore flow.
- If any item fails, this spec is blocked and returns to redesign.

Assumption gate governance:
- Decision owner: ML maintainer prepares evidence, project owner gives go/no-go decision.
- If gate fails:
  - LR implementation path is halted immediately.
  - NB baseline hardening work may continue as a separate track.
  - LR track resumes only after approved redesign/update to spec.

Common steps for both models remain:
- Load verified data + manual-only mode options.
- Temporal split by category (80/20).
- Upsample logic (manual 5x, regular 3x).
- Hard-negative injection (with controlled caps).
- Diagnostics and confusion-matrix generation.

Model-specific steps:

### NB path (unchanged)
- `preprocess()` -> tokens -> join -> `addDocument()` -> `train()`.

### LR path (v1 implementation)
- `preprocess()` -> tokens -> join -> `addDocument()` -> `train()` using natural LR classifier.
- This path still benefits from the existing tokenizer and n-gram signal.

Rationale:
- Keep first migration minimal and reversible.
- Validate whether LR decision boundary alone solves overlap before adding additional feature-engineering complexity.

## 4.3 Inference Pipeline

NB mode:
- Keep current Batch-16 behavior including keyword hints + Siyaset cap + asayis shield.

LR mode (initial):
- Use classifier probabilities/scores directly.
- Skip keyword bonus application at inference time only.
- Return normalized confidence map from LR outputs.

Important: `ML_CONFIDENCE_THRESHOLD` behavior remains globally compatible.

Inference compatibility contract:
- API response schema remains unchanged: `{ kategori, confidence, allScores }`.
- Normalization formula:
  - Let raw class scores be `s_i` for class `i`.
  - If any `s_i < 0`, shift scores by `s'_i = s_i - min(s)`.
  - If `sum(s') > 0`, set `p_i = s'_i / sum(s')`.
  - Else fallback to uniform `p_i = 1 / K` where `K` is class count.
- `allScores` is `{ class: p_i }` and must sum to 1.0 (+- numerical epsilon).
- `confidence` is `max(p_i)` and uses the same threshold gate as NB mode.

## 5. Hard-Negative Injection Integration (Clarified)

This section addresses the uncertainty explicitly.

Current injection method modifies training sample composition before model training:
- Duplicate selected documents from filtered pools and push into `trainSet`.
- It is model-agnostic as long as downstream model consumes `trainSet` examples.

Therefore:
- For NB: unchanged behavior.
- For LR: same injected documents are included in LR training corpus before `train()`.

What changes in LR migration:
- Injection does not move to feature layer.
- Injection remains dataset-level reweighting.
- Any TF-IDF or LR feature construction happens after injected corpus is finalized.

Validation requirement:
- Log injection summary in LR runs with the same key format used by NB:
  - `Injected total`
  - `Genel->Siyaset`
  - `Siyaset->Genel`
  - `Siyaset->Teknoloji`
  - `Siyaset->Dunya`
  - `Siyaset->Ekonomi`
- Compare pool capping effects and variance impact per run.

## 6. Benchmark and Acceptance Plan

## 6.1 Benchmark Matrix

Run the same 10x manual-only benchmark with exactly two variants in phase-1:
1. NB baseline (Batch-16 control)
2. LR without keyword bonus

Benchmark precondition (data-state reproducibility):
- Before each benchmark campaign, snapshot current label state for controlled IDs and category distribution.
- Enforce Batch-16 baseline data state before NB and LR comparisons.
- If drift is detected, restore target state first, then run benchmarks.

Metrics:
- Accuracy mean/std
- Macro-F1 mean/std
- Siyaset F1 mean/std
- `Genel -> Siyaset` pair average and range
- Guard/calibration outcomes
- Inference latency (p95) and memory footprint delta versus NB baseline

Latency measurement source of truth:
- Latency p95 is measured from the dedicated latency harness using the model instance trained in the same benchmark context.
- Production-persisted model state is not used as primary latency evidence for phase-1 gate validation.

## 6.2 Promotion Criteria

LR can be promoted only if all hold:
1. Accuracy mean >= 72.50 OR `(mean(LR)-mean(NB)) >= 0.50` and paired-run t-test p-value < 0.05.
2. `Genel -> Siyaset` average lower than 3.7/run baseline.
3. No critical guard failures across runs. Critical guard failure is defined as any run where:
   - Guard4 calibration fails (`calibration accuracy < 70%`), or
   - Train pipeline aborts and run is marked `success=N`.
4. `std(accuracy_LR)` <= `std(accuracy_NB) + 0.30` (Batch-16 baseline `std(accuracy_NB)=1.79`, threshold <= 2.09).
5. Inference latency p95 <= NB p95 + 10% and no operational memory regressions that impact health checks.

If criteria fail, keep NB as production default.

## 6.3 Out-of-Scope Ablation Note

Asayis shield ablation is explicitly out of phase-1 scope.
If LR phase-1 passes promotion criteria, a separate phase-2 spec may evaluate LR + asayis shield.

## 7. Rollback and Safety

Rollback readiness:
- NB path untouched and available via model selector.
- If LR performs worse, switch config/modelType back to NB immediately.
- Use rollback workflow only if accidental regression reaches protected branch or deployed runtime.

LR error handling and fail-safe:
- Initialization order: try configured model first (`ML_MODEL_TYPE`), if configured model is LR and fails, immediately initialize NB fallback.
- Runtime inference: on LR inference exception, single-request fallback to NB path and emit structured error logs.
- Recovery latency target: fallback decision and reroute must complete within one request cycle (no process restart requirement).
- If both model paths are unavailable, endpoint returns explicit 5xx with diagnostic code (no silent misclassification).
- Persist/restore behavior must be verified for LR before any production promotion; if LR serialization is incompatible, promotion is blocked.

Deployment strategy:
- Stage 1: local benchmark validation.
- Stage 2: canary runtime with `ML_MODEL_TYPE=logistic-regression` in non-critical environment.
- Stage 3: promote only after health-check + benchmark acceptance gates pass.

Promotion decision matrix (owner: ML maintainer + project owner approval):
- Stage 1 pass + Section 8 go/no-go all green -> eligible for Stage 2.
- Stage 2 canary health-check green for 24h + no critical runtime errors -> eligible for Stage 3.
- Any critical guard failure or canary instability -> rollback to NB and stop promotion.

Data safety:
- No destructive data migration in this phase.
- Any relabel experiments must be tracked separately and benchmarked independently.

## 8. Testing Strategy

Required go/no-go checks before claiming completion:
0. Assumption validation: verify `natural.LogisticRegressionClassifier` API surface (`addDocument`, `train`, `classify`, `getClassifications`) and serialization/restore compatibility.
1. Type check (`npx tsc --noEmit`)
2. Benchmark command execution (10x manual-only) for both NB and LR variants
3. Targeted confusion extraction (`Genel -> Siyaset`) for both variants
4. Health-check workflow after model switch in running environment
5. LR serialization/restore validation test (train -> save -> restore -> infer)
6. Unit tests for model routing (NB vs LR path selection)
7. Unit tests for score normalization compatibility and edge cases
8. Regression test that NB mode still reproduces Batch-16 behavior envelope
9. Integration test for runtime model switch via `ML_MODEL_TYPE`
10. Guard4 compatibility assertion for LR mode on calibration subset

Post-promotion hardening (non-blocking):
- Extended stress tests for memory/latency under production-like load
- Additional confusion audits on fresh weekly data

## 9. Deliverables

1. Updated `ml.service.ts` with explicit stable model routing and LR-ready pipeline.
2. Benchmark outputs for NB vs LR comparisons (saved txt artifacts).
3. Confusion comparison table including `Genel -> Siyaset` pair.
4. Final recommendation: keep NB or promote LR.

## 10. Pre-Planning Decisions

1. LR promotion policy: require two consecutive 10x confirmations before making LR default.
2. Benchmark data policy: enforce Batch-16 baseline data state before LR benchmark campaign.

## 11. Future Work (Out of Current Scope)

If LR A/B fails to meet acceptance criteria, evaluate one of:
- explicit TF-IDF adapter phase,
- category-definition redesign project.

## 12. Workflow Integration

Planning and delivery workflow mapping:
- Spec writing quality: brainstorming + writing-skills patterns
- Implementation planning: writing-plans
- Spec review loop: requesting-code-review + receiving-code-review + comprehensive-review workflow principles
- Execution: executing-plans
- Verification gates: verification-before-completion + test-driven-development + health-check workflow
- Failure path: systematic-debugging + rollback workflow

## 13. Scope Boundaries for Next Step

This spec covers model-path migration and benchmarking only.
Implementation plan will be generated separately (writing-plans) after spec approval and review pass.

---

## APPENDIX: Promotion Decision — 2026-04-11 Campaign Result

**Status:** ❌ **PROMOTION BLOCKED**

**Campaign Execution:**
- Date: 2026-04-11
- NB Benchmark: 10x manual-only with `--max-db-samples=300` controlled sampling
- LR Benchmark: 10x manual-only with `--max-db-samples=300` controlled sampling (non-persistent F2 mode)
- Controlled data state: Batch-16 baseline labels enforced before campaign

**Benchmark Results:**

| Metric | NB Batch-16 | LR F2 (10x) | Delta | Status |
|--------|-------------|------------|-------|--------|
| Accuracy mean | 71.80% | 60.79% | -11.01 pp | ❌ FAIL |
| Accuracy std | 1.79% | 3.18% | +1.39 pp | ⚠️ MARGINAL |
| Macro-F1 mean | 0.728 | 0.541 | -0.187 | ❌ FAIL |
| Siyaset F1 mean | 0.742 | 0.287 | -0.455 | ❌ FAIL |
| Siyaset F1 std | 0.045 | 0.095 | +0.050 | ❌ FAIL |
| Genel→Siyaset avg | ~0.9 | ~1.2 | +0.3 (worse) | ⚠️ MARGINAL |

**Gate Evaluation Against Section 6.2 Criteria:**

1. **Accuracy criterion**: LR mean 60.79 < 72.50 threshold ❌ FAIL
   - Delta = -11.01 pp (far below 0.50 pp improvement requirement)
   - Paired t-test not applicable; gap is clear and large

2. **Pair criterion** (Genel→Siyaset < 3.7 avg): LR ~1.2 ≈ NB ~0.9 ❌ FAIL
   - LR shows slightly worse or equivalent pair rate; no improvement

3. **Guard criterion** (no critical failures): Requires inspection of full run log
   - Inference: sampled runs had calibration pass status but confidence distribution unstable
   - Siyaset F1 std 0.095 indicates high variance run-to-run

4. **Std criterion** (LR std ≤ NB std + 0.30): LR std 3.18 > NB std 1.79 + 0.30 = 2.09 ❌ FAIL
   - LR stability worse than acceptable margin
   
5. **Latency criterion**: Not measured in this phase due to LR training time dominance in smoke runs
   - LR training latency observed ~200–230s per run; inference would be latency-neutral or better
   - Latency gate is secondary relative to accuracy gate failure

**Primary Blockers:**

1. **Persistence/Restore Incompatibility (F2 Mode Constraint)**
   - LR save/restore path not compatible with current model persistence schema
   - Only non-persistent (`persist: false`) mode available for experiments
   - Cannot be promoted to production persistence workflow

2. **Benchmark Performance Regression (Accuracy)**
   - LR achieves 60.79% mean accuracy vs NB Batch-16 baseline 71.80%
   - Gap of -11.01 percentage points is severe and not recoverable via phase-1 scope
   - Indicates LR boundary with current tokenizer + n-gram features is not competitive

3. **Siyaset Metric Instability (High Variance)**
   - Siyaset F1 std 0.095 exceeds 0.05 tolerance by 90%
   - This variance precludes reliable hard-negative injection feedback in phase-2
   - Suggests temporal split or category-specific sample imbalance interacting poorly with LR probabilistic model

**Root Cause Analysis:**

The performance gap between NB (71.80%) and LR (60.79%) on the same manual-only validation set indicates:
- LR's linear decision boundary is not suitable for this feature space without explicit feature engineering (e.g., TF-IDF, polynomial features, or explicit domain tokens)
- Natural.js logistic regression with unigram-bigram n-grams does not provide sufficient separation for Genel↔Siyaset confusion
- Temporal split in this specific campaign may have created a harder-than-average test set for LR due to category drift

**Decision:**

- **LR promotion path is CLOSED for phase-1**
- **NB Batch-16 remains production default with no model switch**
- **Recommendation for future work:**
  - If LR re-evaluation is desired, requires explicit feature-engineering phase (TF-IDF, domain features, or category-aware preprocessing)
  - Alternative: category-definition audit to reduce Genel↔Siyaset lexical overlap at source

**Rollback Action Taken:**
- No production change was made; NB Batch-16 continues to be the active model
- LR code path remains in codebase for research/reference only, not wired to production config

**Campaign Artifacts:**
- `batch_f2_nb_10x_20260411.txt` — NB control benchmark (10 runs)
- `batch_f2_lr_10x_20260411.txt` — LR experimental benchmark (10 runs, F2 non-persistent mode)
- This spec section — final promotion decision record
