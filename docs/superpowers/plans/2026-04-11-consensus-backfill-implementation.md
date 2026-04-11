# Consensus Backfill & Full Coverage — Implementation Plan

> **For agentic workers:** REQUIRED: Use `superpowers:executing-plans` + `superpowers:verification-before-completion` + `superpowers:dataset-quality-guard` skills. Steps use checkbox (`- [ ]`) syntax for tracking progress.

**Goal:** Complete news verification (45% → ≥95%), boost ML accuracy (75.6% → ≥80%), and enable full article coverage via infinite scroll.

**Approach:** 6 waves of 200 articles (6 days total), dual NB+LLM consensus, manual dispute resolution, granular rollback (3pp guard), frontend infinite scroll.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Express.js, Gemini + Ollama LLMs, Next.js, IntersectionObserver API.

---

## Architecture: File Structure

### New Files
- `backend/src/scripts/consensus-backfill.ts` — Single-wave consensus engine (batch processor)
- `backend/src/scripts/run-consensus-waves.ts` — Master orchestrator (6-wave pipeline)
- `backend/src/scripts/resolve-disputes-cli.ts` — CLI for manual dispute resolution
- `backend/prisma/migrations/20260411_add_dispute_audit_tables.ts` — DB schema migration
- `.locks/dispute_resolution_in_progress` — Concurrency lock file (created by scripts)

### Modified Files
- `backend/prisma/schema.prisma` — Add `dispute_queue` and `batch_audit_log` models
- `backend/src/modules/news/news.controller.ts` — Add max limit guard (line ~40)
- `backend/src/modules/ml/ml.controller.ts` — Add `PUT /resolve-disputes-batch` endpoint
- `frontend/src/app/page.tsx` — Infinite scroll with IntersectionObserver
- `frontend/src/app/kategoriler/[slug]/page.tsx` — Infinite scroll per category
- `frontend/src/app/kategoriler/page.tsx` — Infinite scroll for all categories overview

### Test Files
- `backend/src/scripts/consensus-backfill.test.ts` — Unit tests for batch processor
- `backend/src/scripts/run-consensus-waves.test.ts` — Orchestration logic tests

---

## Task 1: Database Schema & Migrations

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260411_add_dispute_audit_tables.ts`

### Steps

- [ ] **1.1: Add `dispute_queue` model to schema.prisma**
  - After `Haber` model, add:
  ```prisma
  model DisputeQueue {
    id                  Int       @id @default(autoincrement())
    haberId             Int       @unique
    haber               Haber     @relation(fields: [haberId], references: [id], onDelete: Cascade)
    nbKategoriId        Int?
    nbKategori          Kategori? @relation("nb", fields: [nbKategoriId], references: [id])
    llmKategoriId       Int?
    llmKategori         Kategori? @relation("llm", fields: [llmKategoriId], references: [id])
    nbGuvenSkoru        Float?
    llmGuvenSkoru       Float?
    batchNumber         Int
    durum               String    @default("bekliyor") // bekliyor | cozuldu | atildi
    adminKararKategoriId Int?
    adminKararKategori  Kategori? @relation("admin_karar", fields: [adminKararKategoriId], references: [id])
    createdAt           DateTime  @default(now()) @db.Timestamptz
    resolvedAt          DateTime? @db.Timestamptz
    resolvedBy          String?
    
    @@map("dispute_queue")
  }
  ```

- [ ] **1.2: Add `batch_audit_log` model to schema.prisma**
  - After `DisputeQueue`, add:
  ```prisma
  model BatchAuditLog {
    id                     Int    @id @default(autoincrement())
    batchNumber            Int
    phase                  String // 'pre' or 'post'
    timestamp              DateTime @default(now()) @db.Timestamptz
    haberCount             Int?
    kategoriDistribution   Json? // {"Gündem": 45, "Spor": 120, ...}
    categoryDominancePct   Float?
    imbalanceRatio         Float?
    mlAccuracy             Float?
    trainSize              Int?
    testSize               Int?
    status                 String // 'in_progress' | 'success' | 'rolled_back'
    notes                  String?
    
    @@unique([batchNumber, phase])
    @@map("batch_audit_log")
  }
  ```

- [ ] **1.3: Run Prisma schema validation**
  ```bash
  cd backend && npx prisma validate
  ```

- [ ] **1.4: Create migration file**
  ```bash
  cd backend && npx prisma migrate dev --name add_dispute_audit_tables
  ```
  - Confirms new tables created in PostgreSQL
  - Auto-generates `schema.prisma` lockfile

- [ ] **1.5: Commit schema changes**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/ && \
  git commit -m "schema: add dispute_queue and batch_audit_log tables"
  ```

