import { Controller, Get, Header } from '@nestjs/common';
import { AllowPlaintext } from '../../common/decorators/allow-plaintext.decorator.js';
import { CryptoEnvelopeService } from './crypto-envelope.service.js';

@Controller('crypto')
export class CryptoEnvelopeController {
  constructor(private readonly cryptoEnvelope: CryptoEnvelopeService) {}

  @Get('server-key')
  @AllowPlaintext()
  @Header('cache-control', 'no-store, max-age=0')
  serverKey() {
    return this.cryptoEnvelope.getServerKeyDescriptor();
  }
}
