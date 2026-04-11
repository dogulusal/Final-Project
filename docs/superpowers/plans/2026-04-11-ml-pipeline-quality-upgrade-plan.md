# ML Pipeline Kalitesi Yükseltme - Uygulama Planı

**Tarih:** 2026-04-11  
**Durum:** EXECUTED - Path B closed (pass rate %30, systematic-debugging completed, Sağlık kategorisi temiz)  
**Toplam Süresi:** ~2-3 saat hızlı path + 1-2 hafta background spot-check  
**Branch:** feature/tokenizer-unicode-aware

---

## Genel Bakış

```
Aşama 1: Manual-Only Üretim Geçişi (HIZLI KAZANIM ~ 35 min)
├─ Görev 1: Auto-train parametresi değiş (5 min)
├─ Görev 2: Startup + /train endpoint güncelle (10 min)
└─ Görev 3: Model retrain + panel verification (20 min)
            ↓ Prediction: 58% → 71% (INSTANT improvement)

Aşama 2: Kontrollü Veri Büyütme (BACKGROUND ~ 1-2 hafta)
├─ Görev 4: Pre-check dataset quality (30 min, insan review)
└─ Görev 5: Spot-check batch execution (1-2 hafta, user-driven)

Aşama 3: Dokümantasyon & Finalize (~ 1 saat)
└─ Görev 6: Spec + plan yazılı, git commit (1 saat)
```

---

## 🟢 AŞAMA 1: MANUAL-ONLY ÜRETİM GEÇİŞİ

### Görev 1: Auto-Training Parametresini Güncelle ⏱️ 5 min

**Dosya:** `backend/src/modules/ml/ml.service.ts`

#### 1.1 Adımlar

1. **Dosyayı aç:**
   ```bash
   code backend/src/modules/ml/ml.service.ts
   ```

2. **L240 civarında `initializeTrainingPipeline()` metodunu bul:**
   ```bash
   grep -n "initializeTrainingPipeline" backend/src/modules/ml/ml.service.ts
   ```

3. **L240 civarında bu satırı bul:**
   ```typescript
   await this.loadAndTrainFromDB();  // DEFAULT: manualOnlyVerified=false
   ```

4. **Değiştir:**
   ```typescript
   await this.loadAndTrainFromDB({ manualOnlyVerified: true });  // CHANGE: manual-only
   ```

#### 1.2 Doğrulama

```bash
cd backend

# Step 1: Git diff check
git diff backend/src/modules/ml/ml.service.ts
# Expected: Line ~240 shows `manualOnlyVerified: true`

# Step 2: TypeScript compile check
npx tsc --noEmit
# Expected: 0 errors

# Step 3: Line-by-line verify
grep -A 2 -B 2 "manualOnlyVerified: true" backend/src/modules/ml/ml.service.ts
# Expected: Shows changed line with context
```

#### 1.3 Workflow Integration