---

## Task 2: Backend Script — Consensus Backfill (Single Wave)

**Files:**
- Create: `backend/src/scripts/consensus-backfill.ts`
- Create: `backend/src/scripts/consensus-backfill.test.ts`

### Steps

- [ ] **2.1: Create test file with failing tests (TDD)**
  - File: `backend/src/scripts/consensus-backfill.test.ts`
  - Tests (all failing initially):
    ```typescript
    describe('consensus-backfill', () => {
      it('should process 200 articles with NB+LLM consensus', async () => {
        // Mock NB + LLM responses
        // Expect ~70% consensus, ~30% dispute
        // Verify atomic transaction (all-or-nothing)
      });
      
      it('should handle LLM fallback: Gemini timeout → Ollama', async () => {
        // Mock Gemini 5s timeout
        // Expect fallback to Ollama 10s
        // Verify result saved with llmProvider='ollama'
      });
      
      it('should mark LLM dead after 3 retries', async () => {
        // Mock both Gemini and Ollama fail 3x
        // Expect llmProvider='dead'
      });
      
      it('should rollback entire batch on NB crash', async () => {
        // Mock NB classifier crash mid-batch
        // Expect no partial updates (transaction rollback)
      });
    });
    ```

- [ ] **2.2: Implement `consensus-backfill.ts` main structure**
  - Import: Prisma, NB classifier, LLM providers, chalk for logging
  - Export function: `async function runConsensusBackfill(opts: ConsensusBackfillOptions)`
  - Options interface:
    ```typescript
    interface ConsensusBackfillOptions {
      batchSize: number;
      startFrom: number;
      dryRun: boolean;
      geminiLimit: number;
      ollamaLimit: number;
    }
    ```

- [ ] **2.3: Implement batch selection logic**
  - Query DB for unverified articles:
    ```typescript
    const articles = await prisma.haber.findMany({
      where: { kategoriDogrulandi: false },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // Deterministic
      skip: startFrom,
      take: batchSize,
      include: { kategori: true }
    });
    ```
  - Validate: batch must contain exactly `batchSize` articles (error if <batchSize found)

- [ ] **2.4: Implement NB categorization loop**
  - For each article:
    - Extract `title + content`
    - Call NB classifier: `const nbResult = nbService.categorize(text)`
    - Log: `"[NB] Article 123: ${nbResult.category} (${nbResult.confidence}%)"`

- [ ] **2.5: Implement LLM consensus loop (with fallback & rate limiting)**
  - For each article:
    - Call Gemini with 5s timeout:
      ```typescript
      let llmResult = null;
      let llmProvider = 'gemini';
      try {
        llmResult = await geminiProvider.categorize(text, { timeout: 5000 });
      } catch (geminiErr) {
        if (geminiErr.code === 'TIMEOUT' || geminiErr.status === 429) {
          llmResult = await ollamaProvider.categorize(text, { timeout: 10000 });
          llmProvider = 'ollama';
        } else {
          article.llmProvider = 'dead'; // Out of retries
          continue;
        }
      }
      ```
    - Rate limit: 1.5s delay between Gemini calls

- [ ] **2.6: Implement consensus decision logic**
  - If `nbResult.category === llmResult.category`:
    - Mark CONSENSUS
  - Else:
    - Mark DISPUTE
  - Log disagreements:
    ```typescript
    console.log(`🔍 DISPUTE 🔍 NB=${nbResult.category} LLM=${llmResult.category} haber_id=${article.id}`);
    ```

- [ ] **2.7: Implement atomic batch transaction**
  - Wrap all updates in single Prisma transaction:
    ```typescript
    await prisma.$transaction(async (tx) => {
      // Update consensus articles
      // Insert dispute_queue entries
      // If any fails: entire tx rolls back
    });
    ```

