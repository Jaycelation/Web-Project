import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ProductStatus, type UserStatus } from '@prisma/client';
import type { DashboardDto } from '@secure-commerce/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import type {
  AdjustInventoryDto,
  AdminPageDto,
  AdminProductListDto,
  CreateProductDto,
  CustomerStatusDto,
  UpdateContentDto,
  UpdateProductDto,
} from './admin.dto.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(dto: AdminProductListDto) {
    const where: Prisma.ProductWhereInput = {
      ...(dto.status ? { status: dto.status as ProductStatus } : {}),
      ...(dto.query
        ? {
            OR: [
              { name: { contains: dto.query, mode: 'insensitive' } },
              { skuBase: { contains: dto.query, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: dto.query, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        include: {
          category: true,
          brand: true,
          images: { orderBy: { position: 'asc' }, take: 1 },
          variants: { orderBy: { sku: 'asc' } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      total,
      items: items.map((product) => ({
        id: product.id,
        slug: product.slug,
        skuBase: product.skuBase,
        name: product.name,
        status: product.status,
        basePrice: product.basePrice,
        featured: product.featured,
        category: product.category.name,
        brand: product.brand?.name ?? null,
        imageUrl: product.images[0]?.url ?? '/products/placeholder.svg',
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          price: variant.price,
          stock: variant.stock,
          reservedStock: variant.reservedStock,
          availableStock: Math.max(0, variant.stock - variant.reservedStock),
          lowStockThreshold: variant.lowStockThreshold,
          active: variant.active,
        })),
        updatedAt: product.updatedAt.toISOString(),
      })),
    };
  }

  async createProduct(dto: CreateProductDto, actor: AuthenticatedUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          categoryId: dto.categoryId,
          ...(dto.brandId ? { brandId: dto.brandId } : {}),
          slug: dto.slug,
          skuBase: dto.skuBase,
          name: dto.name,
          shortDescription: dto.shortDescription,
          description: dto.description,
          basePrice: dto.basePrice,
          ...(dto.compareAtPrice !== undefined ? { compareAtPrice: dto.compareAtPrice } : {}),
          status: dto.status,
          featured: dto.featured,
          images: {
            create: dto.images.map((image, position) => ({ url: image.url, alt: image.alt, position })),
          },
          variants: {
            create: dto.variants.map((variant) => ({
              sku: variant.sku,
              name: variant.name,
              attributes: variant.attributes,
              price: variant.price,
              ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold,
            })),
          },
        },
        select: { id: true, slug: true, name: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          action: 'PRODUCT_CREATED',
          entityType: 'Product',
          entityId: product.id,
          after: { slug: product.slug, name: product.name },
        },
      });
      return product;
    });
    return result;
  }

  async updateProduct(dto: UpdateProductDto, actor: AuthenticatedUser) {
    const before = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!before) throw productNotFound();
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: dto.productId },
        data: {
          ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
          ...(dto.brandId ? { brandId: dto.brandId } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.shortDescription ? { shortDescription: dto.shortDescription } : {}),
          ...(dto.description ? { description: dto.description } : {}),
          ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
          ...(dto.compareAtPrice !== undefined ? { compareAtPrice: dto.compareAtPrice } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.featured !== undefined ? { featured: dto.featured } : {}),
        },
        select: { id: true, slug: true, name: true, status: true, updatedAt: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          action: 'PRODUCT_UPDATED',
          entityType: 'Product',
          entityId: product.id,
          before: { name: before.name, status: before.status, basePrice: before.basePrice },
          after: { name: product.name, status: product.status },
        },
      });
      return product;
    });
  }

  async adjustInventory(dto: AdjustInventoryDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRaw<Array<{ id: string; sku: string; stock: number; reservedStock: number }>>(Prisma.sql`
        UPDATE "ProductVariant"
        SET "stock" = "stock" + ${dto.delta}, "updatedAt" = NOW()
        WHERE "id" = ${dto.variantId}
          AND ("stock" + ${dto.delta}) >= "reservedStock"
          AND ("stock" + ${dto.delta}) >= 0
        RETURNING "id", "sku", "stock", "reservedStock"
      `);
      const variant = updated[0];
      if (!variant) {
        throw new ConflictException({
          code: 'INVENTORY_ADJUST_INVALID',
          message: 'Điều chỉnh làm tồn kho âm hoặc thấp hơn lượng đang giữ.',
        });
      }
      await tx.inventoryMovement.create({
        data: {
          variantId: variant.id,
          type: dto.delta >= 0 ? 'IN' : 'ADJUSTMENT',
          quantity: dto.delta,
          before: variant.stock - dto.delta,
          after: variant.stock,
          note: dto.note,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          action: 'INVENTORY_ADJUSTED',
          entityType: 'ProductVariant',
          entityId: variant.id,
          before: { stock: variant.stock - dto.delta },
          after: { stock: variant.stock, note: dto.note },
        },
      });
      return {
        variantId: variant.id,
        sku: variant.sku,
        stock: variant.stock,
        reservedStock: variant.reservedStock,
        availableStock: variant.stock - variant.reservedStock,
      };
    });
  }

  async dashboard(days: number): Promise<DashboardDto> {
    const from = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);
    const [orders, orderCount, newCustomers, statusGroups, bestSellers, lowStock, dailyRevenue] = await Promise.all([
      this.prisma.order.aggregate({
        where: { createdAt: { gte: from }, status: 'DELIVERED' },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.order.count({ where: { createdAt: { gte: from } } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: from } } }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ productName: string; quantity: number; revenue: bigint }>>(Prisma.sql`
        SELECT oi."productName", SUM(oi."quantity")::int AS quantity, SUM(oi."lineTotal")::bigint AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."status" = 'DELIVERED' AND o."createdAt" >= ${from}
        GROUP BY oi."productName"
        ORDER BY quantity DESC
        LIMIT 8
      `),
      this.prisma.$queryRaw<Array<{ variantId: string; sku: string; productName: string; availableStock: number }>>(Prisma.sql`
        SELECT v."id" AS "variantId", v."sku", p."name" AS "productName",
               (v."stock" - v."reservedStock")::int AS "availableStock"
        FROM "ProductVariant" v
        JOIN "Product" p ON p."id" = v."productId"
        WHERE v."active" = TRUE
          AND (v."stock" - v."reservedStock") <= v."lowStockThreshold"
        ORDER BY "availableStock" ASC
        LIMIT 20
      `),
      this.prisma.$queryRaw<Array<{ date: Date; revenue: bigint; orders: number }>>(Prisma.sql`
        SELECT DATE_TRUNC('day', "createdAt") AS date,
               SUM("total")::bigint AS revenue,
               COUNT(*)::int AS orders
        FROM "Order"
        WHERE "status" = 'DELIVERED' AND "createdAt" >= ${from}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date ASC
      `),
    ]);

    const revenue = orders._sum.total ?? 0;
    const cancelled = statusGroups.find((item) => item.status === 'CANCELLED')?._count._all ?? 0;
    return {
      revenue,
      orderCount,
      averageOrderValue: orders._count ? Math.round(revenue / orders._count) : 0,
      newCustomers,
      cancellationRate: orderCount ? Math.round((cancelled / orderCount) * 10_000) / 100 : 0,
      ordersByStatus: statusGroups.map((item) => ({ status: item.status, count: item._count._all })),
      bestSellers: bestSellers.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        revenue: Number(item.revenue),
      })),
      lowStock,
      dailyRevenue: dailyRevenue.map((item) => ({
        date: item.date.toISOString().slice(0, 10),
        revenue: Number(item.revenue),
        orders: item.orders,
      })),
    };
  }

  async listCustomers(dto: AdminPageDto) {
    const where: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
      ...(dto.query
        ? {
            OR: [
              { name: { contains: dto.query, mode: 'insensitive' } },
              { email: { contains: dto.query, mode: 'insensitive' } },
              { phone: { contains: dto.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: { select: { total: true }, where: { status: 'DELIVERED' } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      total,
      items: items.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        orderCount: user._count.orders,
        lifetimeValue: user.orders.reduce((sum, order) => sum + order.total, 0),
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }

  async updateCustomerStatus(dto: CustomerStatusDto, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, role: true, status: true } });
    if (!user || user.role !== 'CUSTOMER') throw new NotFoundException({ code: 'CUSTOMER_NOT_FOUND', message: 'Không tìm thấy khách hàng.' });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { status: dto.status as UserStatus },
        select: { id: true, status: true },
      });
      if (dto.status === 'LOCKED') {
        await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          action: 'CUSTOMER_STATUS_UPDATED',
          entityType: 'User',
          entityId: user.id,
          before: { status: user.status },
          after: { status: updated.status },
        },
      });
      return updated;
    });
  }

  listContent() {
    return this.prisma.contentPage.findMany({ orderBy: { slug: 'asc' } });
  }

  async updateContent(dto: UpdateContentDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const page = await tx.contentPage.upsert({
        where: { slug: dto.slug },
        update: {
          title: dto.title,
          content: dto.content,
          ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
          ...(dto.seoDescription !== undefined ? { seoDescription: dto.seoDescription } : {}),
          published: dto.published,
        },
        create: {
          slug: dto.slug,
          title: dto.title,
          content: dto.content,
          ...(dto.seoTitle ? { seoTitle: dto.seoTitle } : {}),
          ...(dto.seoDescription ? { seoDescription: dto.seoDescription } : {}),
          published: dto.published,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          action: 'CONTENT_UPDATED',
          entityType: 'ContentPage',
          entityId: page.id,
          after: { slug: page.slug, title: page.title, published: page.published },
        },
      });
      return page;
    });
  }

  metadata() {
    return Promise.all([
      this.prisma.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      this.prisma.brand.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]).then(([categories, brands]) => ({ categories, brands }));
  }
}

function productNotFound(): NotFoundException {
  return new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy sản phẩm.' });
}
