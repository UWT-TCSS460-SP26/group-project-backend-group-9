import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { resolveLocalUser } from '../auth/resolveLocalUser';
import { hasRoleAtLeast } from '../middleware/requireAuth';

export const createReview = async (request: Request, response: Response) => {
    const { tmdbId, mediaType, title, body, score } = request.body;

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
    const id = request.parsedParams!.id!;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    response.json(review);
};

export const listReviews = async (request: Request, response: Response) => {
    const parsed = request.parsedQuery ?? {};
    const page = parsed.page ?? 1;
    const limit = parsed.limit ?? 20;

    const where: { tmdbId?: number; mediaType?: 'MOVIE' | 'TV' } = {};
    if (parsed.tmdbId !== undefined) where.tmdbId = parsed.tmdbId;
    if (parsed.mediaType !== undefined) where.mediaType = parsed.mediaType;

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
    const id = request.parsedParams!.id!;
    const { title, body, score } = request.body;

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

// Author shape mirrors what Card #55 (origin/authorResponse) will land for all
// review responses. Inlining it here so this route stays consistent regardless
// of merge order; collapse to the shared formatter when #55 merges.
export const getMyReviews = async (request: Request, response: Response) => {
    try {
        const localUser = await resolveLocalUser(request);

        const reviews = await prisma.review.findMany({
            where: { userId: localUser.id },
            orderBy: { createdAt: 'desc' },
            include: { user: true },
        });

        const formatted = reviews.map((row) => {
            const { user, ...rest } = row as typeof row & {
                user: { id: number; username: string | null; email: string };
            };
            return {
                ...rest,
                author: {
                    id: user.id,
                    username: user.username ?? user.email,
                },
            };
        });

        response.status(200).json(formatted);
    } catch {
        response.status(500).json({ error: 'Failed to fetch reviews' });
    }
};

export const deleteReview = async (request: Request, response: Response) => {
    const user = request.user!;
    const id = request.parsedParams!.id!;

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
