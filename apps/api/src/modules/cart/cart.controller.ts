import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CartService } from './cart.service.js';
import { RemoveCartItemDto, SetCartItemDto } from './cart.dto.js';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post('get')
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.get(user.id);
  }

  @Post('set-item')
  @UseGuards(CsrfGuard)
  setItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetCartItemDto) {
    return this.cart.setItem(user.id, dto.variantId, dto.quantity);
  }

  @Post('remove-item')
  @UseGuards(CsrfGuard)
  removeItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: RemoveCartItemDto) {
    return this.cart.removeItem(user.id, dto.variantId);
  }

  @Post('clear')
  @UseGuards(CsrfGuard)
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.clear(user.id);
  }
}
