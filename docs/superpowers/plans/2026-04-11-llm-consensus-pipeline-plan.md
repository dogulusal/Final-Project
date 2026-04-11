# LLM Consensus Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an async LLM consensus pipeline so RSS news is ingested quickly with NB provisional category, then re-categorized in background with strict category-only LLM output and conflict handling.

**Architecture:** Keep RSS ingestion path fast and deterministic. Save NB provisional result immediately with `llmProvider='pending'`, then process pending items in a dedicated background worker that applies strict LLM categorization, consensus logic, retry policy, and status transitions. Preserve manual validation flow for conflicts and expose worker observability.

**Tech Stack:** Node.js, TypeScript, NestJS modules/services, Prisma ORM (PostgreSQL), Jest, existing Gemini/Ollama provider layer.

---

## Agency Skill/Workflow Gate (Mandatory Before Coding)

- [ ] Run @executing-plans for implementation orchestration.
- [ ] Run @verification-before-completion after each task.
- [ ] Run @test-driven-development for worker and scheduler behavior tests.
- [ ] Run @ai-prompt-engineer before finalizing prompt changes in consensus worker.
- [ ] Run workflow [.agent/workflows/rss-health-monitor.md](.agent/workflows/rss-health-monitor.md) after RSS scheduler edits.
- [ ] Run workflow [.agent/workflows/health-check.md](.agent/workflows/health-check.md) once worker is bootstrapped.
- [ ] Run workflow [.agent/workflows/rollback.md](.agent/workflows/rollback.md) and verify `LLM_CONSENSUS_ENABLED=false` scenario.
- [ ] If anomalies appear, run @systematic-debugging before extra edits.
- [ ] Optional but recommended: run @security-auditor for prompt injection and unsafe input handling in LLM path.

## File Map (Responsibilities)

### Create
- `backend/src/modules/llm/llm-consensus-worker.ts`: Background processor for pending/failed items, strict prompt application, consensus resolution, retries, and counters.
- `backend/src/modules/llm/llm-consensus-worker.singleton.ts`: Singleton bootstrap wrapper to start/stop worker cleanly from app startup.
- `backend/src/__tests__/llm-consensus-worker.test.ts`: Unit tests for strict category parsing, consensus update behavior, and retry/dead transitions.
- `backend/prisma/migrations/<timestamp>_add_llm_consensus_fields/migration.sql`: Schema migration for `nb_kategori_id`, `llm_kategori_id`, `llm_retry_count`, and indexes.

### Modify
- `backend/prisma/schema.prisma`: Add new fields to `Haber` model and keep mapping comments aligned.
- `backend/src/config/constants.ts`: Add `LLM_CONSENSUS_ENABLED`, `LLM_CONSENSUS_BATCH_SIZE`, `LLM_CONSENSUS_INTERVAL_MS`, `LLM_CONSENSUS_MAX_RETRIES`.
- `backend/src/modules/news/news.service.ts`: Extend `CreateNewsDto` and insert path to accept `nbKategoriId`, `llmKategoriId`, `llmRetryCount` defaults.
- `backend/src/modules/rss/rss-scheduler.ts`: Remove inline LLM override flow; persist NB provisional + pending marker.
- `backend/src/main.ts` (or active bootstrap file): Start consensus worker when enabled and stop gracefully on shutdown.
- `backend/src/modules/admin/admin.controller.ts` (conditional): Touch only if manual patch endpoint behavior conflicts with spec.
- `backend/src/__tests__/rss-scheduler.llm.test.ts`: Update expectations for pending-first ingestion path.
- `backend/src/__tests__/ml.service.test.ts` (if needed): Keep unchanged unless regression appears.

### Verify Existing (No Direct Logic Change Expected)
- `backend/src/modules/llm/llm.service.ts`: Reuse providers; do not change global generation contract unless tests force it.
- `backend/src/modules/llm/providers/gemini.provider.ts`
- `backend/src/modules/llm/providers/ollama.provider.ts`

---

## Chunk 1: Data Model + Ingestion Path Refactor

### Task 1: Add DB fields and migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_llm_consensus_fields/migration.sql`
- Test/Verify: Prisma validation output

- [ ] **Step 1: Write schema-level failing verification**
Run: `cd backend && npx prisma validate`
Expected before edit: valid current schema, but new fields absent.

