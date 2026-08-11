import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrdersService } from './orders.service.js';
import { CancelOrderDto, OrderIdDto, OrderListDto, ReturnOrderDto, TrackOrderDto } from './orders.dto.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrderListDto) {
    return this.orders.listMine(user.id, dto.page, dto.pageSize);
  }

  @Post('detail')
  @UseGuards(JwtAuthGuard)
  detailMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrderIdDto) {
    return this.orders.detailMine(user.id, dto.orderId);
  }

  @Post('track')
  track(@Body() dto: TrackOrderDto) {
    return this.orders.trackGuest(dto.orderNo, dto.email);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  cancel(@CurrentUser() user: AuthenticatedUser, @Body() dto: CancelOrderDto) {
    return this.orders.cancelMine(user, dto.orderId, dto.reason);
  }

  @Post('request-return')
  @UseGuards(JwtAuthGuard, CsrfGuard)
  requestReturn(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReturnOrderDto) {
    return this.orders.requestReturn(user, dto.orderId, dto.reason);
  }
}
