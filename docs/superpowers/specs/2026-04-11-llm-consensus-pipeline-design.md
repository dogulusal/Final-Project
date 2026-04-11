# LLM-First Async Consensus Pipeline — Design Spec

**Date:** 2026-04-11  
**Status:** DRAFT  
**Branch:** feature/tokenizer-unicode-aware  
**Author:** brainstorming session  

---

## 1. Problem Statement

Naive Bayes (NB) sınıflandırıcı kelime frekansına dayalı çalışıyor. RSS'den gelen yeni haberlerde bağlamsal anlam gerektiren durumları çözemiyor:

- "Opel elektrikli SUV tanıtıldı" → NB: Sağlık (çünkü "elektrikli", "batarya" kelimeler eğitim setinde Sağlık ile correlate ediyor)
- "Fenerbahçe Euroleague maçı" → NB: Genel (çünkü Euroleague kelimesi eğitim setinde yok)

LLM (Gemini/Ollama) bağlamı anlayarak doğru kategori verebilir. Ama LLM tek başına kullanmak riskli (down olabilir, non-deterministic, maliyetli). **Çözüm: İkisini birleştiren consensus pipeline.**

## 2. Seçilen Yaklaşım: Async Queue (Yaklaşım B)

### Neden bu yaklaşım?

| Kriter | Inline (A) | Async Queue (B) ✅ | LLM-Only (C) |
|--------|-----------|-------------------|---------------|
| RSS cycle latency | +30dk | Değişmez | +30dk |
| NB vs LLM karşılaştırma | Yok | Tam veri | Yok |
| LLM down toleransı | Cycle durur | NB fallback devam eder | Kategorisiz haber |
| Tez değeri | Düşük | Yüksek (3-way comparison) | Orta |

## 3. Mimari Akış

### 3.1 Phase 1: RSS Ingestion (Mevcut scheduler — minimal değişiklik)

```
RSS Item
  → Quality filter (mevcut)
  → Duplicate check (mevcut)
  → NB categorize (mevcut)
  → DB kaydet:
      kategoriId     = NB tahmini (provisional)
      nbKategoriId   = NB tahmini (sabit, değişmez)
      llmKategoriId  = NULL (henüz LLM çalışmadı)
      llmProvider    = 'pending'
      durum          = 'ham'
      kategoriDogrulandi = false
```

### 3.2 Phase 2: LLM Consensus Worker (Yeni background worker)

```
Her 30 saniyede:
  → DB'den llmProvider='pending' kayıtları çek (batch: 10, FIFO)
  → Her haber için:
      1. LLM categorize çağrısı (Gemini primary, Ollama fallback)
      2. LLM sonucunu llmKategoriId'ye yaz
      3. Consensus check:
         ├─ NB == LLM → CONSENSUS
         └─ NB != LLM → CONFLICT
      4. Haber kaydını güncelle
```

### 3.3 Phase 3: Consensus Resolution

```
CONSENSUS (NB == LLM):
  kategoriId         = aynı kategori (zaten NB'den doğru)
  kategoriDogrulandi = true
  durum              = 'hazir'
  llmProvider        = 'gemini' | 'ollama'
  augmentedAt        = now()

CONFLICT (NB != LLM):
  kategoriId         = llmKategoriId  (LLM primary olduğu için kazanır)
  kategoriDogrulandi = false
  durum              = 'ham' (manual review bekliyor)
  llmProvider        = 'gemini' | 'ollama'
  augmentedAt        = now()
  → Log: "CONFLICT 🔍 NB={Sağlık} LLM={Teknoloji} haber_id=1234"
```

## 4. `kategori_id` Alanı Yaşam Döngüsü

Bu soru tasarımın kritik noktasıdır. Netlikle belgelenmesi gerekir:

### 4.1 Geçiş Zaman Çizelgesi

