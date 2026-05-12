// Full coverage for /reviews CRUD: validation, auth, ownership, pagination, filtering.
// Prisma is fully mocked so these run without a database.

const mockReview = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockUser = {
    upsert: jest.fn(),
};

jest.mock('../src/prisma', () => ({
    prisma: { review: mockReview, user: mockUser },
}));

import request from 'supertest';

// Import after env + mocks are in place
import { app } from '../src/app';

const authHeader = (
    sub: string,
    role: 'User' | 'Admin' = 'User',
    email: string = 'alice@example.com'
) => ({
    role: role,
    iat: Math.floor(new Date().getTime()),
    exp: Math.floor(new Date().getTime()) + 360,
    aud: process.env.API_AUDIENCE,
    iss: process.env.AUTH_ISSUER,
    sub: sub,
    email: email,
});

// sampleUser is what Prisma returns when include: { user: true } is used.
// The controller's formatReview() strips this down to author: { id, username }.
const sampleUser = {
    id: 1,
    subjectId: 'auth0|abc123',
    username: 'alice',
    email: 'alice@example.com',
    role: 'User',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
};

const sampleReview = {
    id: 42,
    tmdbId: 961323,
    mediaType: 'MOVIE',
    title: 'Great movie',
    body: 'I really enjoyed this one.',
    score: 9,
    userId: 1,
    createdAt: new Date('2026-04-25T18:30:00.000Z'),
    updatedAt: new Date('2026-04-25T18:30:00.000Z'),
    user: sampleUser,
};

beforeEach(() => {
    Object.values(mockReview).forEach((m) => m.mockReset());
    Object.values(mockUser).forEach((m) => m.mockReset());
});

describe('POST /reviews', () => {
    const validBody = {
        tmdbId: 961323,
        mediaType: 'MOVIE',
        title: 'Great movie',
        body: 'I really enjoyed this one.',
        score: 9,
    };

    it('creates a review and returns 201', async () => {
        mockReview.create.mockResolvedValue(sampleReview);

        const res = await request(app)
            .post('/reviews')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send(validBody);

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(42);
        expect(res.body.author).toEqual({ id: 1, username: 'alice' });
        expect(mockReview.create).toHaveBeenCalledWith({
            data: { ...validBody, userId: 1 },
            include: { user: true },
        });
    });

    it('returns 401 when user header is missing', async () => {
        const res = await request(app).post('/reviews').send(validBody);
        expect(res.status).toBe(401);
        expect(mockReview.create).not.toHaveBeenCalled();
    });

    it.each([
        ['missing title', { ...validBody, title: undefined }],
        ['empty title', { ...validBody, title: '   ' }],
        ['non-string title', { ...validBody, title: 5 }],
        ['missing body', { ...validBody, body: undefined }],
        ['empty body', { ...validBody, body: '' }],
        ['missing score', { ...validBody, score: undefined }],
        ['score below 1', { ...validBody, score: 0 }],
        ['score above 10', { ...validBody, score: 11 }],
        ['non-integer score', { ...validBody, score: 5.5 }],
        ['string score', { ...validBody, score: 'nine' }],
        ['missing tmdbId', { ...validBody, tmdbId: undefined }],
        ['non-integer tmdbId', { ...validBody, tmdbId: 'abc' }],
        ['missing mediaType', { ...validBody, mediaType: undefined }],
        ['invalid mediaType', { ...validBody, mediaType: 'BOOK' }],
    ])('returns 400 for %s', async (_label, payload) => {
        const res = await request(app)
            .post('/reviews')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send(payload);
        expect(res.status).toBe(400);
        expect(mockReview.create).not.toHaveBeenCalled();
    });

    it('returns 409 on duplicate (unique constraint violation)', async () => {
        const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        mockReview.create.mockRejectedValue(err);

        const res = await request(app)
            .post('/reviews')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send(validBody);

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already/i);
    });
});

