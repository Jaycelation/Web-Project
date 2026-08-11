import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus, type Prisma } from '@prisma/client';
import type { CartDto, CartLineDto } from '@secure-commerce/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          product: {
            include: { images: { orderBy: { position: 'asc' as const }, take: 1 } },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, include: cartInclude });
    return cart ? mapCart(cart) : emptyCart();
  }

  async setItem(userId: string, variantId: string, quantity: number): Promise<CartDto> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true } } },
    });
    if (!variant || !variant.active || variant.product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException({ code: 'VARIANT_NOT_FOUND', message: 'Biến thể sản phẩm không khả dụng.' });
    }
    const available = Math.max(0, variant.stock - variant.reservedStock);
    if (quantity > available) {
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: `Chỉ còn ${available} sản phẩm khả dụng.`,
        details: { variantId, availableStock: available },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId },
        update: { status: 'ACTIVE' },
        create: { userId },
      });
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        update: { quantity },
        create: { cartId: cart.id, variantId, quantity },
      });
    });
    return this.get(userId);
  }

  async removeItem(userId: string, variantId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (!cart) return emptyCart();
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return this.get(userId);
  }

  async clear(userId: string): Promise<CartDto> {
    const cart = await this.prisma.cart.findUnique({ where: { userId }, select: { id: true } });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return emptyCart();
  }
}

function mapCart(cart: CartWithItems): CartDto {
  const items: CartLineDto[] = cart.items
    .filter((item) => item.variant.active && item.variant.product.status === ProductStatus.ACTIVE)
    .map((item) => {
      const availableStock = Math.max(0, item.variant.stock - item.variant.reservedStock);
      const unitPrice = item.variant.price;
      return {
        variantId: item.variant.id,
        productId: item.variant.product.id,
        productSlug: item.variant.product.slug,
        productName: item.variant.product.name,
        variantName: item.variant.name,
        sku: item.variant.sku,
        imageUrl: item.variant.product.images[0]?.url ?? '/products/placeholder.svg',
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        availableStock,
      };
    });
  return {
    items,
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function emptyCart(): CartDto {
  return { items: [], subtotal: 0, itemCount: 0 };
}
