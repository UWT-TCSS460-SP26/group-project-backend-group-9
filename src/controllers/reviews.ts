import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { resolveLocalUser } from '../auth/resolveLocalUser';
import { hasRoleAtLeast } from '../middleware/requireAuth';
import { ReviewList, ReviewCreate, ReviewUpdate } from '../middleware/validation';

export const createReview = async (request: Request, response: Response) => {
    const { tmdbId, mediaType, title, body, score } = request.validated!.body as ReviewCreate;

    try {
        const localUser = await resolveLocalUser(request);

        const created = await prisma.review.create({
            data: { tmdbId, mediaType, title, body, score, userId: localUser.id },
        });
        response.status(201).json(created);
    } catch (error: unknown) {
        if ((error as { code?: string })?.code === 'P2002') {
            response.status(409).json({ error: 'You have already reviewed this title' });
            return;
        }
        response.status(500).json({ error: 'Failed to create review' });
    }
};

export const getReviewById = async (request: Request, response: Response) => {
    const { id } = request.validated!.params! as { id: number };

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    response.json(review);
};

export const listReviews = async (request: Request, response: Response) => {
    const { page, limit, tmdbId, mediaType } = request.validated!.query as ReviewList;

    const where: { tmdbId?: number; mediaType?: 'MOVIE' | 'TV' } = {};
    if (tmdbId !== undefined) where.tmdbId = tmdbId;
    if (mediaType !== undefined) where.mediaType = mediaType;

    const [results, total] = await Promise.all([
        prisma.review.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.review.count({ where }),
    ]);

    response.json({ page, limit, total, results });
};

export const updateReview = async (request: Request, response: Response) => {
    const { id } = request.validated!.params! as { id: number };
    const { title, body, score } = request.validated!.body as ReviewUpdate;

    const existingReview = await prisma.review.findUnique({ where: { id } });
    if (!existingReview) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    const existingUser = await resolveLocalUser(request);
    // Only the author may edit — admins do not get an override on edits, only on deletes.
    if (existingUser.id !== existingReview.userId) {
        response.status(403).json({ error: 'Only the author may edit this review' });
        return;
    }

    const updated = await prisma.review.update({
        where: { id },
        data: { title, body, score },
    });
    response.json(updated);
};

export const deleteReview = async (request: Request, response: Response) => {
    const user = request.user!;
    const { id } = request.validated!.params! as { id: number };

    const existingReview = await prisma.review.findUnique({ where: { id } });
    if (!existingReview) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    // can't be null because userId is a required field of a review. Any existing review will have an associated userId
    const existingUser = await resolveLocalUser(request);
    if (existingUser.id !== existingReview.userId && !hasRoleAtLeast(user.role, 'Admin')) {
        response.status(403).json({ error: 'Forbidden' });
        return;
    }

    await prisma.review.delete({ where: { id } });
    response.status(204).end();
};