```
t=0   Haber DB'ye girer
      ├── kategoriId     = NB tahmini (provisional)
      ├── nbKategoriId   = NB tahmini (FROZEN — asla değişmez)
      ├── llmKategoriId  = NULL
      ├── llmProvider    = 'pending'
      └── durum          = 'ham'

t=30s-5min  LLM Worker haberi işler
      CONSENSUS durumu:
      ├── kategoriId     = değişmez (NB zaten doğruydu)
      ├── llmKategoriId  = LLM sonucu (= NB ile aynı)
      ├── llmProvider    = 'gemini'
      ├── kategoriDogrulandi = true
      └── durum          = 'hazir'

      CONFLICT durumu:
      ├── kategoriId     = LLM sonucu (GÜNCELLENDI — LLM kazandı)
      ├── llmKategoriId  = LLM sonucu
      ├── llmProvider    = 'gemini'
      ├── kategoriDogrulandi = false
      └── durum          = 'ham' (review bekliyor)
```

### 4.2 Kurallar

1. **`nbKategoriId`** → NB'nin ilk tahmini. Yazıldıktan sonra asla güncellenmez. Karşılaştırma/audit için kullanılır.
2. **`llmKategoriId`** → LLM'nin kararı. Worker çalıştığında bir kez yazılır.
3. **`kategoriId`** → **Final kategori**. RSS ingestion sırasında NB'den gelir (provisional). Worker tamamlandığında:
   - Consensus → değişmez (NB zaten doğru)
   - Conflict → LLM sonucuyla güncellenir
4. **`llmProvider`** → Durum makinesi:
   - `'pending'` → LLM henüz çalışmadı
   - `'gemini'` / `'ollama'` → LLM tamamlandı
   - `'failed'` → LLM denenemedi (rate limit, API down) — sonraki tick'te retry
   - `'dead'` → Max retry aşıldı (llmRetryCount >= LLM_CONSENSUS_MAX_RETRIES), artık denenmez
   - `'none'` → LLM devre dışı (eski kayıtlar, LLM_CONSENSUS_ENABLED=false)

## 5. Admin Panel Davranışı

### 5.1 "Ham" statuslu haberler arayüzde görünecek mi?

**Frontend kuralı (mevcut davranış korunur):**

**UX kararı (net):** Bu proje "son dakika haber" hassasiyeti gerektirmiyor. Prensip: haber biraz gecikmeli yayınlansa da doğru kategoride yayınlansın. Bu nedenle mevcut tasarım korunur; optimistic rendering eklenmeyecek.

| Sayfa | Görünen haberler | Davranış |
|-------|-----------------|----------|
| Ana sayfa (public) | `durum = 'hazir'` VEYA `durum = 'yayinda'` | Ham haberler **görünmez** |
| Admin panel — Tüm Haberler | Tüm durumlar | Ham haberler sarı badge ile gösterilir |
| Admin panel — Review Queue | `durum = 'ham' AND llmProvider != 'pending'` | Yalnızca LLM tamamlanmış ama consensus geçememiş (conflict) haberler |
| Admin panel — Pending LLM | `llmProvider = 'pending'` | LLM bekleniyor — genellikle 0-5dk içinde boşalır |

### 5.2 Admin Panel İndikatörleri (mevcut admin API üzerinden — frontend değişikliği bu spec kapsamı dışında)

Admin paneldeki mevcut haber listesi zaten `durum` ve `kategoriDogrulandi` alanlarını gösteriyor. Yeni alanlar (`nb_kategori_id`, `llm_kategori_id`) mevcut admin API response'una eklenmeli ki frontend ileride bu bilgiyi gösterebilsin.

**API response genişletme (backend-only):**
```json
{
  "id": 1234,
  "baslik": "Opel elektrikli SUV...",
  "kategoriId": 6,
  "nbKategoriId": 4,
  "llmKategoriId": 6,
  "llmProvider": "gemini",
  "kategoriDogrulandi": false,
  "durum": "ham"
}
```

### 5.3 Conflict Resolution Actions (mevcut manual validation endpoint'i üzerinden)

