import { Router } from 'express';
import { searchRoutes } from './search';
import { detailsRoutes } from './details';

const movieRoutes = Router();

movieRoutes.use('/search', searchRoutes);
movieRoutes.use('/', detailsRoutes);

export { movieRoutes };
