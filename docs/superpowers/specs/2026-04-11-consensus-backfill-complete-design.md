# Consensus Backfill & Full Coverage — Design Spec

**Date:** 2026-04-11  
**Status:** DRAFT  
**Branch:** feature/tokenizer-unicode-aware  
**Author:** brainstorming session  
**Scope:** Complete news verification + ML accuracy boost + frontend unlimited scroll

---

## 1. Problem Statement

### Current State
- Total news: 2,021
- Verified (kategoriDogrulandi=true): 915 (**45%**)
- Unverified: 1,106 (**55%**)
- ML accuracy: **75.6%** (needs ≥80% for production quality)
- Frontend coverage: Limited to hardcoded limits per page (500-1500 range)
- Ham (unprocessed): 73 articles
- LLM provider='none': 372 articles (old, pre-LLM)

### Root Causes
1. **Verification gap:** 1,106 articles never verified → low confidence in dataset
2. **Category imbalance risk:** Previous backfill (4 Apr) caused Siyaset dominance → accuracy dropped 5.2pp
3. **Frontend fragmentation:** Different pages have different limits → user can't access all content
4. **No dual-validation:** Single-model (NB) categorization for older articles → potential systematic errors

### Success Criteria (Project "Level Up")
| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Verified ratio | 45% | **≥95%** | Dual consensus + manual queue |
| ML accuracy | 75.6% | **≥80%** | Larger, cleaner training set |
| Dispute queue | — | **0 pending** | Manual resolution after consensus |
| Ham articles | 73 | **≤20** | Consensus auto-processes |
| Frontend reach | Variable per page | **All 2,021** | Infinite scroll pagination |

---

## 2. Seçilen Yaklaşım: Dalga Dalga Consensus (Wave-by-Wave)

### Why This Approach?

**Rejected alternatives:**
- **Option B (Big Bang):** Process all 1,106 at once. Fastest but high risk of category collapse (same error as 4 Apr incident). No granular rollback.
- **Option C (Confidence Stratified):** Auto-accept NB confidence >85%. Misses high-risk cases where NB is wrongly confident.

**Chosen: Option A (Wave-by-Wave)**
- 6 waves × 200 articles each (33-day spread for operability)
- Each wave: consensus → retrain → evaluate → check 3pp guard
- Rolling rollback if accuracy drops >3pp
- Dispute queue for NB ≠ LLM cases → manual resolution
- Safe, auditable, reversible

---

## 3. Architecture & Components

### 3.1 Database Additions

#### New Table: `dispute_queue`
```sql
CREATE TABLE dispute_queue (
  id              SERIAL PRIMARY KEY,
  haber_id        INT NOT NULL UNIQUE REFERENCES haber(id),
  nb_kategori_id  INT REFERENCES kategori(id),
  llm_kategori_id INT REFERENCES kategori(id),
  nb_guven_skoru  FLOAT,
  llm_guven_skoru FLOAT,
  batch_number    INT,
  durum           VARCHAR(20) DEFAULT 'bekliyor',  -- bekliyor | cozuldu | atildi
  admin_karar_kategori_id INT REFERENCES kategori(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  resolved_at     TIMESTAMP,
  resolved_by     VARCHAR(100)
);
```
**Purpose:** Store NB ↔ LLM disagreements for manual resolution.

#### New Table: `batch_audit_log`
```sql
CREATE TABLE batch_audit_log (
  id                      SERIAL PRIMARY KEY,
  batch_number            INT NOT NULL,
  phase                   VARCHAR(10),  -- 'pre' or 'post'
  timestamp               TIMESTAMP DEFAULT NOW(),
  haber_count             INT,
  kategori_distribution   JSONB,  -- {"Gündem": 45, "Spor": 120, ...}
  category_dominance_pct  FLOAT,  -- highest category %
  imbalance_ratio         FLOAT,  -- max % / min %
  ml_accuracy             FLOAT,
  train_size              INT,
  test_size               INT,
  status                  VARCHAR(20),  -- 'in_progress' | 'success' | 'rolled_back'
  notes                   TEXT,
  
  UNIQUE(batch_number, phase)
);
```
**Purpose:** Audit trail for rollback decisions, category distribution tracking.

### 3.2 Backend Scripts

#### Script 1: `backend/src/scripts/consensus-backfill.ts`
**Purpose:** Core consensus engine for a single batch.

