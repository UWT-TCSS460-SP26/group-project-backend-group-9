import { Router } from 'express';
import {
    createReview,
    deleteReview,
    getMyReviews,
    getReviewById,
    listReviews,
    updateReview,
} from '../../controllers/reviews';
import { requireAuth } from '../../middleware/requireAuth';
import {
    validateCreateReviewBody,
    validateListReviewsQuery,
    validateReviewIdParam,
    validateUpdateReviewBody,
} from '../../middleware/validation';

const reviewRoutes = Router();

reviewRoutes.get('/', validateListReviewsQuery, listReviews);
// /me MUST come before /:id, otherwise Express routes "me" into the id handler.
reviewRoutes.get('/me', requireAuth, getMyReviews);
reviewRoutes.get('/:id', validateReviewIdParam, getReviewById);
reviewRoutes.post('/', requireAuth, validateCreateReviewBody, createReview);
reviewRoutes.put(
    '/:id',
    requireAuth,
    validateReviewIdParam,
    validateUpdateReviewBody,
    updateReview
);
reviewRoutes.delete('/:id', requireAuth, validateReviewIdParam, deleteReview);

export { reviewRoutes };
