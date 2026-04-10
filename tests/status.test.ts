import request from 'supertest';
import { app } from '../src/app';

describe('Status Route', () => {
    it('GET /status — returns status', async () => {
        const response = await request(app).get('/status');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('Alive');
    });
});
