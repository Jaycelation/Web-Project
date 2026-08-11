import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(config: ConfigService) {
    this.allowedOrigins = new Set(
      config
        .get<string>('WEB_ORIGIN', 'http://localhost:3000')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Express.Request>();
    const origin = request.headers.origin;
    if (!origin || request.method === 'OPTIONS') return true;
    if (!this.allowedOrigins.has(origin)) {
      throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: 'Origin không được phép.' });
    }
    return true;
  }
}
