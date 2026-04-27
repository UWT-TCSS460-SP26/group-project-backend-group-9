import { RequestHandler, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace -- Express type augmentation
    namespace Express {
        interface Request {
            parsedParams?: { id?: number };
            parsedQuery?: {
                page?: number;
                limit?: number;
                tmdbId?: number;
                mediaType?: 'MOVIE' | 'TV';
            };
        }
    }
}

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

const IdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const MovieSearchSchema = z.object({
    page: z.coerce.number().int().min(0).optional(),
    lang: z.string().trim().optional(),
    title: z.string().trim().optional(),
    description: z.string().trim().optional(),
    after: z.iso.date().trim().optional(),
    before: z.iso.date().trim().optional(),
    sort: z.literal(['title', 'popularity', 'date', 'rating']).optional(),
    order: z.literal(['asc', 'desc']).optional(),
});

const ShowSearchSchema = z.object({
    page: z.coerce.number().int().min(0).optional(),
    lang: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    after: z.iso.date().trim().optional(),
    before: z.iso.date().trim().optional(),
    sort: z.literal(['name', 'popularity', 'date', 'rating']).optional(),
    order: z.literal(['asc', 'desc']).optional(),
});

/**
 * Generic middleware factory. Parses `request[source]` against `schema`;
 * on failure responds 400 with issue details, on success replaces the
 * source with the parsed (and coerced) value so downstream handlers get
 * properly typed data.
 */
const validate =
    (source: 'body' | 'params' | 'query', schema: z.ZodType): RequestHandler =>
    (request, response, next) => {
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
        if (source !== 'query') request[source] = result.data;
        next();
    };

// --- Middleware ---

export const validateNumericId = validate('params', IdParamSchema);
export const validateMovieSearchParams = validate('query', MovieSearchSchema);
export const validateShowSearchParams = validate('query', ShowSearchSchema);

// --- Types inferred from schemas (no hand-written interfaces needed) ---

export type MovieSearch = z.infer<typeof MovieSearchSchema>;
export type ShowSearch = z.infer<typeof ShowSearchSchema>;

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

/**
 * Wraps up validation for movie search with possible 'page', 'text', 'after', 'before', 'sort',
 * and 'order' parameters
 */
export const validateMovieSearch = () => {
    return [
        requireEnvVar('MOVIE_READ_KEY'),
        validateInteger('page'),
        validateNumberRange('page', 0),
        validateDate('after'),
        validateDate('before'),
        validateEnum('sort', ['title', 'popularity', 'date', 'rating']),
        validateEnum('order', ['asc', 'desc']),
    ];
};

/**
 * Wraps up validation for show search search with possible 'page', 'text', 'after', 'before', 'sort',
 * and 'order' parameters
 */
export const validateShowSearch = () => {
    return [
        requireEnvVar('MOVIE_READ_KEY'),
        validateInteger('page'),
        validateNumberRange('page', 0),
        validateDate('after'),
        validateDate('before'),
        validateEnum('sort', ['name', 'popularity', 'date', 'rating']),
        validateEnum('order', ['asc', 'desc']),
    ];
};

// ─────────────────────────────────────────────────────────────────────────────
// Reviews validation
// ─────────────────────────────────────────────────────────────────────────────

const INTEGER_PATTERN = /^-?\d+$/;

const REVIEW_MEDIA_TYPES = ['MOVIE', 'TV'] as const;
type ReviewMediaType = (typeof REVIEW_MEDIA_TYPES)[number];

const isReviewMediaType = (value: unknown): value is ReviewMediaType =>
    typeof value === 'string' && (REVIEW_MEDIA_TYPES as readonly string[]).includes(value);

/**
 * Parses a path param as an integer and attaches it to request.parsedParams.
 * Responds 400 with the supplied message when the param is missing or not an integer.
 */
export const parseIntPathParam = (name: string, message: string) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const raw = request.params[name];
        if (typeof raw !== 'string' || !INTEGER_PATTERN.test(raw)) {
            response.status(400).json({ error: message });
            return;
        }
        request.parsedParams = { ...(request.parsedParams ?? {}), [name]: Number(raw) };
        next();
    };
};

/**
 * Parses an optional integer query param and attaches it to request.parsedQuery.
 * If the param is absent, passes through. If present, must be an integer >= min.
 * Clamps to clampMax when provided.
 */
