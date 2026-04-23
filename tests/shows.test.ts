import request from 'supertest';
import { app } from '../src/app';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Full mock response matching TMDB's shape
const mockShowSearchResponse: object = {
    page: 1,
    results: [
        {
            adult: false,
            backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
            origin_country: ['US'],
            genre_ids: [18, 80],
            id: 1396,
            original_language: 'en',
            original_name: 'Breaking Bad',
            overview:
                "Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live. He becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost as he enters the dangerous world of drugs and crime.",
            popularity: 120.6714,
            poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
            first_air_date: '2008-01-20',
            name: 'Breaking Bad',
            vote_average: 8.942,
            vote_count: 17525,
        },
    ],
    total_pages: 1,
    total_results: 1,
};

const mockShowResponse: object = {
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
    process.env.MOVIE_READ_KEY = 'test-api-key';
});

describe('Show routes', () => {
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

    describe('GET /shows/search?', () => {
        it('returns transformed search data on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockShowSearchResponse,
            });

            const res = await request(app).get('/shows/search?before=2008-03-14&after=2006-05-01');
            expect(res.status).toBe(200);
            expect(res.body.results[0].name).toBe('Breaking Bad');
            expect(res.body.totalPages).toBe(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('first_air_date.lte=2008-03-14'),
                expect.objectContaining({ headers: { Authorization: 'Bearer test-api-key' } })
            );
        });

        it('returns 400 when query validation fails', async () => {
            const res = await request(app).get('/shows/search?page=one');
            expect(res.status).toBe(400);
            expect(res.body.details[0].message).toContain('expected number');
        });

        it('returns 502 when fetch throws', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const res = await request(app).get('/shows/search');
            expect(res.status).toBe(502);
        });
    });
});
