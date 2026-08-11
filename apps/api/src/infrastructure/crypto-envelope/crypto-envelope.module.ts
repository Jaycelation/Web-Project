import { Module } from '@nestjs/common';
import { CryptoEnvelopeController } from './crypto-envelope.controller.js';
import { CryptoEnvelopeService } from './crypto-envelope.service.js';
import { ReplayCacheService } from './replay-cache.service.js';
import { SecureEnvelopeMiddleware } from './secure-envelope.middleware.js';

@Module({
  controllers: [CryptoEnvelopeController],
  providers: [CryptoEnvelopeService, ReplayCacheService, SecureEnvelopeMiddleware],
  exports: [CryptoEnvelopeService, SecureEnvelopeMiddleware],
})
export class CryptoEnvelopeModule {}
