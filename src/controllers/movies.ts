import { Request, Response } from 'express';

const BASE_URL = 'https://api.themoviedb.org/3';
const apiKey = process.env.MOVIE_READ_KEY;

export const getMovies = async (request: Request, response: Response) => {
    const { text, after, before } = request.query;
    const page = request.query.page || 0;
    const lang = request.query.lang || 'en';
    const sort = request.query.sort || 'popularity';
    const order = request.query.order || 'desc';

    const sortKey: object = {
        title: 'original_title',
        popularity: 'popularity',
        date: 'primary_release_date',
        rating: 'vote_average',
    };

    try {
        const result = await fetch(
            `${BASE_URL}/discover/movie?page=${encodeURIComponent(Number(page) + 1)}&sort_by=${encodeURIComponent(sortKey[sort] + '.' + order)}${after ? '&release_date.gte=' + encodeURIComponent(after) : ''}${before ? '&release_date.lte=' + encodeURIComponent(before) : ''}${lang ? '&language=' + encodeURIComponent(lang) : ''}`,
            {
                // TMDB Requires the key in a custom header
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );
        const data = (await result.json()) as Record<string, unknown>;

        let movies = data.results;

        const filterText = (arr) => {
            if (text) {
                const keywords: string[] = text.split(',');
                arr = arr.filter(
                    (mov) =>
                        keywords.some(
                            (word) => mov.title.toUpperCase().indexOf(word.toUpperCase()) > -1
                        ) ||
                        keywords.some(
                            (word) => mov.overview.toUpperCase().indexOf(word.toUpperCase()) > -1
                        )
                );
                return arr;
            }
        };

        movies = filterText(movies);

        let i = 0;
        while (data.page <= data.total_pages && movies.length < 20) {
            i++;
            const newResponse = await fetch(
                `${BASE_URL}/discover/movie?page=${encodeURIComponent(Number(page) + i + 1)}&sort_by=${encodeURIComponent(sortKey[sort] + '.' + order)}${after ? '&release_date.gte=' + encodeURIComponent(after) : ''}${before ? '&release_date.lte=' + encodeURIComponent(before) : ''}${lang ? '&language=' + encodeURIComponent(lang) : ''}`,
                {
                    // TMDB Requires the key in a custom header
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                }
            );

            const moreData = (await newResponse.json()) as Record<string, unknown>;

            let moreMovies = moreData.results;

            moreMovies = filterText(moreMovies);

            while (moreMovies.length > 0 && movies.length < 20) {
                movies.push(moreMovies.shift());
            }
        }

        const out: object = {
            code: 200,
            page: Number(page),
            totalPages: data.total_pages,
            totalResults: data.total_results,
            results: movies,
        };

        /*
        TODO: for the `text` param, TMDB doesn't provide this exact service natively so i'm
        going to have to do a regular search holding the keywords in the back, then when it's
        returned filter for the keywords and pass that along. which may mean making multiple
        API calls to TMDB. this could be messy
        OK. WORSE ISSUE AHHHHHHH
        so if i'm searching the title & desc for the provided keywords, i'm only gonna search
        the 1 page i get, and then subsequent pages if that one didn't have enough results.
        this means that there is no way for me to get the total page and result counts for the
        actual search query provided, only the ones given to me by the TMDB API, WHICH DOESN'T
        SUPPORT FULL-TEXT SEARCH OR EVEN TITLE SEARCH AT THE SAME ENDPOINT
        AHHHHHHHHHHHH
        */

        if (!result.ok) {
            response.status(result.status).json({ error: data.message || 'API error' });
            return;
        }

        response.json(out);
    } catch (_error) {
        response.status(502).json({ error: 'Network error' });
    }
};
