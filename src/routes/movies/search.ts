import { Router } from 'express';
import { getMovies } from '../../controllers/movies';

const searchRoutes = Router();

searchRoutes.get('/search', getMovies);

export { searchRoutes };