- [ ] **2.8: Implement error recovery**
  - On transaction failure:
    - Log error to console + file: `./consensus-backfill-errors.log`
    - Return early: `{ processed: 0, consensus: 0, dispute: 0, error: error.message }`
    - Operator retries with `--start-from=N`

- [ ] **2.9: Implement logging to batch_audit_log**
  - After successful batch:
    - Create `batch_audit_log` entry:
      ```typescript
      await prisma.batchAuditLog.create({
        data: {
          batchNumber: waveNumber,
          phase: 'post',
          haberCount: processed,
          status: 'in_progress', // Will update when retrain completes
          notes: `Consensus: ${consensusCount}, Disputes: ${disputeCount}`
        }
      });
      ```

- [ ] **2.10: Run tests**
  ```bash
  cd backend && npm test -- consensus-backfill.test.ts
  ```
  - All tests must pass

- [ ] **2.11: CLI entry point**
  - Add main block:
    ```typescript
    if (require.main === module) {
      const args = minimist(process.argv.slice(2));
      runConsensusBackfill({
        batchSize: parseInt(args['batch-size'] || '200'),
        startFrom: parseInt(args['start-from'] || '0'),
        dryRun: args['dry-run'] === true,
        geminiLimit: parseInt(args['gemini-limit'] || '100'),
        ollamaLimit: parseInt(args['ollama-limit'] || '25')
      }).then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
      });
    }
    ```

- [ ] **2.12: Commit**
  ```bash
  git add backend/src/scripts/consensus-backfill.ts backend/src/scripts/consensus-backfill.test.ts && \
  git commit -m "feat: consensus-backfill script with NB+LLM consensus and atomic transaction"
  ```

---

## Task 3: Backend Script — Wave Orchestrator

**Files:**
- Create: `backend/src/scripts/run-consensus-waves.ts`
- Create: `backend/src/scripts/run-consensus-waves.test.ts`

### Steps

- [ ] **3.1: Create test file (TDD)**
  - Tests (failing initially):
    ```typescript
    describe('run-consensus-waves', () => {
      it('should orchestrate 6 waves sequentially', async () => {
        // Mock consensus-backfill success
        // Verify batch_audit_log has 12 entries (6 pre + 6 post)
      });
      
      it('should trigger rollback if accuracy drops >3pp', async () => {
        // Mock wave 2: accuracy 76.2% → 73.0% (drop 3.2pp)
        // Expect: DB restore, dispute cleanup, status='rolled_back'
      });
      
      it('should pause between waves if --auto not set', async () => {
        // Mock user input "y" to proceed
        // Verify next wave starts
      });
    });
    ```

- [ ] **3.2: Implement main orchestration loop**
  - Structure:
    ```typescript
    async function runWaves(opts: WaveOrchestrationOptions) {
      for (let waveNum = startWave; waveNum <= totalWaves; waveNum++) {
        console.log(`\n=== Wave ${waveNum} ===`);
        
        // Pre-flight
        // Process
        // Train
        // Evaluate
        // Check guard
        // If failed: rollback
        // If passed: continue
      }
    }
    ```

- [ ] **3.3: Implement pre-flight phase**
  - Create DB backup:
    ```bash
    ./backend/scripts/backup-db.sh pre_batch_${waveNum}
    ```
  - Snapshot category distribution:
    ```typescript
    const distribution = await prisma.haber.groupBy({
      by: ['kategoriId'],
      where: { kategoriDogrulandi: true },
      _count: true
    });
    
    await prisma.batchAuditLog.create({
      data: {
        batchNumber: waveNum,
        phase: 'pre',
        kategoriDistribution: distribution as any,
        status: 'in_progress'
      }
    });
    ```
  - Guard checks (hard stops):
    - Any category >50% → STOP
    - Any category 2.5x dominant → WARNING only

- [ ] **3.4: Implement process phase**
  - Call `consensus-backfill.ts`:
    ```typescript
    const result = await runConsensusBackfill({
      batchSize: 200,
      startFrom: (waveNum - 1) * 200,
      dryRun: false,
      geminiLimit: 100,
      ollamaLimit: 25
    });
    ```
  - Validate results: `result.processed === 200`

