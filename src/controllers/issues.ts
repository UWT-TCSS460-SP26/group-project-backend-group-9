/*
 * Class:        TCSS 460 Spring 2026
 * Group:        Group 9
 * Assignment:   Sprint 3, Card #43
 */

/**
 * Controller for the public Issue submission endpoint.
 * Reporter email is stored but never returned in responses. Admin-gated
 * triage routes in Sprint 4 will surface it for authorized users.
 */

import { Request, Response } from 'express';
import { prisma } from '../prisma';

export const createIssue = async (request: Request, response: Response) => {
    const { title, description, reporterEmail, severity } = request.body;

    try {
        const issue = await prisma.issue.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                reporterEmail: reporterEmail ?? null,
                severity: severity ?? 'Minor',
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
