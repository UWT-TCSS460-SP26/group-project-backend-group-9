/*
 * Class:        TCSS 460 Spring 2026
 * Group:        Group 9
 * Assignment:   Sprint 3, Cards #43 (POST), #44/#45 (GET/PUT)
 */

/**
 * Tests for /issues. POST is public, GET routes are public, PUT is Admin-only.
 * Prisma is mocked with an in-memory store so create -> read -> update flows
 * work end-to-end without a database.
 */

interface StoredIssue {
    id: number;
    title: string;
    description: string;
    reporterEmail: string | null;
    severity: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

interface FindArgs {
    where?: { id?: number };
    select?: Record<string, true>;
    data?: Partial<StoredIssue>;
    orderBy?: unknown;
}

const mockIssue = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

jest.mock('../src/prisma', () => ({
    prisma: { issue: mockIssue },
}));

import request from 'supertest';
import { app } from '../src/app';

let store: Map<number, StoredIssue>;
let nextId: number;

const project = (issue: StoredIssue, select?: Record<string, true>): Record<string, unknown> => {
    if (!select) return { ...issue };
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(select)) {
        out[key] = (issue as unknown as Record<string, unknown>)[key];
    }
    return out;
};

const authHeader = (sub: string, role: 'User' | 'Admin' = 'User') => ({
    sub,
    role,
    email: `${sub}@test.local`,
});

beforeEach(() => {
    Object.values(mockIssue).forEach((m) => m.mockReset());
    store = new Map();
    nextId = 1;

    mockIssue.create.mockImplementation(({ data }: FindArgs) => {
        const id = nextId++;
        const now = new Date();
        const issue: StoredIssue = {
            id,
            title: (data?.title as string) ?? '',
            description: (data?.description as string) ?? '',
            reporterEmail: (data?.reporterEmail as string | null) ?? null,
            severity: (data?.severity as string) ?? 'Minor',
            status: 'Open',
            createdAt: now,
            updatedAt: now,
        };
        store.set(id, issue);
        return Promise.resolve(issue);
    });

    mockIssue.findMany.mockImplementation(({ select }: FindArgs) =>
        Promise.resolve(Array.from(store.values()).map((i) => project(i, select)))
    );

    mockIssue.findUnique.mockImplementation(({ where, select }: FindArgs) => {
        const id = where?.id;
        const issue = id !== undefined ? store.get(id) : undefined;
        return Promise.resolve(issue ? project(issue, select) : null);
    });

    mockIssue.update.mockImplementation(({ where, data, select }: FindArgs) => {
        const id = where?.id;
        const issue = id !== undefined ? store.get(id) : undefined;
        if (!issue) return Promise.reject({ code: 'P2025' });
        Object.assign(issue, data, { updatedAt: new Date() });
        return Promise.resolve(project(issue, select));
    });

    mockIssue.delete.mockImplementation(({ where }: FindArgs) => {
        const id = where?.id;
        const issue = id !== undefined ? store.get(id) : undefined;
        if (!issue) return Promise.reject({ code: 'P2025' });
        store.delete(id!);
        return Promise.resolve(issue);
    });
});

describe('POST /issues', () => {
    // Happy paths

    it('creates an issue with minimum required fields', async () => {
        const response = await request(app)
            .post('/issues')
            .send({ title: 'Login broken', description: 'Cannot log in.' });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.message).toBe('Issue submitted successfully');
        expect(response.body).not.toHaveProperty('reporterEmail');
    });

    it('creates an issue with all optional fields', async () => {
        const response = await request(app).post('/issues').send({
            title: 'Search returns 500',
            description: 'Searching for any term returns a 500 error.',
            reporterEmail: 'tester@example.com',
            severity: 'Major',
        });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).not.toHaveProperty('reporterEmail');
    });

    it('creates an issue with severity Critical', async () => {
        const response = await request(app).post('/issues').send({
            title: 'Data loss on save',
            description: 'User data is being lost on save action.',
            severity: 'Critical',
        });

        expect(response.status).toBe(201);
    });

    // Sad paths

    it('rejects missing title', async () => {
        const response = await request(app)
            .post('/issues')
            .send({ description: 'No title provided.' });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    it('rejects missing description', async () => {
        const response = await request(app).post('/issues').send({ title: 'Title only.' });

        expect(response.status).toBe(400);
    });

    it('rejects empty string title after trim', async () => {
        const response = await request(app)
            .post('/issues')
            .send({ title: '   ', description: 'Whitespace title.' });

        expect(response.status).toBe(400);
    });

    it('rejects title over 255 characters', async () => {
        const response = await request(app)
            .post('/issues')
            .send({
                title: 'a'.repeat(256),
                description: 'Title is too long.',
            });

        expect(response.status).toBe(400);
    });

    it('rejects invalid email format', async () => {
        const response = await request(app).post('/issues').send({
            title: 'Bug report',
            description: 'Has bad email.',
            reporterEmail: 'not-an-email',
        });

        expect(response.status).toBe(400);
    });

    it('rejects invalid severity value', async () => {
        const response = await request(app).post('/issues').send({
            title: 'Bug report',
            description: 'Has bad severity.',
            severity: 'P0',
        });

        expect(response.status).toBe(400);
    });
});

