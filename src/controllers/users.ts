import { Request, Response } from 'express';
import { prisma } from '../prisma';

// Reused everywhere a user is returned. Excludes `password` so we never leak
// the credential hash. Search this file for the literal `password` to verify.
const userSafeSelect = {
    id: true,
    email: true,
    role: true,
    createdAt: true,
} as const;

export const getMe = async (request: Request, response: Response) => {
    const user = request.user!;
    const found = await prisma.user.findUnique({
        where: { id: user.sub },
        select: userSafeSelect,
    });
    if (!found) {
        response.status(404).json({ error: 'User not found' });
        return;
    }
    response.json(found);
};

export const getUserById = async (request: Request, response: Response) => {
    const id = request.parsedParams!.id!;
    const found = await prisma.user.findUnique({
        where: { id },
        select: userSafeSelect,
    });
    if (!found) {
        response.status(404).json({ error: 'User not found' });
        return;
    }
    response.json(found);
};

export const updateUser = async (request: Request, response: Response) => {
    const user = request.user!;
    const id = request.parsedParams!.id!;

    if (id !== user.sub && user.role !== 'ADMIN') {
        response.status(403).json({ error: 'Forbidden' });
        return;
    }

    // Build the update object explicitly. Never spread req.body into prisma.update.
    // password and unknown fields are silently ignored.
    // TODO Sprint 3: password change will be handled by Auth-Squared.
    const updateData: { email?: string; role?: 'USER' | 'ADMIN' } = {};
    if (request.body.email !== undefined) {
        updateData.email = request.body.email;
    }
    if (request.body.role !== undefined && user.role === 'ADMIN') {
        updateData.role = request.body.role;
    }

    try {
        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
            select: userSafeSelect,
        });
        response.json(updated);
    } catch (error: unknown) {
        const code = (error as { code?: string })?.code;
        if (code === 'P2025') {
            response.status(404).json({ error: 'User not found' });
            return;
        }
        if (code === 'P2002') {
            response.status(409).json({ error: 'Email already in use' });
            return;
        }
        response.status(500).json({ error: 'Failed to update user' });
    }
};

export const deleteUser = async (request: Request, response: Response) => {
    const user = request.user!;
    const id = request.parsedParams!.id!;

    if (id !== user.sub && user.role !== 'ADMIN') {
        response.status(403).json({ error: 'Forbidden' });
        return;
    }

    try {
        await prisma.user.delete({ where: { id } });
        response.status(204).end();
    } catch (error: unknown) {
        if ((error as { code?: string })?.code === 'P2025') {
            response.status(404).json({ error: 'User not found' });
            return;
        }
        response.status(500).json({ error: 'Failed to delete user' });
    }
};
