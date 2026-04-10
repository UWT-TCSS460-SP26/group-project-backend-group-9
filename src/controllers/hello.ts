import { Request, Response } from 'express';

export const getHello = (_request: Request, response: Response) => {
    response.json({ message: 'Hello from Raiden' });
};