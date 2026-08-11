import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  type Coupon,
} from '@prisma/client';
import type { CheckoutResult } from '@secure-commerce/contracts';
import {
  DomainError,
  priceOrder,
  type AuthoritativeVariant,
  type DiscountRule,
} from '@secure-commerce/domain';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import type { CheckoutDto, CheckoutQuoteDto } from './checkout.dto.js';

interface CreatedOrderSnapshot {
  id: string;
  orderNo: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  createdAt: Date;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly baseShippingFee: number;
  private readonly freeShippingThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseShippingFee = Number(config.get<string>('BASE_SHIPPING_FEE', '30000'));
    this.freeShippingThreshold = Number(config.get<string>('FREE_SHIPPING_THRESHOLD', '1000000'));
  }


  async quote(dto: CheckoutQuoteDto, user: AuthenticatedUser | undefined) {
    const mergedLines = mergeLines(dto.items);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...mergedLines.keys()] } },
      include: { product: { select: { status: true } } },
    });
    if (variants.length !== mergedLines.size) {
      throw new BadRequestException({ code: 'VARIANT_UNAVAILABLE', message: 'Một hoặc nhiều biến thể không còn tồn tại.' });
    }
    const authoritative = new Map<string, AuthoritativeVariant>(variants.map((variant) => [variant.id, {
      id: variant.id,
      unitPrice: variant.price,
      availableStock: Math.max(0, variant.stock - variant.reservedStock),
      active: variant.active && variant.product.status === ProductStatus.ACTIVE,
    }]));
    const baseInput = {
      requestedLines: [...mergedLines].map(([variantId, quantity]) => ({ variantId, quantity })),
      variants: authoritative,
      baseShippingFee: this.baseShippingFee,
      freeShippingThreshold: this.freeShippingThreshold,
    };
    const preliminary = priceOrder(baseInput);
    let coupon: Coupon | null = null;
    if (dto.couponCode) {
      const now = new Date();
      coupon = await this.prisma.coupon.findFirst({
        where: { code: dto.couponCode, active: true, startsAt: { lte: now }, expiresAt: { gt: now } },
      });
      if (!coupon) throw new BadRequestException({ code: 'COUPON_INVALID', message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestException({ code: 'COUPON_EXHAUSTED', message: 'Mã giảm giá đã hết lượt sử dụng.' });
      }
      if (preliminary.subtotal < coupon.minOrder) {
        throw new BadRequestException({ code: 'COUPON_MIN_ORDER', message: `Đơn hàng tối thiểu để dùng mã là ${coupon.minOrder.toLocaleString('vi-VN')} ₫.` });
      }
      if (user) {
        const count = await this.prisma.order.count({ where: { couponId: coupon.id, userId: user.id } });
        if (count >= coupon.usagePerUser) throw new BadRequestException({ code: 'COUPON_USER_LIMIT', message: 'Bạn đã dùng hết lượt cho mã giảm giá này.' });
      }
    }
    return priceOrder({ ...baseInput, coupon: coupon ? couponToRule(coupon) : null });
  }

  async createOrder(
    dto: CheckoutDto,
    idempotencyKey: string | undefined,
    user: AuthenticatedUser | undefined,
  ): Promise<CheckoutResult> {
    validateIdempotencyKey(idempotencyKey);
    if (!user && !dto.guestSessionId) {
      throw new BadRequestException({
        code: 'GUEST_SESSION_REQUIRED',
        message: 'Khách mua nhanh cần guestSessionId ổn định.',
      });
    }

    const scope = user ? `user:${user.id}` : `guest:${dto.guestSessionId}`;
    const existing = await this.findExisting(scope, idempotencyKey!);
    if (existing) return this.toResult(existing);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const order = await this.prisma.$transaction(
          async (tx) => this.createWithinTransaction(tx, dto, scope, idempotencyKey!, user),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return this.toResult(order);
      } catch (error) {
        if (isPrismaCode(error, 'P2002')) {
          const winner = await this.findExisting(scope, idempotencyKey!);
          if (winner) return this.toResult(winner);
        }
        if (isPrismaCode(error, 'P2034') && attempt < 3) {
          this.logger.warn(`Checkout transaction xung đột, thử lại lần ${attempt + 1}.`);
          continue;
        }
        throw mapDomainError(error);
      }
    }
    throw new ConflictException({ code: 'CHECKOUT_CONFLICT', message: 'Không thể hoàn tất checkout sau nhiều lần thử.' });
  }

  private async createWithinTransaction(
    tx: Prisma.TransactionClient,
    dto: CheckoutDto,
    scope: string,
    idempotencyKey: string,
    user: AuthenticatedUser | undefined,
  ): Promise<CreatedOrderSnapshot> {
    const duplicate = await tx.order.findUnique({
      where: { idempotencyScope_idempotencyKey: { idempotencyScope: scope, idempotencyKey } },
      select: orderSnapshotSelect,
    });
    if (duplicate) return duplicate;

    const mergedLines = mergeLines(dto.items);
    const variants = await tx.productVariant.findMany({
      where: { id: { in: [...mergedLines.keys()] } },
      include: {
        product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
      },
    });
    if (variants.length !== mergedLines.size) {
      throw new BadRequestException({ code: 'VARIANT_UNAVAILABLE', message: 'Một hoặc nhiều biến thể không còn tồn tại.' });
    }

    const authoritative = new Map<string, AuthoritativeVariant>();
    for (const variant of variants) {
      authoritative.set(variant.id, {
        id: variant.id,
        unitPrice: variant.price,
        availableStock: Math.max(0, variant.stock - variant.reservedStock),
        active: variant.active && variant.product.status === ProductStatus.ACTIVE,
      });
    }

    const coupon = dto.couponCode ? await this.loadCoupon(tx, dto.couponCode, user, dto.shippingAddress.email) : null;
    const preliminary = priceOrder({
      requestedLines: [...mergedLines].map(([variantId, quantity]) => ({ variantId, quantity })),
      variants: authoritative,
      baseShippingFee: this.baseShippingFee,
      freeShippingThreshold: this.freeShippingThreshold,
    });
    if (coupon && preliminary.subtotal < coupon.minOrder) {
      throw new BadRequestException({
        code: 'COUPON_MIN_ORDER',
        message: `Đơn hàng tối thiểu để dùng mã là ${coupon.minOrder.toLocaleString('vi-VN')} ₫.`,
      });
    }
    const priced = priceOrder({
      requestedLines: [...mergedLines].map(([variantId, quantity]) => ({ variantId, quantity })),
      variants: authoritative,
      coupon: coupon ? couponToRule(coupon) : null,
      baseShippingFee: this.baseShippingFee,
      freeShippingThreshold: this.freeShippingThreshold,
    });

    const orderNo = createOrderNo();
    const paymentStatus =
      dto.paymentMethod === PaymentMethod.BANK_TRANSFER
        ? PaymentStatus.AWAITING_TRANSFER
        : PaymentStatus.PENDING;
    const shippingAddress = {
      fullName: dto.shippingAddress.fullName,
      phone: dto.shippingAddress.phone,
      email: dto.shippingAddress.email,
      line1: dto.shippingAddress.line1,
      ...(dto.shippingAddress.line2 ? { line2: dto.shippingAddress.line2 } : {}),
      ...(dto.shippingAddress.ward ? { ward: dto.shippingAddress.ward } : {}),
      district: dto.shippingAddress.district,
      province: dto.shippingAddress.province,
      ...(dto.shippingAddress.postalCode ? { postalCode: dto.shippingAddress.postalCode } : {}),
      country: dto.shippingAddress.country || 'VN',
    };

    const order = await tx.order.create({
      data: {
        orderNo,
        ...(user ? { userId: user.id } : {}),
        ...(coupon ? { couponId: coupon.id } : {}),
        idempotencyScope: scope,
        idempotencyKey,
        guestEmail: dto.shippingAddress.email,
        guestPhone: dto.shippingAddress.phone,
        status: 'PENDING_CONFIRMATION',
        paymentMethod: dto.paymentMethod,
        paymentStatus,
        subtotal: priced.subtotal,
        discount: priced.discount,
        shippingFee: priced.shippingFee,
        total: priced.total,
        shippingAddress,
        ...(dto.customerNote ? { customerNote: dto.customerNote } : {}),
        items: {
          create: priced.lines.map((line) => {
            const variant = variants.find((item) => item.id === line.variantId)!;
            return {
              productId: variant.productId,
              variantId: variant.id,
              productName: variant.product.name,
              productSlug: variant.product.slug,
              variantName: variant.name,
              sku: variant.sku,
              imageUrl: variant.product.images[0]?.url ?? '/products/placeholder.svg',
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              lineTotal: line.lineTotal,
              attributes: variant.attributes,
            };
          }),
        },
        statusHistory: {
          create: {
            toStatus: 'PENDING_CONFIRMATION',
            ...(user ? { actorId: user.id } : {}),
            note: 'Đơn hàng được tạo.',
          },
        },
        payments: {
          create: {
            method: dto.paymentMethod,
            status: paymentStatus,
            amount: priced.total,
            provider: dto.paymentMethod === 'BANK_TRANSFER' ? 'MANUAL_BANK' : 'COD',
          },
        },
        shipment: { create: {} },
      },
      select: orderSnapshotSelect,
    });

    for (const line of priced.lines) {
      const updated = await tx.$queryRaw<Array<{ stock: number; reservedStock: number }>>(Prisma.sql`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${line.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${line.variantId}
          AND "active" = TRUE
          AND ("stock" - "reservedStock") >= ${line.quantity}
        RETURNING "stock", "reservedStock"
      `);
      const state = updated[0];
      if (!state) {
        throw new DomainError('INSUFFICIENT_STOCK', `Biến thể ${line.variantId} vừa hết tồn khả dụng.`);
      }
      const beforeAvailable = state.stock - (state.reservedStock - line.quantity);
      const afterAvailable = state.stock - state.reservedStock;
      await tx.inventoryMovement.create({
        data: {
          variantId: line.variantId,
          orderId: order.id,
          type: 'RESERVATION',
          quantity: -line.quantity,
          before: beforeAvailable,
          after: afterAvailable,
          note: `Giữ hàng cho đơn ${order.orderNo}`,
        },
      });
    }

    if (coupon) {
      await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orderId: order.id,
          ...(user ? { userId: user.id } : {}),
        },
      });
    }

    if (user) {
      const cart = await tx.cart.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({ where: { id: cart.id }, data: { status: 'CONVERTED' } });
      }
    }

    await tx.notificationOutbox.create({
      data: {
        channel: 'EMAIL',
        recipient: dto.shippingAddress.email,
        template: 'order-confirmation',
        payload: {
          orderNo: order.orderNo,
          total: order.total,
          paymentMethod: order.paymentMethod,
        },
      },
    });

    return order;
  }

  private async loadCoupon(
    tx: Prisma.TransactionClient,
    code: string,
    user: AuthenticatedUser | undefined,
    guestEmail: string,
  ): Promise<Coupon> {
    const now = new Date();
    const coupon = await tx.coupon.findFirst({
      where: { code, active: true, startsAt: { lte: now }, expiresAt: { gt: now } },
    });
    if (!coupon) {
      throw new BadRequestException({ code: 'COUPON_INVALID', message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' });
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException({ code: 'COUPON_EXHAUSTED', message: 'Mã giảm giá đã hết lượt sử dụng.' });
    }
    const previousUses = await tx.order.count({
      where: user
        ? { couponId: coupon.id, userId: user.id }
        : { couponId: coupon.id, userId: null, guestEmail: guestEmail.toLowerCase() },
    });
    if (previousUses >= coupon.usagePerUser) {
      throw new BadRequestException({ code: 'COUPON_USER_LIMIT', message: 'Bạn đã dùng hết lượt cho mã giảm giá này.' });
    }
    return coupon;
  }

  private findExisting(scope: string, idempotencyKey: string): Promise<CreatedOrderSnapshot | null> {
    return this.prisma.order.findUnique({
      where: { idempotencyScope_idempotencyKey: { idempotencyScope: scope, idempotencyKey } },
      select: orderSnapshotSelect,
    });
  }

  private toResult(order: CreatedOrderSnapshot): CheckoutResult {
    const result: CheckoutResult = {
      orderId: order.id,
      orderNo: order.orderNo,
      status: order.status as CheckoutResult['status'],
      paymentStatus: order.paymentStatus as CheckoutResult['paymentStatus'],
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shippingFee,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
    };
    if (order.paymentMethod === PaymentMethod.BANK_TRANSFER) {
      result.bankTransfer = {
        bankName: this.config.get<string>('BANK_NAME', 'Ngân hàng Demo'),
        accountNumber: this.config.get<string>('BANK_ACCOUNT_NUMBER', '0000000000'),
        accountName: this.config.get<string>('BANK_ACCOUNT_NAME', 'SECURE COMMERCE'),
        transferContent: order.orderNo,
      };
    }
    return result;
  }
}

const orderSnapshotSelect = {
  id: true,
  orderNo: true,
  status: true,
  paymentStatus: true,
  subtotal: true,
  discount: true,
  shippingFee: true,
  total: true,
  paymentMethod: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

function mergeLines(lines: CheckoutDto['items']): Map<string, number> {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  for (const [variantId, quantity] of merged) {
    if (quantity > 100) {
      throw new BadRequestException({ code: 'INVALID_QUANTITY', message: `Số lượng ${variantId} vượt giới hạn.` });
    }
  }
  return merged;
}

function couponToRule(coupon: Coupon): DiscountRule {
  if (coupon.type === DiscountType.PERCENTAGE) {
    return { type: 'PERCENTAGE', value: coupon.value, minOrder: coupon.minOrder, maxDiscount: coupon.maxDiscount };
  }
  if (coupon.type === DiscountType.FIXED_AMOUNT) {
    return { type: 'FIXED_AMOUNT', value: coupon.value, minOrder: coupon.minOrder };
  }
  return { type: 'FREE_SHIPPING', value: coupon.value, minOrder: coupon.minOrder };
}

function validateIdempotencyKey(value: string | undefined): asserts value is string {
  if (!value || !/^[A-Za-z0-9._:-]{16,128}$/u.test(value)) {
    throw new BadRequestException({
      code: 'IDEMPOTENCY_KEY_INVALID',
      message: 'Header Idempotency-Key phải dài 16–128 ký tự an toàn.',
    });
  }
}

function createOrderNo(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `SC${date}-${randomBytes(5).toString('hex').toUpperCase()}`;
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function mapDomainError(error: unknown): unknown {
  if (!(error instanceof DomainError)) return error;
  const payload = { code: error.code, message: error.message };
  if (error.code === 'INSUFFICIENT_STOCK' || error.code === 'VARIANT_UNAVAILABLE') {
    return new ConflictException(payload);
  }
  return new BadRequestException(payload);
}
