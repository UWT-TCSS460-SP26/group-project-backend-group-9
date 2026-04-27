// Tests for src/prisma.ts — verifies the singleton wires up the connection pool,
// adapter, and PrismaClient correctly without hitting a real database.

// Mocks must be declared before any imports so Jest hoists them above the module load.
jest.mock('pg', () => ({
    Pool: jest.fn(() => ({ _tag: 'MockPool' })),
}));

jest.mock('@prisma/adapter-pg', () => ({
    PrismaPg: jest.fn(() => ({ _tag: 'MockAdapter' })),
}));

jest.mock('../src/generated/prisma/client', () => ({
    PrismaClient: jest.fn(() => ({ _tag: 'MockClient' })),
}));

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

describe('Prisma singleton (src/prisma.ts)', () => {
    let prismaModule: typeof import('../src/prisma');

    beforeAll(async () => {
        process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
        // Import after mocks are in place so the module executes against fakes
        prismaModule = await import('../src/prisma');
    });

    it('creates a Pool using DATABASE_URL from the environment', () => {
        expect(Pool).toHaveBeenCalledWith({
            connectionString: 'postgresql://test:test@localhost:5432/testdb',
        });
    });

    it('wraps the pool in a PrismaPg adapter', () => {
        // PrismaPg must receive the Pool instance, not the raw config,
        // so the driver adapter owns the connection lifecycle.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poolInstance = (Pool as any).mock.results[0].value;
        expect(PrismaPg).toHaveBeenCalledWith(poolInstance);
    });

    it('passes the adapter into PrismaClient', () => {
        // PrismaClient must be constructed with the adapter option so all
        // queries go through the pg driver rather than the default engine.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adapterInstance = (PrismaPg as any).mock.results[0].value;
        expect(PrismaClient).toHaveBeenCalledWith({ adapter: adapterInstance });
    });

    it('exports the same prisma instance on repeated imports (singleton)', async () => {
        // Node caches modules after the first import, so every caller shares
        // one connection pool instead of opening a new one each time.
        const second = await import('../src/prisma');
        expect(prismaModule.prisma).toBe(second.prisma);
    });

    it('constructs each dependency exactly once', () => {
        // Guards against accidental double-initialisation which would leak connections.
        expect(Pool).toHaveBeenCalledTimes(1);
        expect(PrismaPg).toHaveBeenCalledTimes(1);
        expect(PrismaClient).toHaveBeenCalledTimes(1);
    });
});
