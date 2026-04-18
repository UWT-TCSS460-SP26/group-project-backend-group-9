import { Request, Response, NextFunction } from 'express';

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
