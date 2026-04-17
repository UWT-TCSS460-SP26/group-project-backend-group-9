import { Router } from 'express';
import { statusRoutes } from './status';
import { movieRoutes } from './movies';
import { showsRoutes } from './shows';

const routes = Router();

routes.use('/status', statusRoutes);
routes.use('/movies', movieRoutes);
routes.use('/shows', showsRoutes);

export { routes };