Conflict'li haberler mevcut `POST /api/admin/validate` endpoint'i üzerinden çözülür:

| Action | Endpoint | DB Etkisi |
|--------|----------|-----------|
| **Onayla** (LLM doğru) | `POST /api/admin/validate { haberId, karar: 'confirm' }` | `kategoriDogrulandi=true`, `durum='hazir'` |
| **Düzelt** (admin 3. kategori seçer) | `POST /api/admin/validate { haberId, karar: 'correct', yeniKategoriId }` | `kategoriId=yeniKategoriId`, `kategoriDogrulandi=true`, `durum='hazir'`, ManuelValidasyon kaydı oluşturulur |
| **Atla** | `POST /api/admin/validate { haberId, karar: 'skip' }` | Değişiklik yok — haber `durum='ham'` kalır, sonraki review turunda tekrar görünür |

## 6. DB Schema Değişiklikleri

### 6.1 Migration: Yeni alanlar

```prisma
model Haber {
  // ... mevcut alanlar ...
  
  // YENİ: Consensus Pipeline alanları
  nbKategoriId    Int?      @map("nb_kategori_id")    // NB orijinal tahmini (frozen)
  llmKategoriId   Int?      @map("llm_kategori_id")   // LLM kategorisi
  llmRetryCount   Int       @default(0) @map("llm_retry_count") // LLM retry sayacı (max 3)
  
  // Mevcut alanlar — yeni roller:
  // kategoriId      → Final kategori (consensus sonrası)
  // llmProvider     → 'pending' | 'gemini' | 'ollama' | 'failed' | 'none'
  // kategoriDogrulandi → consensus geçtiyse true
  // durum           → 'ham' (LLM bekleniyor/conflict) | 'hazir' (consensus ok) | 'yayinda'
}
```

### 6.2 Migration SQL (uygulanacak)

```sql
ALTER TABLE haberler ADD COLUMN nb_kategori_id INTEGER REFERENCES kategoriler(id);
ALTER TABLE haberler ADD COLUMN llm_kategori_id INTEGER REFERENCES kategoriler(id);
ALTER TABLE haberler ADD COLUMN llm_retry_count INTEGER NOT NULL DEFAULT 0;

-- Mevcut tüm kayıtları legacy olarak işaretle: llm_provider='none'
-- Not: durum alanı bilinçli olarak değiştirilmez.
UPDATE haberler SET llm_provider = 'none';

-- Index: consensus worker batch query
CREATE INDEX idx_haberler_llm_pending ON haberler(llm_provider) WHERE llm_provider = 'pending';
CREATE INDEX idx_haberler_llm_failed ON haberler(llm_provider, llm_retry_count) WHERE llm_provider = 'failed';
```

## 7. Dosya Değişiklikleri

### 7.1 Yeni dosyalar

| Dosya | Açıklama |
|-------|----------|
| `backend/src/modules/llm/llm-consensus-worker.ts` | Background worker: pending haberleri çek → LLM categorize → consensus check → güncelle |
| `backend/src/modules/llm/llm-consensus-worker.singleton.ts` | Worker lifecycle bootstrap: start/stop yönetimi ve uygulama başlangıcına güvenli entegrasyon |

### 7.2 Değişecek dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `backend/prisma/schema.prisma` | +3 alan: `nbKategoriId`, `llmKategoriId`, `llmRetryCount` |
| `backend/src/modules/rss/rss-scheduler.ts` | LLM inline logic kaldır → `llmProvider='pending'` set et, NB sonucunu `nbKategoriId`'ye yaz |
| `backend/src/modules/news/news.service.ts` | `CreateNewsDto`'ya `nbKategoriId`, `llmKategoriId` ekle |
| `backend/src/config/constants.ts` | `LLM_CONSENSUS_BATCH_SIZE=10`, `LLM_CONSENSUS_INTERVAL_MS=30000` |
| `backend/src/main.ts` veya server bootstrap | Worker'ı başlat |

