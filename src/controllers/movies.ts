import { Request, Response } from 'express';
import { MovieSearch } from '../middleware/validation';

const BASE_URL = 'https://api.themoviedb.org/3';
const BASE_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';

export const getMovies = async (request: Request, response: Response) => {
    const { page, title, description, lang, after, before, sort, order } = request.validated!
        .query as MovieSearch;

    const sortKey: Record<string, string> = {
        title: 'title',
        popularity: 'popularity',
        date: 'primary_release_date',
        rating: 'vote_average',
    };

    try {
        const query: string = title
            ? `${BASE_URL}/search/movie?query=${encodeURIComponent(title)}${lang ? '&language=' + encodeURIComponent(lang) : ''}page=${encodeURIComponent(page)}`
            : `${BASE_URL}/discover/movie?page=${encodeURIComponent(page)}&sort_by=${encodeURIComponent(sortKey[sort] + '.' + order)}${after ? '&primary_release_date.gte=' + encodeURIComponent(after) : ''}${before ? '&primary_release_date.lte=' + encodeURIComponent(before) : ''}${lang ? '&language=' + encodeURIComponent(lang) : ''}`;

        const result = await fetch(query, {
            headers: {
                Authorization: `Bearer ${process.env.MOVIE_READ_KEY}`,
            },
        });

        const data = (await result.json()) as Record<string, unknown>;

        if (!result.ok) {
            response.status(502).json({ error: data.message || 'API error' });
            return;
        }

        const movies: Record<string, unknown>[] = data.results as Record<string, unknown>[];

        const keywords: string[] = description?.split(',') || [];

        const out: object = {
            code: 200,
            page: page,
            totalPages: data.total_pages,
            results: movies
                .filter((movie) =>
                    keywords.length > 0
                        ? keywords.every(
                              (word) =>
                                  (movie.overview as string)
                                      .toUpperCase()
                                      .indexOf(word.toUpperCase()) > -1
                          )
                        : true
                )
                .filter((movie) =>
                    title
                        ? (!after || new Date(movie.release_date as string) >= new Date(after)) &&
                          (!before || new Date(movie.release_date as string) <= new Date(before))
                        : true
                )
                .map((movie) => {
                    return {
                        id: movie.id,
                        lang: lang,
                        title: movie.title,
                        description: movie.overview,
                        releaseDate: movie.release_date,
                        poster: `${BASE_IMAGE_URL}${movie.poster_path}`,
                    };
                }),
        };

        response.json(out);
    } catch (_error) {
        response.status(500).json({ error: 'Network error' });
    }
};

export const getMovieDetails = async (request: Request, response: Response) => {
    const { id } = request.validated!.params! as { id: number };

    try {
        const result = await fetch(`${BASE_URL}/movie/${encodeURIComponent(String(id))}`, {
            headers: {
                Authorization: `Bearer ${process.env.MOVIE_READ_KEY}`,
            },
        });

        if (result.status === 404) {
            response.status(404).json({ error: 'Movie not found' });
            return;
        }

        if (!result.ok) {
            response.status(502).json({ error: 'Failed to fetch movie details' });
            return;
        }

        const data = (await result.json()) as Record<string, unknown>;
        const genres = (data.genres as Array<{ id: number; name: string }>).map((g) => g.name);

        response.json({
            id: data.id,
            title: data.title,
            description: data.overview,
            releaseDate: data.release_date,
            poster: `${BASE_IMAGE_URL}${data.poster_path}`,
            genres,
            runtime: data.runtime,
            rating: data.vote_average,
        });
    } catch (_error) {
        response.status(500).json({ error: 'Internal server error' });
    }
};
