import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { getPool } from './pool';

export const DRIZZLE = Symbol('DRIZZLE');

export const drizzleProvider = {
  provide: DRIZZLE,
  useFactory: () => {
    const pool = getPool();

    return drizzle(pool, {
      schema,
      logger: false,
    });
  },
};
