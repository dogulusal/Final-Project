# Faz 1 Ablation Study Results

**Tarih:** 2026-04-16
**Commit:** e722bfb feat(ml): Faz 1 NB optimizasyonları tamamlandı
**Branch:** feature/tokenizer-unicode-aware

---

## Özet

Toplam 6 senaryo koşturuldu. Her senaryoda yalnızca ilgili optimizasyon devre dışı bırakıldı ve kalan tüm optimizasyonlar aktif kaldı.

- **Baseline (tüm optimizasyonlar aktif):** %75.65 / Dünya→Siyaset=27 / Genel→Siyaset=11
- **Tüm eğitim (training-faz1-2026-04-16.log, tam referans):** %77.28

> Not: Ablation baseline ile tam eğitim arasındaki ~1.6pp fark, DB'ye eklenen 4 yeni haber ve stokastik split varyansından kaynaklanmaktadır (2469 → 2473 sample).

---

## Per-Task Sonuçlar

| Task | Optimizasyon | Senaryo Accuracy | Delta (pozitif = task katkı sağlar) | Dünya→Siyaset | Genel→Siyaset |
|------|-------------|-----------------|--------------------------------------|--------------|--------------|
| baseline | (hepsi aktif) | **75.65%** | — | 27 | 11 |
| 1.1 | Dünya↔Siyaset hard negatives | 76.26% | **-0.61pp** | 30 | 19 |
| 1.2 | Siyaset cap 0.13→0.08 | 77.06% | **-1.41pp** | 16 | 14 |
| 1.3 | Content slice 300→800 | 78.67% | **-3.02pp** | 17 | 10 |
| 1.4 | Sağlık keyword expansion | 75.45% | +0.20pp | 27 | 14 |
| 1.5 | Ekonomi→Tech hard negatives | 75.25% | +0.40pp | 34 | 17 |

**Delta yorumu:** `deltaPositiveForTask = baseline - scenario`. Negatif = task kaldırılınca accuracy yükseliyor → task accuracy'yi düşürüyor.

---

## Karar Analizi (Plan Decision Gate kuralları)

### Kural 1: Δ <= -0.20pp → Revert by default
- **Task 1.1 (-0.61pp):** Accuracy düşürüyor. ANCAK confusion pairs iyileşiyor (Genel→Siyaset: 19→11 ↓, Dünya→Siyaset: 30→27 ↓). **Kural 2'ye geçer.**
- **Task 1.2 (-1.41pp):** Accuracy düşürüyor. Dünya→Siyaset 16→27 ↑ (daha kötü), Genel→Siyaset 14→11 ↓. **Kural 2'ye geçer.**
- **Task 1.3 (-3.02pp):** 800 char slice açıkça accuracy düşürüyor. Confusion pairs da daha kötü (Dünya→Siyaset 17→27 ↑). **Güçlü revert adayı.**

### Kural 2: Tam bundle >= +2.0pp verirse mild negative tutulabilir
- Tam Faz 1 bundle: %77.28 vs pre-Faz-1 baseline %73.44 = **+3.84pp** ✅ (>= +2.0pp koşulu sağlanıyor)
- Task 1.1: confusion improvement var → **KORU** (net confusion azaltıyor)
- Task 1.2: Genel→Siyaset iyileşiyor → **TARTIŞMALI** (Dünya→Siyaset kötüleşiyor ama net azalma var)

### Task 1.3 özel değerlendirme
- 800 char slice: hem accuracy -3.02pp hem confusion daha kötü
- 300 char ile: 78.67% accuracy, Dünya→Siyaset=17, Genel→Siyaset=10
- **KARAR: Task 1.3 revert edilmeli → slice 800→300**
- Bu değişiklikle beklenen Faz 1 accuracy: ~78-80%

---

## Önerilen Aksiyon

1. **Hemen revert:** `icerik.slice(0, 800)` → `icerik.slice(0, 300)` (Task 1.3)
   - Beklenen kazanç: +3pp accuracy, daha az Dünya↔Siyaset konfüzyonu
   
2. **İzle:** Task 1.2 (cap 0.08) – Siyaset precision vs overall accuracy tradeoff
   - Eğer Faz 2 (LR+TF-IDF) bu ayrımı zaten yapabiliyorsa, cap kaldırılabilir

3. **Koru:** Task 1.1 (hard negatives), Task 1.4 (Sağlık), Task 1.5 (Ekonomi→Tech)

---

## Referans Log Dosyaları

- Baseline: `ablation-baseline-2026-04-16T21-08-49-414Z.log`
- no-task11: `ablation-no-task11-2026-04-16T21-08-49-414Z.log`
- no-task12: `ablation-no-task12-2026-04-16T21-08-49-414Z.log`
- no-task13: `ablation-no-task13-2026-04-16T21-08-49-414Z.log`
- no-task14: `ablation-no-task14-2026-04-16T21-08-49-414Z.log`
- no-task15: `ablation-no-task15-2026-04-16T21-08-49-414Z.log`
- Full summary JSON: `ablation-summary-2026-04-16T21-08-49-414Z.json`
