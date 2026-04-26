import { Router } from 'express';
import {
    createReview,
    deleteReview,
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