- **Skill:** `dataset-quality-guard` (Görev 4'te tetiklenir)
- **Gate:** ✅ TS compile pass → PROCEED to Görev 2

---

### Görev 2: Startup & /train Endpoint Güncelle ⏱️ 10 min

**Dosya 1:** `backend/src/modules/ml/ml.controller.ts` (2 alan)  
**Dosya 2:** `backend/src/modules/admin/admin.controller.ts` (kontrol)

#### 2.1 Alan A: Startup IIFE (ml.controller.ts, L8-25)

1. **Dosyayı aç:**
   ```bash
   code backend/src/modules/ml/ml.controller.ts
   ```

2. **Startup IIFE bul (beginning of file):**
   ```bash
   grep -n "ML Service initializing" backend/src/modules/ml/ml.controller.ts
   ```

3. **Bu satırı bul:**
   ```typescript
   await mlService.loadAndTrainFromDB();  // DEFAULT: manualOnlyVerified=false
   ```

4. **Değiştir:**
   ```typescript
   await mlService.loadAndTrainFromDB({ manualOnlyVerified: true });  // CHANGE: manual-only
   ```

#### 2.2 Alan B: /train Endpoint (ml.controller.ts, L32-42)

1. **Endpoint bul:**
   ```bash
   grep -n "@Post('train')" backend/src/modules/ml/ml.controller.ts
   ```

2. **Bu satırı bul (endpoint body'de):**
   ```typescript
   await this.mlService.loadAndTrainFromDB();  // DEFAULT: manualOnlyVerified=false
   ```

3. **Değiştir:**
   ```typescript
   await this.mlService.loadAndTrainFromDB({ manualOnlyVerified: true });  // CHANGE: manual-only
   ```

#### 2.3 Alan C: Admin Panel Metriği (admin.controller.ts, L121 - KONTROL SADECESİ)

1. **Dosyayı aç:**
   ```bash
   code backend/src/modules/admin/admin.controller.ts
   ```

2. **Stats endpoint bul:**
   ```bash
   grep -n "getStats\|mlAccuracy" backend/src/modules/admin/admin.controller.ts
   ```

3. **Kontrol (degenişim yoksa bu doğru):**
   ```typescript
   mlAccuracy: (mlPerformance.accuracy * 100).toFixed(1)
   ```

#### 2.4 Doğrulama

```bash
cd backend

# Step 1: diff ml.controller.ts
git diff backend/src/modules/ml/ml.controller.ts
# Expected: 2 changes (startup IIFE + /train endpoint)

# Step 2: diff admin.controller.ts
git diff backend/src/modules/admin/admin.controller.ts
# Expected: 0 changes (kontrol sadece)

# Step 3: TS compile
npx tsc --noEmit
# Expected: 0 errors

# Step 4: Verify all changes
git diff --name-only
# Expected: 
#   backend/src/modules/ml/ml.service.ts
#   backend/src/modules/ml/ml.controller.ts
```

#### 2.5 Workflow Integration

- **Skill:** `verification-before-completion`
- **Gate:** ✅ TS compile + git diff review → PROCEED to Görev 3

---

### Görev 3: Modeli Retrain & Panel Doğrulama ⏱️ 20 min

#### 3.1 Pre-Retrain Checklist

```bash
cd backend

# Check 1: Build success
npm run build
# Expected: ✅ 0 errors, build successful

# Check 2: Services running
# Ensure Docker containers running:
docker compose ps
# Expected: backend container UP, postgres container UP

# Check 3: Database connectivity
# In backend, check if DB connection works (logs should show no connection errors)
```

#### 3.2 Model Retrain (3 Opsiyon)

**OPTION A: Docker API Call (Recommended)**
```bash
# Option A: Via Docker API endpoint
curl -X POST http://localhost:3000/api/ml/train?useDb=true

# Expected response:
{
  "message": "Training from DB completed",
  "accuracy": 70.8  # Should be ~71% ± 2%
}
```

**OPTION B: Manual Backend Restart**
```bash
# Option B: Restart backend container (auto-triggers startup retrain)
docker compose restart backend

# Wait ~30 seconds for startup, then check logs:
docker compose logs backend | tail -50
# Expected: "ML Service initializing... Loading model from DB with manual-only data..."
# Expected: No Guard1/Guard4 errors
```

**OPTION C: Direct Script (Advanced)**
```bash
# Option C: Run training script directly
cd backend
npx ts-node scripts/train-retrain-manual-only.ts
```

#### 3.3 Verification (verification-before-completion SKILL)

**V1: API Accuracy Check (3-5 minutes sonra)**
```bash
# Check 1: Admin stats API
curl http://localhost:3000/api/stats \
  -H "Authorization: Bearer <YOUR_TOKEN_IF_NEEDED>"

# Expected Response:
{
  "mlAccuracy": "71.0",      # ← Critical: Should be ~71% ± 2%
  "trainSize": 413,          # ← Should be ~413 (794 manual / 1.92)
  "testSize": 63,            # ← Should be ~63 (794 manual / 12.6)
  ...
}

# Criteria:
# ✅ 70.8 ≤ mlAccuracy ≤ 71.2 → PASS
# ❌ mlAccuracy < 70% → FAIL (Guard4 threshold)
# ❌ mlAccuracy > 75% → SUSPICIOUS (verify no data leak)
```

**V2: Guard Checks (Backend Logs)**
```bash
# Check 2: Model save status
docker compose logs backend | grep -i "guard\|accuracy\|model.*save"

# Expected:
# "Guard1 check: accuracy drop < 5pp ✅"
# "Guard4 calibration: confidence >= 0.70 ✅"
# "Model saved to model.json ✅"

# Failure indicators (STOP if seen):
# ❌ "Guard1 failed: accuracy drop > 5pp"
# ❌ "Guard4 failed: calibration error"
# ❌ "Model save failed"
```

**V3: Health Check**
```bash
# Check 3: API Health Endpoint
curl http://localhost:3000/api/ml/health

# Expected Response:
{
  "status": "ok",
  "accuracy": 70.8,    # Should match stats API
  "model": "loaded",
  "timestamp": "2026-04-11T10:30:00Z"
}
```

**V4: Database Log Check**
```bash
# Check 4: Training session logged
docker compose exec -T postgres psql -U ml_user -d ml_db -c \
  "SELECT * FROM training_sessions ORDER BY created_at DESC LIMIT 3;"

# Expected: Latest row has status='SUCCESS', accuracy~0.708
```

#### 3.4 If Verification FAILS (Error Paths)

**Scenario A: Accuracy Drop >5pp (58% → 63%)**
→ **Action:** Trigger Rollback Workflow
```bash
# Step 1: Revert last commit
git revert HEAD --no-edit

# Step 2: Rebuild
npm run build

# Step 3: Restart backend
docker compose restart backend

# Step 4: Re-verify (should go back to 58% old accuracy)
```

**Scenario B: Guard1 Error in Logs**
→ **Action:** Trigger Systematic-Debugging Phase 1
```bash
# Phase 1: Root Cause Investigation (MANDATORY)
# Q1: Why did accuracy drop?
#   - Check mislabel count: SELECT COUNT(*) FROM manuel_validasyonlar WHERE is_valid=FALSE
#   - Check category distribution: SELECT category, COUNT(*) FROM manuel_validasyonlar GROUP BY category
#   - Check confidence distribution: SELECT confidence, COUNT(*) FROM manuel_validasyonlar GROUP BY confidence

# Q2: Was the parameter change applied correctly?
#   - Verify: git log --oneline -3
#   - Verify: git show HEAD:backend/src/modules/ml/ml.service.ts | grep -A 2 "manualOnlyVerified"

# Q3: Is DB in a corrupted state?
#   - Check pool: SELECT COUNT(*) FROM manuel_validasyonlar
#   - Check locks: SELECT * FROM pg_stat_activity WHERE state='active'
```

**Scenario C: Health-Check Timeout**
→ **Action:** Infrastructure Check
```bash
# Docker status
docker compose ps

# SQL Pool connection
docker compose exec -T backend curl http://localhost:3000/api/health/db

# If DB down:
docker compose restart postgres
docker compose restart backend
sleep 10  # Wait for services to stabilize
# Then re-run Check 1-4
```

#### 3.5 Workflow Integration

- **Primary Skill:** `verification-before-completion` (IRON LAW: no success claim without verification)
- **Secondary:** `health-check` (curl health endpoints)
- **Error Path:** `systematic-debugging` (if Guard error) + `rollback` (if accuracy drop)

**Gate:** ✅ All V1-V4 PASS → PROCEED to Görev 4

---

## 🟡 AŞAMA 2: KONTROLLÜ VERİ BÜYÜTME

### Görev 4: Dataset Kalitesi Pre-Check ⏱️ 30 min (İNSAN REVIEW + SCRIPT)

**Input:** 955 güven tabanlı kayıt (confidence >=0.70, manuel dışında)  
**Data Source:** `spot-check-validation.ts --export` tarafından üretilen JSON dosyası  
**Output Format:** `backups/spot_check/review_TIMESTAMP.json` (insan review'ü için)

#### 4.1 Step 1: Batch Export Script Çalıştır

```bash
cd backend

# Export candidates with confidence > 0.85 as review batches
npx ts-node scripts/spot-check-validation.ts --export

# Output: 
# - File: backups/spot_check/review_TIMESTAMP.json
#   Sample output structure:
#   {
#     "exportedAt": "2026-04-11T10:00:00Z",
#     "totalCandidates": 955,
#     "batchCount": 95,
#     "batches": [
#       {
#         "batchId": 1,
#         "totalInBatch": 10,
#         "allRecordIds": [12345, 12346, ..., 12354],
#         "sampledRecords": [
#           {
#             "id": 12345,
#             "title": "...",
#             "currentCategory": "Siyaset",
#             "confidence": 0.87,
#             "decision": null,  // ← Human fills: "correct" | "wrong"
#             "note": ""
#           },
#           ... 3 samples total per batch
#         ],
#         "batchDecision": null  // ← Computed during --apply
#       },
#       ... 95 batches total
#     ]
#   }

# Expected: Review file created successfully
```

#### 4.2 Check 1: Class Imbalance (JSON Analizi)

```bash
# Parse JSON and analyze category distribution
cd backend

# Use jq (JSON query tool) OR Node script to analyze:
cat backups/spot_check/review_TIMESTAMP.json | \
  npx jq '.batches[] | .sampledRecords[] | .currentCategory' | \
  sort | uniq -c | sort -rn

# Manual method (Node script):
node << 'EOF'
const fs = require('fs');
const reviewFile = 'backups/spot_check/review_TIMESTAMP.json';
const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));

const categories = {};
review.batches.forEach(batch => {
  batch.sampledRecords.forEach(sample => {
    categories[sample.currentCategory] = (categories[sample.currentCategory] || 0) + 1;
  });
});

console.log('\n=== Category Distribution (Sampled) ===');
const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
sorted.forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));

const max = sorted[0][1];
const min = sorted[sorted.length - 1][1];
const ratio = (max / min).toFixed(2);
console.log(`\nMax/Min Ratio: ${ratio}x`);
console.log(`✅ PASS if ≤ 2.5x, ❌ FAIL if > 2.5x`);
EOF

# CRITERIA:
# ✅ Max ratio ≤ 2.5x → PASS
# ❌ Max ratio > 2.5x → FAIL (too imbalanced)
# ⚠️  Siyaset kategorisi özel dikkat (tarihsel imbalance sorun olabilir)
```

#### 4.3 Check 2: Noise Detection (JSON Analizi)

```bash
# Mislabel pattern detection (caveat: we only have predicted labels, not ground truth yet)
# Since review hasn't been filled by human yet, this check can only analyze:
# - Confidence distribution
# - If any record's confidence suspiciously low for such a batch

node << 'EOF'
const fs = require('fs');
const reviewFile = 'backups/spot_check/review_TIMESTAMP.json';
const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));

console.log('\n=== Confidence Distribution ===');
const confidences = [];
review.batches.forEach(batch => {
  batch.sampledRecords.forEach(sample => {
    confidences.push(sample.confidence);
  });
});

const avg = (confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3);
const min = Math.min(...confidences).toFixed(3);
const max = Math.max(...confidences).toFixed(3);

console.log(`Average confidence: ${avg}`);
console.log(`Min: ${min}, Max: ${max}`);
console.log(`✅ PASS if min ≥ 0.70 and avg ≥ 0.80 (threshold safety)`);
console.log(`❌ ANOMALY if many records < 0.75 (quality concern)`);

// Batch-level analysis
console.log('\n=== Per-Batch Confidence Stats ===');
review.batches.forEach(batch => {
  const batchConf = batch.sampledRecords.map(s => s.confidence);
  const batchAvg = (batchConf.reduce((a, b) => a + b, 0) / batchConf.length).toFixed(3);
  if (batchAvg < 0.78) {
    console.warn(`  ⚠️  Batch ${batch.batchId}: avg conf ${batchAvg} (LOW quality signal)`);
  }
});
EOF

# CRITERIA (PRE-HUMAN-REVIEW):
# ✅ Avg confidence ≥0.80 → PASS
# ❌ Min confidence <0.70 → FAIL (already filtered in export, shouldn't happen)
# ⚠️  Many batches <0.78 avg → FLAG for review (possible lower quality batch)
```

#### 4.4 Check 3: Train/Test Split Consistency (DB Query)

```bash
# After adding 955 records, will stratified split still work?
# Query: Check final category counts (EXISTING + NEW from script output)

docker compose exec -T postgres psql -U ml_user -d ml_db -c \
  "SELECT 
     kategori.ad as category,
     COUNT(DISTINCT CASE WHEN h.kategoriDogrulandi = true THEN h.id END) as existing_manual,
     (SELECT COUNT(*) FROM json '/tmp/review.json'->>'$.batches[*].sampledRecords[*].currentCategory' 
         WHERE value = kategori.ad) as sampled_in_export
   FROM kategori
   LEFT JOIN haber h ON h.kategori_id = kategori.id
   WHERE kategori.ad IN ('Siyaset', 'Spor', 'Dünya', 'Teknoloji', 'Yaşam')
   GROUP BY kategori.id, kategori.ad
   ORDER BY existing_manual DESC;"

# OR simpler: Count from existing manual dataset + 955 new
node << 'EOF'
const reviewFile = 'backups/spot_check/review_TIMESTAMP.json';
const review = JSON.parse(require('fs').readFileSync(reviewFile, 'utf8'));

// Group new by category
const newCounts = {};
review.batches.forEach(batch => {
  batch.sampledRecords.forEach(sample => {
    const cat = sample.currentCategory;
    newCounts[cat] = (newCounts[cat] || 0) + 1;
  });
});

// Existing manual counts (from DB query above or hardcoded from Batch-21c):
const existingCounts = {
  'Siyaset': 280,
  'Spor': 120,
  'Dünya': 180,
  'Teknoloji': 130,
  'Yaşam': 84
};

console.log('\n=== Final Split Check (Existing + New) ===');
const finalCounts = {};
Object.keys(existingCounts).forEach(cat => {
  finalCounts[cat] = existingCounts[cat] + (newCounts[cat] || 0);
});

Object.entries(finalCounts).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

// MIN_TEST_SUPPORT = 10 check
const testRatio = 0.09; // Approx 9% test (MIN_TEST_SUPPORT=10 per category)
Object.entries(finalCounts).forEach(([cat, count]) => {
  const testExpected = Math.floor(count * testRatio);
  const status = testExpected >= 10 ? '✅' : '❌';
  console.log(`  ${cat} → test est. ${testExpected} ${status}`);
});

console.log(`✅ PASS if all categories have ≥10 test samples`);
EOF

# CRITERIA:
# ✅ All categories maintain ≥10 test support
# ❌ Any category <10 → FAIL (stratified split breaks)
```

#### 4.5 Step 2: QA 3-Sample Manual Review (İNSAN KARAR)

**Before this step:**
- Review JSON file: `backups/spot_check/review_TIMESTAMP.json` created
- 95 batches × 3 samples = 285 records need human review
- File structure: `batches[i].sampledRecords[j].decision` = `null` (waiting to be filled)

**QA Instructions:**
1. **Open review file:**
   ```bash
   # Print sample batch
   jq '.batches[0]' backups/spot_check/review_TIMESTAMP.json
   ```

2. **For each of 3 samples per batch, review the article:**
   ```
   Batch-1, Sample-A:
   ID: 12345
   Title: "Cumhuribaşkanı açıklamada bulundu"
   Predicted Category: Siyaset
   Confidence: 0.87
   ———
   QA Decision: Is this article REALLY about Siyaset?
   [ ] YES - predict correct (fill "decision": "correct")
   [ ] NO  - predict wrong (fill "decision": "wrong")
   ```

3. **Update JSON file** with decision:
   ```json
   {
     "batchId": 1,
     "sampledRecords": [
       {
         "id": 12345,
         "title": "...",
         "currentCategory": "Siyaset",
         "confidence": 0.87,
         "decision": "correct"  // ← QA fills this
       },
       {
         "id": 12349,
         "currentCategory": "Spor",
         "confidence": 0.91,
         "decision": "correct"
       },
       {
         "id": 12353,
         "currentCategory": "Teknoloji",
         "confidence": 0.79,
         "decision": "wrong"  // ← This one incorrect!
       }
     ]
   }
   ```

#### 4.6 Pre-Check Decision Gate

**Calculate batch decisions:**
```bash
node << 'EOF'
const fs = require('fs');
const reviewFile = 'backups/spot_check/review_TIMESTAMP.json';
const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));

let totalPass = 0, totalFail = 0;
review.batches.forEach(batch => {
  const decisions = batch.sampledRecords.map(s => s.decision);
  const wrongCount = decisions.filter(d => d === 'wrong').length;
  const batchPass = wrongCount === 0;
  
  if (batchPass) {
    console.log(`✅ Batch ${batch.batchId}: 3/3 correct`);
    totalPass++;
  } else {
    console.log(`❌ Batch ${batch.batchId}: ${wrongCount} wrong`);
    totalFail++;
  }
});

console.log(`\n=== SUMMARY ===`);
console.log(`Passed: ${totalPass}, Failed: ${totalFail}`);

// Overall decision
const criticalFails = totalFail > 5; // More than 5 batches fail?
if (criticalFails) {
  console.log('\n⚠️  QUALITY ALERT: >5 batches failed pre-check');
  console.log('→ Recommend systematic-debugging Phase 1');
} else {
  console.log('\n✅ Pre-check PASSED → Ready for Görev 5');
}
EOF
```

**IF ALL CHECKS PASS:**
```
✅ Class imbalance ≤ 2.5x
✅ Confidence distribution safe (avg ≥0.80)
✅ Split consistency OK (all categories ≥10 test samples)
✅ QA 3-sample: <5 failures (manageable)
→ Görev 5'e GEÇ (Batch execution authorized)
```

**IF ANY CHECK FAILS:**
```
❌ [Class imbalance >2.5x OR low confidence OR few QA passes]
→ STOP Plan execution
→ Trigger systematic-debugging Phase 1:
   Q1: Where's the quality issue? (specific category? low confidence batches?)
   Q2: Should we adjust confidence threshold? (currently 0.85)
   Q3: Should we exclude problematic categories temporarily?
   
→ After root cause: decide RETRY pre-check or ABORT Görev 5
```

#### 4.4 Workflow Integration

- **Primary Skill:** `dataset-quality-guard`
- **Fallback:** `systematic-debugging` (if check fails)
- **Gate:** ✅ All checks + QA 3/3 PASS → PROCEED to Görev 5

---

### Görev 5: Spot-Check Batch Execution ⏱️ 1-2 hafta (USER-DRIVEN)

**Input:** Pre-check PASSED review JSON (`review_TIMESTAMP.json` with batch decisions ready)  
**Output:** ACCEPTED batches → records inserted to `manuel_validasyonlar` table  
**Flow:** JSON → Human Review → JSON Update → Script --apply → DB Changes

#### 5.1 Step 1: Review JSON'ını QA'ya Dağıt

```bash
# File created: backups/spot_check/review_TIMESTAMP.json
# Send to QA: 95 batches × 3 samples each

# QA Person:
# 1. Download file
# 2. Open in text editor / JSON viewer
# 3. For EACH batch:
#    - Read 3 sampled records
#    - Decide: "correct" or "wrong" for each
#    - Update JSON
#    - Save file
# 4. Return file

# Timeline: 95 batches with 3 samples = 285 records
# Est. review time: ~10-15 sec per sample = 48-71 min total
# Spread over 1-2 weeks (batch rotation if multiple QA people)
```

#### 5.2 Step 2: Apply Batch Decisions Script

**After human review completed & JSON filled:**

```bash
cd backend

# Run --apply phase
npx ts-node scripts/spot-check-validation.ts --apply --review-file=backups/spot_check/review_TIMESTAMP.json

# Expected output:
# [Batch 1] ✅ ACCEPTED — 10 records → kategoriDogrulandi=true
# [Batch 2] ✅ ACCEPTED — 10 records → kategoriDogrulandi=true
# [Batch 3] ❌ REJECTED (2 wrong sample(s)) — no DB change, requires manual review
# ...
#
# === SUMMARY ===
# Batches accepted : 92
# Batches rejected : 3
# Records approved : 920
# Audit log written: backups/spot_check/audit_TIMESTAMP.txt

# DB Changes Made:
# - UPDATE haber SET kategoriDogrulandi = true WHERE id IN (12345, 12346, ...)
# - 920 records now marked as validated
```

#### 5.3 Step 3: Auto-Training Trigger Monitoring

**Every 20 validated news:**
```bash
# Monitor backend logs for auto-training triggers
docker compose logs backend -f | grep -i "batch:trained\|training triggered"

# Expected pattern (during batch application):
# 
# [2026-04-11 10:05:00] Training triggered: 20 new validated news
# [2026-04-11 10:05:05] Model training: loading manual-only 814 records
# [2026-04-11 10:05:10] Accuracy: 71.2% (trainSize=539, testSize=73)
# [2026-04-11 10:05:10] Guard1: OK ✅, Guard4: OK ✅
# [2026-04-11 10:05:10] Model saved to model.json
# 
# [2026-04-11 10:20:00] Training triggered: 20 new validated news
# [2026-04-11 10:20:05] Model training: loading manual-only 834 records
# [2026-04-11 10:20:10] Accuracy: 71.4% (trainSize=555, testSize=74)
# [2026-04-11 10:20:10] Guard1: OK ✅, Guard4: OK ✅
# ...
```

**Track Accuracy Trend:**
```bash
# Create monitoring script
node << 'EOF'
const readline = require('readline');
let accuracyTrend = [];

const rl = readline.createInterface({
  input: require('child_process').spawn('docker', ['compose', 'logs', 'backend', '-f']).stdout
});

rl.on('line', line => {
  if (line.includes('Accuracy:')) {
    const match = line.match(/Accuracy: ([\d.]+)%/);
    if (match) {
      const acc = parseFloat(match[1]);
      accuracyTrend.push(acc);
      console.log(`Retrain #${accuracyTrend.length}: ${acc}%`);
      
      // Alert if drop >5pp
      if (accuracyTrend.length > 1) {
        const prev = accuracyTrend[accuracyTrend.length - 2];
        const drop = prev - acc;
        if (drop > 5) {
          console.error(`🚨 GUARD1 ALERT: Accuracy drop ${drop.toFixed(1)}pp (${prev.toFixed(1)} → ${acc.toFixed(1)})`);
        }
      }
    }
  }
});
EOF

