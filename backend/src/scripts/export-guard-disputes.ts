/**
 * Export bekliyor disputes from DB to JSON fixture file.
 * Usage: npx ts-node src/scripts/export-guard-disputes.ts
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const rows = await prisma.$queryRaw<any[]>`
        SELECT dq.haber_id AS id,
               h.baslik AS title,
               COALESCE(h.icerik, '') AS summary,
               knb.ad AS "nbCategory",
               kllm.ad AS "llmCategory",
               ROUND(h.ml_confidence::numeric, 4) AS "mlConfidence",
               ROUND(dq.llm_guven_skoru::numeric, 4) AS "llmConfidence"
        FROM dispute_queue dq
        JOIN haberler h ON h.id = dq.haber_id
        JOIN kategoriler knb ON knb.id = dq.nb_kategori_id
        JOIN kategoriler kllm ON kllm.id = dq.llm_kategori_id
        WHERE dq.durum = 'bekliyor'
        ORDER BY dq.id
    `;

    console.log(`Exported ${rows.length} bekliyor disputes`);

    // Validate categories
    const validCats = new Set(['Spor', 'Ekonomi', 'Teknoloji', 'Siyaset', 'Dünya', 'Sağlık', 'Genel']);
    for (const r of rows) {
        if (!validCats.has(r.nbCategory)) console.warn(`Invalid nbCategory: ${r.nbCategory} (id=${r.id})`);
        if (!validCats.has(r.llmCategory)) console.warn(`Invalid llmCategory: ${r.llmCategory} (id=${r.id})`);
        // Convert Decimal to number for JSON serialization
        r.mlConfidence = Number(r.mlConfidence);
        r.llmConfidence = Number(r.llmConfidence);
    }

    const outPath = path.resolve(__dirname, '../__tests__/fixtures/guard-dispute-42.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`Written to ${outPath}`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
