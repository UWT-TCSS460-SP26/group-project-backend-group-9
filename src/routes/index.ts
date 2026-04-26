import { Router } from 'express';
import { statusRoutes } from './status';
import { movieRoutes } from './movies';
import { showsRoutes } from './shows';
import { reviewRoutes } from './reviews';
import { userRoutes } from './users';
import devAuthRoutes from './devAuth';

const routes = Router();

routes.use('/status', statusRoutes);
routes.use('/movies', movieRoutes);
routes.use('/shows', showsRoutes);
routes.use('/reviews', reviewRoutes);
routes.use('/users', userRoutes);
routes.use('/auth', devAuthRoutes);

export { routes };

//: )
