import { Request, Response, NextFunction } from 'express';

/**
 * Centralized Error Handling Middleware
 * Node.js Best Practice: Error response formatını standartlaştır,
 * Client'a internal detail gönderme, hatayı logla.
 */

// Custom application error class
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, code: string, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

// Pre-defined error factories
export const NotFoundError = (resource: string) =>
    new AppError(`${resource} bulunamadı`, 404, 'NOT_FOUND');

export const ValidationError = (message: string) =>
    new AppError(message, 400, 'VALIDATION_ERROR');

export const UnauthorizedError = (message = 'Yetkilendirme gerekli') =>
    new AppError(message, 401, 'UNAUTHORIZED');

export const ConflictError = (message: string) =>
    new AppError(message, 409, 'CONFLICT');

export const ServiceUnavailableError = (service: string) =>
    new AppError(`${service} servisi şu an kullanılamıyor`, 503, 'SERVICE_UNAVAILABLE');

// Centralized error handler middleware (Express'te SON middleware olarak eklenir)
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    // AppError (bilinen, kendi yarattığımız hata)
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
        });
        return;
    }

    // JSON parse hatası (kötü body gönderilmiş)
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_JSON',
                message: 'Gönderilen istek gövdesi geçerli bir JSON değil.',
            },
        });
        return;
    }

    // Bilinmeyen hata (programcı hatası)
    // Prod ortamda client'a internal detay gösterme!
    console.error('[Unhandled Error]', err);

    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'Beklenmeyen bir hata oluştu'
                : err.message,
        },
    });
}
