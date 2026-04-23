import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * POST /auth/dev-login
 *
 * TEMPORARY — Sprint 2 only. Accepts a username, find-or-creates a user row
 * with role='user', and returns a signed JWT. This endpoint does NOT validate
 * a password. It is a local-development stand-in for the real Auth-Squared
 * integration coming in Sprint 3.
 *
 * DO NOT deploy this router to a public URL.
 *
 * Request body:
 *   {
 *     "username": "alice",
 *     "email": "alice@example.test"   // optional; defaults to <username>@dev.local
 *   }
 *
 * Response:
 *   { "token": "<jwt>" }
 *
 * The JWT payload contains:
 *   { sub: <user.id>, email: <user.email>, role: <user.role>, iat, exp }
 *
 * Expected Prisma User model (you own the rest of your schema):
 *
 *   model User {
 *     id       Int    @id @default(autoincrement())
 *     username String @unique
 *     email    String @unique
 *     role     String @default("user")
 *     // ... other fields your team designs
 *   }
 *
 * Admin accounts must be seeded separately — this endpoint only creates
 * regular users. To log in as an admin, create the user via your seed
 * script and then POST the same username here.
 */
router.post('/dev-login', async (request: Request, response: Response): Promise<void> => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    response.status(500).json({ error: 'JWT_SECRET is not configured' });
    return;
  }

  const { username, email } = request.body as { username?: string; email?: string };
  if (!username || typeof username !== 'string') {
    response.status(400).json({ error: 'username is required' });
    return;
  }

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      email: email ?? `${username}@dev.local`,
      role: 'user',
    },
  });

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: '24h' },
  );

  response.json({ token });
});

export default router;