describe('GET /issues (admin only)', () => {
    it('returns 401 when no auth token is provided', async () => {
        const response = await request(app).get('/issues');
        expect(response.status).toBe(401);
    });

    it('returns 403 when caller has User role', async () => {
        const response = await request(app)
            .get('/issues')
            .set('x-test-user', JSON.stringify(authHeader('test-user', 'User')));
        expect(response.status).toBe(403);
    });

    it('returns 200 with array of issues when caller is Admin', async () => {
        const response = await request(app)
            .get('/issues')
            .set('x-test-user', JSON.stringify(authHeader('test-admin', 'Admin')));
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('includes reporterEmail in every response item for Admin caller', async () => {
        await request(app).post('/issues').send({
            title: 'Test issue with email',
            description: 'Admin should see email.',
            reporterEmail: 'leak-test@example.com',
        });

        const response = await request(app)
            .get('/issues')
            .set('x-test-user', JSON.stringify(authHeader('test-admin', 'Admin')));
        expect(response.status).toBe(200);
        expect(response.body.length).toBeGreaterThan(0);
        for (const issue of response.body) {
            expect(issue).toHaveProperty('reporterEmail');
        }
    });
});

describe('GET /issues/:id (admin only)', () => {
    it('returns 401 when no auth token is provided', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Findable', description: 'Look me up.' });
        const id = createResponse.body.id;

        const response = await request(app).get(`/issues/${id}`);
        expect(response.status).toBe(401);
    });

    it('returns 403 when caller has User role', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Findable', description: 'Look me up.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .get(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-user', 'User')));
        expect(response.status).toBe(403);
    });

    it('returns 200 with the issue when caller is Admin and id exists', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Findable', description: 'Look me up.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .get(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin', 'Admin')));
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(id);
    });

    it('returns 404 when id does not exist (Admin caller)', async () => {
        const response = await request(app)
            .get('/issues/999999')
            .set('x-test-user', JSON.stringify(authHeader('test-admin', 'Admin')));
        expect(response.status).toBe(404);
    });

    it('returns 400 when id is not a positive integer (Admin caller)', async () => {
        const response = await request(app)
            .get('/issues/abc')
            .set('x-test-user', JSON.stringify(authHeader('test-admin', 'Admin')));
        expect(response.status).toBe(400);
    });

    it('includes reporterEmail in the response for Admin caller', async () => {
        const createResponse = await request(app).post('/issues').send({
            title: 'Email visibility test',
            description: 'Admin GET /:id should include reporterEmail.',
            reporterEmail: 'admin-visible@example.com',
        });
        const id = createResponse.body.id;

        const response = await request(app)
            .get(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin', 'Admin')));
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('reporterEmail', 'admin-visible@example.com');
    });
});

describe('PATCH /issues/:id', () => {
    it('returns 401 when no auth token is provided', async () => {
        const response = await request(app).patch('/issues/1').send({ status: 'Resolved' });
        expect(response.status).toBe(401);
    });

    it('returns 403 when caller has User role (insufficient permissions)', async () => {
        const response = await request(app)
            .patch('/issues/1')
            .set('x-test-user', JSON.stringify(authHeader('test-user-1', 'User')))
            .send({ status: 'Resolved' });
        expect(response.status).toBe(403);
    });

    it('returns 200 with updated status when caller is Admin', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'To be resolved', description: 'Admin will close this.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-1', 'Admin')))
            .send({ status: 'Resolved' });
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('Resolved');
    });

    it('returns 200 with updated severity when caller is Admin', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Severity bump', description: 'Reclassify this one.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-1b', 'Admin')))
            .send({ severity: 'Critical' });
        expect(response.status).toBe(200);
        expect(response.body.severity).toBe('Critical');
    });

    it('returns 200 and updates both status and severity together', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Both fields', description: 'Update both at once.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-1c', 'Admin')))
            .send({ status: 'InProgress', severity: 'Major' });
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('InProgress');
        expect(response.body.severity).toBe('Major');
    });

    it('returns 400 when body is empty', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Empty body test', description: '...' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-empty', 'Admin')))
            .send({});
        expect(response.status).toBe(400);
    });

    it('returns 400 when body contains an unknown field', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Unknown field test', description: '...' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-unknown', 'Admin')))
            .send({ status: 'Open', color: 'red' });
        expect(response.status).toBe(400);
    });

    it('returns 404 when id does not exist (Admin caller)', async () => {
        const response = await request(app)
            .patch('/issues/999999')
            .set('x-test-user', JSON.stringify(authHeader('test-admin-2', 'Admin')))
            .send({ status: 'Resolved' });
        expect(response.status).toBe(404);
    });

    it('returns 400 when status value is invalid', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Bad status test', description: '...' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-3', 'Admin')))
            .send({ status: 'Bogus' });
        expect(response.status).toBe(400);
    });

    it('returns 400 when severity value is invalid', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Bad severity test', description: '...' });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-3b', 'Admin')))
            .send({ severity: 'P0' });
        expect(response.status).toBe(400);
    });

    it('includes reporterEmail in the PATCH response for Admin caller', async () => {
        const createResponse = await request(app).post('/issues').send({
            title: 'Email visibility on patch',
            description: '...',
            reporterEmail: 'patch-visible@example.com',
        });
        const id = createResponse.body.id;

        const response = await request(app)
            .patch(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-5', 'Admin')))
            .send({ status: 'Resolved' });
        expect(response.body).toHaveProperty('reporterEmail', 'patch-visible@example.com');
    });

    it('returns 404 on PUT (old method is gone)', async () => {
        const response = await request(app)
            .put('/issues/1')
            .set('x-test-user', JSON.stringify(authHeader('test-admin-put', 'Admin')))
            .send({ status: 'Resolved' });
        expect(response.status).toBe(404);
    });
});

