import { Router } from 'express';
import {
    createReview,
    deleteReview,
    getReviewById,
    listReviews,
    updateReview,
} from '../../controllers/reviews';
import { requireAuth } from '../../middleware/requireAuth';

const reviewRoutes = Router();

reviewRoutes.get('/', listReviews);
reviewRoutes.get('/:id', getReviewById);
reviewRoutes.post('/', requireAuth, createReview);
reviewRoutes.put('/:id', requireAuth, updateReview);
reviewRoutes.delete('/:id', requireAuth, deleteReview);

export { reviewRoutes };
