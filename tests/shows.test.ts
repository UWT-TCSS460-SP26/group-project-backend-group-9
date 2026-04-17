import request from 'supertest';
 import { app } from '../src/app';
                  
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockShowResponse = {
    id: 1396,
    name: 'Breaking Bad',
    overview: 'A chemistry teacher turned drug manufacturer.',
    poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    first_air_date: '2008-01-20',
    last_air_date: '2013-09-29',
    number_of_seasons: 5,
    number_of_episodes: 62,
    status: 'Ended',
    networks: [{ name: 'AMC' }],
    genres: [{ name: 'Drama' }, { name: 'Crime' }],
};

beforeEach(() => {
    mockFetch.mockReset();
});
  
describe('GET /shows/:id', () => {
    it('returns 200 with show details for a valid ID', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockShowResponse,
        });

        const response = await request(app).get('/shows/1396');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('code', 200);
        expect(response.body).toHaveProperty('id', 1396);
        expect(response.body).toHaveProperty('name', 'Breaking Bad');
        expect(response.body).toHaveProperty('description');
        expect(response.body).toHaveProperty('posterUrl');
        expect(Array.isArray(response.body.genres)).toBe(true);
        expect(Array.isArray(response.body.networks)).toBe(true);
    });

    it('returns 404 for a non-existent show ID', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ status_message: 'Not Found' }),
        });

        const response = await request(app).get('/shows/999999999');
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
    });

    it('returns 400 for a non-numeric ID', async () => {
        const response = await request(app).get('/shows/abc');
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    it('returns 502 when fetch throws', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const response = await request(app).get('/shows/1396');
        expect(response.status).toBe(502);
    });
});
