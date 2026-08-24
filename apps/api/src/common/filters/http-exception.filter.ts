import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '@alkabeer/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected server error occurred. Please try again later.';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorCode = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        message = obj.message || exception.message;
        errorCode = obj.error || exception.name;
        details = obj.details || (Array.isArray(obj.message) ? obj.message : undefined);
        if (Array.isArray(obj.message)) {
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof Error) {
      if (exception.message.startsWith('[MoneyRuleViolation]')) {
        status = HttpStatus.BAD_REQUEST;
        errorCode = 'MONEY_RULE_VIOLATION';
        message = exception.message;
      } else {
        this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      }
    }

    // Log the error cleanly without exposing internal details to client
    if (status >= 500) {
      this.logger.error(`[${request.method}] ${request.url} - ${status} - ${message}`);
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - ${status} - ${message}`);
    }

    const errorPayload = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(errorPayload);
  }
}