describe('GET /reviews/:id', () => {
    it('returns the review when found', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview);
        const res = await request(app).get('/reviews/42');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(42);
        expect(res.body.author).toEqual({ id: 1, username: 'alice' });
        expect(mockReview.findUnique).toHaveBeenCalledWith({
            where: { id: 42 },
            include: { user: true },
        });
    });

    it('returns 404 when not found', async () => {
        mockReview.findUnique.mockResolvedValue(null);
        const res = await request(app).get('/reviews/999');
        expect(res.status).toBe(404);
    });

    it('returns 400 for non-integer id', async () => {
        const res = await request(app).get('/reviews/abc');
        expect(res.status).toBe(400);
        expect(mockReview.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to email when username is missing', async () => {
        // Gap 2: formatReview uses `username ?? email`. This test proves the fallback
        // fires correctly so the sprint's documented behavior is verified in code.
        const noUsernameSample = {
            ...sampleReview,
            user: { ...sampleUser, username: null },
        };
        mockReview.findUnique.mockResolvedValue(noUsernameSample);

        const res = await request(app).get('/reviews/42');

        expect(res.status).toBe(200);
        expect(res.body.author.username).toBe('alice@example.com');
    });
});

describe('GET /reviews', () => {
    it('returns paginated results with defaults', async () => {
        mockReview.findMany.mockResolvedValue([sampleReview]);
        mockReview.count.mockResolvedValue(1);

        const res = await request(app).get('/reviews');

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(20);
        expect(res.body.total).toBe(1);
        expect(res.body.results).toHaveLength(1);
        expect(mockReview.findMany).toHaveBeenCalledWith({
            where: { mediaType: 'MOVIE' },
            orderBy: { createdAt: 'desc' },
            skip: 0,
            take: 20,
            include: { user: true },
        });
    });

    it('includes author on each result and does not leak raw user data', async () => {
        // Gap 1 + 3: every item in `results` must have author.id and author.username,
        // and the raw `user` join must not appear in the response.
        mockReview.findMany.mockResolvedValue([sampleReview]);
        mockReview.count.mockResolvedValue(1);

        const res = await request(app).get('/reviews');
        const item = res.body.results[0];

        expect(item.author).toEqual({ id: 1, username: 'alice' });
        expect(item.user).toBeUndefined();
    });

    it('honors page and limit query params', async () => {
        mockReview.findMany.mockResolvedValue([]);
        mockReview.count.mockResolvedValue(0);

        const res = await request(app).get('/reviews?page=3&limit=5');

        expect(res.status).toBe(200);
        expect(res.body.page).toBe(3);
        expect(res.body.limit).toBe(5);
        expect(mockReview.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ skip: 10, take: 5 })
        );
    });

    it('disallows limit beyond 100', async () => {
        mockReview.findMany.mockResolvedValue([]);
        mockReview.count.mockResolvedValue(0);

        const res = await request(app).get('/reviews?limit=9999');

        expect(res.status).toBe(400);
    });

    it('filters by tmdbId and mediaType', async () => {
        mockReview.findMany.mockResolvedValue([sampleReview]);
        mockReview.count.mockResolvedValue(1);

        const res = await request(app).get('/reviews?tmdbId=961323&mediaType=MOVIE');

        expect(res.status).toBe(200);
        expect(mockReview.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { tmdbId: 961323, mediaType: 'MOVIE' } })
        );
    });

    it('returns 400 for invalid mediaType', async () => {
        const res = await request(app).get('/reviews?mediaType=BOOK');
        expect(res.status).toBe(400);
    });

    it('returns 400 for non-integer page', async () => {
        const res = await request(app).get('/reviews?page=abc');
        expect(res.status).toBe(400);
    });

    it('returns 400 for page < 1', async () => {
        const res = await request(app).get('/reviews?page=0');
        expect(res.status).toBe(400);
    });

    it('returns empty array when there are no reviews', async () => {
        mockReview.findMany.mockResolvedValue([]);
        mockReview.count.mockResolvedValue(0);

        const res = await request(app).get('/reviews');
        expect(res.status).toBe(200);
        expect(res.body.results).toEqual([]);
        expect(res.body.total).toBe(0);
    });
});

