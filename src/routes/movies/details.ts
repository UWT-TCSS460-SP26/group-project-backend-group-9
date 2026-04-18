import { Router } from 'express';
import { getMovieDetails } from '../../controllers/movies';

const detailsRoutes = Router();

detailsRoutes.get('/:id', getMovieDetails);

export { detailsRoutes };