### 7.3 Dokunulmayacak dosyalar

| Dosya | Neden |
|-------|-------|
| `backend/src/modules/ml/ml.service.ts` | NB logic değişmiyor, sadece sonucu farklı alana yazılıyor |
| `backend/src/modules/llm/llm.service.ts` | `generate()` fonksiyonu aynen kullanılıyor |
| `backend/src/modules/llm/providers/*` | Provider'lar değişmiyor |
| Frontend (`frontend/`) | Bu spec kapsamı dışında. Mevcut `durum` filtreleme devam ediyor. Admin UI iyileştirmeleri (NB/LLM side-by-side, conflict badge) ayrı bir spec ile planlanabilir |

## 8. LLM Consensus Worker — Detaylı Tasarım

### 8.1 Sınıf yapısı

```typescript
export class LlmConsensusWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;  // re-entrancy guard
  private dailyCount: number = 0;
  private lastResetDate: string = '';
  
  constructor(
    private llmService: ContentGenerationService,
    private intervalMs: number = LLM_CONSENSUS_INTERVAL_MS,
    private batchSize: number = LLM_CONSENSUS_BATCH_SIZE
  ) {}
  
  start(): void
  stop(): void
  private async tick(): Promise<void>
  private async processBatch(): Promise<void>
  private resolveConsensus(nbKategoriId: number, llmKategoriId: number): ConsensusResult
  getStatus(): WorkerStatus
}
```

### 8.2 `processBatch()` akışı

**LLM Prompt Template (kategori-only, katı format):**

```text
SYSTEM:
Sen bir haber kategori sınıflandırıcısısın.

Sadece aşağıdaki sabit kategorilerden BIRINI döndür:
- Siyaset
- Ekonomi
- Teknoloji
- Spor
- Sağlık
- Dünya
- Genel

Kurallar:
1) Çıktı sadece kategori adı olmalı.
2) Hiçbir açıklama, gerekçe, JSON, markdown, noktalama veya ek metin yazma.
3) Büyük/küçük harf ve Türkçe karakterleri kategori listesiyle birebir koru.
4) Kararsızsan "Genel" döndür.

USER:
Baslik: {baslik}
Ozet: {ozet}
Kaynak URL: {kaynak_url}
NB Tahmin: {nb_kategori}
```

**Geçersiz yanıt politikası:** LLM çıktısı sabit listedeki 7 kategoriden biri değilse `llmKategoriId = NULL` yazılır, `kategoriId` NB tahmininde kalır, kayıt conflict üretmeden uyarı loguyla işlenir.

```
1. SELECT * FROM haberler 
   WHERE llm_provider = 'pending'
   ORDER BY yayinlanma_tarihi ASC
   LIMIT {batchSize}

2. For each haber:
   a. Build LLM input: { baslik, ozet: icerik, kategori: nbKategori.ad, kaynak_url }
   b. Call callLLMWithRetry(input) → GeneratedNewsContent
   c. Extract llmKategori from response
   d. Resolve llmKategoriId via kategoriMap
   e. Compare nbKategoriId vs llmKategoriId
   f. UPDATE haberler SET:
        llm_kategori_id = llmKategoriId,
        kategori_id = (consensus ? nbKategoriId : llmKategoriId),
        kategori_dogrulandi = (consensus ? true : false),
        llm_provider = providerName,
        augmented_at = NOW(),
        durum = (consensus ? 'hazir' : 'ham')
        -- Not: category-only worker contract. Bu worker baslik/icerik/meta_aciklama/sentiment alanlarını güncellemez.

3. Log summary: "Batch complete: {consensus}✅ {conflict}🔍 {failed}❌"
```

### 8.3 Error handling

| Hata | Davranış |
|------|----------|
| Gemini 429 rate limit | Exponential backoff (mevcut `callLLMWithRetry`) |
| Gemini API down | Ollama fallback (mevcut provider logic) |
| Her iki provider da down | `llmProvider = 'failed'`, haber NB kategorisinde kalır, sonraki tick'te tekrar dener |
| Geçersiz LLM kategori | `llmKategoriId = NULL`, NB kategorisi geçerli kalır, log uyarı |
| DB write hatası | Catch, log, sonraki habere geç |

