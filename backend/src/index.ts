import express from 'express';
import cors from 'cors';
import { PORT, NODE_ENV, LOG_LEVEL } from './config/constants';

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Health Check ---
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// --- Routes (Faz 1-4'te eklenecek) ---
import { rssRouter } from './modules/rss';
import { mlRouter } from './modules/ml';

app.use('/api/rss', rssRouter);
app.use('/api/ml', mlRouter);
// app.use('/api/llm', llmRouter);
// app.use('/api/news', newsRouter);
// app.use('/api/render', renderRouter);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`[Server] AI Haber Ajansı backend çalışıyor → http://localhost:${PORT}`);
    console.log(`[Server] Ortam: ${NODE_ENV} | Log seviyesi: ${LOG_LEVEL}`);
});

export default app;
