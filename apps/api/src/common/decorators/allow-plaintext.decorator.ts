import { SetMetadata } from '@nestjs/common';

export const ALLOW_PLAINTEXT_KEY = 'allowPlaintext';
export const AllowPlaintext = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PLAINTEXT_KEY, true);
