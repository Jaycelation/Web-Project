import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { SECURE_ENVELOPE_HEADER, SECURE_ENVELOPE_HEADER_VALUE } from '@secure-commerce/crypto-envelope';
import { CryptoEnvelopeService } from './crypto-envelope.service.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly cryptoEnvelope: CryptoEnvelopeService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const mapped = mapException(exception);
    const requestId = request.secureContext?.requestId ?? request.header('x-request-id') ?? randomUUID();
    const payload = {
      statusCode: mapped.status,
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (mapped.status >= 500) {
      this.logger.error(`${request.method} ${request.originalUrl}: ${mapped.message}`, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(mapped.status);
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-request-id', requestId);

    if (request.secureContext) {
      try {
        const encrypted = await this.cryptoEnvelope.encryptOutgoing(request.secureContext, payload, mapped.status);
        response.setHeader(SECURE_ENVELOPE_HEADER, SECURE_ENVELOPE_HEADER_VALUE);
        response.json(encrypted);
        return;
      } catch (encryptionError) {
        this.logger.error('Không thể mã hóa error response.', encryptionError instanceof Error ? encryptionError.stack : undefined);
      }
    }

    response.json(payload);
  }
}

function mapException(exception: unknown): {
  status: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    if (typeof body === 'string') return { status, code: `HTTP_${status}`, message: body };
    const record = body as Record<string, unknown>;
    const rawMessage = record.message;
    return {
      status,
      code: typeof record.code === 'string' ? record.code : `HTTP_${status}`,
      message: Array.isArray(rawMessage)
        ? rawMessage.map(String).join('; ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message,
      ...(record.details === undefined ? {} : { details: record.details }),
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      return { status: HttpStatus.CONFLICT, code: 'UNIQUE_CONSTRAINT', message: 'Dữ liệu đã tồn tại.' };
    }
    if (exception.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Không tìm thấy bản ghi.' };
    }
    if (exception.code === 'P2034') {
      return { status: HttpStatus.CONFLICT, code: 'TRANSACTION_CONFLICT', message: 'Xung đột giao dịch; vui lòng thử lại.' };
    }
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Hệ thống gặp lỗi ngoài dự kiến.',
  };
}
