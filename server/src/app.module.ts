import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
import { DrizzleModule } from './database/drizzle.module';
import { HealthModule } from './health/health.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    DrizzleModule,
    HealthModule,
    ChatModule,
    UploadsModule,
  ],
})
export class AppModule {}
