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
                minReviews?: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Users validation
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_ROLES = ['User', 'Admin'] as const;
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
        response.status(400).json({ error: 'role must be User or Admin' });
        return;
    }

    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// Issues validation
// ─────────────────────────────────────────────────────────────────────────────

const ISSUE_SEVERITIES = ['Minor', 'Major', 'Critical'] as const;
const ISSUE_STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'] as const;

/**
 * Validates that a required body field is present and is a non-empty string after trim.
 * Optionally enforces a maximum length.
 */
export const requireBodyString = (name: string, maxLength?: number) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const value = request.body?.[name];
        if (typeof value !== 'string' || value.trim().length === 0) {
            response
                .status(400)
                .json({ error: `${name} is required and must be a non-empty string` });
            return;
        }
        if (maxLength && value.length > maxLength) {
            response
                .status(400)
                .json({ error: `${name} must be ${maxLength} characters or fewer` });
            return;
        }
        next();
    };
};

/**
 * Validates that an optional body field, if present, is a string matching basic email format.
 */
export const validateOptionalBodyEmail = (name: string) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const value = request.body?.[name];
        if (value === undefined || value === null) {
            next();
            return;
        }
        if (typeof value !== 'string' || !EMAIL_PATTERN.test(value)) {
            response.status(400).json({ error: `${name} is not a valid email address` });
            return;
        }
        next();
    };
};

/**
 * Validates that an optional body field, if present, matches one of the allowed enum values.
 */
export const validateOptionalBodyEnum = (name: string, options: readonly string[]) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const value = request.body?.[name];
        if (value === undefined || value === null) {
            next();
            return;
        }
        if (!options.includes(value)) {
            response.status(400).json({ error: `${name} must be one of ${options.join(', ')}` });
            return;
        }
        next();
    };
};

/**
 * Rejects the request if any disallowed field appears in the body.
 * Used to prevent clients from setting fields like status on creation.
 */
export const rejectBodyFields = (disallowed: string[]) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const present = disallowed.filter((field) => request.body?.[field] !== undefined);
        if (present.length > 0) {
            response.status(400).json({ error: `Field(s) not allowed: ${present.join(', ')}` });
            return;
        }
        next();
    };
};

/**
 * Wraps up validation for POST /issues body.
 * Title and description required, optional reporterEmail and severity validated if present,
 * status and other internal fields rejected if sent.
 */
export const validateCreateIssue = () => {
    return [
        requireBodyString('title', 255),
        requireBodyString('description', 5000),
        validateOptionalBodyEmail('reporterEmail'),
        validateOptionalBodyEnum('severity', ISSUE_SEVERITIES),
        rejectBodyFields(['status', 'id', 'createdAt', 'updatedAt']),
    ];
};

/**
 * Validates :id path param is an integer. Used by GET /issues/:id and PUT /issues/:id.
 */
export const validateIdParam = () => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const raw = request.params.id;
        if (typeof raw !== 'string' || !INTEGER_PATTERN.test(raw)) {
            response.status(400).json({ error: 'id must be an integer' });
            return;
        }
        next();
    };
};

/**
 * Validates PUT /issues/:id body: only `status` is allowed and must be a valid IssueStatus.
 */
export const validateUpdateIssueStatus = () => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const body = request.body ?? {};
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== 'status') {
            response.status(400).json({ error: 'Only the status field is allowed' });
            return;
        }
        if (!ISSUE_STATUSES.includes(body.status)) {
            response
                .status(400)
                .json({ error: `status must be one of ${ISSUE_STATUSES.join(', ')}` });
            return;
        }
        next();
    };
};

const COMMUNITY_SORT_VALUES = ['rating', 'reviews'] as const;

/** Validates GET /community query string: page, limit, minReviews, sort. */
export const validateCommunityFeedQuery = [
    parseIntQueryParam('page', { min: 1 }, 'page must be a positive integer'),
    parseIntQueryParam(
        'limit',
        { min: 1, clampMax: 50 },
        'limit must be a positive integer between 1 and 50'
    ),
    parseIntQueryParam('minReviews', { min: 1 }, 'minReviews must be a positive integer'),
    (request: Request, response: Response, next: NextFunction): void => {
        const raw = request.query.sort;
        if (raw === undefined) {
            next();
            return;
        }
        if (!COMMUNITY_SORT_VALUES.includes(raw as (typeof COMMUNITY_SORT_VALUES)[number])) {
            response.status(400).json({ error: 'sort must be rating or reviews' });
            return;
        }
        next();
    },
];

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
