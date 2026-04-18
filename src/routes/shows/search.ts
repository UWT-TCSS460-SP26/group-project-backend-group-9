import { Router } from 'express';
import { getMovies } from '../../controllers/movies';
import { validateShowSearch } from '../../middleware/validation';

const searchRoutes = Router();

searchRoutes.get('/', validateShowSearch(), getMovies);

export { searchRoutes };