- [ ] **3.5: Implement train & evaluate phase**
  - Call ML retrain:
    ```bash
    curl -s http://localhost:3002/api/ml/train?useDb=true \
      -H "Authorization: Bearer $JWT_TOKEN"
    ```
  - Wait for retrain to complete
  - Evaluate accuracy:
    ```bash
    curl -s http://localhost:3002/api/ml/evaluate \
      -H "Authorization: Bearer $JWT_TOKEN" | jq '.data.overall_accuracy'
    ```

- [ ] **3.6: Implement 3pp accuracy guard**
  - Compare `waveN_postAccuracy` vs `waveN-1_postAccuracy`
  - If diff >3pp: ROLLBACK
  - Else: CONTINUE

- [ ] **3.7: Implement rollback procedure**
  - Restore DB:
    ```bash
    docker exec postgres pg_restore -d news_db < backups/pre_batch_${waveNum}.dump.gz
    ```
  - Restore ML model from model_state
  - Delete disputes from failed wave:
    ```typescript
    await prisma.disputeQueue.deleteMany({
      where: { batchNumber: waveNum }
    });
    ```
  - Mark batch_audit_log:
    ```typescript
    await prisma.batchAuditLog.update({
      where: { id: logEntry.id },
      data: { status: 'rolled_back', notes: `Accuracy: ${prevAcc}% → ${newAcc}% (drop >3pp)` }
    });
    ```

- [ ] **3.8: Implement inter-wave pause**
  - If `--auto` NOT set:
    - Display wave N results
    - Prompt: "Proceed to Wave N+1? (y/n)"
    - Wait for input
  - Else: auto-proceed

- [ ] **3.9: CLI arguments**
  ```bash
  --waves=6
  --batch-size=200
  --start-wave=1
  --auto
  --dry-run
  ```

- [ ] **3.10: Run tests**
  ```bash
  cd backend && npm test -- run-consensus-waves.test.ts
  ```

- [ ] **3.11: Commit**
  ```bash
  git add backend/src/scripts/run-consensus-waves.ts backend/src/scripts/run-consensus-waves.test.ts && \
  git commit -m "feat: wave orchestrator with accuracy guard and rollback"
  ```

---

## Task 4: Backend API Endpoints — Dispute Resolution

**Files:**
- Modify: `backend/src/modules/ml/ml.controller.ts`
- Create: `backend/src/__tests__/ml.dispute-resolution.test.ts`

### Steps

- [ ] **4.1: Create test file (TDD)**
  - Tests:
    ```typescript
    describe('PUT /api/ml/resolve-disputes-batch', () => {
      it('should resolve disputes and update haber', async () => {
        // Create test disputes
        // Call endpoint with decisions
        // Verify haber updated + dispute_queue.durum='cozuldu'
      });
      
      it('should error if CLI lock exists', async () => {
        // Create .locks/dispute_resolution_in_progress
        // Call endpoint
        // Expect 409 error
      });
    });
    ```

- [ ] **4.2: Add endpoint to ml.controller.ts**
  - Before existing endpoints, add:
    ```typescript
    protectedRouter.put('/resolve-disputes-batch', async (req: Request, res: Response) => {
      try {
        const { decisions } = req.body as {
          decisions: Array<{
            disputeId: number;
            chosenKategoriId: number;
            reason: string;
          }>;
        };
        
        // Check lock
        if (fs.existsSync('.locks/dispute_resolution_in_progress')) {
          return res.status(409).json({
            success: false,
            error: 'Dispute resolution in progress via CLI'
          });
        }
        
        // Resolve disputes
        await prisma.$transaction(
          decisions.map(d =>
            prisma.haber.update({
              where: { id: d.disputeId }, // Should be haberId from dispute
              data: {
                kategoriId: d.chosenKategoriId,
                kategoriDogrulandi: true,
                durum: 'hazir'
              }
            }).then(() =>
              prisma.disputeQueue.update({
                where: { id: d.disputeId },
                data: {
                  adminKararKategoriId: d.chosenKategoriId,
                  durum: 'cozuldu',
                  resolvedBy: req.user?.email || 'unknown',
                  resolvedAt: new Date()
                }
              })
            )
          )
        );
        
        res.json({
          success: true,
          resolved: decisions.length,
          message: `${decisions.length} disputes resolved.`
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    ```

