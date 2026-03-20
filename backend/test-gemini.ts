import 'dotenv/config';
import { GeminiProvider } from './src/modules/llm/providers/gemini.provider';

async function test() {
    const g = new GeminiProvider();
    const ok = await g.isAvailable();
    console.log('Gemini available:', ok);
    console.log('API Key prefix:', process.env.LLM_API_KEY?.substring(0, 15) + '...');
    
    if (ok) {
        const r = await g.generateContent(
            '[{"id": 1, "baslik": "Fenerbahce basketbol maci"}]',
            'Haberleri kategorize et. Spor, Ekonomi, Teknoloji, Siyaset, Dunya, Saglik, Genel kategorilerinden birini sec. JSON olarak: [{"id": 1, "kategori": "Spor"}]'
        );
        console.log('Response:', r.content.substring(0, 200));
        console.log('Tokens used:', r.tokensUsed);
    }
}

test().catch(e => console.error('ERROR:', e.message));
