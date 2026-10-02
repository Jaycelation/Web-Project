import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminPageDto } from '../admin/admin.dto.js';
import { AdminOrderListDto } from '../orders/orders.dto.js';
import { ConfirmTransferDto, CouponStatusDto, CreateCouponDto, ModerateReviewDto, ReviewQueueDto } from './operations.dto.js';
import { OperationsService } from './operations.service.js';
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Post('reviews') reviews(@Body() dto: ReviewQueueDto) { return this.operations.reviews(dto); }
  @Post('reviews/moderate') moderate(@Body() dto: ModerateReviewDto, @CurrentUser() user: AuthenticatedUser) { return this.operations.moderate(dto, user); }
  @Post('coupons') coupons(@Body() dto: AdminPageDto) { return this.operations.coupons(dto); }
  @Post('coupons/create') @Roles(Role.ADMIN)
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: AuthenticatedUser) { return this.operations.createCoupon(dto, user); }
  @Post('coupons/status') @Roles(Role.ADMIN)
  couponStatus(@Body() dto: CouponStatusDto, @CurrentUser() user: AuthenticatedUser) { return this.operations.couponStatus(dto, user); }
  @Post('audit') @Roles(Role.ADMIN)
  audit(@Body() dto: AdminPageDto) { return this.operations.audit(dto); }
  @Post('orders/export')
  exportOrders(@Body() dto: AdminOrderListDto, @CurrentUser() user: AuthenticatedUser) { return this.operations.exportOrders(dto, user); }
  @Post('payments/confirm-transfer') @Roles(Role.ADMIN)
  confirmTransfer(@Body() dto: ConfirmTransferDto, @CurrentUser() user: AuthenticatedUser) { return this.operations.confirmTransfer(dto, user); }
}