describe('PUT /reviews/:id', () => {
    const updateBody = { title: 'Updated', body: 'New thoughts.', score: 7 };

    it('updates and returns 200 when caller is the author', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview); // userId: 1
        mockReview.update.mockResolvedValue({ ...sampleReview, ...updateBody });

        const res = await request(app)
            .put('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send(updateBody);

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Updated');
        expect(res.body.author).toEqual({ id: 1, username: 'alice' });
        expect(mockReview.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: updateBody,
            include: { user: true },
        });
    });

    it('returns 401 without auth', async () => {
        const res = await request(app).put('/reviews/42').send(updateBody);
        expect(res.status).toBe(401);
    });

    it('returns 403 when caller is not the author (even as Admin)', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview); // userId: 1

        // create the id=1 user
        const _user = await request(app)
            .get('/users/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        // update with a different user (id=2)
        const res = await request(app)
            .put('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')))
            .send(updateBody);

        expect(res.status).toBe(403);
        expect(mockReview.update).not.toHaveBeenCalled();
    });

    it('returns 404 when review does not exist', async () => {
        mockReview.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .put('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send(updateBody);

        expect(res.status).toBe(404);
    });

    it('returns 400 for invalid score in body', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview);

        const res = await request(app)
            .put('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send({ ...updateBody, score: 11 });

        expect(res.status).toBe(400);
        expect(mockReview.update).not.toHaveBeenCalled();
    });

    it('returns 400 for non-integer id', async () => {
        const res = await request(app)
            .put('/reviews/abc')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send(updateBody);
        expect(res.status).toBe(400);
    });
});

describe('DELETE /reviews/:id', () => {
    it('returns 204 when caller is the author', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview); // userId: 1
        mockReview.delete.mockResolvedValue(sampleReview);

        const res = await request(app)
            .delete('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(204);
        expect(mockReview.delete).toHaveBeenCalledWith({ where: { id: 42 } });
    });

    it('returns 204 when caller is an Admin deleting another user’s review', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview); // userId: 1
        mockReview.delete.mockResolvedValue(sampleReview);

        // create the id=1 user
        const _user = await request(app)
            .get('/users/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        // delete with a different user (id=2)
        const res = await request(app)
            .delete('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')));

        expect(res.status).toBe(204);
    });

    it('returns 401 without auth', async () => {
        const res = await request(app).delete('/reviews/42');
        expect(res.status).toBe(401);
    });

    it('returns 403 when caller is neither author nor admin', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview);
        // create the id=1 user
        const _user = await request(app)
            .get('/users/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        // delete with a different user (id=2)
        const res = await request(app)
            .delete('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('99', 'User')));

        expect(res.status).toBe(403);
        expect(mockReview.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when review does not exist', async () => {
        mockReview.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .delete('/reviews/42')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(404);
    });
});

describe('GET /reviews/me', () => {
    // resolveLocalUser is stubbed (tests/setup.ts) to derive local user id from
    // the numeric portion of `sub`. authHeader('1') → user id 1.

    const reviewForUser = (id: number, userId: number, username = 'alice') => ({
        id,
        tmdbId: 100 + id,
        mediaType: 'MOVIE',
        title: `Review ${id}`,
        body: `Body ${id}`,
        score: 7,
        userId,
        createdAt: new Date(`2026-04-25T18:30:0${id}.000Z`),
        updatedAt: new Date(`2026-04-25T18:30:0${id}.000Z`),
        user: {
            id: userId,
            subjectId: `user-${userId}`,
            username,
            email: `${username}@example.com`,
            role: 'User',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
    });

    it('returns 401 when no auth token is provided', async () => {
        const res = await request(app).get('/reviews/me');
        expect(res.status).toBe(401);
    });

    it("returns 200 with the caller's reviews only", async () => {
        mockReview.findMany.mockResolvedValue([
            reviewForUser(1, 1, 'alice'),
            reviewForUser(2, 1, 'alice'),
        ]);

        const res = await request(app)
            .get('/reviews/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
        expect(mockReview.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: 1 },
                orderBy: { createdAt: 'desc' },
                include: { user: true },
            })
        );
    });

    it('returns an empty array (200, not 404) when caller has no reviews', async () => {
        mockReview.findMany.mockResolvedValue([]);

        const res = await request(app)
            .get('/reviews/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('ignores any ?userId query parameter and uses the JWT sub', async () => {
        mockReview.findMany.mockResolvedValue([reviewForUser(1, 1, 'alice')]);

        const res = await request(app)
            .get('/reviews/me?userId=999')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(200);
        const callArg = mockReview.findMany.mock.calls[0][0];
        expect(callArg.where).toEqual({ userId: 1 });
    });

    it('includes an author identity object on each review', async () => {
        mockReview.findMany.mockResolvedValue([reviewForUser(1, 1, 'alice')]);

        const res = await request(app)
            .get('/reviews/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(200);
        expect(res.body[0]).toHaveProperty('author');
        expect(res.body[0].author).toEqual({ id: 1, username: 'alice' });
        // raw user join should not be leaked
        expect(res.body[0]).not.toHaveProperty('user');
    });
});
