# Azure Cost Awareness (Maliyet Farkındalığı Kuralı)

Bu proje (Teams Chatbot Backend), yapısı gereği bulut faturası (Cost) üretebilecek harici servislere (Azure OpenAI, MS SQL, Power BI) ciddi derecede bağımlıdır. Çözüm üretirken maliyet optimizasyonu her zaman önceliklidir!

Aşağıdaki ilkeler **mutlaka** gözetilmelidir:

## 1. Büyük Veriyi AI'a Gönderme
Bunu asla yapma! SQL'den çekilen 10.000 satırlık hantal tabloyu doğrudan OpenAI LLM promtunun içine atamazsın.
- Bu hem LLM limitlerini patlatır (Context Length), hem de aşırı **TOKEN faturası** ödemene neden olur.
- **Çözüm:** Önce SQL veya DAX kullanarak veriyi olabildiğince filtreden/agregasyondan (+ GROUP BY) geçir, yalnızca özetlenmiş veya en dar kapsamlı final JSON sonucunu (ör. İlk 10 satır ya da sadece toplam hesaplamalar) AI modeline ilet.

## 2. Tekrarlayan İşler İçin Cache (Önbellek)
Performans ve Azure maliyetini düşürmek için, sistemde devamlı aynı sorular/sonuçlar geliyorsa AI veya SQL'e tekrar erişme.
- Bot'a sorulan sabit (ör: "Merhaba", "Yardım") sorular önbellekten mi karşılanıyor?
- Geniş çaplı finansal hesaplamalar günlük olarak SQL'den mi çekiliyor? **Redis veya In-memory Cache** ile tutulmalı. Sadece TTL dolunca istek Azure'a gitmeli.

## 3. Power BI Embedded Yükü
Power BI Embedded kapasite sınırlarına dikkat edin. Sürekli birbiri ardına ağır DAX sorguları ateşlemek kapasiteyi (ve Capacity Node maliyetlerini) dondurabilir. Yavaşlatılmış sorgular ve kuyruklama yapıları düşünün.

## 4. Prompt Optimizasyonu
Azure OpenAI API çağrılarında (GPT-3.5 / GPT-4) promtları kısa, net ve sistemi gereksiz yönlendirmelerden arındırılmış halde yazın. Ne kadar uzun "System Message", o kadar fazla gereksiz Input Token parası demektir.

Bir kod yazarken veya mimari kurgularken, "Bu işlem 500 kullanıcı tarafından saniyede 1 kez yapılırsa Azure Faturası ne gelir?" sorusunu sormadan onay vermeyin.
