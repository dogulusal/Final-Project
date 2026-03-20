---
trigger: always_on
---

# ML Stability Rules

Bu kurallar AI News Agency'nin "beyni" olan Naive Bayes ve LLM modellerinin kararlılığını korumak içindir:

1. **Accuracy Threshold**: `ml.service.ts` içindeki `lastAccuracy` değeri asla %70'in altına düşmemelidir. Eğer deneme testlerinde (test-ml.ts) başarı oranı %70 altındaysa model yayına alınmaz.
2. **Confidence Normalization**: Tahmin skorları (Confidence) her zaman Softmax benzeri bir normalizasyondan geçmelidir. Ham olasılıklar asla doğrudan UI'a yansıtılmaz.
3. **Training Data Balance**: Eğitim setinde bir kategori, en küçük kategoriden 10 kat daha fazla veriye sahip olmamalıdır. Dengesizlik varsa LLM ile sentetik veri üretimi veya veri seyreltme (under-sampling) uygulanmalıdır.
4. **Approval Workflow**: ML tarafından "Genel" olarak etiketlenen haberler, LLM tarafından onaylanmadıkça "Yayında" statüsüne geçirilmemelidir.
5. **Retraining Frequency**: Model her 1000 yeni "onaylanmış" haberde bir yeniden eğitilmelidir (`loadAndTrainFromDB`).