- [ ] **Step 2: Update Prisma model**
Add to `Haber`:
- `nbKategoriId Int? @map("nb_kategori_id")`
- `llmKategoriId Int? @map("llm_kategori_id")`
- `llmRetryCount Int @default(0) @map("llm_retry_count")`
Keep comments aligned with spec semantics.

- [ ] **Step 3: Create migration SQL with explicit FK/index DDL**
Use exact SQL:
- `ALTER TABLE haberler ADD COLUMN nb_kategori_id INTEGER REFERENCES kategoriler(id);`
- `ALTER TABLE haberler ADD COLUMN llm_kategori_id INTEGER REFERENCES kategoriler(id);`
- `ALTER TABLE haberler ADD COLUMN llm_retry_count INTEGER NOT NULL DEFAULT 0;`
- `UPDATE haberler SET llm_provider = 'none';` (keep `durum` unchanged)
- `CREATE INDEX idx_haberler_llm_pending ON haberler(llm_provider) WHERE llm_provider = 'pending';`
- `CREATE INDEX idx_haberler_llm_failed ON haberler(llm_provider, llm_retry_count) WHERE llm_provider = 'failed';`

- [ ] **Step 4: Validate Prisma + migration**
Run:
- `cd backend && npx prisma validate`
- `cd backend && npx prisma migrate dev --name add_llm_consensus_fields`
Expected: migration applied locally without schema drift.

- [ ] **Step 5: Commit**
Run:
`git add backend/prisma/schema.prisma backend/prisma/migrations`
`git commit -m "feat(db): add llm consensus tracking fields"`

### Task 2: Add consensus config constants

**Files:**
- Modify: `backend/src/config/constants.ts`
- Create/Modify Test: `backend/src/__tests__/config.constants.test.ts`

- [ ] **Step 1: Write failing config constants test (unconditional)**
Create/update `backend/src/__tests__/config.constants.test.ts` with assertions that importing
`LLM_CONSENSUS_ENABLED`, `LLM_CONSENSUS_BATCH_SIZE`, `LLM_CONSENSUS_INTERVAL_MS`, `LLM_CONSENSUS_MAX_RETRIES`
returns expected default values.
Run: `cd backend && npm test -- config.constants.test.ts --runInBand`
Expected before implementation: FAIL (missing exports).

- [ ] **Step 2: Implement constants**
Add with explicit defaults:
- `LLM_CONSENSUS_ENABLED` (default: `true`)
- `LLM_CONSENSUS_BATCH_SIZE` (default: `10`)
- `LLM_CONSENSUS_INTERVAL_MS` (default: `30000`)
- `LLM_CONSENSUS_MAX_RETRIES` (default: `3`)
Use existing parsing helpers.

- [ ] **Step 3: Verify constants resolved**
Run: `cd backend && npm test -- --runInBand`
Expected: existing tests pass, no constant import errors.

- [ ] **Step 4: Commit**
Run:
`git add backend/src/config/constants.ts`
`git commit -m "feat(config): add llm consensus worker settings"`

### Task 3: Refactor RSS scheduler to pending-first model

**Files:**
- Modify: `backend/src/modules/rss/rss-scheduler.ts`
- Modify: `backend/src/modules/news/news.service.ts`
- Modify: `backend/src/__tests__/rss-scheduler.llm.test.ts`

- [ ] **Step 1: Write failing tests for new ingestion semantics**
Add/adjust tests to assert:
- Scheduler writes `llmProvider='pending'` when consensus enabled
- Scheduler writes `llmProvider='none'` when `LLM_CONSENSUS_ENABLED=false`
- `kategoriId` and `nbKategoriId` are same NB provisional value
- No inline LLM override in scheduler path
- `durum='ham'`, `kategoriDogrulandi=false` at ingest time.

- [ ] **Step 2: Extend CreateNewsDto + insert path**
Allow `nbKategoriId`, `llmKategoriId`, and optional `llmRetryCount` handling; preserve dedup and cache behavior.

- [ ] **Step 3: Remove scheduler inline LLM enrichment/override block**
Keep ML categorize + sentiment calls.
Persist provisional fields exactly as spec.

- [ ] **Step 4: Run targeted tests**
Run:
- `cd backend && npm test -- rss-scheduler.llm.test.ts --runInBand`
Expected: PASS with pending-first assertions.

