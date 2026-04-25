import { Pool } from 'pg';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '../generated/prisma/client';
const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
export const prisma = new PrismaClient({ adapter });