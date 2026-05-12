// Tests for GET /community — community-ranked discovery feed.
// Prisma groupBy is mocked; global.fetch mocks TMDB API calls.

const mockReview = {
    groupBy: jest.fn(),
};

jest.mock('../src/prisma', () => ({
    prisma: { review: mockReview },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import request from 'supertest';
import { app } from '../src/app';

const mockTmdbMovie = {
    id: 961323,
    title: 'Nimona',
    poster_path: '/2NQljeavtfl22207D1kxLpa4LS3.jpg',
    release_date: '2023-06-23',
};

const sampleAggregate = [
    {
        tmdbId: 961323,
        mediaType: 'MOVIE',
        _avg: { score: 8.5 },
        _count: { id: 10 },
    },
];

// The controller calls groupBy twice: once for the page, once for the total count.
const mockGroupBy = (pageResults = sampleAggregate, allResults = sampleAggregate) => {
    mockReview.groupBy.mockResolvedValueOnce(pageResults).mockResolvedValueOnce(allResults);
};

const mockTmdbOk = (data: object = mockTmdbMovie) => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => data });
};

beforeEach(() => {
    mockReview.groupBy.mockReset();
    mockFetch.mockReset();
    process.env.MOVIE_READ_KEY = 'test-api-key';
});

describe('GET /community', () => {
    describe('success cases', () => {
        it('returns 200 with enriched results', async () => {
            mockGroupBy();
            mockTmdbOk();

            const res = await request(app).get('/community?sort=rating');

            expect(res.status).toBe(200);
            expect(res.body.results).toHaveLength(1);
            expect(res.body.results[0]).toMatchObject({
                tmdbId: 961323,
                mediaType: 'MOVIE',
                averageScore: 8.5,
                reviewCount: 10,
                tmdb: {
                    title: 'Nimona',
                    poster: 'https://image.tmdb.org/t/p/w500/2NQljeavtfl22207D1kxLpa4LS3.jpg',
                    releaseDate: '2023-06-23',
                },
            });
        });

        it('defaults sort to rating when omitted', async () => {
            mockGroupBy();
            mockTmdbOk();

            const res = await request(app).get('/community');

            expect(res.status).toBe(200);
            expect(res.body.sort).toBe('rating');
            expect(mockReview.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { _avg: { score: 'desc' } } })
            );
        });

        it('sorts by review count when sort=reviews', async () => {
            mockGroupBy();
            mockTmdbOk();

            const res = await request(app).get('/community?sort=reviews');

            expect(res.status).toBe(200);
            expect(res.body.sort).toBe('reviews');
            expect(mockReview.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({ orderBy: { _count: { id: 'desc' } } })
            );
        });

        it('returns correct pagination envelope', async () => {
            const all = Array.from({ length: 30 }, (_, i) => ({
                tmdbId: i + 1,
                mediaType: 'MOVIE',
                _avg: { score: 7 },
                _count: { id: 3 },
            }));
            mockGroupBy(all.slice(0, 5), all);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ ...mockTmdbMovie }),
            });

            const res = await request(app).get('/community?sort=rating&page=1&limit=5');

            expect(res.status).toBe(200);
            expect(res.body.page).toBe(1);
            expect(res.body.limit).toBe(5);
            expect(res.body.total).toBe(30);
            expect(res.body.results).toHaveLength(5);
        });

        it('returns empty results when no titles meet the minReviews threshold', async () => {
            mockGroupBy([], []);

            const res = await request(app).get('/community?sort=rating&minReviews=100');

            expect(res.status).toBe(200);
            expect(res.body.results).toHaveLength(0);
            expect(res.body.total).toBe(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('passes minReviews threshold to the HAVING clause', async () => {
            mockGroupBy();
            mockTmdbOk();

            await request(app).get('/community?sort=rating&minReviews=5');

            expect(mockReview.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({ having: { id: { _count: { gte: 5 } } } })
            );
        });

        it('uses name and first_air_date for TV shows', async () => {
            const tvAggregate = [
                { tmdbId: 1396, mediaType: 'TV', _avg: { score: 9 }, _count: { id: 5 } },
            ];
            mockGroupBy(tvAggregate, tvAggregate);
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    id: 1396,
                    name: 'Breaking Bad',
                    poster_path: '/zzWGRw277MNoCs3zhyG3YS6LVEF.jpg',
                    first_air_date: '2008-01-20',
                }),
            });

            const res = await request(app).get('/community?sort=rating');

            expect(res.status).toBe(200);
            expect(res.body.results[0].tmdb.title).toBe('Breaking Bad');
            expect(res.body.results[0].tmdb.releaseDate).toBe('2008-01-20');
        });
    });

    describe('TMDB failure handling', () => {
        it('sets tmdb to null when TMDB returns non-ok status', async () => {
            mockGroupBy();
            mockFetch.mockResolvedValue({ ok: false, status: 404 });

            const res = await request(app).get('/community?sort=rating');

            expect(res.status).toBe(200);
            expect(res.body.results[0].tmdb).toBeNull();
        });

        it('sets tmdb to null when TMDB fetch throws', async () => {
            mockGroupBy();
            mockFetch.mockRejectedValue(new Error('Network error'));

            const res = await request(app).get('/community?sort=rating');

            expect(res.status).toBe(200);
            expect(res.body.results[0].tmdb).toBeNull();
        });
    });

    describe('validation errors', () => {
        it('returns 400 for invalid sort value', async () => {
            const res = await request(app).get('/community?sort=newest');

            expect(res.status).toBe(400);
            expect(mockReview.groupBy).not.toHaveBeenCalled();
        });

        it('returns 400 for page=0', async () => {
            const res = await request(app).get('/community?page=0');

            expect(res.status).toBe(400);
            expect(mockReview.groupBy).not.toHaveBeenCalled();
        });

        it('returns 400 for non-integer page', async () => {
            const res = await request(app).get('/community?page=two');

            expect(res.status).toBe(400);
            expect(mockReview.groupBy).not.toHaveBeenCalled();
        });

        it('returns 400 for limit above maximum (51)', async () => {
            const res = await request(app).get('/community?limit=51');

            expect(res.status).toBe(400);
            expect(mockReview.groupBy).not.toHaveBeenCalled();
        });

        it('returns 400 for negative minReviews', async () => {
            const res = await request(app).get('/community?minReviews=-1');

            expect(res.status).toBe(400);
            expect(mockReview.groupBy).not.toHaveBeenCalled();
        });
    });

    describe('environment', () => {
        it('returns 500 when MOVIE_READ_KEY is not set', async () => {
            delete process.env.MOVIE_READ_KEY;

            const res = await request(app).get('/community?sort=rating');

            expect(res.status).toBe(500);
            expect(mockReview.groupBy).not.toHaveBeenCalled();
        });
    });
});
