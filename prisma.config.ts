import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: path.join('prisma', 'schema.prisma'),
    migrate: {
        // Dynamic imports keep pg out of the CLI bundle; same connection as the app runtime.
        async adapter() {
            const { Pool } = await import('pg');
            const { PrismaPg } = await import('@prisma/adapter-pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            return new PrismaPg(pool);
        },
    },
});