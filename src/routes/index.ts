import { Router } from 'express';
import { statusRoutes } from './status';
import { movieRoutes } from './movies';
import { showsRoutes } from './shows';
import { reviewRoutes } from './reviews';
import { userRoutes } from './users';
import { issueRoutes } from './issues';
import { communityRoutes } from './community';

const routes = Router();

routes.use('/status', statusRoutes);
routes.use('/movies', movieRoutes);
routes.use('/shows', showsRoutes);
routes.use('/reviews', reviewRoutes);
routes.use('/users', userRoutes);
routes.use('/issues', issueRoutes);
routes.use('/community', communityRoutes);

export { routes };

//: )
