import { Router } from 'express';
import { searchRoutes } from './search';
import { detailsRoutes } from './details';

const showsRoutes = Router();

showsRoutes.use('/search', searchRoutes);
showsRoutes.use('/', detailsRoutes);

export { showsRoutes };
