import { Router } from 'express';
import { createIssue, getIssues, getIssueById, updateIssueStatus } from '../../controllers/issues';
import { requireAuth, requireRoleAtLeast } from '../../middleware/requireAuth';
import {
    validateNumericId,
    validateIssueCreateBody,
    validateIssueUpdateBody,
} from '../../middleware/validation';

const issueRoutes = Router();

issueRoutes.post('/', validateIssueCreateBody, createIssue);
issueRoutes.get('/', requireAuth, getIssues);
issueRoutes.get('/:id', validateNumericId, getIssueById);
issueRoutes.put(
    '/:id',
    requireAuth,
    requireRoleAtLeast('Admin'),
    validateNumericId,
    validateIssueUpdateBody,
    updateIssueStatus
);

export { issueRoutes };
