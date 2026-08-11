import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PLAINTEXT_KEY } from '../decorators/allow-plaintext.decorator.js';

@Injectable()
export class SecureEnvelopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowPlaintext = this.reflector.getAllAndOverride<boolean>(ALLOW_PLAINTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowPlaintext) return true;

    const request = context.switchToHttp().getRequest<Express.Request>();
    if (request.method === 'OPTIONS') return true;
    if (!request.secureContext) {
      throw new BadRequestException({
        code: 'SECURE_ENVELOPE_REQUIRED',
        message: 'Endpoint này yêu cầu request được bọc bằng RSA-OAEP + AES-256-GCM.',
      });
    }
    return true;
  }
}
