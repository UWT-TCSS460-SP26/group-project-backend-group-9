import { Request, Response, NextFunction } from 'express';

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

/**
 * Validates that a required parameter is present in the path or query
 */
export const requireParam = (name: string) => {
    return (request: Request, response: Response, next: NextFunction) => {
        if (!request.query[name] && !request.params[name]) {
            response.status(400).json({ error: `${name} parameter is required` });
            return;
        }
        next();
    };
};

/**
 * Validates that a required parameter is present in the query
 */
export const requireQueryParam = (name: string) => {
    return (request: Request, response: Response, next: NextFunction) => {
        if (!request.query[name]) {
            response.status(400).json({ error: `${name} query parameter is required` });
            return;
        }
        next();
    };
};

/**
 * Validates that a required parameter is present in the path
 */
export const requirePathParam = (name: string) => {
    return (request: Request, response: Response, next: NextFunction) => {
        if (!request.params[name]) {
            response.status(400).json({ error: `${name} path parameter is required` });
            return;
        }
        next();
    };
};

/**
 * Validates that an enum type parameter has an allowed value
 */
export const validateEnum = (name: string, options: string[]) => {
    return (request: Request, response: Response, next: NextFunction) => {
        const value: string = (request.params[name] || request.query[name]) as string;
        if (value && !options.includes(value)) {
            response.status(400).json({ error: `${value} is not one of ${options}` });
            return;
        }
        next();
    };
};

/**
 * Validates that a number parameter is a number. Allows unset parameters.
 */
export const validateInteger = (name: string) => {
    return (request: Request, response: Response, next: NextFunction) => {
        const value: number = Number(request.params[name] || request.query[name]);
        if ((request.params[name] || request.query[name]) && !Number.isInteger(value)) {
            response.status(400).json({ error: `${value} is not an integer` });
            return;
        }
        next();
    };
};

/**
 * Validates that a number parameter is within the specified range
 */
export const validateNumberRange = (name: string, min?: number, max?: number) => {
    return (request: Request, response: Response, next: NextFunction) => {
        const value: number = Number(request.params[name] || request.query[name]);
        if (value && ((min && value < min) || (max && value > max))) {
            response.status(400).json({ error: `${value} is not within the allowed range` });
            return;
        }
        next();
    };
};

/**
 * Validates that a date parameter matches the required format
 */
export const validateDate = (name: string) => {
    return (request: Request, response: Response, next: NextFunction) => {
        const value: string = (request.params[name] || request.query[name]) as string;
        const seg: string[] | undefined = value?.split('-');

        if (
            value &&
            !(
                seg[0].length === 4 &&
                seg[1].length === 2 &&
                Number.isInteger(Number(seg[1])) &&
                Number(seg[1]) > 0 &&
                Number(seg[1]) < 13 &&
                seg[2].length === 2 &&
                Number.isInteger(Number(seg[2])) &&
                Number(seg[2]) > 0 &&
                Number(seg[2]) < 32
            )
        ) {
            response.status(400).json({ error: `${value} is not a YYYY-MM-DD formatted date` });
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
