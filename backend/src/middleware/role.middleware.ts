import { Request, Response, NextFunction } from 'express';

/**
 * Kullanıcı rolleri
 */
export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
}

/**
 * Role guard middleware — JWT'de bulunan role'ün belirtilen role'lerden birine eşit olup olmadığını kontrol et.
 * 
 * Kullanım:
 *   router.get('/admin/stats', verifyJwtToken, requireRole([UserRole.ADMIN]), adminStatsHandler)
 */
export const requireRole = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // verifyJwtToken middleware'ı çalışmış olmalı
        if (!req.userRole) {
            return res.status(403).json({
                success: false,
                code: 'ROLE_MISSING',
                message: 'Kullanıcı rolü bulunamadı. Önce verifyJwtToken middleware\'ı çalıştırınız.'
            });
        }

        if (!allowedRoles.includes(req.userRole as UserRole)) {
            return res.status(403).json({
                success: false,
                code: 'INSUFFICIENT_PERMISSIONS',
                message: `Bu endpoint'e erişim izni yok. Gerekli rol: ${allowedRoles.join(', ')}`
            });
        }

        next();
    };
};