### 8.4 Retry policy for failed items

```
llmProvider = 'failed' olan kayıtlar:
  → Sonraki tick'lerde tekrar denenir (her tick'te pending + failed birlikte çekilir)
  → Retry counter: `llm_retry_count` alanı her başarısız denemede +1 artar
  → llm_retry_count >= LLM_CONSENSUS_MAX_RETRIES (default: 3) → llmProvider = 'dead'
  → Dead letter haberleri NB kategorisiyle kalır, durum = 'ham'
  → Worker query: `WHERE (llm_provider = 'pending') OR (llm_provider = 'failed' AND llm_retry_count < {LLM_CONSENSUS_MAX_RETRIES})`
```

## 9. RSS Scheduler Simplification

Mevcut scheduler'dan **kaldırılacak** logic:

```diff
- // 4. LLM Zenginleştirme bloğu (satır ~320-370)
- const quotaAvailable = LLM_PIPELINE_ENABLED && ...
- if (quotaAvailable) { ... callLLMWithRetry ... }
- // LLM category override logic
- if (normalizedKategori) { const llmCatId = ... finalCatId = llmCatId; }

+ // 4. Consensus Pipeline: LLM'i worker'a bırak
+ const llmProviderValue = LLM_PIPELINE_ENABLED ? 'pending' : 'none';
```

Scheduler'ın yeni DB kayıt bloğu:

```typescript
await this.newsService.createNews({
    baslik: safeTitle,
    icerik: contentFallback,
    metaAciklama: contentFallback.substring(0, 150) + "...",
    kategoriId: finalCatId,          // NB tahmini (provisional)
    nbKategoriId: finalCatId,        // NB tahmini (frozen)
    llmKategoriId: null,             // Worker dolduracak
    sentiment: sentRes?.label || "Nötr",
    mlConfidence: catRes?.confidence,
    gorselUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167",
    kaynakUrl: safeLink,
    durum: 'ham',                    // Her zaman ham başlar
    llmProvider: llmProviderValue,   // 'pending' veya 'none'
    kategoriDogrulandi: false,
    augmentedAt: undefined
});
```

## 10. Konfigürasyon

```typescript
// constants.ts — YENİ sabitler
export const LLM_CONSENSUS_ENABLED = toBool(process.env.LLM_CONSENSUS_ENABLED, true);
export const LLM_CONSENSUS_BATCH_SIZE = toInt(process.env.LLM_CONSENSUS_BATCH_SIZE, 10);
export const LLM_CONSENSUS_INTERVAL_MS = toInt(process.env.LLM_CONSENSUS_INTERVAL_MS, 30_000);
export const LLM_CONSENSUS_MAX_RETRIES = toInt(process.env.LLM_CONSENSUS_MAX_RETRIES, 3);
```

## 11. Monitoring & Observability

### 11.1 Worker status endpoint

```
GET /api/llm/consensus/status
→ {
    isRunning: true,
    pendingCount: 12,
    todayProcessed: 187,
    todayConsensus: 142,
    todayConflict: 38,
    todayFailed: 7,
    lastTickAt: "2026-04-11T14:30:00Z",
    dailyQuota: { used: 187, limit: 400 }
  }
```

### 11.2 Consensus istatistikleri (SQL view)

```sql
-- Günlük consensus raporu
SELECT 
  DATE(augmented_at) as tarih,
  COUNT(*) FILTER (WHERE nb_kategori_id = llm_kategori_id) as consensus,
  COUNT(*) FILTER (WHERE nb_kategori_id != llm_kategori_id) as conflict,
  COUNT(*) FILTER (WHERE llm_provider = 'failed') as failed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE nb_kategori_id = llm_kategori_id) / 
    NULLIF(COUNT(*) FILTER (WHERE llm_kategori_id IS NOT NULL), 0), 1
  ) as consensus_rate_pct
FROM haberler
WHERE llm_kategori_id IS NOT NULL
GROUP BY DATE(augmented_at)
ORDER BY tarih DESC;
```

