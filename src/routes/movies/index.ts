import { Router } from 'express';
import { searchRoutes } from './search';

const movieRoutes = Router();

movieRoutes.use('/search', searchRoutes);

export { movieRoutes };
