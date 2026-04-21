# Guard-First Anti-Drift Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Katman 1-2-3 guard logic in `categorize()` with strict test-first execution over the 42 dispute set, then ship with measurable guard-LLM alignment and rollback readiness.

**Architecture:** Existing `MlCategorizationService.categorize()` flow remains intact; three guard layers are inserted post-keyword-bonus, pre-return. Validation is done with deterministic unit tests plus a dispute replay harness over 42 real records. Release is controlled by env flags and a rollback playbook.

**Tech Stack:** TypeScript, Jest, Node.js, Prisma/PostgreSQL, existing ML service and scripts

---

## Skill and Workflow Mapping

- Primary skills included in this plan:
  - `@.agent/skills/test-driven-development`
  - `@.agent/skills/code-reviewer`
  - `@.agent/skills/systematic-debugging`
  - `@.agent/skills/verification-before-completion`
- Workflows included in this plan:
  - `@.agent/workflows/test-bot.md` (adapted to run full 42-dispute replay as automated bot-like test campaign)
  - `@.agent/workflows/rollback.md`
- Explicitly not included (by scope):
  - `@.agent/skills/refactoring-advisor`
  - `@.agent/skills/performance-profiler`
  - `@.agent/skills/dataset-quality-guard` (no retrain, no `training:generate`)

## Agency Meta-Rules Compliance

- `.agent/agency-meta-rules.md` checked.
- No prompt/LLM prompt file change in this plan, so `ai-prompt-engineer` not required.
- No RSS source ingestion change in this plan, so `rss-health-monitor` not required.
- This implementation is PR-equivalent; include `@.agent/workflows/comprehensive-review.md` as final optional gate before merge.

## Metric Definitions (Locked Before Implementation)

- `alignmentRate` definition:
  - Numerator: `guardTriggered` records where post-guard `kategori === llmCategory`
  - Denominator: all `guardTriggered` records
  - Formula: `alignedWithLlm / guardTriggered`
- `kural3FalsePositiveRate` definition:
  - Population: records where Kural 3 changed category to `Genel`
  - Numerator: Kural 3 changes where target LLM category is `Siyaset` or `Dunya` (i.e. Kural 3 moved away from LLM)
  - Denominator: all Kural 3 trigger count
  - Formula: `kural3AgainstLlm / kural3Triggered`
- Dataset for both metrics:
  - Fixed replay fixture `backend/src/__tests__/fixtures/guard-dispute-42.json`
  - Same fixture must be used across Task 5, Task 6, and Task 7.

---

## File Structure

**Modify**
- `backend/src/modules/ml/ml.service.ts`
- `backend/src/modules/ml/ml.interface.ts` (if return type needs `confidenceBand` / `guardOverride` extension)
- `backend/src/__tests__/ml.service.test.ts`

**Create**
- `backend/src/__tests__/ml.guard-layers.test.ts`
- `backend/src/__tests__/fixtures/guard-dispute-42.json`
- `backend/src/scripts/export-guard-disputes.ts`
- `backend/src/scripts/replay-guard-disputes.ts`
- `backend/src/scripts/guard-verification-report.ts`

**Plan/Docs artifacts**
- `docs/superpowers/specs/2026-04-12-guard-first-anti-drift-design.md` (only if thresholds/flags are updated after evidence)
- `docs/superpowers/plans/2026-04-21-guard-first-implementation-plan.md` (this file)

---

## Chunk 1: Test-First Harness and Katman 1

### Task 1: Prepare 42-Dispute Replay Fixture (RED First)

**Files:**
- Create: `backend/src/scripts/export-guard-disputes.ts`
- Create: `backend/src/__tests__/fixtures/guard-dispute-42.json`
- Create: `backend/src/__tests__/ml.guard-layers.test.ts`

- [ ] **Step 1: Write failing fixture-load test (`@.agent/skills/test-driven-development`)**

```typescript
it('loads exactly 42 dispute fixtures with required fields', () => {
  const fixtures = loadGuardFixtures();
  expect(fixtures).toHaveLength(42);
  for (const r of fixtures) {
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('title');
    expect(r).toHaveProperty('summary');
    expect(r).toHaveProperty('nbCategory');
    expect(r).toHaveProperty('llmCategory');
  }
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "loads exactly 42 dispute fixtures"`
Expected: FAIL (fixture file/helper not found)

- [ ] **Step 2b: Validate source data availability before export**

