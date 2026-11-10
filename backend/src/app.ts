import 'reflect-metadata';
import {ValidationPipe} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type {Request, Response, NextFunction} from 'express';
import type {NestExpressApplication} from '@nestjs/platform-express';
import {Config} from './config/config';
import {
  ApiExceptionFilter,
  BadRequest,
  ErrorInfo,
  ErrorResponse,
  validationFailure,
} from './common/errors';

import {GithubClient} from './modules/github/github_client';

import {documentSchemas} from './modules/cvs/cv_resource.dto';
import {AppModule} from './app.module';

export async function createApp(
  config: Config,
  external?: Pick<GithubClient, 'identity' | 'repositories'>,
) {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config, external),
    {logger: ['error', 'warn']},
  );
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    // The generated client encodes literal AIP colons. Express matches raw paths.
    // Normalize the path only; OAuth query values must retain their original encoding.
    const query = request.url.indexOf('?');
    const path = query < 0 ? request.url : request.url.slice(0, query);
    request.url = path.replace(/%3a/gi, ':') + (query < 0 ? '' : request.url.slice(query));
    response.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    });
    next();
  });
  app.useBodyParser('json', {limit: '4mb'});
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationFailure,
    }),
  );
  app.enableCors({origin: config.origins, credentials: true});
  app.enableShutdownHooks();
  return app;
}

export function openapi(app: Awaited<ReturnType<typeof createApp>>) {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CVory Nest API')
      .setVersion('0.2.0')
      .addCookieAuth('cvory_session')
      .build(),
    {extraModels: [ErrorResponse, ErrorInfo, BadRequest]},
  );
  document.components = {
    ...document.components,
    schemas: {...document.components?.schemas, ...documentSchemas()},
  };
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'patch', 'delete', 'put'] as const) {
      const operation = path[method];
      if (!operation) continue;
      for (const code of [400, 401, 403, 404, 409, 413, 429, 500, 503]) {
        operation.responses[String(code)] = {
          description: 'Google HTTP/JSON error with a stable ErrorInfo reason.',
          content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorResponse'}}},
        };
      }
    }
  }
  return document;
}
