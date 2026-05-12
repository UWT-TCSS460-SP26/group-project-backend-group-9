import { Router } from 'express';
import { getMovies } from '../../controllers/movies';
import { requireEnvVar, validateMovieSearchParams } from '../../middleware/validation';

const searchRoutes = Router();

searchRoutes.get('/', requireEnvVar('MOVIE_READ_KEY'), validateMovieSearchParams, getMovies);

export { searchRoutes };
