import { Router } from 'express';
import { getMovies } from '../../controllers/movies';
import { validateMovieSearch } from '../../middleware/validation';

const searchRoutes = Router();

searchRoutes.get('/', validateMovieSearch(), getMovies);

export { searchRoutes };
