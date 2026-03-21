import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PORT, NODE_ENV, LOG_LEVEL, CORS_ALLOWED_ORIGINS } from './config/constants';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth.middleware';


const app = express();

// --- Middleware ---
// Helmet: güvenli HTTP başlıkları (X-Content-Type-Options, X-Frame-Options, vb.)
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production',  // Sadece prod'da CSP
    crossOriginEmbedderPolicy: false, // Next.js ile uyumluluk için
}));
app.use(cors({
    origin: CORS_ALLOWED_ORIGINS,
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiter: max 100 requests per minute per IP
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Çok fazla istek gönderildi, lütfen bir süre bekleyin.' }
});
app.use('/api/', apiLimiter);

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
import { llmRouter } from './modules/llm';
import { renderRouter } from './modules/render';
import { newsRouter } from './modules/news';
import { socialRouter } from './modules/social';
import { adminRouter } from './modules/admin/admin.controller';

app.use('/api/rss', rssRouter);
app.use('/api/ml', authMiddleware, mlRouter);
app.use('/api/llm', authMiddleware, llmRouter); // LLM kotası koruma: yetkisiz çağrı = Gemini maliyeti
app.use('/api/news', newsRouter);
app.use('/api/render', renderRouter);
app.use('/api/social', socialRouter);
app.use('/api/admin', authMiddleware, adminRouter);


// --- Background Tasks ---
import { rssScheduler } from './modules/rss/rss-scheduler';
rssScheduler.start(); // RSS periyodik toplayıcısını başlat

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('[Server] Kapatılıyor...');
    rssScheduler.stop();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[Server] Kapatılıyor (Ctrl+C)...');
    rssScheduler.stop();
    process.exit(0);
});

// --- Centralized Error Handler (EN SON middleware olmalı) ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`[Server] AI Haber Ajansı backend çalışıyor → http://localhost:${PORT}`);
    console.log(`[Server] Ortam: ${NODE_ENV} | Log seviyesi: ${LOG_LEVEL}`);
});

export default app;
