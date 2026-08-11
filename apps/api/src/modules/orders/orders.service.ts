import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, type Role } from '@prisma/client';
import type { OrderDto } from '@secure-commerce/contracts';
import {
  assertOrderTransition,
  DomainError,
  requiresInventoryReservationRelease,
  requiresInventoryRestock,
} from '@secure-commerce/domain';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { mapOrder, orderInclude, type OrderWithDetails } from './order.mapper.js';
import type { AdminOrderListDto, UpdateOrderStatusDto } from './orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string, page: number, pageSize: number): Promise<{ items: OrderDto[]; total: number }> {
    const where = { userId };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: orders.map(mapOrder), total };
  }

  async detailMine(userId: string, orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: orderInclude });
    if (!order) throw orderNotFound();
    return mapOrder(order);
  }

  async trackGuest(orderNo: string, email: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, guestEmail: email.toLowerCase() },
      include: orderInclude,
    });
    if (!order) throw orderNotFound();
    return mapOrder(order);
  }

  async cancelMine(user: AuthenticatedUser, orderId: string, reason: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { status: true } });
    if (!order) throw orderNotFound();
    if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
      throw new ConflictException({
        code: 'ORDER_CANNOT_CANCEL',
        message: 'Chỉ có thể tự hủy đơn khi đang chờ xác nhận.',
      });
    }
    return this.transition(orderId, OrderStatus.CANCELLED, user, { note: reason, cancellationReason: reason });
  }

  async requestReturn(user: AuthenticatedUser, orderId: string, reason: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, select: { status: true } });
    if (!order) throw orderNotFound();
    if (order.status !== OrderStatus.DELIVERED) {
      throw new ConflictException({ code: 'RETURN_NOT_ALLOWED', message: 'Chỉ đơn đã giao mới có thể yêu cầu đổi trả.' });
    }
    return this.transition(orderId, OrderStatus.RETURN_REQUESTED, user, { note: reason });
  }

  async listAdmin(dto: AdminOrderListDto): Promise<{ items: OrderDto[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(dto.status ? { status: dto.status as OrderStatus } : {}),
      ...(dto.query
        ? {
            OR: [
              { orderNo: { contains: dto.query, mode: 'insensitive' } },
              { guestEmail: { contains: dto.query, mode: 'insensitive' } },
              { guestPhone: { contains: dto.query, mode: 'insensitive' } },
              { user: { email: { contains: dto.query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((dto.page || 1) - 1) * (dto.pageSize || 10),
        take: dto.pageSize || 10,
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items: orders.map(mapOrder), total };
  }

  async updateStatus(dto: UpdateOrderStatusDto, actor: AuthenticatedUser): Promise<OrderDto> {
    return this.transition(dto.orderId, dto.status as OrderStatus, actor, {
      ...(dto.note ? { note: dto.note } : {}),
      ...(dto.status === 'CANCELLED' && dto.note ? { cancellationReason: dto.note } : {}),
      ...(dto.carrier ? { carrier: dto.carrier } : {}),
      ...(dto.trackingCode ? { trackingCode: dto.trackingCode } : {}),
      ...(dto.trackingUrl ? { trackingUrl: dto.trackingUrl } : {}),
    });
  }

  private async transition(
    orderId: string,
    target: OrderStatus,
    actor: Pick<AuthenticatedUser, 'id' | 'name' | 'role'>,
    options: {
      note?: string;
      cancellationReason?: string;
      carrier?: string;
      trackingCode?: string;
      trackingUrl?: string;
    },
  ): Promise<OrderDto> {
    try {
      const order = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
          if (!current) throw orderNotFound();
          assertOrderTransition(current.status, target);

          if (target === OrderStatus.CONFIRMED) await confirmInventory(tx, current);
          if (target === OrderStatus.CANCELLED) await cancelInventory(tx, current);

          const now = new Date();
          const updated = await tx.order.update({
            where: { id: current.id },
            data: {
              status: target,
              ...(target === OrderStatus.CONFIRMED ? { confirmedAt: now } : {}),
              ...(target === OrderStatus.SHIPPING ? { shippedAt: now } : {}),
              ...(target === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
              ...(target === OrderStatus.CANCELLED ? { cancelledAt: now } : {}),
              ...(options.cancellationReason ? { cancellationReason: options.cancellationReason } : {}),
              statusHistory: {
                create: {
                  fromStatus: current.status,
                  toStatus: target,
                  actorId: actor.id,
                  ...(options.note ? { note: options.note } : {}),
                },
              },
              ...(target === OrderStatus.SHIPPING
                ? {
                    shipment: {
                      upsert: {
                        create: {
                          shippedAt: now,
                          ...(options.carrier ? { carrier: options.carrier } : {}),
                          ...(options.trackingCode ? { trackingCode: options.trackingCode } : {}),
                          ...(options.trackingUrl ? { trackingUrl: options.trackingUrl } : {}),
                        },
                        update: {
                          shippedAt: now,
                          ...(options.carrier ? { carrier: options.carrier } : {}),
                          ...(options.trackingCode ? { trackingCode: options.trackingCode } : {}),
                          ...(options.trackingUrl ? { trackingUrl: options.trackingUrl } : {}),
                        },
                      },
                    },
                  }
                : {}),
              ...(target === OrderStatus.DELIVERED
                ? {
                    shipment: { update: { deliveredAt: now } },
                    ...(current.paymentMethod === 'COD'
                      ? { paymentStatus: PaymentStatus.PAID, payments: { updateMany: { where: {}, data: { status: PaymentStatus.PAID, paidAt: now } } } }
                      : {}),
                  }
                : {}),
              ...(target === OrderStatus.REFUNDED
                ? {
                    paymentStatus: PaymentStatus.REFUNDED,
                    payments: { updateMany: { where: {}, data: { status: PaymentStatus.REFUNDED } } },
                  }
                : {}),
            },
            include: orderInclude,
          });

          if (target === OrderStatus.DELIVERED) {
            for (const item of current.items) {
              if (item.productId) {
                await tx.product.update({ where: { id: item.productId }, data: { soldCount: { increment: item.quantity } } });
              }
            }
          }
          await tx.adminAuditLog.create({
            data: {
              actorId: actor.id,
              action: 'ORDER_STATUS_UPDATED',
              entityType: 'Order',
              entityId: current.id,
              before: { status: current.status },
              after: { status: target, note: options.note ?? null },
            },
          });
          if (updated.guestEmail) {
            await tx.notificationOutbox.create({
              data: {
                channel: 'EMAIL',
                recipient: updated.guestEmail,
                template: 'order-status',
                payload: { orderNo: updated.orderNo, status: updated.status },
              },
            });
          }
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return mapOrder(order);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new ConflictException({ code: error.code, message: error.message });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({ code: 'ORDER_CONFLICT', message: 'Đơn vừa được cập nhật; vui lòng tải lại.' });
      }
      throw error;
    }
  }
}

async function confirmInventory(tx: Prisma.TransactionClient, order: OrderWithDetails): Promise<void> {
  for (const item of order.items) {
    if (!item.variantId) continue;
    const updated = await tx.$queryRaw<Array<{ stock: number; reservedStock: number }>>(Prisma.sql`
      UPDATE "ProductVariant"
      SET "stock" = "stock" - ${item.quantity},
          "reservedStock" = "reservedStock" - ${item.quantity},
          "updatedAt" = NOW()
      WHERE "id" = ${item.variantId}
        AND "stock" >= ${item.quantity}
        AND "reservedStock" >= ${item.quantity}
      RETURNING "stock", "reservedStock"
    `);
    const state = updated[0];
    if (!state) throw new DomainError('INVENTORY_CONFIRM_FAILED', `Không thể xuất kho SKU ${item.sku}.`);
    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        orderId: order.id,
        type: 'OUT',
        quantity: -item.quantity,
        before: state.stock + item.quantity,
        after: state.stock,
        note: `Xác nhận đơn ${order.orderNo}`,
      },
    });
  }
}

async function cancelInventory(tx: Prisma.TransactionClient, order: OrderWithDetails): Promise<void> {
  if (requiresInventoryReservationRelease(order.status)) {
    for (const item of order.items) {
      if (!item.variantId) continue;
      const updated = await tx.$queryRaw<Array<{ stock: number; reservedStock: number }>>(Prisma.sql`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" - ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.variantId} AND "reservedStock" >= ${item.quantity}
        RETURNING "stock", "reservedStock"
      `);
      const state = updated[0];
      if (!state) throw new DomainError('INVENTORY_RELEASE_FAILED', `Không thể hoàn reservation SKU ${item.sku}.`);
      const beforeAvailable = state.stock - (state.reservedStock + item.quantity);
      const afterAvailable = state.stock - state.reservedStock;
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          orderId: order.id,
          type: 'RELEASE',
          quantity: item.quantity,
          before: beforeAvailable,
          after: afterAvailable,
          note: `Hủy đơn ${order.orderNo}`,
        },
      });
    }
    return;
  }

  if (requiresInventoryRestock(order.status)) {
    for (const item of order.items) {
      if (!item.variantId) continue;
      const variant = await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
        select: { stock: true },
      });
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          orderId: order.id,
          type: 'IN',
          quantity: item.quantity,
          before: variant.stock - item.quantity,
          after: variant.stock,
          note: `Nhập hoàn do hủy đơn ${order.orderNo}`,
        },
      });
    }
  }
}

function orderNotFound(): NotFoundException {
  return new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng.' });
}
