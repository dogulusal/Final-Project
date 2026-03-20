import { Request, Response, NextFunction } from 'express';
import { ADMIN_API_KEY } from '../config/constants';

/**
 * Admin ve ML endpoint'lerini korumak için basit bir API Key middleware.
 * İstek başlığında (Header) 'x-api-key' bekler.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            message: 'Yetkisiz erişim. Geçerli bir API Key gereklidir.'
        });
    }

    next();
};
