import type { AuthenticatedUser } from './authenticated-user.js';
import type { SecureRequestContext } from '../../infrastructure/crypto-envelope/crypto-envelope.types.js';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      secureContext?: SecureRequestContext;
    }
  }
}

export {};
