import { Router } from 'express';
import { getMovieDetails } from '../../controllers/movies';
import { requirePathParam, validateInteger } from '../../middleware/validation';

const detailsRoutes = Router();

detailsRoutes.get('/:id', requirePathParam('id'), validateInteger('id'), getMovieDetails);

export { detailsRoutes };