# Criteria: ✅ Maintain ≥70% (Guard4 threshold) and no 5pp drops
```

#### 5.4 Step 4: Rejected Batches Handling

**If batch marked REJECTED (any sample "wrong"):**

```bash
# Script creates audit log
cat backups/spot_check/audit_TIMESTAMP.txt

# Output example:
# Batch 3: REJECTED (2 wrong sample(s)) — sent to manual queue [ids: 12366, 12367, 12368, 12369, 12370, 12371, 12372, 12373, 12374, 12375]
# Batch 7: REJECTED (1 wrong sample(s)) — sent to manual queue [ids: 12406, 12407, ...]

# Manual queue approach option:
# 1. Create separate table: rejected_spot_checks (batch_id, record_ids, reason, created_at)
# 2. Route rejected batches to manual review workflow
# 3. Later: re-categorize and potentially re-submit
```

#### 5.5 Pass Rate Calculation

```bash
# After all QA reviews complete
node << 'EOF'
const fs = require('fs');
const auditFile = 'backups/spot_check/audit_TIMESTAMP.txt';
const audit = fs.readFileSync(auditFile, 'utf8');

const accepted = (audit.match(/ACCEPTED/g) || []).length;
const rejected = (audit.match(/REJECTED/g) || []).length;
const total = accepted + rejected;
const passRate = ((accepted / total) * 100).toFixed(1);

