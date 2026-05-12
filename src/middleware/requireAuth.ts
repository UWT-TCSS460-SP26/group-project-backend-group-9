import { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { expressjwt, type Request as JwtRequest } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { resolveLocalUser } from '../auth/resolveLocalUser';

export const ROLE_HIERARCHY = ['User', 'Moderator', 'Admin', 'SuperAdmin', 'Owner'] as const;
export type Role = (typeof ROLE_HIERARCHY)[number];

export interface AuthenticatedUser {
    sub: string;
    email?: string;
    role: Role;
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string | string[];
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace -- Express type augmentation
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

const issuer = process.env.AUTH_ISSUER;
const audience = process.env.API_AUDIENCE;

if (!issuer || !audience) {
    // Fail fast at boot — middleware would surface this as 500 on every request otherwise.
    throw new Error(
        'AUTH_ISSUER and API_AUDIENCE must be set. See .env.example for the auth-squared integration.'
    );
}

const verifyJwt = expressjwt({
    secret: jwksRsa.expressJwtSecret({
        jwksUri: `${issuer}/.well-known/jwks.json`,
        cache: true,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
    }),
    audience,
    issuer,
    algorithms: ['RS256'],
});

const attachUser = (request: JwtRequest, _response: Response, next: NextFunction): void => {
    if (request.auth) {
        (request as Request).user = request.auth as unknown as AuthenticatedUser;
    }
    next();
};

const handleAuthError: ErrorRequestHandler = (error, _request, response, next) => {
    if (error && (error as { name?: string }).name === 'UnauthorizedError') {
        response.status(401).json({ error: 'Invalid or missing token' });
        return;
    }
    next(error);
};

/**
 * Verifies the Authorization: Bearer <token> header against the auth-squared
 * issuer's JWKS (RS256) and attaches the decoded payload to request.user.
 */
export const requireAuth: Array<RequestHandler | ErrorRequestHandler> = [
    verifyJwt,
    attachUser,
    handleAuthError,
];

/**
 * Exact-match role gate. Use after requireAuth.
 */
export const requireRole = (role: Role): RequestHandler => {
    return (request: Request, response: Response, next: NextFunction): void => {
        try {
            if (!request.user) {
                response.status(401).json({ error: 'Not authenticated' });
                return;
            }
            // Check against local user role so we can control role without going to Auth2
            const localUser = resolveLocalUser(request);
            localUser.then(
                (res) => {
                    if (res.role !== role) {
                        response.status(403).json({ error: 'Insufficient permissions' });
                        return;
                    }
                    next();
                },
                () => {
                    response.status(500).json({ error: 'Internal server error' });
                    return;
                }
            );
        } catch (_error) {
            response.status(500).json({ error: 'Internal server error' });
            return;
        }
    };
};

/**
 * Minimum-role gate using the 5-tier auth-squared hierarchy:
 * User < Moderator < Admin < SuperAdmin < Owner
 *
 */
export const requireRoleAtLeast = (minRole: Role): RequestHandler => {
    const minIdx = ROLE_HIERARCHY.indexOf(minRole);
    return (request: Request, response: Response, next: NextFunction): void => {
        try {
            if (!request.user) {
                response.status(401).json({ error: 'Not authenticated' });
                return;
            }
            // Check against local user role so we can control role without going to Auth2
            const localUser = resolveLocalUser(request);
            localUser.then(
                (res) => {
                    const userIdx = ROLE_HIERARCHY.indexOf(res.role);
                    if (userIdx < 0 || userIdx < minIdx) {
                        response.status(403).json({ error: 'Insufficient permissions' });
                        return;
                    }
                    next();
                },
                () => {
                    response.status(500).json({ error: 'Internal server error' });
                    return;
                }
            );
        } catch (_error) {
            response.status(500).json({ error: 'Internal server error' });
        }
    };
};

/**
 * Returns true when the authenticated user's role is at least `minRole` in
 * the 5-tier hierarchy. For use in controllers where policy is "owner OR
 * privileged," which can't be expressed as a single middleware gate.
 */
export const hasRoleAtLeast = (role: Role | undefined, minRole: Role): boolean => {
    if (!role) return false;
    const userIdx = ROLE_HIERARCHY.indexOf(role);
    const minIdx = ROLE_HIERARCHY.indexOf(minRole);
    return userIdx >= 0 && userIdx >= minIdx;
};
