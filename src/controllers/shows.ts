import { Request, Response } from 'express';

// TMDB base URLs for API requests and poster images
const BASE_URL = 'https://api.themoviedb.org/3';
const BASE_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';
const apiKey = process.env.MOVIE_READ_KEY;

// Fetches TV show details from TMDB and returns a transformed response
export const getShowDetails = async (request: Request, response: Response) => {
    const { id } = request.params;

    try {
        const tmdbResponse = await fetch(`${BASE_URL}/tv/${id}`, {
            headers: {
                Authorization: `Bearer ${process.env.MOVIE_READ_KEY}`,
            },
        });

        if (tmdbResponse.status === 404) {
            response.status(404).json({ error: 'Show not found' });
            return;
        }

        if (!tmdbResponse.ok) {
            response.status(500).json({ error: 'Failed to fetch show data' });
            return;
        }

        const data = (await tmdbResponse.json()) as Record<string, unknown>;
        const networks = data.networks as { name: string }[];
        const genres = data.genres as { name: string }[];

        // Transform TMDB response into our API schema
        response.json({
            code: 200,
            id: data.id,
            name: data.name,
            description: data.overview,
            posterUrl: data.poster_path ? `${BASE_IMAGE_URL}${data.poster_path}` : null,
            firstAirDate: data.first_air_date,
            lastAirDate: data.last_air_date,
            numberOfSeasons: data.number_of_seasons,
            numberOfEpisodes: data.number_of_episodes,
            status: data.status,
            networks: networks.map((n) => n.name),
            genres: genres.map((g) => g.name),
        });
    } catch (_error) {
        response.status(502).json({ error: 'Network error' });
    }
};

export const getShows = async (request: Request, response: Response) => {
    const page: number = Number(request.query.page) || 0;
    const text: string = request.query.text as string;
    const lang: string = (request.query.lang || 'en') as string;
    const after: string = request.query.after as string;
    const before: string = request.query.before as string;
    const sort: string = (request.query.sort || 'popularity') as string;
    const order: string = (request.query.order || 'desc') as string;

    const sortKey: Record<string, string> = {
        name: 'name',
        popularity: 'popularity',
        date: 'first_air_date',
        rating: 'vote_average',
    };

    try {
        const result = await fetch(
            `${BASE_URL}/discover/tv?page=${encodeURIComponent(Number(page) + 1)}&sort_by=${encodeURIComponent(sortKey[sort] + '.' + order)}${after ? '&first_air_date.gte=' + encodeURIComponent(after) : ''}${before ? '&first_air_date.lte=' + encodeURIComponent(before) : ''}${lang ? '&language=' + encodeURIComponent(lang) : ''}`,
            {
                // TMDB Requires the key in a custom header
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );

        const data = (await result.json()) as Record<string, unknown>;

        if (!result.ok) {
            response.status(result.status).json({ error: data || 'API error' });
            return;
        }

        const shows: Record<string, unknown>[] = data.results as Record<string, unknown>[];

        const keywords: string[] = text?.split(',') || [];

        const out: object = {
            code: 200,
            page: page,
            totalPages: data.total_pages,
            results: shows
                .filter((show) =>
                    keywords.length > 0
                        ? keywords.every(
                              (word) =>
                                  (show.name as string).toUpperCase().indexOf(word.toUpperCase()) >
                                      -1 ||
                                  (show.overview as string)
                                      .toUpperCase()
                                      .indexOf(word.toUpperCase()) > -1
                          )
                        : true
                )
                .map((show) => {
                    return {
                        id: show.id,
                        lang: lang,
                        name: show.name,
                        description: show.overview,
                        firstAirDate: show.first_air_date,
                        poster: `${BASE_IMAGE_URL}${show.poster_path}`,
                    };
                }),
        };

        response.json(out);
    } catch (_error) {
        response.status(502).json({ error: 'Network error' });
    }
};
