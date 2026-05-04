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

    it('rejects status field on creation', async () => {
        const response = await request(app).post('/issues').send({
            title: 'Bug report',
            description: 'Trying to set status.',
            status: 'Resolved',
        });

        expect(response.status).toBe(400);
    });
});

describe('GET /issues', () => {
    it('returns 200 with array of issues', async () => {
        const response = await request(app)
            .get('/issues')
            .set('x-test-user', JSON.stringify(authHeader('test-user', 'User')));
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('does not include reporterEmail in any response item', async () => {
        await request(app).post('/issues').send({
            title: 'Test issue with email',
            description: 'Should not leak email.',
            reporterEmail: 'leak-test@example.com',
        });

        const response = await request(app)
            .get('/issues')
            .set('x-test-user', JSON.stringify(authHeader('test-user', 'User')));
        expect(response.status).toBe(200);
        for (const issue of response.body) {
            expect(issue).not.toHaveProperty('reporterEmail');
        }
    });
});

describe('GET /issues/:id', () => {
    it('returns 200 with the issue when id exists', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Findable', description: 'Look me up.' });
        const id = createResponse.body.id;

        const response = await request(app).get(`/issues/${id}`);
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(id);
    });

    it('returns 404 when id does not exist', async () => {
        const response = await request(app).get('/issues/999999');
        expect(response.status).toBe(404);
    });

    it('returns 400 when id is not a positive integer', async () => {
        const response = await request(app).get('/issues/abc');
        expect(response.status).toBe(400);
    });

    it('does not include reporterEmail in the response', async () => {
        const createResponse = await request(app).post('/issues').send({
            title: 'Email leak test',
            description: 'Single get should also strip.',
            reporterEmail: 'single-leak@example.com',
        });
        const id = createResponse.body.id;

        const response = await request(app).get(`/issues/${id}`);
        expect(response.body).not.toHaveProperty('reporterEmail');
    });
});

describe('PUT /issues/:id', () => {
    it('returns 401 when no auth token is provided', async () => {
        const response = await request(app).put('/issues/1').send({ status: 'Resolved' });
        expect(response.status).toBe(401);
    });

    it('returns 403 when caller has User role (insufficient permissions)', async () => {
        const response = await request(app)
            .put('/issues/1')
            .set('x-test-user', JSON.stringify(authHeader('test-user-1', 'User')))
            .send({ status: 'Resolved' });
        expect(response.status).toBe(403);
    });

    it('returns 200 when caller is Admin and id exists', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'To be resolved', description: 'Admin will close this.' });
        const id = createResponse.body.id;

        const response = await request(app)
            .put(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-1', 'Admin')))
            .send({ status: 'Resolved' });
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('Resolved');
    });

    it('returns 404 when id does not exist (Admin caller)', async () => {
        const response = await request(app)
            .put('/issues/999999')
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
            .put(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-3', 'Admin')))
            .send({ status: 'Bogus' });
        expect(response.status).toBe(400);
    });

    it('rejects body fields other than status', async () => {
        const createResponse = await request(app)
            .post('/issues')
            .send({ title: 'Field strip test', description: '...' });
        const id = createResponse.body.id;

        const response = await request(app)
            .put(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-4', 'Admin')))
            .send({ status: 'InProgress', title: 'Hijack attempt' });
        expect(response.status).toBe(400);
    });

    it('does not include reporterEmail in the PUT response', async () => {
        const createResponse = await request(app).post('/issues').send({
            title: 'Put strip test',
            description: '...',
            reporterEmail: 'put-leak@example.com',
        });
        const id = createResponse.body.id;

        const response = await request(app)
            .put(`/issues/${id}`)
            .set('x-test-user', JSON.stringify(authHeader('test-admin-5', 'Admin')))
            .send({ status: 'Resolved' });
        expect(response.body).not.toHaveProperty('reporterEmail');
    });
});
