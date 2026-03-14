import { prisma } from '../config/database';
import fs from 'fs';
import path from 'path';

/**
 * Veritabanındaki 'yayinda' veya 'hazir' durumunda olan, yüksek güven skoruna sahip haberleri toplayıp
 * AI (OpenAI / Gemini) Fine-tuning işlemi için gerekli olan .jsonl formatında dışa aktarır.
 */
async function exportForFineTuning() {
    console.log('[Fine-Tuning Pipeline] Veritabanına bağlanılıyor...');

    try {
        const approvedNews = await prisma.haber.findMany({
            where: {
                durum: { in: ['hazir', 'yayinda'] }
            },
            include: {
                kategori: true
            }
        });

        if (approvedNews.length === 0) {
            console.log('[Fine-Tuning Pipeline] Yeterli onaylı haber bulunamadı.');
            return;
        }

        console.log(`[Fine-Tuning Pipeline] ${approvedNews.length} adet onaylı haber bulundu.`);

        // Export dosya yolu (Root klasöründe 'data/fine-tuning')
        const exportDir = path.resolve(__dirname, '../../../../data/fine-tuning');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(exportDir, `dataset-${timestamp}.jsonl`);

        // JSONL (JSON Lines) formatı oluşturma (OpenAI formatına uygun yapılandırılmıştır)
        // Her satır, mesajlar dizisi içeren bir JSON objesidir.
        let savedCount = 0;
        const fileStream = fs.createWriteStream(filename, { flags: 'a' });

        for (const news of approvedNews) {
            if (!news.icerik || !news.kategori) continue;

            const systemPrompt = "Sen profesyonel, tarafsız ve kısa (Smart Brevity) özetler çıkaran bir AI haber editörüsün. Sana verilen karmaşık haberi temizle ve en can alıcı noktalarına göre haber metnini ve doğru kategoriyi belirle.";
            const userContent = `Aşağıdaki haber metnini analiz et, yeniden yaz ve kategorisini belirle:\\n\\nBaşlık: ${news.baslik}\\nÖrijinal Metin: ${news.icerik}`;
            const assistantContent = `Kategori: ${news.kategori.ad}\\n\\nHaber:\\n${news.icerik}`;

            const jsonLine = JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                    { role: "assistant", content: assistantContent }
                ]
            });

            fileStream.write(jsonLine + '\n');
            savedCount++;
        }

        fileStream.end();

        console.log(`[Fine-Tuning Pipeline] Başarılı! ${savedCount} adet haber '.jsonl' formatında dışa aktarıldı.`);
        console.log(`[Dosya Konumu] ${filename}`);
        console.log(`Şimdi bu dosyayı CLI arayüzünüz ile (veya OpenAI/UI üzerinden) sisteme yükleyebilirsiniz.`);
        console.log(`Örnek OpenAI Kodu: openai api fine_tunes.create -t "${filename}" -m "gpt-3.5-turbo"`);

    } catch (error) {
        console.error('[Fine-Tuning Error] Dışa aktarma sırasında kritik hata:', error);
    } finally {
        await prisma.$disconnect();
    }
}

exportForFineTuning();