- [ ] **Step 5: Run RSS health monitor workflow**
Execute workflow [.agent/workflows/rss-health-monitor.md](.agent/workflows/rss-health-monitor.md) and capture findings in commit/body note.

- [ ] **Step 6: Commit**
Run:
`git add backend/src/modules/rss/rss-scheduler.ts backend/src/modules/news/news.service.ts backend/src/__tests__/rss-scheduler.llm.test.ts`
`git commit -m "refactor(rss): switch to pending-first consensus ingestion"`

---

## Chunk 2: Worker + API + Verification + Rollback

### Task 4: Implement strict category-only consensus worker

**Files:**
- Create: `backend/src/modules/llm/llm-consensus-worker.ts`
- Create: `backend/src/modules/llm/llm-consensus-worker.singleton.ts`
- Create/Modify: `backend/src/__tests__/llm-consensus-worker.test.ts`

- [ ] **Step 1: Write failing worker unit tests (TDD first)**
Cover:
- strict parser accepts only: `Siyaset|Ekonomi|Teknoloji|Spor|Sağlık|Dünya|Genel`
- invalid output => `llmKategoriId=null`, NB category remains final
- consensus (`nb==llm`) => `durum='hazir'`, `kategoriDogrulandi=true`
- conflict (`nb!=llm`) => final `kategoriId=llm`, `durum='ham'`
- failed retry increments `llmRetryCount` and transitions to `dead` at max retries.

- [ ] **Step 2: Implement worker class (category-only contract)**
Core methods:
- start/stop/tick/processBatch
- strict prompt template and strict output normalizer
- pending + failed query with retry threshold
- provider/failure state updates
- counters for status endpoint
- category fields only update (`kategoriId`, `nbKategoriId`, `llmKategoriId`, `kategoriDogrulandi`, `durum`, `llmProvider`, `llmRetryCount`)
- do NOT update enrichment fields (`baslik`, `icerik`, `meta_aciklama`, `sentiment`) in this worker.

- [ ] **Step 3: Add singleton bootstrap wrapper**
Expose `startLlmConsensusWorker()` and `stopLlmConsensusWorker()` to keep startup wiring simple and testable.

- [ ] **Step 4: Run worker tests**
Run: `cd backend && npm test -- llm-consensus-worker.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 5: Run AI prompt review skill gate**
Run @ai-prompt-engineer on strict prompt text and capture required adjustments before merging.

- [ ] **Step 6: Commit**
Run:
`git add backend/src/modules/llm/llm-consensus-worker.ts backend/src/modules/llm/llm-consensus-worker.singleton.ts backend/src/__tests__/llm-consensus-worker.test.ts`
`git commit -m "feat(llm): add async consensus worker with strict category parser"`

### Task 5: Wire startup + status endpoint

**Files:**
- Modify: `backend/src/main.ts`
- Modify: `backend/src/modules/llm/llm.controller.ts`
- Create Test: `backend/src/__tests__/llm-consensus-status.test.ts`

- [ ] **Step 1: Write failing API/status test**
Create `backend/src/__tests__/llm-consensus-status.test.ts` expecting
`GET /api/llm/consensus/status` to return worker counters and pending count shape.

- [ ] **Step 2: Wire worker lifecycle**
Start worker when `LLM_CONSENSUS_ENABLED=true`; stop on shutdown signals.

- [ ] **Step 3: Implement status endpoint**
Return:
- running flags
- pending count
- today processed/consensus/conflict/failed
- quota usage summary.

- [ ] **Step 4: Run tests**
Run:
- `cd backend && npm test -- --runInBand`
Expected: all tests green.

- [ ] **Step 5: Commit**
Run:
`git add backend/src/main.ts backend/src/modules/llm/llm.controller.ts backend/src/__tests__/llm-consensus-status.test.ts`
`git commit -m "feat(api): expose llm consensus worker status and lifecycle"`

### Task 6: Validation flow alignment with consensus spec

**Files:**
- Modify: `backend/src/modules/ml/ml.controller.ts` (contains `/validate-batch` and `/validate-correction`)
- Modify (if needed): `backend/src/modules/admin/admin.controller.ts` (manual category patch behavior)
- Test: `backend/src/__tests__/ml.validate-flow.test.ts`

- [ ] **Step 1: Write failing behavior tests for validation actions**
Create/update `backend/src/__tests__/ml.validate-flow.test.ts` and assert:
- confirm path marks `kategoriDogrulandi=true`, `durum='hazir'`
- correct path updates `kategoriId`, marks verified+hazir, writes `manuel_validasyonlar`
- skip path keeps `durum='ham'`.

- [ ] **Step 2: Implement minimal controller/service changes**
Update `backend/src/modules/ml/ml.controller.ts` first.
Only touch `backend/src/modules/admin/admin.controller.ts` if behavior mismatch remains for manual patch endpoints.

- [ ] **Step 3: Run targeted tests**
Run: `cd backend && npm test -- ml.validate-flow.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 4: Commit**
Run:
`git add backend/src/modules/ml/ml.controller.ts backend/src/__tests__/ml.validate-flow.test.ts`
If `backend/src/modules/admin/admin.controller.ts` changed, also run:
`git add backend/src/modules/admin/admin.controller.ts`
Then commit:
`git commit -m "fix(validation): align confirm-correct-skip flow with consensus spec"`

