require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(async () => {
    const r = await client.query(
      "SELECT indexname FROM pg_indexes WHERE tablename='haberler' ORDER BY indexname"
    );
    console.log('Indexes on haberler:', r.rows.map(x => x.indexname).join(', '));
    await client.end();
  })
  .catch(e => { console.error('Error:', e.message); process.exit(1); });