console.log(`\n=== Final Results ===`);
console.log(`Batches accepted: ${accepted}`);
console.log(`Batches rejected: ${rejected}`);
console.log(`Total batches: ${total}`);
console.log(`Pass rate: ${passRate}%`);

if (passRate >= 80) {
  console.log(`✅ PASS RATE OK (≥80%)`);
} else {
  console.log(`❌ PASS RATE LOW (<80%)`);
  console.log(`→ Trigger systematic-debugging Phase 1: Why so many rejects?`);
}

// Records approved
const recordsApproved = accepted * 10; // Assuming all batches full
console.log(`\nRecords added to manuel_validasyonlar: +${recordsApproved}`);
console.log(`Total manual-only after: 794 + ${recordsApproved} = ${794 + recordsApproved}`);
EOF

# Criteria: ✅ Pass rate ≥80% (8/10 batches)
```

#### 5.6 Final Verification After All Batches Complete

```bash
# Step 1: Verify all records added
docker compose exec -T postgres psql -U ml_user -d ml_db -c \
  "SELECT COUNT(*) as total_manual_records FROM haber WHERE kategoriDogrulandi = true;"

# Expected: ~1700+ (794 original + ~900 from spot-check, assuming 90% pass rate)

# Step 2: Final retrain to confirm accuracy maintained
curl -X POST http://localhost:3000/api/ml/train?useDb=true

