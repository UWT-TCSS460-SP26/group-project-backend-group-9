import { Request, Response } from 'express';
import { prisma } from '../prisma';

const MEDIA_TYPES = ['MOVIE', 'TV'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const isMediaType = (value: unknown): value is MediaType =>
    typeof value === 'string' && (MEDIA_TYPES as readonly string[]).includes(value);

const isValidScore = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10;

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const parseIntegerParam = (raw: string | string[] | undefined): number | null => {
    if (typeof raw !== 'string' || !/^-?\d+$/.test(raw)) return null;
    return Number(raw);
};

export const createReview = async (request: Request, response: Response) => {
    const user = request.user!;
    const { tmdbId, mediaType, title, body, score } = request.body ?? {};

    if (typeof tmdbId !== 'number' || !Number.isInteger(tmdbId)) {
        response.status(400).json({ error: 'tmdbId must be an integer' });
        return;
    }
    if (!isMediaType(mediaType)) {
        response.status(400).json({ error: 'mediaType must be MOVIE or TV' });
        return;
    }
    if (!isNonEmptyString(title)) {
        response.status(400).json({ error: 'title is required' });
        return;
    }
    if (!isNonEmptyString(body)) {
        response.status(400).json({ error: 'body is required' });
        return;
    }
    if (!isValidScore(score)) {
        response.status(400).json({ error: 'score must be an integer between 1 and 10' });
        return;
    }

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
    const id = parseIntegerParam(request.params.id);
    if (id === null) {
        response.status(400).json({ error: 'id must be an integer' });
        return;
    }

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
        response.status(404).json({ error: 'Review not found' });
        return;
    }
    response.json(review);
};

export const listReviews = async (request: Request, response: Response) => {
    const pageRaw = request.query.page as string | undefined;
    const limitRaw = request.query.limit as string | undefined;
    const tmdbIdRaw = request.query.tmdbId as string | undefined;
    const mediaTypeRaw = request.query.mediaType as string | undefined;

    let page = 1;
    if (pageRaw !== undefined) {
        const parsed = parseIntegerParam(pageRaw);
        if (parsed === null || parsed < 1) {
            response.status(400).json({ error: 'page must be a positive integer' });
            return;
        }
        page = parsed;
    }

    let limit = 20;
    if (limitRaw !== undefined) {
        const parsed = parseIntegerParam(limitRaw);
        if (parsed === null || parsed < 1) {
            response.status(400).json({ error: 'limit must be a positive integer' });
            return;
        }
        limit = Math.min(parsed, 100);
    }

    const where: { tmdbId?: number; mediaType?: MediaType } = {};
    if (tmdbIdRaw !== undefined) {
        const parsed = parseIntegerParam(tmdbIdRaw);
        if (parsed === null) {
            response.status(400).json({ error: 'tmdbId must be an integer' });
            return;
        }
        where.tmdbId = parsed;
    }
    if (mediaTypeRaw !== undefined) {
        if (!isMediaType(mediaTypeRaw)) {
            response.status(400).json({ error: 'mediaType must be MOVIE or TV' });
            return;
        }
        where.mediaType = mediaTypeRaw;
    }

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
    const id = parseIntegerParam(request.params.id);
    if (id === null) {
        response.status(400).json({ error: 'id must be an integer' });
        return;
    }

    const { title, body, score } = request.body ?? {};
    if (!isNonEmptyString(title)) {
        response.status(400).json({ error: 'title is required' });
        return;
    }
    if (!isNonEmptyString(body)) {
        response.status(400).json({ error: 'body is required' });
        return;
    }
    if (!isValidScore(score)) {
        response.status(400).json({ error: 'score must be an integer between 1 and 10' });
        return;
    }

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
    const id = parseIntegerParam(request.params.id);
    if (id === null) {
        response.status(400).json({ error: 'id must be an integer' });
        return;
    }

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
