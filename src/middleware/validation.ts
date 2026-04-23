import { RequestHandler, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// --- Schemas ---

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