describe('DELETE /issues/:id', () => {
    it('returns 401 when no auth token is provided', async () => {
        const response = await request(app).delete('/issues/1');
        expect(response.status).toBe(401);
    });

    it('returns 403 when caller has User role', async () => {
        const response = await request(app)
            .delete('/issues/1')
            .set('x-test-user', JSON.stringify(authHeader('test-user-del', 'User')));
        expect(response.status).toBe(403);
    });

    it('returns 204 with no body when caller is Admin and id exists', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'To be deleted', description: 'Admin will remove this.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .delete(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-del', 'Admin')));
        expect(response.status).toBe(204);
        expect(response.body).toEqual({});
    });

    it('returns 404 when id does not exist (Admin caller)', async () => {
        const response = await request(app)
            .delete('/issues/999999')
            .set('x-test-user', JSON.stringify(authHeader('test-admin-del2', 'Admin')));
        expect(response.status).toBe(404);
    });

    it('returns 400 when id is not a positive integer', async () => {
        const response = await request(app)
            .delete('/issues/abc')
            .set('x-test-user', JSON.stringify(authHeader('test-admin-del3', 'Admin')));
        expect(response.status).toBe(400);
    });

    it('after successful DELETE, GET on the same id returns 404', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Round-trip delete', description: '...' });
        const id = createResponse.body.id;

        const deleteResponse = await request(app)
            .delete(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-del4', 'Admin')));
        expect(deleteResponse.status).toBe(204);

        const getResponse = await request(app)
            .get(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-del4', 'Admin')));
        expect(getResponse.status).toBe(404);
    });
});
