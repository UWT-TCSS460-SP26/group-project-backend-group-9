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
    validateNumericId,
    validateIssueCreateBody,
    validateIssueUpdateBody,
} from '../../middleware/validation';

const issueRoutes = Router();

issueRoutes.post('/', validateIssueCreateBody, createIssue);
issueRoutes.get('/', requireAuth, requireRoleAtLeast('Admin'), getIssues);
issueRoutes.get('/:id', requireAuth, requireRoleAtLeast('Admin'), validateNumericId, getIssueById);
issueRoutes.patch(
    '/:id',
    requireAuth,
    requireRoleAtLeast('Admin'),
    validateNumericId,
    validateIssueUpdateBody,
    updateIssue
);
issueRoutes.delete(
    '/:id',
    requireAuth,
    requireRoleAtLeast('Admin'),
    validateNumericId,
    deleteIssue
);

export { issueRoutes };
