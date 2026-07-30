import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { formatValidationErrors } from './common/validators/format-validation-errors';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: formatValidationErrors,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const uploadDir = configService.get<string>('UPLOAD_DIR') ?? './uploads';
  app.useStaticAssets(resolve(uploadDir), { prefix: '/uploads' });

  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

bootstrap();
