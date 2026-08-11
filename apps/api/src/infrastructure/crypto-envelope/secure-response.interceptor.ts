import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { from, mergeMap, type Observable } from 'rxjs';
import { SECURE_ENVELOPE_HEADER, SECURE_ENVELOPE_HEADER_VALUE } from '@secure-commerce/crypto-envelope';
import { CryptoEnvelopeService } from './crypto-envelope.service.js';

@Injectable()
export class SecureResponseInterceptor implements NestInterceptor {
  constructor(private readonly cryptoEnvelope: CryptoEnvelopeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!request.secureContext) return next.handle();

    return next.handle().pipe(
      mergeMap((data) =>
        from(this.cryptoEnvelope.encryptOutgoing(request.secureContext!, data, response.statusCode)),
      ),
      mergeMap((envelope) => {
        response.setHeader(SECURE_ENVELOPE_HEADER, SECURE_ENVELOPE_HEADER_VALUE);
        response.setHeader('x-request-id', request.secureContext!.requestId);
        response.setHeader('cache-control', 'no-store');
        return [envelope];
      }),
    );
  }
}
