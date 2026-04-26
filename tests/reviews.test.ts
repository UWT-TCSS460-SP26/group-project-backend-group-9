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

jest.mock('../src/lib/prisma', () => ({
    prisma: { review: mockReview, user: mockUser },
}));

import jwt from 'jsonwebtoken';
import request from 'supertest';

const TEST_SECRET = 'test-secret-for-jwt-signing-only';
process.env.JWT_SECRET = TEST_SECRET;

// Import after env + mocks are in place
import { app } from '../src/app';

const userToken = (sub: number, role: 'USER' | 'ADMIN' = 'USER', email = 'u@example.com') =>
    jwt.sign({ sub, email, role }, TEST_SECRET, { expiresIn: '1h' });

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
            .set('Authorization', `Bearer ${userToken(1)}`)
            .send(validBody);

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(42);
        expect(res.body.userId).toBe(1);
        expect(mockReview.create).toHaveBeenCalledWith({
            data: { ...validBody, userId: 1 },
        });
    });

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).post('/reviews').send(validBody);
        expect(res.status).toBe(401);
        expect(mockReview.create).not.toHaveBeenCalled();
    });

    it('returns 401 when bearer token is malformed', async () => {
        const res = await request(app)
            .post('/reviews')
            .set('Authorization', 'Bearer not-a-real-jwt')
            .send(validBody);
        expect(res.status).toBe(401);
    });

    it('returns 401 when Authorization scheme is not Bearer', async () => {
        const res = await request(app)
            .post('/reviews')
            .set('Authorization', `Token ${userToken(1)}`)
            .send(validBody);
        expect(res.status).toBe(401);
    });

    it('returns 401 when token is signed with the wrong secret', async () => {
        const badToken = jwt.sign({ sub: 1, email: 'x', role: 'USER' }, 'other-secret');
        const res = await request(app)
            .post('/reviews')
            .set('Authorization', `Bearer ${badToken}`)
            .send(validBody);
        expect(res.status).toBe(401);
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
            .set('Authorization', `Bearer ${userToken(1)}`)
            .send(payload);
        expect(res.status).toBe(400);
        expect(mockReview.create).not.toHaveBeenCalled();
    });

    it('returns 409 on duplicate (unique constraint violation)', async () => {
        const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        mockReview.create.mockRejectedValue(err);

        const res = await request(app)
            .post('/reviews')
            .set('Authorization', `Bearer ${userToken(1)}`)
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
        expect(mockReview.findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
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
            where: {},
            orderBy: { createdAt: 'desc' },
            skip: 0,
            take: 20,
        });
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

    it('clamps limit to a maximum of 100', async () => {
        mockReview.findMany.mockResolvedValue([]);
        mockReview.count.mockResolvedValue(0);

        const res = await request(app).get('/reviews?limit=9999');

        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(100);
        expect(mockReview.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
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
            .set('Authorization', `Bearer ${userToken(1)}`)
            .send(updateBody);

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Updated');
        expect(mockReview.update).toHaveBeenCalledWith({
            where: { id: 42 },
            data: updateBody,
        });
    });

    it('returns 401 without auth', async () => {
        const res = await request(app).put('/reviews/42').send(updateBody);
        expect(res.status).toBe(401);
    });

    it('returns 403 when caller is not the author (even as ADMIN)', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview); // userId: 1

        const res = await request(app)
            .put('/reviews/42')
            .set('Authorization', `Bearer ${userToken(99, 'ADMIN')}`)
            .send(updateBody);

        expect(res.status).toBe(403);
        expect(mockReview.update).not.toHaveBeenCalled();
    });

    it('returns 404 when review does not exist', async () => {
        mockReview.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .put('/reviews/42')
            .set('Authorization', `Bearer ${userToken(1)}`)
            .send(updateBody);

        expect(res.status).toBe(404);
    });

    it('returns 400 for invalid score in body', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview);

        const res = await request(app)
            .put('/reviews/42')
            .set('Authorization', `Bearer ${userToken(1)}`)
            .send({ ...updateBody, score: 11 });

        expect(res.status).toBe(400);
        expect(mockReview.update).not.toHaveBeenCalled();
    });

    it('returns 400 for non-integer id', async () => {
        const res = await request(app)
            .put('/reviews/abc')
            .set('Authorization', `Bearer ${userToken(1)}`)
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
            .set('Authorization', `Bearer ${userToken(1)}`);

        expect(res.status).toBe(204);
        expect(mockReview.delete).toHaveBeenCalledWith({ where: { id: 42 } });
    });

    it('returns 204 when caller is an ADMIN deleting another user’s review', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview); // userId: 1
        mockReview.delete.mockResolvedValue(sampleReview);

        const res = await request(app)
            .delete('/reviews/42')
            .set('Authorization', `Bearer ${userToken(99, 'ADMIN')}`);

        expect(res.status).toBe(204);
    });

    it('returns 401 without auth', async () => {
        const res = await request(app).delete('/reviews/42');
        expect(res.status).toBe(401);
    });

    it('returns 403 when caller is neither author nor admin', async () => {
        mockReview.findUnique.mockResolvedValue(sampleReview);

        const res = await request(app)
            .delete('/reviews/42')
            .set('Authorization', `Bearer ${userToken(99, 'USER')}`);

        expect(res.status).toBe(403);
        expect(mockReview.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when review does not exist', async () => {
        mockReview.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .delete('/reviews/42')
            .set('Authorization', `Bearer ${userToken(1)}`);

        expect(res.status).toBe(404);
    });
});

describe('POST /auth/dev-login', () => {
    it('returns a signed JWT for a valid email', async () => {
        mockUser.upsert.mockResolvedValue({
            id: 7,
            email: 'tester@example.com',
            role: 'USER',
        });

        const res = await request(app)
            .post('/auth/dev-login')
            .send({ email: 'tester@example.com' });

        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
        const decoded = jwt.verify(res.body.token, TEST_SECRET) as jwt.JwtPayload;
        expect(decoded.email).toBe('tester@example.com');
        expect(decoded.role).toBe('USER');
        expect(typeof decoded.sub).toBe('number');
        expect(res.body.user.email).toBe('tester@example.com');
        expect(res.body.user.role).toBe('USER');
        expect(res.body.user.id).toBe(7);
    });

    it('rejects role in the request body (no role escalation via dev-login)', async () => {
        const res = await request(app)
            .post('/auth/dev-login')
            .send({ email: 'admin@example.com', role: 'ADMIN' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/role is not a permitted field/i);
        expect(mockUser.upsert).not.toHaveBeenCalled();
    });

    it('returns 400 for missing email', async () => {
        const res = await request(app).post('/auth/dev-login').send({});
        expect(res.status).toBe(400);
    });

    it('returns 400 for invalid role value', async () => {
        const res = await request(app)
            .post('/auth/dev-login')
            .send({ email: 'x@example.com', role: 'GOD' });
        expect(res.status).toBe(400);
    });
});
