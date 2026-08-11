import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CheckoutDto, CheckoutQuoteDto } from './checkout.dto.js';
import { CheckoutService } from './checkout.service.js';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}


  @Post('quote')
  @UseGuards(OptionalJwtAuthGuard)
  quote(@Body() dto: CheckoutQuoteDto, @CurrentUser() user: AuthenticatedUser | undefined) {
    return this.checkout.quote(dto, user);
  }

  @Post('place-order')
  @UseGuards(OptionalJwtAuthGuard, CsrfGuard)
  placeOrder(
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.checkout.createOrder(dto, idempotencyKey, user);
  }
}
