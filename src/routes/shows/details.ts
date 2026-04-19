import { Router } from 'express';
import { getShowDetails } from '../../controllers/shows';
import { requirePathParam, validateInteger } from '../../middleware/validation';

const detailsRoutes = Router();

detailsRoutes.get('/:id', requirePathParam('id'), validateInteger('id'), getShowDetails);

export { detailsRoutes };
