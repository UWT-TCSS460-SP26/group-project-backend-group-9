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
    validateReviewListParams,
    validateReviewCreateBody,
    validateReviewUpdateBody,
    validateNumericId,
} from '../../middleware/validation';

const reviewRoutes = Router();

reviewRoutes.get('/', validateReviewListParams, listReviews);
reviewRoutes.get('/:id', validateNumericId, getReviewById);
reviewRoutes.post('/', requireAuth, validateReviewCreateBody, createReview);
reviewRoutes.put('/:id', requireAuth, validateNumericId, validateReviewUpdateBody, updateReview);
reviewRoutes.delete('/:id', requireAuth, validateNumericId, deleteReview);

export { reviewRoutes };
