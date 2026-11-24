import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  readonly statusCode: number;
  readonly message: string | string[];
  readonly timestamp: string;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const message =
      typeof rawResponse === 'object' && rawResponse !== null && 'message' in rawResponse
        ? (rawResponse as { readonly message: string | string[] }).message
        : typeof rawResponse === 'string'
          ? rawResponse
          : 'Internal server error';

    const body: ErrorBody = {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
