import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { resolveLocalUser } from '../auth/resolveLocalUser';
import { hasRoleAtLeast } from '../middleware/requireAuth';
import { UserUpdate } from '../middleware/validation';

export const getMe = async (request: Request, response: Response) => {
    try {
        const found = await resolveLocalUser(request);
        // This shouldn't happen, but just in case
        if (!found) {
            response.status(404).json({ error: 'User not found' });
            return;
        }

        response.json(found);
    } catch (_error) {
        response.status(500).json({ error: 'Internal server error' });
    }
};

export const getUserById = async (request: Request, response: Response) => {
    const { id } = request.validated!.params! as { id: number };
    try {
        const found = await prisma.user.findUnique({
            where: { id },
        });
        if (!found) {
            response.status(404).json({ error: 'User not found' });
            return;
        }
        response.json(found);
    } catch (_error) {
        response.status(500).json({ error: 'Internal server error' });
    }
};

export const updateUser = async (request: Request, response: Response) => {
    const user = request.user!;
    const { id } = request.validated!.params! as { id: number };
    const { email, role } = request.validated!.body as UserUpdate;

    try {
        const existing = await resolveLocalUser(request);

        if (existing.id !== id && !hasRoleAtLeast(user.role, 'Admin')) {
            response.status(403).json({ error: 'Forbidden' });
            return;
        }

        const updateData: { email?: string; role?: 'User' | 'Admin' } = {};
        if (email) {
            updateData.email = email;
        }
        if (role && hasRoleAtLeast(user.role, 'Admin')) {
            updateData.role = role;
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
        });
        response.json(updated);
    } catch (error: unknown) {
        const code = (error as { code?: string })?.code;
        if (code === 'P2025') {
            response.status(404).json({ error: 'User not found' });
            return;
        } else if (code === 'P2002') {
            response.status(409).json({ error: 'Email already in use' });
            return;
        } else {
            response.status(500).json({ error: 'Failed to update user' });
        }
    }
};

export const deleteUser = async (request: Request, response: Response) => {
    const user = request.user!;
    const { id } = request.validated!.params! as { id: number };

    try {
        const existing = await resolveLocalUser(request);

        if (existing.id !== id && !hasRoleAtLeast(user.role, 'Admin')) {
            response.status(403).json({ error: 'Forbidden' });
            return;
        }

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
