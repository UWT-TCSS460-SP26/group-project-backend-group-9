import request from 'supertest';
import { app } from '../src/app';

// Mock global fetch to avoid hitting real TMDB in tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Full mock response matching TMDB's shape
const mockMovieSearchResponse: object = {
    page: 1,
    results: [
        {
            adult: false,
            backdrop_path: '/sidvlo7V8VMyskNKGwua0Tarbol.jpg',
            genre_ids: [16, 10751, 12, 14, 35, 28, 18, 878],
            id: 961323,
            original_language: 'en',
            original_title: 'Nimona',
            overview:
                'A knight framed for a tragic crime teams with a scrappy, shape-shifting teen to prove his innocence.',
            popularity: 4.2522,
            poster_path: '/2NQljeavtfl22207D1kxLpa4LS3.jpg',
            release_date: '2023-06-23',
            title: 'Nimona',
            video: false,
            vote_average: 7.9,
            vote_count: 1358,
        },
    ],
    total_pages: 1,
    total_results: 1,
};

const mockMovieResponse: object = {
    adult: false,
    backdrop_path: '/sidvlo7V8VMyskNKGwua0Tarbol.jpg',
    belongs_to_collection: null,
    budget: 0,
    genres: [
        {
            id: 16,
            name: 'Animation',
        },
        {
            id: 10751,
            name: 'Family',
        },
        {
            id: 12,
            name: 'Adventure',
        },
        {
            id: 14,
            name: 'Fantasy',
        },
        {
            id: 35,
            name: 'Comedy',
        },
        {
            id: 28,
            name: 'Action',
        },
        {
            id: 18,
            name: 'Drama',
        },
        {
            id: 878,
            name: 'Science Fiction',
        },
    ],
    homepage: 'https://www.netflix.com/title/81444554',
    id: 961323,
    imdb_id: 'tt19500164',
    origin_country: ['US'],
    original_language: 'en',
    original_title: 'Nimona',
    overview:
        'A knight framed for a tragic crime teams with a scrappy, shape-shifting teen to prove his innocence.',
    popularity: 4.2522,
    poster_path: '/2NQljeavtfl22207D1kxLpa4LS3.jpg',
    production_companies: [
        {
            id: 13184,
            logo_path: '/pfUB1a62jSMIqp4Xmaq6z2cgW0B.png',
            name: 'Annapurna Pictures',
            origin_country: 'US',
        },
        {
            id: 31922,
            logo_path: '/omWPoru2LNayUOBqjMBLP9KrFrP.png',
            name: 'DNEG',
            origin_country: 'GB',
        },
    ],
    production_countries: [
        {
            iso_3166_1: 'US',
            name: 'United States of America',
        },
        {
            iso_3166_1: 'GB',
            name: 'United Kingdom',
        },
    ],
    release_date: '2023-06-23',
    revenue: 0,
    runtime: 99,
    spoken_languages: [
        {
            english_name: 'English',
            iso_639_1: 'en',
            name: 'English',
        },
    ],
    status: 'Released',
    tagline: 'A little anti. A little hero.',
    title: 'Nimona',
    video: false,
    vote_average: 7.9,
    vote_count: 1358,
};

beforeEach(() => {
    mockFetch.mockReset();
    process.env.MOVIE_READ_KEY = 'test-api-key';
});

describe('Movie Routes', () => {
    describe('GET /movies/:id', () => {
        it('returns transformed movie details on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockMovieResponse,
            });

            const res = await request(app).get('/movies/961323');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(961323);
            expect(res.body.title).toBe('Nimona');
            expect(res.body.description).toBe(
                'A knight framed for a tragic crime teams with a scrappy, shape-shifting teen to prove his innocence.'
            );
            expect(res.body.releaseDate).toBe('2023-06-23');
            expect(res.body.poster).toBe(
                'https://image.tmdb.org/t/p/w500/2NQljeavtfl22207D1kxLpa4LS3.jpg'
            );
            expect(res.body.genres).toContain('Animation');
            expect(res.body.genres).toContain('Family');
            expect(res.body.runtime).toBe(99);
            expect(res.body.rating).toBe(7.9);
        });

        it('returns 404 for an invalid movie id', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                json: async () => ({
                    status_message: 'The resource you requested could not be found.',
                }),
            });

            const res = await request(app).get('/movies/999999999');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /movies/search?', () => {
        it('returns transformed search data on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockMovieSearchResponse,
            });

            const res = await request(app).get('/movies/search?before=2023-07-01&after=2023-05-01');
            expect(res.status).toBe(200);
            expect(res.body.results[0].title).toBe('Nimona');
            expect(res.body.totalPages).toBe(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('primary_release_date.lte=2023-07-01'),
                expect.objectContaining({ headers: { Authorization: 'Bearer test-api-key' } })
            );
        });

        it('returns 400 when query validation fails', async () => {
            const res = await request(app).get('/movies/search?page=one');
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/.*integer.*/i);
        });

        it('returns 502 when fetch throws', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const res = await request(app).get('/movies/search');
            expect(res.status).toBe(502);
        });
    });
});
