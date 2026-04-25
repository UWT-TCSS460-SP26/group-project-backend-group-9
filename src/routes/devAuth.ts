// Development-only auth: mints JWTs without a real signup flow so tests and
// local clients can exercise authenticated endpoints.
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const devAuthRoutes = Router();

const hashEmailToId = (email: string): number => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = (hash * 31 + email.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) || 1;
};

devAuthRoutes.post('/dev-login', (request: Request, response: Response) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        response.status(500).json({ error: 'JWT_SECRET is not configured' });
        return;
    }

    const { email, role, userId } = request.body ?? {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
        response.status(400).json({ error: 'A valid email is required' });
        return;
    }

    const resolvedRole = role ?? 'USER';
    if (resolvedRole !== 'USER' && resolvedRole !== 'ADMIN') {
        response.status(400).json({ error: 'role must be USER or ADMIN' });
        return;
    }

    const id =
        typeof userId === 'number' && Number.isInteger(userId) ? userId : hashEmailToId(email);

    const token = jwt.sign({ sub: id, email, role: resolvedRole }, secret, { expiresIn: '1h' });

    response.json({
        token,
        user: { id, email, role: resolvedRole },
    });
});

export { devAuthRoutes };
