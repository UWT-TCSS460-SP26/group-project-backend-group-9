import { Router } from 'express';
import { getShows } from '../../controllers/shows';
import { requireEnvVar, validateShowSearchParams } from '../../middleware/validation';

const searchRoutes = Router();

searchRoutes.get('/', requireEnvVar('MOVIE_READ_KEY'), validateShowSearchParams, getShows);

export { searchRoutes };