### Task 7: End-to-end verification and operational gates

**Files:**
- Modify: only if bugs found during verification
- Artifacts: test/log outputs in existing repo conventions

- [ ] **Step 1: Smoke test with 5 article sample (explicit acceptance)**
Run local app and process 5 pending items.
Then run SQL check:
`SELECT id, kategori_id, nb_kategori_id, llm_kategori_id, durum, llm_provider, kategori_dogrulandi, llm_retry_count FROM haberler WHERE llm_provider IN ('gemini','ollama','failed','dead') ORDER BY yayinlanma_tarihi DESC LIMIT 5;`
Acceptance:
- at least 1 row where `nb_kategori_id = llm_kategori_id` and `durum='hazir'` and `kategori_dogrulandi=true`
- at least 1 row where `nb_kategori_id <> llm_kategori_id` and `durum='ham'` and `kategori_dogrulandi=false`.

- [ ] **Step 2: Run health-check workflow**
Execute workflow [.agent/workflows/health-check.md](.agent/workflows/health-check.md).
Expected: backend healthy, worker active, pending queue draining.

- [ ] **Step 3: Run rollback workflow**
Execute workflow [.agent/workflows/rollback.md](.agent/workflows/rollback.md):
- set `LLM_CONSENSUS_ENABLED=false`
- verify scheduler writes `llmProvider='none'`
- verify existing `pending` handling follows rollback plan.

- [ ] **Step 4: Run security audit skill (recommended)**
Run @security-auditor for prompt injection vectors and log any required sanitization fixes.

- [ ] **Step 5: Run verification-before-completion gate**
Run @verification-before-completion with explicit checklist from this plan.

- [ ] **Step 6: Final commit (if needed) + push**
Run:
`git add -A`
`git commit -m "test: complete llm consensus pipeline verification and rollback checks"`
`git push origin feature/tokenizer-unicode-aware`

---

## Definition of Done

- [ ] New DB fields exist and migration is applied locally.
- [ ] RSS scheduler saves NB provisional with pending marker and no inline LLM override.
- [ ] Consensus worker processes pending/failed records with strict category-only prompt policy.
- [ ] Invalid LLM category output is safely ignored (`llmKategoriId=null`, NB final remains).
- [ ] Retry policy transitions failed records to dead at max retry count.
- [ ] Worker status endpoint returns expected payload.
- [ ] Admin validate actions match confirm/correct/skip spec behavior.
- [ ] Tests pass and health/rollback workflows are verified.

## Suggested Commit Sequence

1. `feat(db): add llm consensus tracking fields`
2. `feat(config): add llm consensus worker settings`
3. `refactor(rss): switch to pending-first consensus ingestion`
4. `feat(llm): add async consensus worker with strict category parser`
5. `feat(api): expose llm consensus worker status and lifecycle`
6. `fix(validation): align confirm-correct-skip flow with consensus spec`
7. `test: complete llm consensus pipeline verification and rollback checks`

## Notes for Executor

- Keep files focused; do not grow scheduler further.
- Reuse existing provider abstractions; avoid adding a second LLM stack.
- Avoid schema churn beyond agreed fields.
- If implementation uncovers hidden dependency in frontend/admin UI, capture it in a separate follow-up spec instead of widening this scope.
