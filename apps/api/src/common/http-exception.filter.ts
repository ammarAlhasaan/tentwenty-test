import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string[];
  path: string;
  timestamp: string;
}

function toMessages(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const path = httpAdapter.getRequestUrl(ctx.getRequest()) ?? '';

    let body: ErrorBody;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'object' && response !== null && 'message' in response
          ? (response as { message: unknown }).message
          : response;

      body = {
        statusCode: status,
        error: toReason(status),
        message: toMessages(detail),
        path,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Nothing is read off `exception` here on purpose: that omission is what
      // guarantees no stack, file path, SQL or internal message reaches the
      // client. The full error goes to the log instead.
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: ['Internal server error'],
        path,
        timestamp: new Date().toISOString(),
      };

      this.logger.error(
        `Unhandled exception on ${path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    httpAdapter.reply(ctx.getResponse(), body, body.statusCode);
  }
}

function toReason(status: number): string {
  const name = HttpStatus[status];
  if (typeof name !== 'string') return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
