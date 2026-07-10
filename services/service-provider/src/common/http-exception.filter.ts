import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { formatErrorResponse, ApiError } from '@connectsphere/contracts';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let formatted: any;

    if (exception instanceof ApiError) {
      formatted = formatErrorResponse(exception);
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();
      const message = typeof exceptionResponse === 'object' ? exceptionResponse.message || exception.message : exceptionResponse;
      
      formatted = {
        success: false,
        error: {
          message: Array.isArray(message) ? message.join(', ') : String(message),
          errorCode: 'HTTP_ERROR',
          statusCode: status,
          details: exceptionResponse,
        },
      };
    } else {
      formatted = formatErrorResponse(exception);
    }

    console.error(`[NestJS Error Handler]`, exception);

    response.status(formatted.error.statusCode).json(formatted);
  }
}
