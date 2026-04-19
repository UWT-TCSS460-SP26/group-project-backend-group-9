import { Router } from 'express';
import { detailsRoutes } from './details';
import { searchRoutes } from './search';

const movieRoutes = Router();

movieRoutes.use('/search', searchRoutes);
movieRoutes.use('/', detailsRoutes);

export { movieRoutes };
