import { RequestHandler, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

declare global {
    // Adding field for validated data for the controllers to access
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            validated?: {
                body?: unknown;
                query?: unknown;
                params?: unknown;
            };
        }
    }
}

// --- Schemas ---

const IdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const MovieSearchSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    lang: z.string().trim().min(1).max(8).default('en'),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    after: z.iso.date().trim().optional(),
    before: z.iso.date().trim().optional(),
    sort: z.literal(['title', 'popularity', 'date', 'rating']).default('popularity'),
    order: z.literal(['asc', 'desc']).default('desc'),
});

const ShowSearchSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    lang: z.string().trim().min(1).default('en'),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    after: z.iso.date().trim().optional(),
    before: z.iso.date().trim().optional(),
    sort: z.literal(['name', 'popularity', 'date', 'rating']).default('popularity'),
    order: z.literal(['asc', 'desc']).default('desc'),
});

const ReviewListSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    tmdbId: z.coerce.number().int().positive().optional(),
    mediaType: z.literal(['MOVIE', 'TV']).default('MOVIE'),
});

const ReviewCreateSchema = z.object({
    body: z.string().trim().min(1),
    mediaType: z.literal(['MOVIE', 'TV']),
    score: z.coerce.number().int().positive().max(10),
    title: z.string().trim().min(1),
    tmdbId: z.coerce.number().int().positive(),
});

const ReviewUpdateSchema = z.object({
    body: z.string().trim().min(1),
    score: z.coerce.number().int().positive().max(10),
    title: z.string().trim().min(1),
});

const UserUpdateSchema = z.object({
    email: z.string().trim().email().optional(),
    role: z.literal(['User', 'Admin']).optional(),
});

const IssueCreateSchema = z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1).max(5000),
    reporterEmail: z.string().trim().email().optional(),
    severity: z.literal(['Minor', 'Major', 'Critical']).default('Minor'),
});

const IssueUpdateSchema = z.object({
    status: z.literal(['Open', 'InProgress', 'Resolved', 'Closed']),
});

const CommunityListSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    minReviews: z.coerce.number().int().min(0).default(0),
    sort: z.literal(['rating', 'reviews']),
});

/**
 * Generic middleware factory. Parses `request[source]` against `schema`;
 * on failure responds 400 with issue details, on success sets
 * request.validated to the parsed & coerced value so downstream handlers
 * get properly typed data.
 */
const validate =
    (source: 'body' | 'params' | 'query', schema: z.ZodType): RequestHandler =>
    (request, response, next) => {
        const validated: Record<string, unknown> = { ...(request.validated ?? {}) };
        const result = schema.safeParse(request[source]);
        if (!result.success) {
            response.status(400).json({
                error: 'Validation failed',
                details: result.error.issues.map((i) => ({
                    path: i.path.join('.'),
                    message: i.message,
                })),
            });
            return;
        }
        validated[source] = result.data;
        request.validated = validated;
        next();
    };

// --- Middleware ---

export const validateNumericId = validate('params', IdParamSchema);
export const validateMovieSearchParams = validate('query', MovieSearchSchema);
export const validateShowSearchParams = validate('query', ShowSearchSchema);
export const validateReviewListParams = validate('query', ReviewListSchema);
export const validateReviewCreateBody = validate('body', ReviewCreateSchema);
export const validateReviewUpdateBody = validate('body', ReviewUpdateSchema);
export const validateUserUpdateBody = validate('body', UserUpdateSchema);
export const validateIssueCreateBody = validate('body', IssueCreateSchema);
export const validateIssueUpdateBody = validate('body', IssueUpdateSchema);
export const validateCommunityListParams = validate('query', CommunityListSchema);

// --- Types inferred from schemas (no hand-written interfaces needed) ---

export type MovieSearch = z.infer<typeof MovieSearchSchema>;
export type ShowSearch = z.infer<typeof ShowSearchSchema>;
export type ReviewList = z.infer<typeof ReviewListSchema>;
export type ReviewCreate = z.infer<typeof ReviewCreateSchema>;
export type ReviewUpdate = z.infer<typeof ReviewUpdateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type IssueCreate = z.infer<typeof IssueCreateSchema>;
export type IssueUpdate = z.infer<typeof IssueUpdateSchema>;
export type CommunityList = z.infer<typeof CommunityListSchema>;

// Miscellaneous validation middleware

/**
 * Validates that a required environment variable is set.
 * Returns a middleware function that checks for the given key in process.env.
 */
export const requireEnvVar = (key: string) => {
    return (_request: Request, response: Response, next: NextFunction) => {
        if (!process.env[key]) {
            response.status(500).json({ error: `${key} is not configured` });
            return;
        }
        next();
    };
};