**Arguments:**
```bash
npx ts-node src/scripts/consensus-backfill.ts \
  --batch-size=200 \
  --start-from=0 \
  --dry-run \
  --gemini-limit=100 \
  --ollama-limit=25
```

**Flow:**
1. Select 200 unverified articles (oldest first, ordered by created_at)
2. For each article:
   - Call NB classifier (in-memory, instant)
   - Call LLM (Gemini primary, Ollama fallback, 1.5s delay between calls)
   - Compare results:
     - **CONSENSUS:** NB == LLM category → insert into haber with `kategoriDogrulandi=true`
     - **DISPUTE:** NB ≠ LLM category → insert into dispute_queue with both scores
3. Log counts: consensus n, dispute m
4. Return: { processed: 200, consensus: ~140, dispute: ~60 }

#### Script 2: `backend/src/scripts/run-consensus-waves.ts`
**Purpose:** Orchestrate all 6 waves with retry logic and rollback.

**Arguments:**
```bash
npx ts-node src/scripts/run-consensus-waves.ts \
  --waves=6 \
  --batch-size=200 \
  --start-wave=1 \
  --auto \
  --dry-run
```

**Flow for each wave:**
```
Pre-flight
├─ Create pre_batch_N snapshot: backup-db.sh → backups/pre_batch_N_TIMESTAMP.dump.gz
├─ Snapshot category distribution → batch_audit_log(wave_n, phase='pre')
└─ Confirm: "Ready to process 200 articles? (y/n)"

Process
├─ consensus-backfill.ts --batch-size=200 --start-from=OFFSET
├─ Verify counts match (processed, consensus, dispute)
└─ Log to batch_audit_log

Train & Evaluate
├─ POST /api/ml/train?useDb=true
  └─ Model retrains on all verified articles (now ~915 + ~140 consensus)
├─ POST /api/ml/evaluate → get new accuracy
├─ Compare to previous wave's accuracy:
   └─ If accuracy drop > 3pp → ROLLBACK (see Section 3.5)
   └─ If accuracy drop ≤ 3pp → CONTINUE
└─ Log final state → batch_audit_log(wave_n, phase='post')

Next Wave?
└─ If --auto: proceed to wave N+1
   Else: pause, show results, ask confirmation
```

### 3.3 Rollback Mechanism (Safety Net)

**Trigger:** Accuracy drops >3pp after wave N

