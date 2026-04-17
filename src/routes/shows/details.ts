import { Router } from 'express';
import { getShowsById } from '../../controllers/shows';

const showDetailsRoutes = Router();

showDetailsRoutes.get('/:id', getShowsById);

export { showDetailsRoutes };
