import { Request, Response } from 'express';

// TMDB base URLs for API requests and poster images
const BASE_URL = 'https://api.themoviedb.org/3';
const BASE_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';

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
