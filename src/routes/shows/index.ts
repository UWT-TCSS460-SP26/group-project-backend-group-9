import { Router } from 'express';
import { showDetailsRoutes } from './details';

const showsRoutes = Router();

showsRoutes.use('/', showDetailsRoutes);

export { showsRoutes };
