import { Pool } from 'pg';
import { getAppDatabaseUrl } from './database-url';

let pool: Pool | null = null;

export function getPool() {
  if (!pool) {
    const poolMax = Number(process.env.DB_POOL_MAX ?? 10);

    pool = new Pool({
      connectionString: getAppDatabaseUrl(),
      max: poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PG error', err);
    });
  }

  return pool;
}
