import { Router } from 'express';
import { statusRoutes } from './status';

const routes = Router();

routes.use('/status', statusRoutes);

export { routes };