- [ ] **4.3: Add admin panel endpoint to list disputes**
  - In admin.controller.ts:
    ```typescript
    router.get('/disputes', verifyJwtToken, requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
      const { status = 'bekliyor' } = req.query;
      const disputes = await prisma.disputeQueue.findMany({
        where: { durum: status as string },
        include: {
          nbKategori: true,
          llmKategori: true,
          haber: {
            select: { id: true, baslik: true }
          }
        },
        orderBy: { createdAt: 'asc' },
        take: 50
      });
      
      res.json({
        success: true,
        data: disputes,
        total: await prisma.disputeQueue.count({ where: { durum: status as string } })
      });
    });
    ```

- [ ] **4.4: Run tests**
  ```bash
  cd backend && npm test -- ml.dispute-resolution.test.ts
  ```

- [ ] **4.5: Commit**
  ```bash
  git add backend/src/modules/ml/ml.controller.ts backend/src/__tests__/ml.dispute-resolution.test.ts && \
  git commit -m "feat: dispute resolution endpoints + admin list"
  ```

---

## Task 5: Backend CLI Script — Dispute Resolution

**Files:**
- Create: `backend/src/scripts/resolve-disputes-cli.ts`

### Steps

- [ ] **5.1: Implement CLI interactive loop**
  - Create lock file on start: `.locks/dispute_resolution_in_progress`
  - Remove on exit (ensure even on crash)
  - Use `inquirer` or `prompts` for user input

- [ ] **5.2: Load disputes in batches of 10**
  ```typescript
  const disputes = await prisma.disputeQueue.findMany({
    where: { durum: 'bekliyor' },
    include: { nbKategori: true, llmKategori: true, haber: true },
    orderBy: { createdAt: 'asc' },
    take: 10 * (batch - 1 + 1)
  });
  ```

- [ ] **5.3: Display each dispute**
  ```
  Dispute #1:
    Title: "Opel elektrikli SUV..."
    NB says: Sağlık (0.65 confidence)
    LLM says: Teknoloji (0.92 confidence)
    
    What's the correct category? (1) Sağlık, (2) Teknoloji, (3) Other
  ```

- [ ] **5.4: Collect decisions and call API**
  - After batch of 10, call `PUT /api/ml/resolve-disputes-batch`
  - Verify response success

- [ ] **5.5: CLI arguments**
  ```bash
  --batch=1
  --continue-from-dispute-id=100
  ```

- [ ] **5.6: Commit**
  ```bash
  git add backend/src/scripts/resolve-disputes-cli.ts && \
  git commit -m "feat: CLI tool for interactive dispute resolution"
  ```

---

## Task 6: Frontend — Backend Limit Guard

**Files:**
- Modify: `backend/src/modules/news/news.controller.ts`

### Steps

- [ ] **6.1: Add max limit enforcer to GET /api/news**
  - Find current code around line 40:
    ```typescript
    const limit = parseInt(req.query.limit as string) || 20;
    ```
  - Replace with:
    ```typescript
    let limit = parseInt(req.query.limit as string) || 20;
    const MAX_LIMIT = 100;
    limit = Math.min(limit, MAX_LIMIT);
    ```

- [ ] **6.2: Test locally**
  ```bash
  curl "http://localhost:3002/api/news?limit=500"
  # Should return at most 100 articles
  ```

- [ ] **6.3: Commit**
  ```bash
  git add backend/src/modules/news/news.controller.ts && \
  git commit -m "fix: enforce max limit=100 for GET /api/news"
  ```

---

## Task 7: Frontend — Infinite Scroll Main Page

**Files:**
- Modify: `frontend/src/app/page.tsx`

### Steps

- [ ] **7.1: Add IntersectionObserver hook**
  - Create `useInfiniteScroll` hook in `frontend/src/hooks/useInfiniteScroll.ts`:
    ```typescript
    export function useInfiniteScroll(callback: () => void) {
      const observerTarget = useRef<HTMLDivElement>(null);
      
      useEffect(() => {
        const observer = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) {
            callback();
          }
        });
        
        if (observerTarget.current) {
          observer.observe(observerTarget.current);
        }
        
        return () => observer.disconnect();
      }, [callback]);
      
      return observerTarget;
    }
    ```

