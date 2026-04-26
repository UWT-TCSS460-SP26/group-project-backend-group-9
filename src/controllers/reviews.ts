import { Request, Response } from 'express';
import { prisma } from '../prisma';

export const createReview = async (request: Request, response: Response) => {
    const user = request.user!;
    const { tmdbId, mediaType, title, body, score } = request.body;

    try {
        const created = await prisma.review.create({
            data: { tmdbId, mediaType, title, body, score, userId: user.sub },
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
    const user = request.user!;
    const id = request.parsedParams!.id!;
    const { title, body, score } = request.body;

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    // Only the author may edit — admins do not get an override on edits, only on deletes.
    if (existing.userId !== user.sub) {
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
    const id = request.parsedParams!.id!;

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    if (existing.userId !== user.sub && user.role !== 'ADMIN') {
        response.status(403).json({ error: 'Forbidden' });
        return;
    }

    await prisma.review.delete({ where: { id } });
    response.status(204).end();
};
