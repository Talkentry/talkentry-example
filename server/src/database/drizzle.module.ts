import { Global, Module } from '@nestjs/common';
import { DemoDatabaseService } from './demo-database.service';
import { drizzleProvider, DRIZZLE } from './drizzle.provider';

@Global()
@Module({
  providers: [drizzleProvider, DemoDatabaseService],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