# Expected response:
{
  "message": "Training from DB completed",
  "accuracy": 71.5  # Possibly slightly higher than initial 71.0%
}

# Step 3: Verify Guard1/Guard4 still OK
docker compose logs backend | tail -20 | grep -i "guard"
# Expected: "Guard1: OK ✅", "Guard4: OK ✅"
```

#### 5.7 Workflow Integration

- **Primary Skill:** `verification-before-completion` (each batch verification)
- **Error Path 1:** `systematic-debugging` Phase 1 (if pass_rate <80%)
- **Error Path 2:** `rollback` (if accuracy ↓ >5pp during batch execution)

**Gate:** ✅ Pass rate ≥80% AND accuracy ≥70% AND final verify OK → PROCEED to Görev 6

---

## 🔵 AŞAMA 3: DOKÜMANTASYON & FINALIZE

### Görev 6: Spec + Plan + Git Commit ⏱️ 1 saat

**Status:** Spec & Plan docs already written (this file + design spec)  
**Remaining:** Add Future Work note, git commit

#### 6.1 Update Future Work Boundary Note

**File:** Already in spec (`docs/superpowers/specs/2026-04-11-ml-pipeline-quality-upgrade-design.md`)  
**Section:** Bölüm 4: Future Work — Out-of-Scope

**Content (verify presents):**
```markdown
## Bölüm 4: Future Work — Out-of-Scope

