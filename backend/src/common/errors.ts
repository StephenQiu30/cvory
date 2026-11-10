import {ArgumentsHost, Catch, ExceptionFilter, HttpException} from '@nestjs/common';
import {ApiProperty} from '@nestjs/swagger';
import type {Response} from 'express';
import type {ValidationError} from 'class-validator';

export class FieldViolation {
  @ApiProperty() field!: string;
  @ApiProperty() description!: string;
}
export class BadRequest {
  @ApiProperty() '@type'!: string;
  @ApiProperty({type: [FieldViolation]}) fieldViolations!: FieldViolation[];
}

export class ErrorInfo {
  @ApiProperty() '@type'!: string;
  @ApiProperty() domain!: string;
  @ApiProperty() reason!: string;
}
export class ErrorBody {
  @ApiProperty() code!: number;
  @ApiProperty() status!: string;
  @ApiProperty() message!: string;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [{$ref: '#/components/schemas/ErrorInfo'}, {$ref: '#/components/schemas/BadRequest'}],
    },
  })
  details!: Array<ErrorInfo | BadRequest>;
}
export class ErrorResponse {
  @ApiProperty({type: ErrorBody}) error!: ErrorBody;
}

export class ApiError extends Error {
  constructor(
    readonly code: number,
    readonly status: string,
    readonly reason: string,
    message = 'Request could not be completed.',
    readonly violations: FieldViolation[] = [],
  ) {
    super(message);
  }
}
export const invalid = (message = 'Invalid request.'): ApiError =>
  new ApiError(400, 'INVALID_ARGUMENT', 'INVALID_REQUEST', message);
export const unauthenticated = (): ApiError =>
  new ApiError(401, 'UNAUTHENTICATED', 'SESSION_REQUIRED');
export const notFound = (): ApiError => new ApiError(404, 'NOT_FOUND', 'RESOURCE_NOT_FOUND');
export const conflict = (): ApiError => new ApiError(409, 'ABORTED', 'ETAG_MISMATCH');

export function validationFailure(errors: ValidationError[]): ApiError {
  const violations: FieldViolation[] = [];
  const visit = (items: ValidationError[], prefix = '', depth = 0): void => {
    if (depth > 10) return;
    for (const item of items) {
      if (violations.length >= 50) return;
      const field = `${prefix}${item.property}`.slice(0, 200);
      if (item.constraints) violations.push({field, description: 'Invalid field value.'});
      if (item.children?.length) visit(item.children, `${field}.`, depth + 1);
    }
  };
  visit(errors);
  return new ApiError(400, 'INVALID_ARGUMENT', 'INVALID_REQUEST', 'Invalid request.', violations);
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code =
      error instanceof ApiError
        ? error.code
        : error instanceof HttpException
          ? error.getStatus()
          : 500;
    const status =
      error instanceof ApiError
        ? error.status
        : {
            400: 'INVALID_ARGUMENT',
            404: 'NOT_FOUND',
            408: 'DEADLINE_EXCEEDED',
            413: 'RESOURCE_EXHAUSTED',
            429: 'RESOURCE_EXHAUSTED',
            502: 'UNAVAILABLE',
            503: 'UNAVAILABLE',
            504: 'DEADLINE_EXCEEDED',
          }[code] || 'INTERNAL';
    response
      .status(code)
      .set('Cache-Control', 'no-store')
      .json({
        error: {
          code,
          status,
          message: error instanceof ApiError ? error.message : 'Request could not be completed.',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              domain: 'cvory',
              reason: error instanceof ApiError ? error.reason : 'REQUEST_FAILED',
            },
            ...(error instanceof ApiError && error.violations.length
              ? [
                  {
                    '@type': 'type.googleapis.com/google.rpc.BadRequest',
                    fieldViolations: error.violations,
                  },
                ]
              : []),
          ],
        },
      });
  }
}
