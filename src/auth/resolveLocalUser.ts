import type { Request } from 'express';
import { prisma } from '../prisma';
import type { UserModel } from '../generated/prisma/models';

/**
 * Upserts a local User row keyed by the auth-squared `sub` claim, then returns
 * it. Call at the start of any handler that needs a local User PK — e.g. to
 * set as a foreign key on Message.authorId. Handlers that don't touch any
 * User-FK'd table can skip this.
 *
 * A plain helper, not express middleware — the DB write stays visible in the
 * handler body, and the auth middleware itself is side-effect-free.
 */
export const resolveLocalUser = async (request: Request): Promise<UserModel> => {
    const { sub, email: claimEmail } = request.user!;

    // Fast path: the local row itself caches the auth-squared enrichment, so
    // userinfo is called at most once per sub — not per request.
    try {
        const existing = await prisma.user.findUnique({ where: { subjectId: sub } });
        if (existing) {
            if (claimEmail && claimEmail !== existing.email) {
                return prisma.user.update({
                    where: { subjectId: sub },
                    data: { email: claimEmail },
                });
            }
            return existing;
        }

        const token = extractBearerToken(request);
        const info = token ? await fetchUserInfo(token) : undefined;

        const email = info?.email ?? claimEmail ?? `${sub}@placeholder.local`;
        const username =
            info?.username ?? (info?.email ? info.email.split('@')[0] : `user-${sub.slice(0, 12)}`);

        // upsert (not create) to tolerate a race between two concurrent first-time
        // requests for the same sub.
        return prisma.user.upsert({
            where: { subjectId: sub },
            update: {},
            create: { subjectId: sub, username, email },
        });
    } catch (error) {
        console.log(error);
    }
    return null;
};

interface UserInfoResponse {
    email?: string;
    name?: string;
    username?: string;
}

const fetchUserInfo = async (accessToken: string): Promise<UserInfoResponse | undefined> => {
    const issuer = process.env.AUTH_ISSUER;
    if (!issuer) return undefined;
    try {
        const response = await fetch(`${issuer}/v2/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return undefined;
        return (await response.json()) as UserInfoResponse;
    } catch {
        return undefined;
    }
};

const extractBearerToken = (request: Request): string | undefined => {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return undefined;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
};
