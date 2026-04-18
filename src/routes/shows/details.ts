import { Router } from 'express';
import { getShowsById } from '../../controllers/shows';
import { requirePathParam, validateInteger } from '../../middleware/validation';

const showDetailsRoutes = Router();

showDetailsRoutes.get('/:id', requirePathParam('id'), validateInteger('id'), getShowsById);

export { showDetailsRoutes };
