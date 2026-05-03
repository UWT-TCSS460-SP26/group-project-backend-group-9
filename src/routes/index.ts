import { Router } from 'express';
import { statusRoutes } from './status';
import { movieRoutes } from './movies';
import { showsRoutes } from './shows';
import { reviewRoutes } from './reviews';
import { userRoutes } from './users';

const routes = Router();

routes.use('/status', statusRoutes);
routes.use('/movies', movieRoutes);
routes.use('/shows', showsRoutes);
routes.use('/reviews', reviewRoutes);
routes.use('/users', userRoutes);

export { routes };

//: )
