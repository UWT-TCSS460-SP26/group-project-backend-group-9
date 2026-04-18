import { Router } from 'express';
import { detailsRoutes } from './details';
import { searchRoutes } from './search';

const movieRoutes = Router();

movieRoutes.use('/', detailsRoutes);
movieRoutes.use('/search', searchRoutes);

export { movieRoutes };
