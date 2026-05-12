import { Router } from 'express';
import { getCommunityFeed } from '../../controllers/community';
import { requireEnvVar, validateCommunityListParams } from '../../middleware/validation';

const communityRoutes = Router();

communityRoutes.get(
    '/',
    requireEnvVar('MOVIE_READ_KEY'),
    validateCommunityListParams,
    getCommunityFeed
);

export { communityRoutes };
