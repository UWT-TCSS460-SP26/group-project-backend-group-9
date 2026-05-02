import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { validateUserIdParam, validateUpdateUserBody } from '../../middleware/validation';
import { getMe, getUserById, updateUser, deleteUser } from '../../controllers/users';

const userRoutes = Router();

// User registration is owned by POST /auth/dev-login this sprint.
// In Sprint 3, Auth-Squared will replace dev-login with a real
// registration flow. POST /users is intentionally not implemented here.

// GET /users (list all) is intentionally not implemented this sprint.
// Per team discussion (Raiden, 4/26), there is no frontend flow that
// requires listing all users. Reviews are queryable by userId via the
// reviews endpoints. If admin tooling appears in a future sprint,
// add a list endpoint then.

// /me MUST come before /:id — otherwise Express matches "me" as the :id
// value and validateUserIdParam returns 400.
userRoutes.get('/me', requireAuth, getMe);
userRoutes.get('/:id', requireAuth, validateUserIdParam, getUserById);
userRoutes.put('/:id', requireAuth, validateUserIdParam, validateUpdateUserBody, updateUser);
userRoutes.delete('/:id', requireAuth, validateUserIdParam, deleteUser);

export { userRoutes };
