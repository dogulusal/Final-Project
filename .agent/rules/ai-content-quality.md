---
trigger: always_on
---

# AI Content Quality Rules

LLM (Gemini/Ollama) tarafından üretilen haber özetleri ve içerikler için kalite standartları:

1. **Neutrality (Tarafsızlık)**: Üretilen özetlerde duygusal veya yanlı sıfatlar (örn: "skandal", "muhteşem", "korkunç") sadece haberin kaynağında doğrudan alıntı olarak yer alıyorsa kullanılabilir.
2. **Fact First**: Özetin ilk cümlesi her zaman haberin temel "Kim, Ne, Nerede, Ne Zaman" bilgisini içermelidir.
3. **Bias Scale Integration**: Her özet üretildiğinde sistem otomatik olarak bir "Bias Check" (Taraflılık Ölçümü) yapmalı ve 0.7 üzeri taraflılık saptanan içerikler admin onayına düşmelidir.
4. **Length Constraint**: Smart Brevity formatına uygun olarak özetler asla 300 kelimeyi geçmemeli, maddeler (bullet points) halinde sunulmalıdır.
5. **Source Attribution**: Her AI özeti, hangi orijinal kaynağa dayandığını (`kaynakUrl`) açıkça belirtmelidir.
