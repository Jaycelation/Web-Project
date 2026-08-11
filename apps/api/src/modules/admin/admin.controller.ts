import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OrdersService } from '../orders/orders.service.js';
import { AdminOrderListDto, UpdateOrderStatusDto } from '../orders/orders.dto.js';
import {
  AdjustInventoryDto,
  AdminPageDto,
  AdminProductListDto,
  CreateProductDto,
  CustomerStatusDto,
  DashboardQueryDto,
  UpdateContentDto,
  UpdateProductDto,
} from './admin.dto.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, CsrfGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly orders: OrdersService,
  ) {}

  @Post('dashboard')
  dashboard(@Body() dto: DashboardQueryDto) {
    return this.admin.dashboard(dto.days);
  }

  @Post('products')
  products(@Body() dto: AdminProductListDto) {
    return this.admin.listProducts(dto);
  }

  @Post('products/create')
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.admin.createProduct(dto, actor);
  }

  @Post('products/update')
  updateProduct(@Body() dto: UpdateProductDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.admin.updateProduct(dto, actor);
  }

  @Post('inventory/adjust')
  adjustInventory(@Body() dto: AdjustInventoryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.admin.adjustInventory(dto, actor);
  }

  @Post('orders')
  ordersList(@Body() dto: AdminOrderListDto) {
    return this.orders.listAdmin(dto);
  }

  @Post('orders/update-status')
  updateOrder(@Body() dto: UpdateOrderStatusDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.orders.updateStatus(dto, actor);
  }

  @Post('customers')
  customers(@Body() dto: AdminPageDto) {
    return this.admin.listCustomers(dto);
  }

  @Post('customers/status')
  @Roles(Role.ADMIN)
  customerStatus(@Body() dto: CustomerStatusDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.admin.updateCustomerStatus(dto, actor);
  }

  @Post('content')
  content() {
    return this.admin.listContent();
  }

  @Post('content/update')
  updateContent(@Body() dto: UpdateContentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.admin.updateContent(dto, actor);
  }

  @Post('metadata')
  metadata() {
    return this.admin.metadata();
  }
}
