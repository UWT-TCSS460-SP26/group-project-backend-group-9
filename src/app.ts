import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import YAML from 'yaml';
import { apiReference } from '@scalar/express-api-reference';
import { logger } from './middleware/logger';
import { routes } from './routes';

const app = express();

// Application-level middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// OpenAPI documentation
const specFile = fs.readFileSync('./openapi.yaml', 'utf8');
const spec = YAML.parse(specFile);
app.get('/openapi.json', (_request: Request, response: Response) => {
    response.json(spec);
});
app.use('/api-docs', apiReference({ spec: { url: '/openapi.json' } }));

// Routes
app.get('/hello', (_request: Request, response: Response) => {
    response.json({ message: 'Hello, TCSS 460!' });
});

app.use(routes);
app.get('/hello/riley', (_request: Request, response: Response) => {
    response.json({ message: 'Hello from Riley!' });
});

app.get('/hello/saeed', (_request: Request, response: Response) => {
  response.json({ message: 'Hello, Saeed!' });
});

// 404 handler — must be after all routes
app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: 'Route not found' });
});

export { app };
