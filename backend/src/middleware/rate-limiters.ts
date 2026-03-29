import rateLimit from 'express-rate-limit';

/**
 * Login endpoint rate limiter: 5 requests per 15 minutes per IP
 * Brute force saldırılarını önlemek için sıkı sınırlama
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 5, // 5 deneme
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Giriş denemesi çok fazla. 15 dakika sonra tekrar deneyin.'
    },
    skip: (req) => {
        // Development modunda skip et
        return process.env.NODE_ENV === 'development';
    }
});

/**
 * General API rate limiter: 100 requests per minute per IP
 * Tüm API endpoints için
 */
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 dakika
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Çok fazla istek gönderildi, lütfen bir süre bekleyin.'
    }
});
