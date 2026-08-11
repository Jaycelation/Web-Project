import { BadRequestException, Injectable, type NestMiddleware } from '@nestjs/common';
import {
  SECURE_ENVELOPE_HEADER,
  SECURE_ENVELOPE_HEADER_VALUE,
  type EncryptedEnvelope,
  type RequestAad,
  SecureEnvelopeError,
} from '@secure-commerce/crypto-envelope';
import type { NextFunction, Request, Response } from 'express';
import { CryptoEnvelopeService } from './crypto-envelope.service.js';

@Injectable()
export class SecureEnvelopeMiddleware implements NestMiddleware {
  constructor(private readonly cryptoEnvelope: CryptoEnvelopeService) {}

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    const header = request.header(SECURE_ENVELOPE_HEADER);
    if (!header) {
      next();
      return;
    }
    if (header !== SECURE_ENVELOPE_HEADER_VALUE) {
      next(new BadRequestException({ code: 'ENVELOPE_VERSION_INVALID', message: 'Header envelope không hỗ trợ.' }));
      return;
    }
    try {
      const envelope = request.body as EncryptedEnvelope<RequestAad>;
      if (!envelope || typeof envelope !== 'object' || !('aad' in envelope)) {
        throw new BadRequestException({ code: 'ENVELOPE_MALFORMED', message: 'Body không phải encrypted envelope.' });
      }
      const path = request.originalUrl.split('?')[0] ?? request.path;
      const decrypted = await this.cryptoEnvelope.decryptIncoming(envelope, request.method, path);
      request.body = decrypted.body;
      request.secureContext = decrypted.context;
      request.headers['x-request-id'] = decrypted.context.requestId;
      response.setHeader('cache-control', 'no-store');
      next();
    } catch (error) {
      if (error instanceof SecureEnvelopeError) {
        next(
          new BadRequestException({
            code: error.code,
            message: 'Encrypted envelope không hợp lệ hoặc không xác thực được.',
          }),
        );
        return;
      }
      next(error);
    }
  }
}