### 4.1 Transformer Models (BERTurk)

**Neden Sonrası?**
- Current manual-only baseline: 71.56% stabil, Guard pass
- Transformer integration: 2-3 hafta araştırma + NAPI Canvas vs Huggingface perf test
- Priority: Aşama 1-2 completion + baseline monitoring (Batch-22+)

**Roadmap:**
```
2026-04-11: Manual-only + spot-check (THIS PLAN)
         ↓
2026-04-25: Spot-check completion + documentation
         ↓
2026-05-02: Transformer research spike (Batch-22)
         ↓
...
```
```

#### 6.2 Optional: Update Siyaset Tracking Doc

**File:** `docs/superpowers/recovery/siyaset-support-tracking-2026-04-07.md`

**Add Section:**
```markdown
## Batch-21d: ML Pipeline Quality Upgrade (2026-04-11)

**Outcome (Expected):**
- Manual-only training: 58% → **71.56%** ✅
- Spot-check batch execution: 955 records → +X accepted
- Panel ML Doğruluk card: updated to 71% ± 2%
- Siyaset category: F1-std dev ≤ 0.05 maintained ✅ (from Batch-21c benchmark)

**Status:** Implementation scheduled 2026-04-11
```

#### 6.3 Git Commit & Push

```bash
cd c:/Users/dogul/Final-Project