- [ ] **7.2: Modify page.tsx to use infinite scroll**
  - Find current state management (page, limit, articles)
  - Add `observerTarget` ref from hook
  - Replace manual pagination with:
    - On page load: fetch 20 articles
    - On scroll-to-bottom: fetch next 20
    - Update page number

- [ ] **7.3: Update rendering to show observer target**
  - Add at bottom of articles list:
    ```jsx
    <div ref={observerTarget} className="flex justify-center p-8">
      {isLoading && <Spinner />}
    </div>
    ```

- [ ] **7.4: Test locally**
  - npm run dev
  - Scroll to bottom, verify next 20 load

- [ ] **7.5: Commit**
  ```bash
  git add frontend/src/app/page.tsx frontend/src/hooks/useInfiniteScroll.ts && \
  git commit -m "feat: infinite scroll on main page"
  ```

---

## Task 8: Frontend — Infinite Scroll Category Pages

**Files:**
- Modify: `frontend/src/app/kategoriler/[slug]/page.tsx`
- Modify: `frontend/src/app/kategoriler/page.tsx`

### Steps

- [ ] **8.1: Apply same infinite scroll pattern to kategori/[slug]/page.tsx**
  - Import `useInfiniteScroll` hook
  - Update limit from hardcoded 100 to dynamic pagination
  - Test category page scrolls smoothly

- [ ] **8.2: Apply same pattern to kategori/page.tsx (all categories)**
  - Remove hardcoded limit=1500
  - Use infinite scroll starting at 20 articles

- [ ] **8.3: Test all pages**
  ```bash
  npm run build && npm run start
  # Visit main page, category page, all categories
  # Verify scroll loads more articles
  ```

- [ ] **8.4: Commit**
  ```bash
  git add frontend/src/app/kategoriler/ && \
  git commit -m "feat: infinite scroll on category pages"
  ```

---

## Task 9: Integration Testing

**Files:**
- Create: `backend/src/__tests__/consensus-integration.test.ts`

### Steps

- [ ] **9.1: Create integration test**
  - Full end-to-end: consensus-backfill → retrain → evaluate
  - With mock LLM responses
  - Verify accuracy improvement

- [ ] **9.2: Create wave orchestration test**
  - Run 2 waves (not full 6)
  - Verify rollback on accuracy drop

- [ ] **9.3: Run full test suite**
  ```bash
  cd backend && npm test
  ```
  - All tests pass

- [ ] **9.4: Commit**
  ```bash
  git add backend/src/__tests__/consensus-integration.test.ts && \
  git commit -m "test: integration tests for consensus pipeline"
  ```

---

## Task 10: Documentation & Dry Run

**Files:**
- Modify: `docs/OPERATIONS.md` (new section)
- Create: `docs/DISPUTE_RESOLUTION_RUNBOOK.md`

### Steps

- [ ] **10.1: Write runbook**
  - How to run `run-consensus-waves.ts`
  - How to use CLI dispute resolver
  - Rollback procedure if needed

- [ ] **10.2: Dry run wave 1 in dry-run mode**
  ```bash
  npx ts-node src/scripts/consensus-backfill.ts \
    --batch-size=50 \
    --dry-run
  ```
  - Verify NB+LLM calls work
  - Verify no DB changes (dry-run)

- [ ] **10.3: Commit docs**
  ```bash
  git add docs/OPERATIONS.md docs/DISPUTE_RESOLUTION_RUNBOOK.md && \
  git commit -m "docs: operation runbooks for consensus backfill"
  ```

---

## Completion Checklist

- [ ] All 10 tasks completed and committed
- [ ] Backend tests: `npm test` passes
- [ ] Frontend builds: `npm run build` succeeds
- [ ] Dry run: wave 1 (50 articles) processes without DB changes
- [ ] Dispute resolution CLI tested manually
- [ ] Main page loads <1.5s with infinite scroll working
- [ ] PR ready for review

---

**READY FOR EXECUTION** using `superpowers:executing-plans`
