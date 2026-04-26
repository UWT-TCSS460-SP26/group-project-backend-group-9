import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
    sub: number;
    email: string;
    role: string;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace -- Express type augmentation
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * Verifies the Authorization: Bearer <token> header using JWT_SECRET and
 * attaches the decoded payload to request.user. Responds 401 when the
 * header is missing, malformed, or the token is invalid/expired.
 */
export const requireAuth = (request: Request, response: Response, next: NextFunction): void => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        response.status(500).json({ error: 'JWT_SECRET is not configured' });
        return;
    }

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        response.status(401).json({ error: 'Missing or malformed Authorization header' });
        return;
    }

    const token = header.slice('Bearer '.length).trim();

    try {
        const decoded = jwt.verify(token, secret);
        if (
            typeof decoded === 'string' ||
            typeof decoded.sub !== 'number' ||
            typeof decoded.email !== 'string' ||
            typeof decoded.role !== 'string'
        ) {
            response.status(401).json({ error: 'Invalid token payload' });
            return;
        }
        request.user = {
            sub: decoded.sub,
            email: decoded.email,
            role: decoded.role,
        };
        next();
    } catch {
        response.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Role gate. Use after requireAuth:
 *
 *   router.delete('/reviews/:id', requireAuth, requireRole('admin'), handler);
 */
export const requireRole = (role: string) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        if (!request.user) {
            response.status(401).json({ error: 'Not authenticated' });
            return;
        }
        if (request.user.role !== role) {
            response.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
};
