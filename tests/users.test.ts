// Coverage for /users CRUD: auth, ownership, role-strip, password-strip, validation.
// Prisma is fully mocked so these run without a database.

const mockUser = {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
};

const mockReview = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

jest.mock('../src/prisma', () => ({
    prisma: { review: mockReview, user: mockUser },
}));

import request from 'supertest';

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

const sampleUser = {
    id: 1,
    email: 'alice@example.com',
    role: 'User',
    createdAt: new Date('2026-04-25T14:00:00.000Z'),
};

beforeEach(() => {
    Object.values(mockUser).forEach((m) => m.mockReset());
    Object.values(mockReview).forEach((m) => m.mockReset());
});

describe('GET /users/me', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/users/me');
        expect(res.status).toBe(401);
        expect(mockUser.findUnique).not.toHaveBeenCalled();
    });

    it('returns the authenticated user (no password field)', async () => {
        mockUser.findUnique.mockResolvedValue(sampleUser);

        // Should be guaranteed to create a user
        // because if the auth header is valid
        // resolveLocalUser will find-or-create the user
        // "user exists" is handled in Auth2
        const res = await request(app)
            .get('/users/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(1);
        expect(res.body.email).toBe('alice@example.com');
    });
});

describe('GET /users/:id', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).get('/users/1');
        expect(res.status).toBe(401);
    });

    it('returns 400 for non-integer id', async () => {
        const res = await request(app)
            .get('/users/abc')
            .set('x-test-user', JSON.stringify(authHeader('1')));
        expect(res.status).toBe(400);
        expect(mockUser.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the user does not exist', async () => {
        mockUser.findUnique.mockResolvedValue(null);

        const res = await request(app)
            .get('/users/999')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(404);
    });

    it('returns the user (no password field)', async () => {
        mockUser.findUnique.mockResolvedValue(sampleUser);

        const res = await request(app)
            .get('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(1);
        expect(res.body).not.toHaveProperty('password');
    });
});

describe('PUT /users/:id', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).put('/users/1').send({ email: 'new@example.com' });
        expect(res.status).toBe(401);
    });

    it('returns 403 when a non-owner non-admin tries to update', async () => {
        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'User')))
            .send({ email: 'new@example.com' });

        expect(res.status).toBe(403);
        expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('allows the owner to update their own email', async () => {
        const updated = { ...sampleUser, email: 'new@example.com' };
        mockUser.update.mockResolvedValue(updated);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send({ email: 'new@example.com' });

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('new@example.com');
        expect(res.body).not.toHaveProperty('password');
        expect(mockUser.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { email: 'new@example.com' },
        });
    });

    it("allows an admin to update another user's email", async () => {
        const updated = { ...sampleUser, email: 'new@example.com' };
        mockUser.update.mockResolvedValue(updated);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')))
            .send({ email: 'new@example.com' });

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('new@example.com');
    });

    it("allows an admin to change another user's role", async () => {
        const updated = { ...sampleUser, role: 'Admin' };
        mockUser.update.mockResolvedValue(updated);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')))
            .send({ role: 'Admin' });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe('Admin');
        expect(mockUser.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { role: 'Admin' },
        });
    });

    it('silently strips role when a User tries to escalate themselves', async () => {
        mockUser.update.mockResolvedValue(sampleUser);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1', 'User')))
            .send({ email: 'new@example.com', role: 'Admin' });

        expect(res.status).toBe(200);
        // role must NOT be in the data passed to Prisma
        expect(mockUser.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { email: 'new@example.com' },
        });
    });

    it('silently ignores the password field in the body', async () => {
        mockUser.update.mockResolvedValue(sampleUser);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send({ email: 'new@example.com', password: 'hunter2' });

        expect(res.status).toBe(200);
        const callArgs = mockUser.update.mock.calls[0][0];
        expect(callArgs.data).not.toHaveProperty('password');
    });

    it('returns 400 for invalid email format', async () => {
        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send({ email: 'not-an-email' });

        expect(res.status).toBe(400);
        expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid role value (sent by admin)', async () => {
        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')))
            .send({ role: 'GOD' });

        expect(res.status).toBe(400);
        expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the user does not exist (Prisma P2025)', async () => {
        const err = Object.assign(new Error('Not found'), { code: 'P2025' });
        mockUser.update.mockRejectedValue(err);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send({ email: 'new@example.com' });

        expect(res.status).toBe(404);
    });

    it('returns 409 on email collision (Prisma P2002)', async () => {
        const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        mockUser.update.mockRejectedValue(err);

        const res = await request(app)
            .put('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')))
            .send({ email: 'taken@example.com' });

        expect(res.status).toBe(409);
    });
});

describe('DELETE /users/:id', () => {
    it('returns 401 without a token', async () => {
        const res = await request(app).delete('/users/1');
        expect(res.status).toBe(401);
    });

    it('returns 403 when a non-owner non-admin tries to delete', async () => {
        // create the id=1 user
        const _user = await request(app)
            .get('/users/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        // delete with a different user (id=2)
        const res = await request(app)
            .delete('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'User')));

        expect(res.status).toBe(403);
        expect(mockUser.delete).not.toHaveBeenCalled();
    });

    it('returns 204 when the owner deletes their own account', async () => {
        mockUser.delete.mockResolvedValue(sampleUser);

        const res = await request(app)
            .delete('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        expect(res.status).toBe(204);
        expect(mockUser.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns 204 when an admin deletes another user', async () => {
        mockUser.delete.mockResolvedValue(sampleUser);

        // create the id=1 user
        const _user = await request(app)
            .get('/users/me')
            .set('x-test-user', JSON.stringify(authHeader('1')));

        // delete with a different user (id=2)
        const res = await request(app)
            .delete('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')));

        expect(res.status).toBe(204);
    });

    it('returns 404 when the user does not exist (Prisma P2025)', async () => {
        const err = Object.assign(new Error('Not found'), { code: 'P2025' });
        mockUser.delete.mockRejectedValue(err);

        const res = await request(app)
            .delete('/users/1')
            .set('x-test-user', JSON.stringify(authHeader('99', 'Admin')));

        expect(res.status).toBe(404);
    });
});