# Step 1: Check status
git status

# Expected changed files:
# - backend/src/modules/ml/ml.service.ts
# - backend/src/modules/ml/ml.controller.ts
# - docs/superpowers/specs/2026-04-11-ml-pipeline-quality-upgrade-design.md
# - docs/superpowers/plans/2026-04-11-ml-pipeline-quality-upgrade-plan.md
# - docs/superpowers/recovery/siyaset-support-tracking-2026-04-07.md (optional)

# Step 2: Add files
git add backend/src/modules/ml/*.ts docs/

# Step 3: Commit
git commit -m "feat: ml-pipeline-quality-upgrade - manual-only training + spot-check gate (71.56% target)

- Görev 1: Auto-train parameter to manualOnlyVerified: true (L240)
- Görev 2: Startup IIFE + /train endpoint updated
- Görev 3: Model retrained, panel ML Doğruluk ~71% verified
- Görev 4: Dataset pre-check (imbalance, noise, QA review)
- Görev 5: 955 confidence records spot-check batching (1-2 week background)
- Görev 6: Spec + plan documentation complete

Target: 71.56% ± 2.21% (Batch-21c benchmark)
Workflow: verification-before-completion, health-check, dataset-quality-guard
Future: Transformer (BERTurk) — Out-of-scope, Batch-22+ roadmap"

# Step 4: Verify commit
git log --oneline -1

# Step 5: Push to feature branch
git push origin feature/tokenizer-unicode-aware

# Expected: ✅ Successfully pushed to feature/tokenizer-unicode-aware
```

#### 6.4 Verification (verification-before-completion SKILL)

**Final Checklist:**

```bash
# Check 1: Commit exists
git log --oneline -3 | grep "ml-pipeline-quality-upgrade"
# Expected: ✅ Found

# Check 2: Files in commit
git show --name-status HEAD

# Expected:
# M  backend/src/modules/ml/ml.service.ts
# M  backend/src/modules/ml/ml.controller.ts
# A  docs/superpowers/specs/2026-04-11-ml-pipeline-quality-upgrade-design.md
# A  docs/superpowers/plans/2026-04-11-ml-pipeline-quality-upgrade-plan.md

# Check 3: Branch pushed
git branch -v
# Expected: feature/tokenizer-unicode-aware ... [origin/feature/tokenizer-unicode-aware]

# Check 4: Render spec document (verify markdown syntax)
cat docs/superpowers/specs/2026-04-11-ml-pipeline-quality-upgrade-design.md | head -50
# Expected: ✅ Markdown headers # ## ### present, no syntax errors
```

#### 6.5 Workflow Integration

- **Primary Skill:** `writing-plans` (plan document) - ALREADY EXECUTED
- **Verification:** `verification-before-completion` (git commit + file presence)
- **Review Loop:** `spec-document-reviewer` (max 5 iteration) - OPTIONAL if formal review needed

**Gate:** ✅ Git commit + push successful → PLAN COMPLETE

---

## ⚠️ ERROR PATHS & RECOVERY

### Path A: Guard1 Triggered (Accuracy ↓ >5pp)

**Trigger Condition:**
```
Retrain attempt: 71.0% expected
Actual result: 65.9% (5.1pp drop)
Guard1 alarm: Model NOT saved
```

**Recovery (rollback SKILL):**
```bash
cd backend

# Step 1: Identify last good commit
git log --oneline -5
# Pick commit before parameter changes

# Step 2: Revert changes
git revert HEAD --no-edit
# This creates NEW commit undoing changes

# Step 3: Rebuild
npm run build

# Step 4: Restart backend
docker compose restart backend

# Step 5: Verify old behavior
curl http://localhost:3000/api/stats
# Expected: mlAccuracy returns to ~58%

# Step 6: Root cause investigation (systematic-debugging Phase 1)
# Q1: Why did accuracy drop with manual-only?
#   - Data corruption in DB?
#   - Mislabel rate in 794 manual records?
#   - Model initialization issue?
# Q2: Is DB state consistent?
# Q3: Should we try alternative parameters?
```

### Path B: Batch Pass Rate <80%

**Trigger Condition:**
```
Batch Results: 70 pass / 95 total = 73.7% pass rate
Threshold: ≥80% required
Action: PAUSE Görev 5
```

**Recovery (systematic-debugging SKILL, Phase 1-4):**
```bash
# Phase 1: ROOT CAUSE INVESTIGATION (MANDATORY)

# Q1: Error pattern analysis
docker compose exec -T postgres psql -U ml_user -d ml_db -c \
  "SELECT category, COUNT(*) as fail_count FROM rejected_batches GROUP BY category;"

# Q2: Confidence distribution in rejects
# Are fails concentrated in low-confidence (<0.75)?
# If yes: raise confidence threshold for spot-check

# Q3: Time component (mislabeling drifting over time)?
# Check if reject rate increases chronologically

# Phase 2: PATTERN ANALYSIS
# Hypothesis 1: Category-specific issue (e.g., Siyaset category fails >80%)
# Hypothesis 2: Confidence threshold too low (many 0.70-0.75 confidence mislabels)
# Hypothesis 3: Model drift (model was wrong on these, now retrain exposed it)

# Phase 3: HYPOTHESIS TESTING
# Test H1: SELECT category FROM rejected_batches; see if single category
# Test H2: SELECT confidence FROM confidence_based_export_955 WHERE status='rejected'; check mean
# Test H3: Retrain with rejected batch, see if accuracy drops more

# Phase 4: IMPLEMENTATION
# If H1: Exclude category temporarily, resume with other categories
# If H2: Increase confidence threshold to 0.75 or 0.80, re-export batches
# If H3: Investigate model state, possible rollback to earlier checkpoint
```

### Path C: Infrastructure Failure (DB/API)

**Trigger Condition:**
```
curl http://localhost:3000/api/stats
→ 500 Connection refused
```

**Recovery (health-check SKILL):**
```bash
# Diagnostic 1: Container status
docker compose ps
# Expected: All UP

# Diagnostic 2: Postgres connectivity
docker compose exec -T postgres psql -U ml_user -d ml_db -c "SELECT 1;"
# Expected: ✅ 1

# Diagnostic 3: Backend logs
docker compose logs backend | tail -30
# Look for: "connection refused", "ECONNREFUSED"

# Recovery actions:
# If Postgres down:
docker compose restart postgres
sleep 5

# If Backend down:
docker compose restart backend
sleep 10

# If Network issue:
docker network ls
docker compose down
docker compose up -d
sleep 15

# Re-verify:
curl http://localhost:3000/api/ml/health
```

---

## 📊 Tahmini Zaman Dağılımı

| Görev | Bölüm | Tahmini Süresi | Paralel Yapılabilir? |
|:---:|:---:|:---:|:---:|
| 1 | 1 | 5 min | Evet (2 ile) |
| 2 | 1 | 10 min | Evet (1 sonrası) |
| 3 | 1 | 20 min | 1-2 bitene kadar BLOCK |
| 4 | 2 | 30 min | 3 bitene kadar BLOCK |
| 5 | 2 | 1-2 hafta | 4 PASS sonrası, background |
| 6 | 3 | 1 saat | Kısmi (spec paralel), full 5 sonrası |
| | **HIZLI PATH** | **~35 min** | ✅ Aşama 1 complete |
| | **KOMPLE** | **2-3 saat + 1-2 hafta** | ✅ Tüm görevler complete |

---

## ✅ SUCCESS CRITERIA

**Görev 1-3 (Hızlı Kazanım) Tamamlandı:**
- ✅ Panel ML Doğruluk: 71.0% ± 2% (upgrade from 58%)
- ✅ Guard1/Guard4: PASS
- ✅ Database: 794 manual-only records eğitim seti

**Görev 4-5 (Kontrollü Büyütme):**
- ✅ Pre-check: PASS (imbalance, noise, QA)
- ✅ Batch pass rate: ≥80%
- ✅ Final accuracy: ≥71% maintained

**Görev 6 (Dokümantasyon):**
- ✅ Spec document: written
- ✅ Implementation plan: written (this file)
- ✅ Git commit: pushed to feature/tokenizer-unicode-aware

---

## 🚀 READY FOR EXECUTION

**Plan Status:** ✅ APPROVED & DETAILED  
**Next Action:** Begin Görev 1  
**Timeline:** ~2-3 saat hızlı kazanım + 1-2 hafta background spot-check

