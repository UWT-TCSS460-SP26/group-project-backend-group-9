import { Router } from 'express';
import { helloRouter } from './raiden';

const helloRoutes = Router();

helloRoutes.use('/raiden', helloRouter);

export { helloRoutes };