## 12. Tez Çıktıları

Bu mimari 3 temel karşılaştırma tablosu üretir:

| Metrik | Kaynak | Açıklama |
|--------|--------|----------|
| NB-only accuracy | `nb_kategori_id` vs `manuel_validasyonlar.yeni_kategori_id` | NB tek başına ne kadar doğru? |
| LLM-only accuracy | `llm_kategori_id` vs `manuel_validasyonlar.yeni_kategori_id` | LLM tek başına ne kadar doğru? |
| Consensus accuracy | `kategori_id` (final) vs `manuel_validasyonlar.yeni_kategori_id` | İki model birlikte ne kadar doğru? |
| Conflict rate | `nb_kategori_id != llm_kategori_id` / toplam | Hangi kategorilerde en çok uyuşmazlık var? |
| Latency comparison | NB ~1ms, LLM ~1500ms, Consensus async (user-invisible) | Performans karşılaştırma |

## 13. Rollback Plan

Consensus pipeline sorun çıkarırsa:

1. `LLM_CONSENSUS_ENABLED=false` → Worker durur, scheduler `llmProvider='none'` yazar
2. Mevcut NB-only akış devam eder
3. `pending` kayıtlar `none` olarak güncellenir:
   ```sql
   UPDATE haberler SET llm_provider = 'none', durum = 'hazir' 
   WHERE llm_provider = 'pending';
   ```

## 14. Implementation Order

1. **Schema migration** → `nb_kategori_id`, `llm_kategori_id`, `llm_retry_count` alanları + index
2. **constants.ts** → Yeni config sabitleri
3. **news.service.ts** → CreateNewsDto genişlet
4. **rss-scheduler.ts** → LLM inline logic kaldır, `pending` + `nbKategoriId` yaz
5. **llm-consensus-worker.ts** → Yeni worker dosyası oluştur
6. **Server bootstrap** → Worker'ı başlat
7. **Smoke test** → 5 haber ile end-to-end doğrulama
8. **Admin endpoint** → `/api/llm/consensus/status`

## 15. Skill ve Workflow Entegrasyonu (Plan/İcra)

Bu bölüm planlama ve uygulama sürecinde kullanılacak yetenekleri netleştirir.

### 15.1 Zorunlu (bu plan için onaylandı)

- `.agent/skills/executing-plans` — implementasyon yürütme standardı
- `.agent/skills/verification-before-completion` — her görev sonrası doğrulama
- `.agent/workflows/health-check.md` — worker bootstrap sonrası sistem sağlığı
- `.agent/workflows/rollback.md` — `LLM_CONSENSUS_ENABLED=false` rollback akışı
- `.agent/skills/systematic-debugging` — beklenmeyen worker davranışlarında kök neden analizi
- `.agent/skills/test-driven-development` — worker birim/integrasyon testleri

### 15.2 Faydalı (risk bazlı uygulanacak)

- `.agent/workflows/rss-health-monitor.md` — RSS döngüsü etkileniyor mu kontrolü
- `.agent/skills/security-auditor` — prompt injection ve LLM input sanitization denetimi

### 15.3 Meta-kural uyumu

`.agent/agency-meta-rules.md` gereği:

- Prompt/LLM davranış değişikliklerinde `.agent/skills/ai-prompt-engineer` review adımı uygulanır.
- RSS ingestion değişikliklerinde `.agent/workflows/rss-health-monitor.md` çalıştırılır.

Not: İstenen `nodejs-best-practices` ve `backend-specialist.md` bu repository içinde tanımlı değil; eşdeğer kalite kontrolü `comprehensive-review`, `refactoring-advisor` ve test/review adımlarıyla sağlanacaktır.
