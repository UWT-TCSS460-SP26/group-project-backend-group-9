import { Router } from 'express';
import { getStatus } from '../controllers/status';

const statusRoutes = Router();

statusRoutes.get('/', getStatus);

export { statusRoutes };