import { Router } from 'express';
import { statusRoutes } from './status';
import { movieRoutes } from './movies';

const routes = Router();

routes.use('/status', statusRoutes);
routes.use('/movies', movieRoutes);

export { routes };
