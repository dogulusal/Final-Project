import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ADMIN_API_KEY, JWT_SECRET } from '../config/constants';

/**
 * Express Request'i extend et — JWT payload'unu attach et
 */
declare global {
    namespace Express {
        interface Request {
            userId?: string | number;
            userRole?: string;
            token?: string;
        }
    }
}

/**
 * JWT token'ı verify et. Authorization header'ı kontrol et: "Bearer <token>"
 */
export const verifyJwtToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            code: 'NO_TOKEN',
            message: 'Kimlik doğrulama gereklidir. Authorization header\'ı eksiktir.'
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN_FORMAT',
            message: 'Geçersiz token formatı. "Bearer <token>" bekleniyor.'
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.userId = decoded.id;
        req.userRole = decoded.role;
        req.token = token;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRED',
                message: 'Token süresi dolmuştur.'
            });
        }
        return res.status(401).json({
            success: false,
            code: 'INVALID_TOKEN',
            message: 'Geçersiz token.'
        });
    }
};

/**
 * Selective authentication middleware — bazı path'leri skip et (örn: /login)
 * Eski x-api-key ile backward compatibility sağla
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Public path'ler — auth gereksizyayız
    const publicPaths = ['/api/admin/login', '/api/health'];
    if (publicPaths.some(path => req.path === path || req.originalUrl.includes(path))) {
        return next();
    }

    // Eğer Authorization header varsa (Bearer ya da başka format) JWT doğrulamayı dene
    // verifyJwtToken format kontrolü de yapıyor (INVALID_TOKEN_FORMAT kodu ile)
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return verifyJwtToken(req, res, next);
    }

    // Fallback: x-api-key kontrolü (eski sistem, backward compatibility)
    // NOT: Boş/eksik ADMIN_API_KEY'de fallback'e izin ver (legacy mode devre dışı)
    if (!ADMIN_API_KEY || ADMIN_API_KEY.trim() === '') {
        // Legacy API key devre dışı — JWT gerekli
        return res.status(401).json({
            success: false,
            code: 'AUTH_REQUIRED',
            message: 'Kimlik doğrulama gereklidir. JWT token kullanınız.'
        });
    }

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            code: 'INVALID_API_KEY',
            message: 'Yetkisiz erişim. Geçerli bir API Key gereklidir.'
        });
    }

    next();
};
