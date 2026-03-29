import { authMiddleware, verifyJwtToken } from '../middleware/auth.middleware';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock constants so JWT_SECRET is predictable in tests
const TEST_JWT_SECRET = 'test-secret-minimum-32-chars-long-for-tests';
jest.mock('../config/constants', () => ({
    ...jest.requireActual('../config/constants'),
    JWT_SECRET: 'test-secret-minimum-32-chars-long-for-tests',
    ADMIN_API_KEY: ''
}));

/**
 * Test için JWT token oluşturur
 */
function createTestToken(role: string = 'admin', expiresIn = '1h'): string {
    return jwt.sign(
        { id: 1, email: 'admin@test.com', role, type: 'access' },
        TEST_JWT_SECRET,
        { expiresIn, issuer: 'news-agency', audience: 'news-agency-api' } as any
    );
}

describe('Auth Middleware', () => {
    let mockRequest: any;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        nextFunction = jest.fn();
        mockRequest = { headers: {}, path: '/protected', originalUrl: '/api/admin/stats' };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    // --- Public path skip tests ---
    describe('Public paths (login, health)', () => {
        it('should skip auth for /api/admin/login', () => {
            mockRequest.path = '/api/admin/login';
            mockRequest.originalUrl = '/api/admin/login';
            mockRequest.headers = {};

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should skip auth for /api/health', () => {
            mockRequest.path = '/api/health';
            mockRequest.originalUrl = '/api/health';

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });
    });

    // --- JWT Token tests ---
    describe('JWT Token Authentication', () => {
        it('should call next with valid JWT Bearer token', () => {
            const token = createTestToken('admin');
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should return 401 with expired JWT token', () => {
            const expiredToken = createTestToken('admin', '-1s');
            mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'TOKEN_EXPIRED' })
            );
        });

        it('should return 401 with malformed JWT token', () => {
            mockRequest.headers = { authorization: 'Bearer not.a.valid.jwt' };

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'INVALID_TOKEN' })
            );
        });

        it('should return 401 with wrong Bearer format', () => {
            mockRequest.headers = { authorization: 'Token abc123' };

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'INVALID_TOKEN_FORMAT' })
            );
        });

        it('should return 401 if no authorization header', () => {
            mockRequest.headers = {};

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(nextFunction).not.toHaveBeenCalled();
        });

        it('should attach userId and userRole to request on valid token', () => {
            const token = createTestToken('admin');
            mockRequest.headers = { authorization: `Bearer ${token}` };

            authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

            expect((mockRequest as any).userId).toBe(1);
            expect((mockRequest as any).userRole).toBe('admin');
        });
    });

    // --- verifyJwtToken standalone tests ---
    describe('verifyJwtToken middleware', () => {
        it('should return 401 if Authorization header missing', () => {
            mockRequest.headers = {};

            verifyJwtToken(mockRequest as Request, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'NO_TOKEN' })
            );
        });
    });
});
