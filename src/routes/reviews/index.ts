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
    validateReviewListParams,
    validateReviewCreateBody,
    validateReviewUpdateBody,
    validateNumericId,
} from '../../middleware/validation';

const reviewRoutes = Router();

reviewRoutes.get('/', validateReviewListParams, listReviews);
// /me MUST come before /:id, otherwise Express routes "me" into the id handler.
reviewRoutes.get('/me', requireAuth, getMyReviews);
reviewRoutes.get('/:id', validateNumericId, getReviewById);
reviewRoutes.post('/', requireAuth, validateReviewCreateBody, createReview);
reviewRoutes.put('/:id', requireAuth, validateNumericId, validateReviewUpdateBody, updateReview);
reviewRoutes.delete('/:id', requireAuth, validateNumericId, deleteReview);

export { reviewRoutes };
