import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
    sub: number;
    email: string;
    role: 'USER' | 'ADMIN';
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: AuthUser;
    }
}

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        response.status(500).json({ error: 'JWT_SECRET is not configured' });
        return;
    }

    const header = request.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) {
        response.status(401).json({ error: 'Missing bearer token' });
        return;
    }

    const token = header.slice('Bearer '.length).trim();
    try {
        const payload = jwt.verify(token, secret) as jwt.JwtPayload;
        if (
            typeof payload.sub !== 'number' ||
            typeof payload.email !== 'string' ||
            (payload.role !== 'USER' && payload.role !== 'ADMIN')
        ) {
            response.status(401).json({ error: 'Invalid token payload' });
            return;
        }
        request.user = { sub: payload.sub, email: payload.email, role: payload.role };
        next();
    } catch (_error) {
        response.status(401).json({ error: 'Invalid or expired token' });
    }
};
