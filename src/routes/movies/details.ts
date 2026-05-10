import { Router } from 'express';
import { getMovieDetails } from '../../controllers/movies';
import { requireEnvVar, validateNumericId } from '../../middleware/validation';

const detailsRoutes = Router();

detailsRoutes.get('/:id', requireEnvVar('MOVIE_READ_KEY'), validateNumericId, getMovieDetails);

export { detailsRoutes };
