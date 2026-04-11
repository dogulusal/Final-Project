# Batch-21 NB Stabilization Implementation Plan

> Source spec: docs/superpowers/specs/2026-04-11-batch21-nb-stabilization-design.md
> Objective: Improve benchmark reliability and stabilize NB performance with stratified-temporal split, controlled validation, and isolated injection tuning.
> Timebox: 1 week hard limit

## Scope

- Keep NB Batch-16 as production default during entire cycle.
- Do not promote LR in this plan.
- Do not introduce transformer work in this plan.

## Deliverables

1. Stratified-temporal split implementation in ML training path
2. Per-category support/fallback diagnostics in benchmark output
3. Spot-check validation workflow (3/3 pass, 1+ fail reject)
4. Boundary-case review set (20-30 Genel<->Siyaset records)
5. Batch-21a/b/c benchmark artifacts and final go/no-go report

## Task 1: Implement Stratified-Temporal Split

Files:
- backend/src/modules/ml/ml.service.ts

- [ ] Add per-category temporal split utility
- [ ] Keep base split at 80/20 per category
- [ ] Enforce minimum test support target >=10 (ideal >=15)
- [ ] Enforce train share floor >=60% per category
- [ ] Add fallback branch when support target cannot be satisfied under train floor
- [ ] Emit structured split logs per category (train/test/support/fallback reason)

Acceptance:
- Training runs without regression in existing flow
- Logs show category-level split diagnostics every run
- No category violates train>=60% rule

## Task 2: Add Benchmark Diagnostics for Reliability

Files:
- backend/scripts/benchmark-10x-tokenizer.ts
- backend/src/modules/ml/ml.service.ts

- [ ] Print per-run per-category test supports
- [ ] Print run-level warning when any category support <10
- [ ] Summarize min/mean/max support by category at end of campaign
- [ ] Keep existing output schema compatible for prior parsers

Acceptance:
- Benchmark output contains explicit support visibility
- Existing comparison scripts still parse summary block

## Task 3: Implement Spot-Check Validation Gate (Human-in-the-loop)

Files:
- backend/scripts/ (new script)

- [ ] Create candidate extractor for confidence >0.85 records
- [ ] Group in 10-record batches
- [ ] Sample 3 random records per batch for manual review file export
- [ ] Implement decision application helper:
  - [ ] 3/3 correct => batch accepted
  - [ ] >=1 wrong => whole batch rejected to manual queue
- [ ] Write audit log output for thesis traceability

Acceptance:
- No auto-approval path without sampling
- Every accepted batch has explicit 3/3 proof line in output

## Task 4: Build Boundary-Case Review Set (20-30 records)

Files:
- backend/scripts/ (new query/export helper)
- backups/benchmark_state/ (output artifacts)

- [ ] Extract Genel predictions with near-Siyaset confidence
- [ ] Extract Siyaset predictions with low confidence
- [ ] Merge and deduplicate candidate list
- [ ] Produce review sheet with id, title, predicted class, top scores
- [ ] Apply labeling policy: uncertain => Genel
- [ ] Save final reviewed ids snapshot

Acceptance:
- 20-30 reviewed records completed
- Review artifact includes final label decision per id

## Task 5: Execute Controlled Benchmark Loop (Batch-21a/b/c)

Files:
- benchmark artifact txt files in repo root

- [ ] Batch-21a: stratified split + injection OFF (5x smoke, then 10x if stable)
- [ ] Batch-21b: stratified split + Batch-16 injection params ON (5x then 10x)
- [ ] Batch-21c: stratified split + tuned injection params (single-variable change only)
- [ ] Keep dataset state snapshot before each campaign
- [ ] Save all outputs with timestamped filenames

Acceptance:
- All three stages have reproducible artifacts
- Parameter changes are one-at-a-time and documented

## Task 6: Evaluate Gates and Decide

Gate thresholds:
1. Accuracy mean >=71.80 (target path toward >=72.50)
2. Accuracy std <=2.50
3. Siyaset F1 std <=0.05
4. Siyaset support >=10 on each run
5. Guard4 pass rate >=80%
6. Genel->Siyaset average must not worsen

- [ ] Produce final pass/fail table
- [ ] If pass: mark Batch-21 as controlled production candidate
- [ ] If fail after 3-cycle tuning: declare architectural ceiling and stop loop
- [ ] Keep Batch-16 default unchanged in either outcome

Acceptance:
- Decision is evidence-based and reproducible
- Clear stop condition applied within 1-week limit

## Task 7: Thesis Alignment and Closure Notes

Files:
- docs/superpowers/specs/2026-04-11-batch21-nb-stabilization-design.md (append outcome)
- docs/plan-tezTamamlamaStratejisi.prompt.md (optional status sync)

- [ ] Add methodology note: Batch-21 is a new baseline lineage (not strict direct compare)
- [ ] Add final narrative section: tested, measured, accepted/rejected by gates
- [ ] If rejected: include architectural ceiling statement and scope boundary note

Acceptance:
- Thesis narrative remains consistent with evidence-first process
- No ambiguity on why NB remained default (or why candidate advanced)

## Execution Order

1. Task 1
2. Task 2
3. Task 3 and Task 4 in parallel
4. Task 5
5. Task 6
6. Task 7

## Risk Controls

- Freeze production model selection to NB during campaign.
- Take benchmark state snapshots before each run series.
- Avoid multi-variable tuning.
- Enforce 1-week hard stop to prevent optimization loop sprawl.
