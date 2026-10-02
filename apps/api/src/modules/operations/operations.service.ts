import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toCsv, validateCouponDefinition } from '@secure-commerce/domain';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { AdminPageDto } from '../admin/admin.dto.js';
import type { AdminOrderListDto } from '../orders/orders.dto.js';
import type { ConfirmTransferDto, CouponStatusDto, CreateCouponDto, ModerateReviewDto, ReviewQueueDto } from './operations.dto.js';
@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}
  async reviews(dto: ReviewQueueDto) {
    const where: Prisma.ReviewWhereInput = { ...(dto.status ? { status: dto.status } : {}),
      ...(dto.query ? { product: { name: { contains: dto.query, mode: 'insensitive' } } } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (dto.page - 1) * dto.pageSize, take: dto.pageSize,
        select: { id: true, rating: true, comment: true, status: true, createdAt: true,
          user: { select: { name: true } }, product: { select: { name: true, slug: true } } } }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }
  async moderate(dto: ModerateReviewDto, actor: AuthenticatedUser) {
    return this.transaction(async (tx) => {
      const review = await tx.review.findUnique({ where: { id: dto.reviewId }, select: { id: true, status: true } });
      if (!review) throw new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Không tìm thấy đánh giá.' });
      const result = await tx.review.update({ where: { id: review.id }, data: { status: dto.status }, select: { id: true, status: true } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'REVIEW_MODERATED', entityType: 'Review',
        entityId: review.id, before: { status: review.status }, after: { status: result.status } } });
      return result;
    });
  }
  async coupons(dto: AdminPageDto) {
    const where: Prisma.CouponWhereInput = dto.query ? { OR: [
      { code: { contains: dto.query, mode: 'insensitive' } }, { name: { contains: dto.query, mode: 'insensitive' } },
    ] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (dto.page - 1) * dto.pageSize, take: dto.pageSize }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }
  async createCoupon(dto: CreateCouponDto, actor: AuthenticatedUser) {
    const error = validateCouponDefinition(dto);
    if (error) throw new BadRequestException({ code: error, message: 'Kiểm tra mã, giá trị, giới hạn và thời gian coupon.' });
    return this.transaction(async (tx) => {
      const coupon = await tx.coupon.create({ data: {
        code: dto.code, name: dto.name, type: dto.type, value: dto.value, minOrder: dto.minOrder,
        maxDiscount: dto.maxDiscount ?? null, usageLimit: dto.usageLimit ?? null,
        usagePerUser: dto.usagePerUser, startsAt: new Date(dto.startsAt), expiresAt: new Date(dto.expiresAt),
      } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'COUPON_CREATED', entityType: 'Coupon', entityId: coupon.id,
        after: { code: coupon.code, type: coupon.type, value: coupon.value } } });
      return coupon;
    });
  }
  async couponStatus(dto: CouponStatusDto, actor: AuthenticatedUser) {
    return this.transaction(async (tx) => {
      const before = await tx.coupon.findUnique({ where: { id: dto.couponId } });
      if (!before) throw new NotFoundException({ code: 'COUPON_NOT_FOUND', message: 'Không tìm thấy coupon.' });
      const updated = await tx.coupon.update({ where: { id: before.id }, data: { active: dto.active } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'COUPON_STATUS_UPDATED', entityType: 'Coupon', entityId: before.id,
        before: { active: before.active }, after: { active: updated.active } } });
      return updated;
    });
  }
  async audit(dto: AdminPageDto) {
    const where: Prisma.AdminAuditLogWhereInput = dto.query ? { OR: [
      { action: { contains: dto.query, mode: 'insensitive' } }, { entityType: { contains: dto.query, mode: 'insensitive' } },
      { entityId: { contains: dto.query, mode: 'insensitive' } },
    ] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (dto.page - 1) * dto.pageSize, take: dto.pageSize,
        select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, actor: { select: { name: true } } } }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }
  async exportOrders(dto: AdminOrderListDto, actor: AuthenticatedUser) {
    const where: Prisma.OrderWhereInput = { ...(dto.status ? { status: dto.status } : {}), ...(dto.query ? { OR: [
      { orderNo: { contains: dto.query, mode: 'insensitive' } }, { guestEmail: { contains: dto.query, mode: 'insensitive' } },
      { guestPhone: { contains: dto.query, mode: 'insensitive' } }, { user: { email: { contains: dto.query, mode: 'insensitive' } } },
    ] } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({ where, take: 250, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { orderNo: true, createdAt: true, status: true, paymentMethod: true, paymentStatus: true,
          subtotal: true, discount: true, shippingFee: true, total: true } });
      const total = await tx.order.count({ where });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'ORDERS_EXPORTED', entityType: 'Order',
        after: { count: orders.length, total, truncated: total > orders.length } } });
      return { filename: `mira-orders-${new Date().toISOString().slice(0,10)}.csv`, count: orders.length, total,
        truncated: total > orders.length,
        csv: toCsv([['Order','Created (UTC)','Status','Method','Payment','Subtotal (VND)','Discount (VND)','Shipping (VND)','Total (VND)'],
          ...orders.map((o) => [o.orderNo, o.createdAt.toISOString(), o.status, o.paymentMethod, o.paymentStatus, o.subtotal, o.discount, o.shippingFee, o.total])]) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async confirmTransfer(dto: ConfirmTransferDto, actor: AuthenticatedUser) {
    return this.transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: dto.orderId }, include: { payments: true } });
      if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
      if (order.paymentMethod !== 'BANK_TRANSFER' || dto.expectedTotal !== order.total ||
        ['CANCELLED','REFUNDED','RETURN_REQUESTED'].includes(order.status)) {
        throw new ConflictException({ code: 'TRANSFER_NOT_ALLOWED', message: 'Không thể xác nhận cho trạng thái hoặc số tiền này.' });
      }
      const matches = order.payments.filter((p) => p.method === 'BANK_TRANSFER');
      const payment = matches[0];
      if (matches.length !== 1 || !payment || payment.amount !== order.total) throw new ConflictException({ code: 'TRANSFER_RECORD_INVALID', message: 'Cần kiểm tra bản ghi thanh toán.' });
      if (order.paymentStatus === 'PAID' && payment.status === 'PAID' && payment.provider === 'MANUAL_BANK' && payment.providerRef === dto.providerRef) return { ok: true, alreadyConfirmed: true };
      if (order.paymentStatus !== 'AWAITING_TRANSFER' || payment.status !== 'AWAITING_TRANSFER') {
        throw new ConflictException({ code: 'TRANSFER_ALREADY_PROCESSED', message: 'Thanh toán đã được xử lý.' });
      }
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', provider: 'MANUAL_BANK', providerRef: dto.providerRef, paidAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });
      await tx.adminAuditLog.create({ data: { actorId: actor.id, action: 'BANK_TRANSFER_CONFIRMED', entityType: 'Order', entityId: order.id,
        before: { paymentStatus: order.paymentStatus }, after: { paymentStatus: 'PAID', amount: order.total } } });
      return { ok: true, alreadyConfirmed: false };
    });
  }
  private async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code)) {
        throw new ConflictException({ code: 'OPERATION_CONFLICT', message: 'Dữ liệu trùng hoặc vừa thay đổi. Kiểm tra và tải lại.' });
      }
      throw error;
    }
  }
}
