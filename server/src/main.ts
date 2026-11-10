import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'node:path';
import { AppModule } from './app.module';

function parseCorsOrigins(raw?: string): true | string[] {
  if (!raw) {
    return true;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
    ) {
      return parsed;
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });

  // Local demo media only — not a CDN. Relative attachment urls resolve under /uploads.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Talkentra Server')
    .setDescription('Reference Chat API for Talkentra SDK development')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3087);
  // Listen on all interfaces so Expo Go on a physical phone can reach the API.
  await app.listen(port, '0.0.0.0');

  console.log(`Talkentra server listening on http://0.0.0.0:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`Uploads: POST /uploads + GET /uploads/:file`);
  console.log(
    `Socket.IO chat events on the same origin (chat:join / chat:event)`,
  );
}

void bootstrap();
