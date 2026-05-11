import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { IssueCreate, IssueUpdate } from '../middleware/validation';

// Fields safe to return on Issue endpoints. reporterEmail is intentionally omitted
// so it can never be leaked to public list/get responses.
const PUBLIC_ISSUE_SELECT = {
    id: true,
    title: true,
    description: true,
    severity: true,
    status: true,
    createdAt: true,
    updatedAt: true,
} as const;

// Admin-only select. Includes reporterEmail so admins can follow up on bug reports.
const ADMIN_ISSUE_SELECT = {
    ...PUBLIC_ISSUE_SELECT,
    reporterEmail: true,
} as const;

export const createIssue = async (request: Request, response: Response) => {
    const { title, description, reporterEmail, severity } = request.validated!.body as IssueCreate;

    try {
        const issue = await prisma.issue.create({
            data: {
                title: title,
                description: description,
                reporterEmail: reporterEmail ?? null,
                severity: severity,
            },
        });

        response.status(201).json({
            id: issue.id,
            message: 'Issue submitted successfully',
        });
    } catch {
        response.status(500).json({ error: 'Failed to create issue' });
    }
};

export const getIssues = async (_request: Request, response: Response) => {
    try {
        const issues = await prisma.issue.findMany({
            select: ADMIN_ISSUE_SELECT,
            orderBy: { createdAt: 'desc' },
        });
        response.status(200).json(issues);
    } catch {
        response.status(500).json({ error: 'Failed to fetch issues' });
    }
};

export const getIssueById = async (request: Request, response: Response) => {
    try {
        const { id } = request.validated!.params! as { id: number };
        const issue = await prisma.issue.findUnique({
            where: { id },
            select: ADMIN_ISSUE_SELECT,
        });
        if (!issue) {
            response.status(404).json({ error: 'Issue not found' });
            return;
        }
        response.status(200).json(issue);
    } catch {
        response.status(500).json({ error: 'Failed to fetch issue' });
    }
};

export const updateIssue = async (request: Request, response: Response) => {
    try {
        const { id } = request.validated!.params! as { id: number };
        const data = request.validated!.body as IssueUpdate;

        const existing = await prisma.issue.findUnique({ where: { id } });
        if (!existing) {
            response.status(404).json({ error: 'Issue not found' });
            return;
        }

        const updated = await prisma.issue.update({
            where: { id },
            data,
            select: ADMIN_ISSUE_SELECT,
        });
        response.status(200).json(updated);
    } catch {
        response.status(500).json({ error: 'Failed to update issue' });
    }
};

export const deleteIssue = async (request: Request, response: Response) => {
    try {
        const { id } = request.validated!.params! as { id: number };

        const existing = await prisma.issue.findUnique({ where: { id } });
        if (!existing) {
            response.status(404).json({ error: 'Issue not found' });
            return;
        }

        await prisma.issue.delete({ where: { id } });
        response.status(204).send();
    } catch {
        response.status(500).json({ error: 'Failed to delete issue' });
    }
};
