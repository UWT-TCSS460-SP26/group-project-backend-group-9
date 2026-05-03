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
import { createIssue } from '../../controllers/issues';
import { validateCreateIssue } from '../../middleware/validation';

const issueRoutes = Router();

issueRoutes.post('/', validateCreateIssue(), createIssue);

export { issueRoutes };
