import { Router } from 'express';
import { statusRoutes } from './status';
import { movieRoutes } from './movies';

const routes = Router();

routes.use('/status', statusRoutes);
routes.use('/movies', movieRoutes);
routes.use('/test', async (request: Request, response: Response) => {
    const BASE_URL = 'https://api.themoviedb.org/3';
    const apiKey = process.env.MOVIE_READ_KEY;
    try {
        const result = await fetch(
            `${BASE_URL}/movie/961323`, {
                // TMDB Requires the key in a custom header 
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                }
            }
        );
        const data = (await result.json()) as Record<string, unknown>;
        
        if (!result.ok) {
            response.status(result.status).json({ error: data.message || 'TMDB API error' });
            return;
        }
        
        response.json(data);
    } catch (_error) {
        response.status(502).json({ error: 'Failed to reach TMDB' });
    }
});

export { routes };
