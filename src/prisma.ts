// One shared instance prevents connection pool exhaustion from multiple PrismaClient instantiations.
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
