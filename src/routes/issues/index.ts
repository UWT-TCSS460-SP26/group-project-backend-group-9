/*
 * Class:        TCSS 460 Spring 2026
 * Group:        Group 9
 * Assignment:   Sprint 3, Card #43
 */

/**
 * Public Issue submission router.
 * POST /issues, no authentication required, creates a bug report.
 * Admin-gated read and triage routes will be added in Sprint 4.
 */

import { Router } from 'express';
import {
    createIssue,
    getIssues,
    getIssueById,
    updateIssue,
    deleteIssue,
} from '../../controllers/issues';
import { requireAuth, requireRoleAtLeast } from '../../middleware/requireAuth';
import {
    validateCreateIssue,
    validateIdParam,
    validateUpdateIssue,
} from '../../middleware/validation';

const issueRoutes = Router();

issueRoutes.post('/', validateCreateIssue(), createIssue);
issueRoutes.get('/', requireAuth, requireRoleAtLeast('Admin'), getIssues);
issueRoutes.get('/:id', requireAuth, requireRoleAtLeast('Admin'), validateIdParam(), getIssueById);
issueRoutes.patch(
    '/:id',
    requireAuth,
    requireRoleAtLeast('Admin'),
    validateIdParam(),
    validateUpdateIssue(),
    updateIssue
);
issueRoutes.delete(
    '/:id',
    requireAuth,
    requireRoleAtLeast('Admin'),
    validateIdParam(),
    deleteIssue
);

export { issueRoutes };
