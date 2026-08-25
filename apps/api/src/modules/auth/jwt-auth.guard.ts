import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.cookies?.access_token) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = Express.User>(error: unknown, user: TUser | false | null, info: unknown): TUser {
    if (error || !user) {
      throw error instanceof Error
        ? error
        : new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Phiên đăng nhập không hợp lệ.' });
    }
    void info;
    return user;
  }
}
