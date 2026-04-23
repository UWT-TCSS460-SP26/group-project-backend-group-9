import { Router } from 'express';
import { getShowDetails } from '../../controllers/shows';
import { requireEnvVar, validateNumericId } from '../../middleware/validation';

const detailsRoutes = Router();

detailsRoutes.get('/:id', requireEnvVar('MOVIE_READ_KEY'), validateNumericId, getShowDetails);

export { detailsRoutes };
