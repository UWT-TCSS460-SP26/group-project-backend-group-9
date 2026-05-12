import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { resolveLocalUser } from '../auth/resolveLocalUser';
import { hasRoleAtLeast } from '../middleware/requireAuth';
import { ReviewList, ReviewCreate, ReviewUpdate } from '../middleware/validation';
import type { ReviewModel, UserModel } from '../generated/prisma/models';

// Shapes a Prisma review+user row into the public API response format.
// We always expose `author` instead of the raw `user` join so consumers
// get a stable, minimal identity object and never see email or role.
// `username` is required by the DB schema, so the email fallback is a safety net only.
function formatReview(review: ReviewModel & { user: UserModel }) {
    const { user, ...rest } = review;
    return {
        ...rest,
        author: {
            id: user.id,
            username: user.username ?? user.email,
        },
    };
}

// Passed to every Prisma query that returns a review so the user join is always included.
const reviewInclude = { user: true } as const;

export const createReview = async (request: Request, response: Response) => {
    const { tmdbId, mediaType, title, body, score } = request.validated!.body as ReviewCreate;

    try {
        const localUser = await resolveLocalUser(request);

        const created = await prisma.review.create({
            data: { tmdbId, mediaType, title, body, score, userId: localUser.id },
            include: reviewInclude,
        });
        response.status(201).json(formatReview(created));
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

    try {
        const review = await prisma.review.findUnique({ where: { id }, include: reviewInclude });
        if (!review) {
            response.status(404).json({ error: 'Review not found' });
            return;
        }
        response.json(formatReview(review));
    } catch (_error) {
        response.status(500).json({ error: 'Internal server error' });
    }
};

export const listReviews = async (request: Request, response: Response) => {
    const { page, limit, tmdbId, mediaType } = request.validated!.query as ReviewList;

    const where: { tmdbId?: number; mediaType?: 'MOVIE' | 'TV' } = {};
    if (tmdbId !== undefined) where.tmdbId = tmdbId;
    if (mediaType !== undefined) where.mediaType = mediaType;

    try {
        const [results, total] = await Promise.all([
            prisma.review.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: reviewInclude,
            }),
            prisma.review.count({ where }),
        ]);

        response.json({ page, limit, total, results: results.map(formatReview) });
    } catch (_error: unknown) {
        response.status(500).json({ error: 'Internal server error' });
    }
};

export const updateReview = async (request: Request, response: Response) => {
    const { id } = request.validated!.params! as { id: number };
    const { title, body, score } = request.validated!.body as ReviewUpdate;

    try {
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
            include: reviewInclude,
        });
        response.json(formatReview(updated));
    } catch (_error) {
        response.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteReview = async (request: Request, response: Response) => {
    const { id } = request.validated!.params! as { id: number };

    try {
        const existingReview = await prisma.review.findUnique({ where: { id } });
        if (!existingReview) {
            response.status(404).json({ error: 'Review not found' });
            return;
        }
        // can't be null because userId is a required field of a review. Any existing review will have an associated userId
        const existingUser = await resolveLocalUser(request);
        if (
            existingUser.id !== existingReview.userId &&
            !hasRoleAtLeast(existingUser.role, 'Admin')
        ) {
            response.status(403).json({ error: 'Forbidden' });
            return;
        }

        await prisma.review.delete({ where: { id } });
        response.status(204).end();
    } catch (_error) {
        response.status(500).json({ error: 'Internal server error' });
    }
};
