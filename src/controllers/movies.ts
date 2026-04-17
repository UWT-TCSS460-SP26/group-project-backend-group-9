import { Request, Response } from 'express';

const BASE_URL = 'https://api.themoviedb.org/3';
const apiKey = process.env.MOVIE_READ_KEY;

export const getMovies = async (request: Request, response: Response) => {
    const page: number = Number(request.query.page) || 0;
    const title: string = request.query.title as string;
    const lang: string = (request.query.lang || 'en') as string;
    const after: string = request.query.after as string;
    const before: string = request.query.before as string;
    const sort: string = (request.query.sort || 'popularity') as string;
    const order: string = (request.query.order || 'desc') as string;

    const sortKey: Record<string, string> = {
        title: 'original_title',
        popularity: 'popularity',
        date: 'primary_release_date',
        rating: 'vote_average',
    };

    // Looks much better without prettier formatting
    // prettier-ignore
    const movieCompare: Record<string, (a: Record<string, unknown>, b: Record<string, unknown>) => number> = {
        title: (a: Record<string, unknown>, b: Record<string, unknown>) =>
            (a.title as string).localeCompare(b.title as string),
        popularity: (a: Record<string, unknown>, b: Record<string, unknown>) =>
            (a.popularity as number) - (b.popularity as number),
        date: (a: Record<string, unknown>, b: Record<string, unknown>) =>
            Date.parse(a.release_date as string) - Date.parse(b.release_date as string),
        rating: (a: Record<string, unknown>, b: Record<string, unknown>) =>
            ((a.vote_average as number) - (b.vote_average as number)) as number,
    };

    try {
        if (title) {
            // Going to use the TMDB search API, then manually apply filters to it
            const result = await fetch(
                `${BASE_URL}/search/movie?query=${encodeURIComponent(title)}&page=${encodeURIComponent(Number(page) + 1)}${lang ? '&language=' + encodeURIComponent(lang) : ''}`,
                {
                    // TMDB Requires the key in a custom header
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                }
            );

            const data = (await result.json()) as Record<string, unknown>;

            if (!result.ok) {
                response.status(result.status).json({ error: data.message || 'API error' });
                return;
            }

            const movies: Record<string, unknown>[] = data.results as Record<string, unknown>[];

            const out: object = {
                code: 200,
                page: page,
                totalPages: data.total_pages,
                results: (order === 'asc'
                    ? movies.sort(movieCompare[sort])
                    : movies.sort(movieCompare[sort]).reverse()
                )
                    .filter((a) =>
                        after ? Date.parse(a.release_date as string) - Date.parse(after) >= 0 : true
                    )
                    .filter((a) =>
                        before
                            ? Date.parse(a.release_date as string) - Date.parse(before) <= 0
                            : true
                    )
                    .map((movie) => {
                        return {
                            id: movie.id,
                            lang: lang,
                            title: movie.title,
                            description: movie.overview,
                            releaseDate: movie.release_date,
                            poster: 'TBD',
                        };
                    }),
            };

            response.json(out);
        } else {
            // Just use the TMDB discover API
            const result = await fetch(
                `${BASE_URL}/discover/movie?page=${encodeURIComponent(Number(page) + 1)}&sort_by=${encodeURIComponent(sortKey[sort] + '.' + order)}${after ? '&primary_release_date.gte=' + encodeURIComponent(after) : ''}${before ? '&primary_release_date.lte=' + encodeURIComponent(before) : ''}${lang ? '&language=' + encodeURIComponent(lang) : ''}`,
                {
                    // TMDB Requires the key in a custom header
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                }
            );

            const data = (await result.json()) as Record<string, unknown>;

            if (!result.ok) {
                response.status(result.status).json({ error: data.message || 'API error' });
                return;
            }

            const movies: Record<string, unknown>[] = data.results as Record<string, unknown>[];
            const out: object = {
                code: 200,
                page: page,
                totalPages: data.total_pages,
                results: movies.map((movie) => {
                    return {
                        id: movie.id,
                        lang: lang,
                        title: movie.title,
                        description: movie.overview,
                        releaseDate: movie.release_date,
                        poster: 'TBD',
                    };
                }),
            };

            response.json(out);
        }
    } catch (_error) {
        response.status(502).json({ error: 'Network error' });
    }
};
