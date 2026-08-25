import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const hasSessionCookie = Boolean(
      request.cookies?.access_token || request.cookies?.refresh_token,
    );
    if (!hasSessionCookie) return true;

    const cookieToken = request.cookies.csrf_token as string | undefined;
    const headerToken = request.header('x-csrf-token');
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      throw new ForbiddenException({ code: 'CSRF_INVALID', message: 'CSRF token không hợp lệ.' });
    }
    return true;
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
