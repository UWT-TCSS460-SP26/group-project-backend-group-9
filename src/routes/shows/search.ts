import { Router } from 'express';
import { getShows } from '../../controllers/shows';
import { validateShowSearch } from '../../middleware/validation';

const searchRoutes = Router();

searchRoutes.get('/', validateShowSearch(), getShows);

export { searchRoutes };