**Procedure:**
1. Restore DB from `backups/pre_batch_N_TIMESTAMP.dump.gz`
2. Restore ML model from `model_state` table (previous wave's version)
3. Clean up: delete dispute_queue entries created in failed wave
4. Mark in batch_audit_log: status='rolled_back', notes="Accuracy: X% → Y% (drop >3pp)"
5. Notify operator: "Wave N rolled back. Investigate dispute queue. Resume from wave N?"

**Example:**
```
Wave 3 pre-accuracy: 76.2%
Wave 3 post-accuracy: 73.1% (drop: 3.1pp > 3pp threshold)
→ ROLLBACK triggered
→ DB restored to pre_batch_3
→ Manual review: check new disputes from wave 3
→ Resolve blocking disputes manually
→ Retry wave 3 with --start-wave=3
```

### 3.4 Dispute Resolution

**Manual workflow (for ~300-400 disputed articles):**

1. **CLI tool:** `backend/src/scripts/resolve-disputes-cli.ts`
   ```bash
   npx ts-node src/scripts/resolve-disputes-cli.ts --batch=1
   ```
   Shows batches of 10 disputes, operator chooses correct category, updates haber + dispute_queue

2. **API endpoint:** `PUT /api/ml/resolve-disputes-batch` (admin-protected)
   ```json
   {
     "decisions": [
       { "disputeId": 123, "chosenKategoriId": 5, "reason": "LLM correct" },
       { "disputeId": 124, "chosenKategoriId": 3, "reason": "NB correct" }
     ]
   }
   ```

3. **Admin panel:** `GET /api/admin/disputes` + `GET /api/admin/disputes/:id`
   - Lists pending disputes with NB vs LLM side-by-side
   - Operator picks correct category on UI
   - Auto-updates haber + updates dispute_queue

---

## 4. Wave Schedule & Projections

### Wave Execution Plan

| Wave | Articles | Start offset | Expected consensus | Expected disputes | Cumulative verified |
|---|---|---|---|---|---|
| 1 | 200 | 0 | ~140 (70%) | ~60 (30%) | ~1,055 (52%) |
| 2 | 200 | 200 | ~140 | ~60 | ~1,195 (59%) |
| 3 | 200 | 400 | ~140 | ~60 | ~1,335 (66%) |
| 4 | 200 | 600 | ~140 | ~60 | ~1,475 (73%) |
| 5 | 200 | 800 | ~140 | ~60 | ~1,615 (80%) |
| 6 | 106 | 1000 | ~74 | ~32 | ~1,689 (84%) |
| **Manual** | ~330 disputes | — | ~330 | 0 | **~2,019 (≥99%)** |

### Timeline Estimate

| Phase | Duration | Notes |
|---|---|---|
| Prep (TDay 0) | 2h | DB backup, script testing, dry-run wave 1 |
| Waves 1-3 (Day 1-2) | ~1.5h/wave × 3 + retrain | 600 articles consensus, checkpoints every 30min |
| Waves 4-6 (Day 2-3) | ~1.5h/wave × 3 + retrain | 506 articles consensus |
| Dispute resolution (Day 3-4) | ~4-6h | Manual CLI or API (30sec per dispute × 330 = 3h) |
| Frontend changes (Day 4) | 2-3h | Infinite scroll implementation + testing |
| Final retrain & validate (Day 4) | 1h | Full model on 2,000+ verified articles |
| **Total: ~4-5 calendar days** | | Can be parallelized; peaks at ~2h/wave |

### Category Imbalance Guards (In-Wave Monitoring)

For each wave, category distribution before/after is checked:

```
Pre-wave check (batch_audit_log phase='pre')
  → If any category > 50% → HARD STOP (Guard2 active)
  → If any category 2.5x higher than lowest → WARNING (log only)

Post-wave check (batch_audit_log phase='post')
  → If drop-to-imbalance: prev 30%, now 35% → CONTINUE (minor)
  → If jump-to-imbalance: prev 25%, now 55% → ROLLBACK (Guard2 hard stop)
```

---

## 5. Frontend — Infinite Scroll & Full Coverage

### 5.1 Backend Pagina Limit Guard

**In** `backend/src/modules/news/news.controller.ts`:
- Add maximum limit enforcer: `const safeLimit = Math.min(limit, 100);`
- This ensures no single API call fetches >100 articles (performance protection)
- Default still 20 (unchanged)

### 5.2 Frontend Changes

#### Change 1: Main Page (`frontend/src/app/page.tsx`)
**Current:** Loads 20 articles, manual pagination
**New:** 
- Initial load: 20 articles
- On scroll-to-bottom: auto-fetch next 20
- Uses `IntersectionObserver` (not scroll listener → better performance)
- Displays total pages remaining: "Showing 20-40 of 2,021"

#### Change 2: Category Page (`frontend/src/app/kategoriler/[slug]/page.tsx`)
**Current:** Fixed limit=100 per category
**New:**
- Initial load: 20 articles
- Infinite scroll: +20 each scroll
- For categories with <100 articles: stops at natural end

#### Change 3: All Categories Overview (`frontend/src/app/kategoriler/page.tsx`)
**Current:** Loads all 1,500 articles at once (hardcoded)
**New:**
- Initial load: 20 articles (paginated)
- Infinite scroll: +20 each
- Respects API max limit of 100/call

### 5.3 Performance Impact

| Metric | Before | After | Δ |
|---|---|---|---|
| Initial page load size | 20-100 articles (varies) | 20 articles | ✓ Smaller |
| API call size | 20-1500 (inconsistent) | Consistent (20-100) | ✓ Predictable |
| Cache hit ratio | Low (large payloads) | High (repeated 20-article pages) | ✓ Better |
| User's time-to-see-content | ~1.5s | ~1.2s | ✓ Faster |
| Total articles reachable | Limited by page logic | All 2,021+ | ✓ Complete |

### 5.4 No Changes (Out of Scope)
- Sitemap endpoint (`/sitemap.ts` still uses limit=1000 for SEO)
- Backend sorting/filtering logic
- Cache middleware TTL (stays 60s)
- Social features or LLM pipeline

---

## 6. Rollback Strategy & Disaster Recovery

### 6.1 Single-Wave Rollback
If wave N fails accuracy guard (>3pp drop):
```
1. Restore DB: docker exec postgres pg_restore ... < backups/pre_batch_N.dump.gz
2. Restore ML: reload model_state from wave N-1
3. Truncate: DELETE FROM dispatch_queue WHERE batch_number = N
4. Retry: --start-wave=N (re-process same 200 articles)
```
**Time to recover:** ~5 minutes

### 6.2 Multi-Wave Rollback (Disaster)
If waves 1-3 cause unrecoverable distribution skew:
```
1. Restore full DB from backups/pre_batch_1.dump.gz
2. Clear all: TRUNCATE dispute_queue; TRUNCATE batch_audit_log;
3. Restart: --waves=6 --start-wave=1 (run again from zero)
```
**Decision point:** If wave 3 fails and manual investigation reveals systemic issue (e.g., LLM API behavior changed), restart entire consensus process with adjustments.
**Time to reset:** ~10 minutes

### 6.3 Backups Kept
- Pre-backfill master snapshot: `backups/pre_consensus_2026-04-11.dump.gz`
- Per-wave snapshots: `backups/pre_batch_1_20260411_HHMM.dump.gz` through `pre_batch_6_*.dump.gz`
- Retention: 14 days (delete older)

---

## 7. Success Metrics & Completion Checklist

### Verification (End of Backfill)
- [ ] Verified articles: ≥1,920 (≥95%)
- [ ] Dispute queue: 0 pending items
- [ ] batch_audit_log: 12 entries (6 pre + 6 post phases)
- [ ] No rolled_back entries in batch_audit_log (all "success")

### ML Quality (After Full Retrain)
- [ ] Model accuracy: ≥80%
- [ ] No category >50% dominance
- [ ] All categories represented (min 50 verified articles per category)
- [ ] Model version: v51+ (up from v50)

### Frontend (After Changes)
- [ ] Main page loads in <1.5s
- [ ] Infinite scroll works (20 articles loaded, auto-fetches next on bottom)
- [ ] All 2,021 articles reachable (scrollable to end)
- [ ] Category pages smooth (no lag on scroll)

### Operational
- [ ] All scripts committed to git
- [ ] dispute_queue + batch_audit_log tables created + tested
- [ ] Admin endpoints live and tested
- [ ] Rollback procedures documented and dry-run tested

---

## 8. Post-Completion: Standing Rules

**These rules persist after backfill:**

1. **New articles auto-routing:**
   - RSS scheduler → NB categorize → LLM consensus worker (existing)
   - If consensus: auto-verify (kategoriDogrulandi=true)
   - If dispute: human review (stays ham until resolved)

2. **Weekly Dispute Audit:**
   - Every Monday: check `SELECT count(*) FROM dispute_queue WHERE durum='bekliyor'`
   - If >50 pending: schedule resolution session

3. **Monthly Accuracy Check:**
   - First Friday of month: run `POST /api/ml/evaluate` on production model
   - If accuracy <77%: flag for investigation (check batch_audit_log for anomalies)

4. **Quarterly Full Census:**
   - Re-run full `loadAndTrainFromDB` with all verified articles
   - Compare against model_state version from previous quarter
   - Document in batch_audit_log for trend analysis

---

## 9. Known Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Category imbalance (like 4 Apr) | Medium | High (accuracy drop) | 3-wave guard checks, rollback at 3pp threshold |
| LLM API quota exceeded | Medium | Medium (wave stalls) | Gemini limit=100/day, Ollama fallback, easy pause/resume |
| DB restore failure | Low | Critical | Pre-wave snapshots stored, restore tested pre-backfill |
| Manual dispute resolution backlog | Medium | Low (low risk, just slower) | CLI tool + batch API for fast resolution |
| Frontend infinite scroll bugs | Low | Low (UX only) | Tested with mock paginated API before commit |

---

## 10. Future Enhancements (Out of Scope)

- Dynamic batch sizing based on dispute ratio
- ML model reweighting per category (only if accuracy plateaus)
- A/B test: LLM1 (Gemini) vs LLM2 (new provider) consensus
- Sentiment analysis verification (similar dual-verify pipeline)

---

**READY FOR IMPLEMENTATION AFTER APPROVAL**
