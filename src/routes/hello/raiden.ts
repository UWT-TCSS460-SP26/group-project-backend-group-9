import { Router } from 'express';
import { getHello } from '../../controllers/hello';

const helloRouter = Router();

helloRouter.get('/', getHello);

export { helloRouter };