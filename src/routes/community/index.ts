import { Router } from 'express';
import { getCommunityFeed } from '../../controllers/community';
import { requireEnvVar, validateCommunityFeedQuery } from '../../middleware/validation';

const communityRoutes = Router();

communityRoutes.get(
    '/',
    requireEnvVar('MOVIE_READ_KEY'),
    validateCommunityFeedQuery,
    getCommunityFeed
);

export { communityRoutes };
