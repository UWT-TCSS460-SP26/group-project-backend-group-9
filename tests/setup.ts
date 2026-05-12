// Stub the DB upsert helper so tests don't need a running Prisma connection.
// Convention: tests use `sub: 'user-N'` (or 'user-N-suffix'); the stub pulls
// the first numeric group out of the sub and returns that as the local PK.
// Tests that want a specific local id set it explicitly in the JWT sub.
jest.mock('../src/auth/resolveLocalUser', () => ({
    resolveLocalUser: jest.fn(
        async (request: { user?: { sub: string; email?: string; role: string } }) => {
            const sub = request.user!.sub;
            const match = sub.match(/(\d+)/);
            const id = match ? Number(match[1]) : 0;
            return {
                id,
                subjectId: sub,
                username: `user-${sub.slice(0, 12)}`,
                email: request.user?.email ?? `${sub}@test.local`,
                role: request.user!.role,
                createdAt: new Date(),
            };
        }
    ),
}));

// Middleware stub — bypasses JWKS network calls and trusts an
// `x-test-user` header carrying the claim set the test wants to simulate.
// Header is JSON-encoded: { sub: 'seed-user-1', role: 'Admin' }.
jest.mock('../src/middleware/requireAuth', () => {
    const ROLE_HIERARCHY = ['User', 'Moderator', 'Admin', 'SuperAdmin', 'Owner'] as const;
    type Role = (typeof ROLE_HIERARCHY)[number];

    interface StubUser {
        sub: string;
        email?: string;
        role: Role;
    }

    const parseTestUser = (request: {
        headers: Record<string, string | string[] | undefined>;
    }): StubUser | undefined => {
        const header = request.headers['x-test-user'];
        if (!header || typeof header !== 'string') return undefined;
        try {
            return JSON.parse(header) as StubUser;
        } catch {
            return undefined;
        }
    };

    const authenticate = (
        request: { headers: Record<string, string | string[] | undefined>; user?: StubUser },
        response: { status: (code: number) => { json: (body: unknown) => void } },
        next: () => void
    ): void => {
        const user = parseTestUser(request);
        if (!user) {
            response.status(401).json({ error: 'Invalid or missing token' });
            return;
        }
        request.user = user;
        next();
    };

    return {
        ROLE_HIERARCHY,
        requireAuth: [authenticate],
        requireRole:
            (role: Role) =>
            (
                request: { user?: StubUser },
                response: { status: (code: number) => { json: (body: unknown) => void } },
                next: () => void
            ): void => {
                if (!request.user) {
                    response.status(401).json({ error: 'Not authenticated' });
                    return;
                }
                if (request.user.role !== role) {
                    response.status(403).json({ error: 'Insufficient permissions' });
                    return;
                }
                next();
            },
        requireRoleAtLeast:
            (minRole: Role) =>
            (
                request: { user?: StubUser },
                response: { status: (code: number) => { json: (body: unknown) => void } },
                next: () => void
            ): void => {
                if (!request.user) {
                    response.status(401).json({ error: 'Not authenticated' });
                    return;
                }
                const userIdx = ROLE_HIERARCHY.indexOf(request.user.role);
                const minIdx = ROLE_HIERARCHY.indexOf(minRole);
                if (userIdx < 0 || userIdx < minIdx) {
                    response.status(403).json({ error: 'Insufficient permissions' });
                    return;
                }
                next();
            },
        hasRoleAtLeast: (role: Role | undefined, minRole: Role): boolean => {
            if (!role) return false;
            const userIdx = ROLE_HIERARCHY.indexOf(role);
            const minIdx = ROLE_HIERARCHY.indexOf(minRole);
            return userIdx >= 0 && userIdx >= minIdx;
        },
    };
});
