require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

const INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS "haberler_kategori_id_durum_yayinlanma_tarihi_idx"
   ON "haberler" ("kategori_id", "durum", "yayinlanma_tarihi" DESC)`,
  `CREATE INDEX IF NOT EXISTS "haberler_durum_sentiment_yayinlanma_tarihi_idx"
   ON "haberler" ("durum", "sentiment", "yayinlanma_tarihi" DESC)`,
];

client.connect()
  .then(async () => {
    for (const sql of INDEX_SQL) {
      await client.query(sql);
    }

    const r = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename='haberler' ORDER BY indexname"
    );
    console.log('Indexes on haberler:', r.rows.map(x => x.indexname).join(', '));
    await client.end();
  })
  .catch(e => { console.error('Error:', e.message); process.exit(1); });





