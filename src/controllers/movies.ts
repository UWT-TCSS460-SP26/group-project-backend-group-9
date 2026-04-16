import { Request, Response } from 'express';

const BASE_URL = 'https://api.themoviedb.org/3';
const apiKey = process.env.MOVIE_READ_KEY;

export const getMovies = (request: Request, response: Response) => {
    response.json({ status: 'Alive' });
    // TODO: for the `text` param, TMDB doesn't provide this exact service natively so i'm
    // going to have to do a regular search holding the keywords in the back, then when it's
    // returned filter for the keywords and pass that along. which may mean making multiple
    // API calls to TMDB. this could be messy
};