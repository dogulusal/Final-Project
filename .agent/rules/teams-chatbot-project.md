---
trigger: always_on
---

Bu proje bir Teams Chatbot Backend projesidir (Node.js + TypeScript). Aşağıdaki proje bağlamını her zaman dikkate al:

1. Mimari: Azure Bot Service + Bot Framework SDK + Azure OpenAI + Power BI + On-Prem MS SQL
2. Deploy: Docker container — hem Azure hem self-hosted çalışabilmeli
3. Cache: In-memory cache ile başla, ileride Redis'e geçilebilir
4. Veri stratejisi: Büyük veriyi AI'a gönderme, önce SQL/DAX ile filtrele, sadece sonucu AI'a formattat
5. Hibrit platform: Teams App (hızlı sorgular) + Web Dashboard (detaylı analizler)
6. Knowledge Base: Her gece DB senkronizasyonu ile kalıcı bilgi tabanı
7. Kullanıcı sayısı: 20-500 arası ölçeklenebilir olmalı
