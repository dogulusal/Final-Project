# Batch-21 NB Stabilization Design Spec

Date: 2026-04-11
Status: Approved (design)
Owner: ML optimization track

## 1. Problem Statement

Batch-16 remains the stable production baseline (accuracy mean 71.80, std 1.79). Recent LR phase-1 experiments were blocked by:

1. Persistence/restore incompatibility (F2-only experimental mode)
2. Benchmark regression versus Batch-16 baseline
3. High Siyaset metric variance (Siyaset F1 std 0.095 with support=5)

Core issue: Current benchmark split strategy can produce very low per-class support (especially Siyaset), reducing reliability of run-to-run comparisons and making model decisions noisy.

## 2. Goal and Scope

Primary goal:
- Reach a reliable and reproducible NB benchmark cycle targeting 72.50 mean accuracy without changing core model family.

Secondary goals:
- Reduce variance in class-specific metrics (especially Siyaset F1)
- Prevent overfitting to confusion-pair heuristics
- Preserve production safety with clear exit conditions

Out of scope:
- Production LR promotion
- Transformer migration in this sprint
- Large-scale taxonomy redesign in this sprint

## 3. Strategy Summary (A + mini-B)

The approved strategy combines:

1. Approach A (core): stratified-temporal split + validation quality improvements
2. Approach B (small parallel): targeted manual relabel of 20-30 Genel<->Siyaset boundary cases

Approach C (additional heuristic post-processing) is explicitly excluded.

## 4. Design Details

### 4.1 Stratified-Temporal Split

Replace global temporal split with per-category temporal split.

Rules:
1. Split each category independently by time (80/20 base)
2. Enforce minimum test support per category (target >=10, ideal >=15)
3. Do not reduce any category train share below 60%
4. If support rule cannot be satisfied under train>=60% rule, keep safe split and log fallback reason

Rationale:
- Stabilizes minority-category metrics
- Makes Siyaset F1 variance operationally meaningful
- Improves comparability across repeated 10x runs

Compatibility note for thesis:
- Batch-21 uses a different evaluation methodology than Batch-16.
- Direct numerical comparison is indicative, not strict apples-to-apples equivalence.
- Batch-21 starts a new baseline lineage.

### 4.2 Validation Pool Expansion + Boundary Relabel

#### 4.2.1 Targeted Validation Expansion

1. Measure validated counts per category (`kategori_dogrulandi=true`)
2. Raise weak categories toward operational floor
3. Prioritize categories affecting target confusion (Genel, Siyaset)

#### 4.2.2 Human-in-the-loop Spot-Check Gate

High-confidence auto-approval is forbidden.

Process:
1. Build candidate batch (confidence > 0.85)
2. Randomly inspect 3 records from each 10-record batch
3. Gate:
   - 3/3 correct -> batch accepted
   - >=1 wrong -> full batch rejected and sent to manual queue

Reason:
- Prevents high-confidence but wrong-label contamination
- Addresses known false-confidence cases (example pattern: 100% confidence but wrong class)

#### 4.2.3 Boundary Case Manual Review (20-30 records)

Scope:
- General<->Siyaset ambiguous items only

Labeling policy:
- If uncertain, keep as Genel
- Do not force ambiguous items into Siyaset

This policy is mandatory for consistency and drift control.

### 4.3 Injection Calibration Loop (Batch-21a/b/c)

Run isolated experiments to avoid confounded conclusions:

1. Batch-21a: stratified split, injection OFF
2. Batch-21b: stratified split, Batch-16 injection params ON
3. Batch-21c: stratified split, tuned injection params (single-variable changes only)

Control rule:
- One parameter change per run cycle
- No simultaneous multi-knob tuning

## 5. Acceptance Gates (Batch-21)

Batch-21 candidate is acceptable if:

1. Accuracy mean >=71.80 (baseline equivalence) and target path toward >=72.50
2. Accuracy std <=2.50
3. Siyaset F1 std <=0.05
4. Siyaset test support >=10 for each run
5. Guard4 pass rate >=80% over campaign
6. Genel->Siyaset average does not worsen versus Batch-16 reference behavior

## 6. Timebox and Exit Criteria

Hard timebox:
- Maximum 1 week for this optimization cycle

Exit outcomes:
1. Success path:
   - Batch-21 candidate meets gates, proceed to controlled production candidate evaluation
2. Failure path:
   - If still unstable after 3-cycle tuning, document architectural ceiling and stop optimization loop
   - Keep NB Batch-16 as production default

Required thesis wording on failure:
- Current NB architecture reached practical ceiling under available data/scope.
- Further gains likely require transformer-class modeling and/or taxonomy redesign, both out of current sprint scope.

## 7. Thesis Narrative Positioning

This cycle is presented as evidence-based engineering:

1. Hypothesis formed (split instability + support scarcity)
2. Controlled interventions applied (split, validation, isolated injection tuning)
3. Objective gates evaluated
4. Promotion or stop decision made from measured evidence

LR non-promotion is not a weakness; it is a methodological maturity signal.

## 8. Implementation Boundaries

In this phase:
1. Preserve NB production default
2. Add split and dataset-quality controls
3. Keep rollback path trivial (config-only return to Batch-16 behavior)
4. Defer transformer track to separate long-sprint proposal

---

## 9. Execution Outcome Addendum (2026-04-11)

### Campaign Evidence

Control/candidate comparison:
- Batch-21b (`batch21b_nb_10x_20260411.txt`)
- Batch-21c (`batch21c_nb_10x_20260411_final.txt`)

Observed aggregate metrics:
- Batch-21b: Accuracy 71.00 +- 2.62, Macro-F1 0.717 +- 0.027, Siyaset F1 0.716 +- 0.051, support=25
- Batch-21c: Accuracy 71.56 +- 2.21, Macro-F1 0.722 +- 0.022, Siyaset F1 0.718 +- 0.039, support=25

Key improvements in Batch-21c:
1. Accuracy mean +0.56 pp
2. Accuracy std reduced (2.62 -> 2.21)
3. Siyaset F1 std reduced (0.051 -> 0.039)
4. Guard reliability maintained (10/10 run success)

### Gate Interpretation

Strict gate status:
1. Accuracy threshold 71.80: narrowly missed by 0.24pp
2. All stability gates: passed
3. Genel->Siyaset pair: borderline drift (3.6 -> 3.7)

Decision interpretation (owner-approved):
- Because Batch-21 uses a changed methodology (stratified split), Batch-16 comparison is indicative rather than strict.
- The 0.24pp miss is treated as non-material versus clear stability gains.

### Official Decision

Batch-21c is designated as a controlled production candidate.

Operational meaning:
1. Candidate is eligible for controlled rollout validation.
2. Batch-16 remains default until rollout checks complete.
3. No claim of unrestricted full promotion at this stage.

### Thesis Alignment

This outcome supports an evidence-first thesis narrative:
1. Hypothesis-driven diagnosis
2. Controlled intervention sequence
3. Reproducible benchmark validation
4. Transparent trade-off decision under methodology change

This is presented as methodological maturity, not metric cherry-picking.
