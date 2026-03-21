import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { CACHE_TTL_SECONDS } from '../config/constants';

/**
 * Redis Response Cache Middleware
 *
 * GET istekleri için URL + query parametrelerine göre cache key oluşturur.
 * Cache hit: JSON doğrudan Redis'ten döner (DB'ye gidilmez).
 * Cache miss: Normal handler çalışır, `res.json` override edilerek yanıt cache'e yazılır.
 *
 * Cache invalidation:
 *   - Her habere `cacheInvalidate()` çağrıldığında o pattern'daki keyler silinir.
 *   - Scheduler yeni haber eklediğinde news cache'i otomatik temizlenir.
 */
export function cacheMiddleware(ttlSeconds: number = CACHE_TTL_SECONDS) {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Yalnızca GET isteklerini cache'le
        if (req.method !== 'GET') return next();

        const cacheKey = `api:cache:${req.originalUrl}`;

        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json');
                res.send(cached);
                return;
            }
        } catch (err) {
            // Redis erişilemezse cache'i atla — graceful degradation
            console.warn('[Cache] Redis erişilemedi, cache atlanıyor:', (err as Error).message);
            return next();
        }

        // Cache miss: orijinal res.json'u yakala ve cache'e yaz
        res.setHeader('X-Cache', 'MISS');
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            redis.setex(cacheKey, ttlSeconds, JSON.stringify(body)).catch((err) =>
                console.warn('[Cache] Yazma hatası:', (err as Error).message)
            );
            return originalJson(body);
        };

        next();
    };
}

/**
 * Belirtilen pattern ile eşleşen tüm cache key'lerini siler.
 * Örnek: invalidateCache('api:cache:/api/news*') → tüm news listesi cache'lerini siler.
 */
export async function invalidateCache(pattern: string): Promise<void> {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`[Cache] ${keys.length} key temizlendi: ${pattern}`);
        }
    } catch (err) {
        console.warn('[Cache] Invalidation hatası:', (err as Error).message);
    }
}
