import { Request, Response } from 'express';

export const getStatus = (_request: Request, response: Response) => {
    response.json({ status: 'Alive' });
};
