import { Request, Response } from 'express';
import { prisma } from '../prisma';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

async function fetchTmdbMeta(tmdbId: number, mediaType: 'MOVIE' | 'TV') {
    const path = mediaType === 'MOVIE' ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    try {
        const res = await fetch(`${TMDB_BASE}${path}`, {
            headers: { Authorization: `Bearer ${process.env.MOVIE_READ_KEY}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as Record<string, unknown>;
        return {
            title: (mediaType === 'MOVIE' ? data.title : data.name) as string,
            poster: data.poster_path ? `${IMAGE_BASE}${data.poster_path as string}` : null,
            releaseDate: (mediaType === 'MOVIE'
                ? data.release_date
                : data.first_air_date) as string,
        };
    } catch {
        return null;
    }
}

export const getCommunityFeed = async (request: Request, response: Response) => {
    const parsed = request.parsedQuery ?? {};
    const page = parsed.page ?? 1;
    const limit = parsed.limit ?? 20;
    const minReviews = parsed.minReviews ?? 2;
    const sort = (request.query.sort ?? 'rating') as 'rating' | 'reviews';

    const having = { id: { _count: { gte: minReviews } } };
    const orderBy =
        sort === 'reviews'
            ? { _count: { id: 'desc' as const } }
            : { _avg: { score: 'desc' as const } };

    try {
        const [aggregates, allGroups] = await Promise.all([
            prisma.review.groupBy({
                by: ['tmdbId', 'mediaType'],
                _avg: { score: true },
                _count: { id: true },
                having,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.review.groupBy({
                by: ['tmdbId', 'mediaType'],
                _count: { id: true },
                having,
            }),
        ]);

        const results = await Promise.all(
            aggregates.map(async (group) => ({
                tmdbId: group.tmdbId,
                mediaType: group.mediaType,
                averageScore: Math.round((group._avg.score ?? 0) * 10) / 10,
                reviewCount: group._count.id,
                tmdb: await fetchTmdbMeta(group.tmdbId, group.mediaType),
            }))
        );

        response.json({
            page,
            limit,
            total: allGroups.length,
            sort,
            minReviews,
            results,
        });
    } catch (_error) {
        response.status(500).json({ error: 'Failed to fetch community feed' });
    }
};