Run: `cd backend && docker compose exec postgres psql -P pager=off -U postgres -d news_db -c "SELECT COUNT(*) FROM dispute_queue WHERE durum='bekliyor';"`
Expected:
- If count >= 42: continue with export
- If count < 42: block implementation, export available set + record gap in plan notes

- [ ] **Step 3: Implement minimal export + fixture file**

Command (manual export once):
`cd backend && npx ts-node src/scripts/export-guard-disputes.ts --status=bekliyor --limit=42 --out=src/__tests__/fixtures/guard-dispute-42.json`

- [ ] **Step 4: Re-run test, verify GREEN**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "loads exactly 42 dispute fixtures"`
Expected: PASS

- [ ] **Step 5: Verify fixture integrity (known bad set)**

Run: `cd backend && npx ts-node src/scripts/export-guard-disputes.ts --status=bekliyor --limit=42 --validate=src/__tests__/fixtures/guard-dispute-42.json`
Expected:
- Fixture contains exactly 42 records
- All `llmCategory` values are in {Spor, Ekonomi, Teknoloji, Siyaset, Dunya, Saglik, Genel}
- IDs overlap with current known `dispute_queue.durum='bekliyor'` sample

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/export-guard-disputes.ts backend/src/__tests__/fixtures/guard-dispute-42.json backend/src/__tests__/ml.guard-layers.test.ts
git commit -m "test: add 42-dispute fixture harness for guard layers"
```

### Task 2: Katman 1 (Sağlık Negatif Sinyal) via TDD

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`
- Modify: `backend/src/__tests__/ml.guard-layers.test.ts`

- [ ] **Step 1: Write failing Katman 1 tests (RED)**

```typescript
it('moves Saglik winner to Spor when anti-saglik hits >=2 and saglik hits == 0', async () => {
  const out = await runCategorize('Basketbol Super Lig: Tofas - Besiktas');
  expect(out.kategori).toBe('Spor');
});

it('does not create phantom score keys for unknown anti category', async () => {
  const out = await runCategorizeWithForcedUnknownAntiCategory();
  expect(Object.keys(out.allScores)).not.toContain('UnknownCategory');
});

