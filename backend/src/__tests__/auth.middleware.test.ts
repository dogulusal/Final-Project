import { authMiddleware } from '../middleware/auth.middleware';
import { ADMIN_API_KEY } from '../config/constants';
import { Request, Response, NextFunction } from 'express';

describe('Auth Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
        mockRequest = {
            headers: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    it('should call next if valid API key is provided', () => {
        mockRequest.headers = { 'x-api-key': ADMIN_API_KEY };
        
        authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
        
        expect(nextFunction).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 401 if API key is missing', () => {
        authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
        
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringContaining('Yetkisiz')
        }));
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if API key is invalid', () => {
        mockRequest.headers = { 'x-api-key': 'wrong-key' };
        
        authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
        
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
