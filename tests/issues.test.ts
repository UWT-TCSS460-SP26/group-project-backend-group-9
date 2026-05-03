/*
 * Class:        TCSS 460 Spring 2026
 * Group:        Group 9
 * Assignment:   Sprint 3, Card #43
 */

/**
 * Tests for POST /issues. Public route, no auth required.
 * Covers happy paths (minimal body, full body, severity defaulting) and
 * sad paths (missing required fields, invalid formats, disallowed fields).
 * Prisma is mocked so these run without a database.
 */

const mockIssue = {
    create: jest.fn(),
};

jest.mock('../src/prisma', () => ({
    prisma: { issue: mockIssue },
}));

jest.mock('../src/lib/prisma', () => ({
    prisma: { issue: mockIssue },
}));

import request from 'supertest';
import { app } from '../src/app';

beforeEach(() => {
    Object.values(mockIssue).forEach((m) => m.mockReset());
    mockIssue.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
            id: 1,
            ...data,
            status: 'Open',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
    );
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
        const response = await request(app).post('/issues').send({
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
