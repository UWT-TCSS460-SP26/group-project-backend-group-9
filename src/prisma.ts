// One shared instance prevents connection pool exhaustion from multiple PrismaClient instantiations.
import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