it('uses hasOwnProperty guard before score redistribution', async () => {
  const out = await runCategorizeWithInvalidAntiCategory('FakeCategory');
  expect(out.allScores).not.toHaveProperty('FakeCategory');
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "Katman 1"`
Expected: FAIL (guard logic missing)

- [ ] **Step 3: Implement minimal Katman 1 in `categorize()`**
- Add `const originalBestCategory = bestCategory;` immediately after the first best category/confidence selection loop and before any Katman 1 condition.
- Add anti-saglik signal scoring.
- Add safety check: `Object.prototype.hasOwnProperty.call(scores, maxAntiCategory)`.
- Keep behavior env-gated: `GUARD_SAGLIK_ENABLED !== 'false'`.

- [ ] **Step 4: Run tests, verify GREEN**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "Katman 1"`
Expected: PASS

- [ ] **Step 5: Run code review pass (`@.agent/skills/code-reviewer`)**
- Focus area 1: score redistribution safety
- Focus area 2: normalization invariants after redistribution

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/ml/ml.service.ts backend/src/__tests__/ml.guard-layers.test.ts
git commit -m "feat: add Katman1 saglik negative guard with safe score redistribution"
```

---

## Chunk 2: Katman 2 and Katman 3

### Task 3: Katman 2 Boundary Guard via TDD

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`
- Modify: `backend/src/__tests__/ml.guard-layers.test.ts`

- [ ] **Step 1: Write failing Katman 2 tests (RED)**

```typescript
it('General -> Siyaset when siyasetHits>=2 and dunyaHits=0', async () => {
  const out = await runCategorize('Cumhurbaskani ve meclis oturumu aciklamasi');
  expect(out.kategori).toBe('Siyaset');
});

it('General/Siyaset -> Dunya when dunyaHits>=2', async () => {
  const out = await runCategorize('NATO ve Avrupa Birligi zirvesi');
  expect(out.kategori).toBe('Dunya');
});

it('Kural3 is disabled when GUARD_BOUNDARY_KURAL3_ENABLED=false', async () => {
  process.env.GUARD_BOUNDARY_KURAL3_ENABLED = 'false';
  const out = await runBoundaryKural3Candidate();
  expect(out.kategori).not.toBe('Genel');
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "Katman 2"`
Expected: FAIL

- [ ] **Step 3: Implement minimal Katman 2**
- Add rules 1 and 2 under `GUARD_BOUNDARY_ENABLED !== 'false'`.
- Add rule 3 behind `GUARD_BOUNDARY_KURAL3_ENABLED !== 'false'`.
- Ensure rule application order is deterministic.

- [ ] **Step 4: Run tests, verify GREEN**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "Katman 2"`
Expected: PASS

- [ ] **Step 5: Run targeted review (`@.agent/skills/code-reviewer`)**
- Mandatory focus: Kural 3 false positive risk and margin handling.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/ml/ml.service.ts backend/src/__tests__/ml.guard-layers.test.ts
git commit -m "feat: add Katman2 boundary guard with kural3 feature flag"
```

### Task 4: Katman 3 Confidence Band via TDD

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts`
- Modify: `backend/src/modules/ml/ml.interface.ts`
- Modify: `backend/src/__tests__/ml.guard-layers.test.ts`

- [ ] **Step 1: Write failing Katman 3 tests (RED)**

```typescript
it('sets HIGH band when confidence>=0.85, keyword support exists, no override', async () => {
  const out = await runHighConfidenceCase();
  expect(out.confidenceBand).toBe('HIGH');
});

it('sets MEDIUM when guard override happened', async () => {
  const out = await runGuardOverrideCase();
  expect(out.confidenceBand).toBe('MEDIUM');
  expect(out.guardOverride).not.toBeNull();
});

it('never sets HIGH when guard override happened', async () => {
  const out = await runGuardOverrideCase();
  expect(out.confidenceBand).not.toBe('HIGH');
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "Katman 3"`
Expected: FAIL

- [ ] **Step 3: Implement minimal Katman 3**
- Add `confidenceBand` and `guardOverride` to return payload.
- Update TypeScript interfaces as needed.

- [ ] **Step 4: Run tests, verify GREEN**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "Katman 3"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/ml/ml.service.ts backend/src/modules/ml/ml.interface.ts backend/src/__tests__/ml.guard-layers.test.ts
git commit -m "feat: add Katman3 confidence band and override metadata"
```

---

## Chunk 3: 42-Record Campaign, Debug Loop, Verification, Deploy, Rollback

### Task 5: Automated 42-Dispute Campaign (Test-Bot Adaptation)

**Files:**
- Create: `backend/src/scripts/replay-guard-disputes.ts`
- Create: `backend/src/scripts/guard-verification-report.ts`

- [ ] **Step 1: Write failing campaign test (RED)**

```typescript
it('computes guard-LLM alignment over 42 disputes and outputs summary', async () => {
  const report = await runGuardReplay();
  expect(report.total).toBe(42);
  expect(report.guardTriggered).toBeGreaterThan(0);
  expect(report.alignmentRate).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run test, verify RED**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts -t "alignment over 42 disputes"`
Expected: FAIL

- [ ] **Step 3: Implement replay scripts (GREEN)**
- Replay fixture records through `categorize()` with guards on.
- Compare `kategori` vs fixture `llmCategory`.
- Emit JSON summary with:
  - `total`
  - `guardTriggered`
  - `alignedWithLlm`
  - `alignmentRate`
  - `kural3FalsePositiveRate`

- [ ] **Step 4: Run campaign and capture report**

Run: `cd backend && npx ts-node src/scripts/replay-guard-disputes.ts --fixture=src/__tests__/fixtures/guard-dispute-42.json --out=tmp/guard-replay-report.json`
Expected: report file created, exit code 0

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/replay-guard-disputes.ts backend/src/scripts/guard-verification-report.ts
git commit -m "test: add 42-dispute guard replay campaign and metrics report"
```

### Task 6: Systematic Debugging Loop for Non-Improving Cases

**Files:**
- Modify: `backend/src/modules/ml/ml.service.ts` (logs only if needed)
- Modify: `backend/src/scripts/replay-guard-disputes.ts` (diagnostic output)

- [ ] **Step 1: Apply `@.agent/skills/systematic-debugging` Phase 1-2 before any threshold tweak**
- Reproduce mismatch deterministically with fixture id list.
- Trace signals: anti-hit counts, siyasetHits, dunyaHits, originalBestCategory, finalCategory.

- [ ] **Step 2: Form one hypothesis per failed pattern**
- Example: "Kural 3 over-fires because margin threshold too permissive on short headlines."

- [ ] **Step 3: Test single minimal change and rerun replay**

Run: `cd backend && npx ts-node src/scripts/replay-guard-disputes.ts --fixture=src/__tests__/fixtures/guard-dispute-42.json --out=tmp/guard-replay-report-after-debug.json`
Expected: metric delta attributable to one change only

- [ ] **Step 4: Stop after 3 failed attempts and escalate architecture discussion**
- Do not do 4th blind tweak.

**Task 6 Entry Gate (quantitative):**
- Run Task 6 only if Task 5/Task 7 replay metrics are below targets:
  - `alignmentRate < 0.70` OR
  - `kural3FalsePositiveRate > 0.20`
- If both targets are met, skip Task 6 and continue to Task 7/Task 8.

**Task 6 Control Flow:**
- Task 5 always runs first and produces baseline replay metrics.
- If baseline metrics fail target, Task 6 auto-starts.
- After each minimal fix attempt in Task 6, rerun replay and compare to baseline.
- If target met, exit Task 6 and continue to Task 7.

**Failed Attempt Definition:**
- A failed attempt is any single-change iteration where replay metrics do not improve toward target and/or regress.
- After 3 failed attempts, stop changes and escalate architecture decision before any deploy action.

### Task 7: Verification Before Completion Gate

**Files:**
- Modify: `docs/superpowers/specs/2026-04-12-guard-first-anti-drift-design.md` (only if thresholds changed)

- [ ] **Step 1: Run full targeted backend test suite for ML guards**

Run: `cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts src/__tests__/ml.service.test.ts`
Expected: PASS, exit code 0

- [ ] **Step 2: Run type/build verification (`@.agent/skills/verification-before-completion`)**

Run: `cd backend && npm run build`
Expected: PASS, no TypeScript errors

- [ ] **Step 3: Run 42-dispute replay and validate spec success criteria**

Run: `cd backend && npx ts-node src/scripts/replay-guard-disputes.ts --fixture=src/__tests__/fixtures/guard-dispute-42.json --out=tmp/guard-replay-final.json`
Expected (targets from spec):
- guard-LLM alignment >= 70%
- Kural 3 false positive <= 20%

- [ ] **Step 3b: Deployment block on failed metrics**
- If any Step 3 target fails, do not proceed to Task 8.
- Route to Task 6 for systematic debugging and rerun Step 3 after each minimal fix.

- [ ] **Step 4: Complete explicit checklist before completion claim**
- "Basketbol Super Lig: Tofas - Besiktas" -> Spor (not Saglik)
- Genel<->Siyaset dispute count <= 8 (baseline 16)
- Accuracy benchmark >= 85% (no regression)
- No new false positive dispute patterns in sampled replay

### Task 8: Deploy and Rollback-Ready Operations

**Files:**
- No required code changes; operational commands and release note update

- [ ] **Step 1: Deploy with conservative flags**
- `GUARD_SAGLIK_ENABLED=true`
- `GUARD_BOUNDARY_ENABLED=true`
- `GUARD_BOUNDARY_KURAL3_ENABLED=false` (first rollout safety)

Note: Spec default for Kural 3 is `true`; deployment starts with `false` intentionally because Kural 3 is the highest-risk override.

- [ ] **Step 2: Post-deploy monitor window (24h)**
- Track: dispute rate, guardTriggered count, Kural 3 disabled impact.

Go/No-Go criteria after 24h:
- Go: no meaningful dispute spike, no guard-related runtime error logs, alignment trend non-degrading
- No-Go: dispute spike, repeated guard exceptions, or clear false-positive surge -> execute Step 4 rollback

- [ ] **Step 3: If stable, enable Kural 3 gradually**
- Set `GUARD_BOUNDARY_KURAL3_ENABLED=true` in controlled window.

- [ ] **Step 4: Prepare rollback path (`@.agent/workflows/rollback.md`)**

```bash
git log --oneline -n 5
git revert <problematic_commit_hash>
cd backend && npm run build
cd backend && npm test -- src/__tests__/ml.guard-layers.test.ts src/__tests__/ml.service.test.ts
```

Expected: rollback commit green and service back to stable behavior.

- [ ] **Step 5: Optional PR-equivalent safety pass**
- Run `@.agent/workflows/comprehensive-review.md` checklist before merge to `main`.

---

## Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6 (only if metrics below target)
7. Task 7
8. Task 8

## Exit Criteria

- [ ] All Katman 1-2-3 tests implemented via RED -> GREEN sequence
- [ ] Code-review pass completed after each layer
- [ ] 42-dispute replay report produced
- [ ] Success criteria validated with fresh evidence
- [ ] Deploy executed with safe-flag strategy
- [ ] Rollback commands validated and ready
