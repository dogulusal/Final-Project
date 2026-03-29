import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PORT, NODE_ENV, LOG_LEVEL, CORS_ALLOWED_ORIGINS } from './config/constants';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth.middleware';
import { validateEnvironment, logValidationResults } from './config/env-validation';

// === Validate Environment on Startup ===
const envValidation = validateEnvironment();
logValidationResults(envValidation);

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

import { rssRouter } from './modules/rss';
import { mlRouter } from './modules/ml';
import { llmRouter } from './modules/llm';
import { renderRouter } from './modules/render';
import { newsRouter } from './modules/news';
import { socialRouter } from './modules/social';
import { adminRouter } from './modules/admin/admin.controller';
import { AuthService } from './modules/admin/auth.service';
import { createLoginResponse } from './common/auth';
import { loginLimiter } from './middleware/rate-limiters';

app.use('/api/rss', rssRouter);
app.use('/api/ml', authMiddleware, mlRouter);
app.use('/api/llm', authMiddleware, llmRouter); // LLM kotası koruma: yetkisiz çağrı = Gemini maliyeti
app.use('/api/news', newsRouter);
app.use('/api/render', renderRouter);
app.use('/api/social', socialRouter);

// Mount /api/admin/login PUBLIC endpoint (NO auth required)
app.post('/api/admin/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, sifre } = req.body;

        if (!email || !sifre) {
            return res.status(400).json({
                success: false,
                error: 'Email ve şifre gereklidir'
            });
        }

        // Kullanıcı doğrula
        const user = await AuthService.login(email, sifre);

        // JWT token'ları oluştur
        const tokens = createLoginResponse(user.id, user.email, 'admin' as any);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    ad: user.ad
                },
                ...tokens
            }
        });
    } catch (error: any) {
        console.error('[Auth] Login hatası:', error.message);
        next(error);
    }
});

// Mount rest of /api/admin routes WITH authentication
app.use('/api/admin', authMiddleware, adminRouter);


// --- Background Tasks ---
import { rssScheduler } from './modules/rss/rss-scheduler';
import { backupScheduler } from './scripts/backup-scheduler';
rssScheduler.start(); // RSS periyodik toplayıcısını başlat
backupScheduler.start(); // Günlük veritabanı yedeklemesini başlat

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('[Server] Kapatılıyor...');
    rssScheduler.stop();
    backupScheduler.stop();
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[Server] Kapatılıyor (Ctrl+C)...');
    rssScheduler.stop();
    backupScheduler.stop();
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
