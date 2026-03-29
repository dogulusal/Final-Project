import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } from '../config/constants';
import { UserRole } from '../middleware/role.middleware';

/**
 * JWT Token Payload Tipi
 */
export interface JwtPayload {
    id: string | number;
    email: string;
    role: UserRole;
    type: 'access' | 'refresh';
}

/**
 * Şifre hashleme (salt rounds = 10)
 */
export const hashPassword = async (password: string): Promise<string> => {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
};

/**
 * Şifre karşılaştırma
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

/**
 * Access token generate et (1 saat geçerli)
 */
export const generateAccessToken = (userId: string | number, email: string, role: UserRole): string => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }

    const payload: JwtPayload = {
        id: userId,
        email,
        role,
        type: 'access'
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'news-agency',
        audience: 'news-agency-api'
    });
};

/**
 * Refresh token generate et (7 gün geçerli)
 */
export const generateRefreshToken = (userId: string | number, email: string, role: UserRole): string => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }

    const payload: JwtPayload = {
        id: userId,
        email,
        role,
        type: 'refresh'
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        issuer: 'news-agency',
        audience: 'news-agency-api'
    });
};

/**
 * Token'ı verify et
 */
export const verifyToken = (token: string): JwtPayload => {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not set');
    }

    return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

/**
 * Login response tipinde token pair return et
 */
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // Saniye cinsinden
    tokenType: string;
}

export const createLoginResponse = (userId: string | number, email: string, role: UserRole): LoginResponse => {
    const accessToken = generateAccessToken(userId, email, role);
    const refreshToken = generateRefreshToken(userId, email, role);

    return {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 saat
        tokenType: 'Bearer'
    };
};
