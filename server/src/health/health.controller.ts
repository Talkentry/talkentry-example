import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { DRIZZLE } from '../database/drizzle.provider';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get()
  async check() {
    const health = {
      status: 'ok' as 'ok' | 'degraded' | 'critical',
      service: 'talkentry-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        postgres: false,
      },
    };

    try {
      await this.db.execute(sql`SELECT 1`);
      health.services.postgres = true;
    } catch (error) {
      health.status = 'critical';
      this.logger.warn(
        `PostgreSQL health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return health;
  }
}
