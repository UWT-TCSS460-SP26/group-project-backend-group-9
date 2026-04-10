import { Router } from 'express';
import { helloRoutes } from './hello';

const routes = Router();

routes.use('/hello', helloRoutes);

export { routes };
