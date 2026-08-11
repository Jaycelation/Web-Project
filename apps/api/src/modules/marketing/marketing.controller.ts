import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscribeDto } from './marketing.dto.js';
import { MarketingService } from './marketing.service.js';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeDto) {
    return this.marketing.subscribe(dto.email);
  }
}