export const parseIntQueryParam = (
    name: string,
    options: { min?: number; clampMax?: number },
    message: string
) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const raw = request.query[name];
        if (raw === undefined) {
            next();
            return;
        }
        if (typeof raw !== 'string' || !INTEGER_PATTERN.test(raw)) {
            response.status(400).json({ error: message });
            return;
        }
        let value = Number(raw);
        if (options.min !== undefined && value < options.min) {
            response.status(400).json({ error: message });
            return;
        }
        if (options.clampMax !== undefined) {
            value = Math.min(value, options.clampMax);
        }
        request.parsedQuery = { ...(request.parsedQuery ?? {}), [name]: value };
        next();
    };
};

/** Validates :id path param for review routes. */
export const validateReviewIdParam = parseIntPathParam('id', 'id must be an integer');

/** Validates POST /reviews body: tmdbId, mediaType, title, body, score. */
export const validateCreateReviewBody = (
    request: Request,
    response: Response,
    next: NextFunction
): void => {
    const { tmdbId, mediaType, title, body, score } = request.body ?? {};

    if (typeof tmdbId !== 'number' || !Number.isInteger(tmdbId)) {
        response.status(400).json({ error: 'tmdbId must be an integer' });
        return;
    }
    if (!isReviewMediaType(mediaType)) {
        response.status(400).json({ error: 'mediaType must be MOVIE or TV' });
        return;
    }
    if (typeof title !== 'string' || title.trim().length === 0) {
        response.status(400).json({ error: 'title is required' });
        return;
    }
    if (typeof body !== 'string' || body.trim().length === 0) {
        response.status(400).json({ error: 'body is required' });
        return;
    }
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 10) {
        response.status(400).json({ error: 'score must be an integer between 1 and 10' });
        return;
    }
    next();
};

/** Validates PUT /reviews/:id body: title, body, score. */
export const validateUpdateReviewBody = (
    request: Request,
    response: Response,
    next: NextFunction
): void => {
    const { title, body, score } = request.body ?? {};

    if (typeof title !== 'string' || title.trim().length === 0) {
        response.status(400).json({ error: 'title is required' });
        return;
    }
    if (typeof body !== 'string' || body.trim().length === 0) {
        response.status(400).json({ error: 'body is required' });
        return;
    }
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 10) {
        response.status(400).json({ error: 'score must be an integer between 1 and 10' });
        return;
    }
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Users validation
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_ROLES = ['USER', 'ADMIN'] as const;
type UserRole = (typeof USER_ROLES)[number];

const isUserRole = (value: unknown): value is UserRole =>
    typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);

/** Validates :id path param for user routes. */
export const validateUserIdParam = parseIntPathParam('id', 'id must be an integer');

/**
 * Validates PUT /users/:id body. Only `email` and `role` are validated;
 * other fields (including password) are ignored by the controller. An empty
 * body is allowed (no fields to update is a valid no-op).
 *
 * Note: middleware does NOT enforce the "only admins may change role" rule;
 * that's the controller's responsibility (defense in depth).
 */
export const validateUpdateUserBody = (
    request: Request,
    response: Response,
    next: NextFunction
): void => {
    const { email, role } = request.body ?? {};

    if (email !== undefined) {
        if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
            response.status(400).json({ error: 'email must be a valid email address' });
            return;
        }
    }

    if (role !== undefined && !isUserRole(role)) {
        response.status(400).json({ error: 'role must be USER or ADMIN' });
        return;
    }

    next();
};

/** Validates GET /reviews query string: page, limit, tmdbId, mediaType. */
export const validateListReviewsQuery = [
    parseIntQueryParam('page', { min: 1 }, 'page must be a positive integer'),
    parseIntQueryParam('limit', { min: 1, clampMax: 100 }, 'limit must be a positive integer'),
    parseIntQueryParam('tmdbId', {}, 'tmdbId must be an integer'),
    (request: Request, response: Response, next: NextFunction): void => {
        const raw = request.query.mediaType;
        if (raw === undefined) {
            next();
            return;
        }
        if (!isReviewMediaType(raw)) {
            response.status(400).json({ error: 'mediaType must be MOVIE or TV' });
            return;
        }
        request.parsedQuery = { ...(request.parsedQuery ?? {}), mediaType: raw };
        next();
    },
];
