import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
import { getMigrationDatabaseUrl } from './src/database/database-url';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/**/*.schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: getMigrationDatabaseUrl(),
  },
  verbose: true,
  strict: true,
  schemaFilter: [process.env.DB_SCHEMA ?? 'talkentra'],
});
