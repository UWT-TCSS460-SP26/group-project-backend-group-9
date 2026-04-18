import { Router } from 'express';
import { searchRoutes } from './search';
import { detailsRoutes } from './details';

const showsRoutes = Router();

showsRoutes.use('/', detailsRoutes);
showsRoutes.use('/search', searchRoutes);

export { showsRoutes };
