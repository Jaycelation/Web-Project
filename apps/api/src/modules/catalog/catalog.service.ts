import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type {
  CatalogSearchResult,
  ProductDetailDto,
  ProductSummaryDto,
} from '@secure-commerce/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { CatalogSearchDto } from './catalog.dto.js';

type CatalogProduct = Prisma.ProductGetPayload<{
  include: {
    category: true;
    brand: true;
    images: true;
    variants: true;
  };
}>;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: CatalogSearchDto): Promise<CatalogSearchResult> {
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 12;
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(dto.category ? { category: { slug: dto.category, active: true } } : {}),
      ...(dto.brand ? { brand: { slug: dto.brand, active: true } } : {}),
      ...(dto.minPrice !== undefined || dto.maxPrice !== undefined
        ? {
            basePrice: {
              ...(dto.minPrice !== undefined ? { gte: dto.minPrice } : {}),
              ...(dto.maxPrice !== undefined ? { lte: dto.maxPrice } : {}),
            },
          }
        : {}),
      ...(dto.inStock ? { variants: { some: { active: true, stock: { gt: 0 } } } } : {}),
      ...(dto.query
        ? {
            OR: [
              { name: { contains: dto.query, mode: 'insensitive' } },
              { skuBase: { contains: dto.query, mode: 'insensitive' } },
              { shortDescription: { contains: dto.query, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: dto.query, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      dto.sort === 'price_asc'
        ? { basePrice: 'asc' }
        : dto.sort === 'price_desc'
          ? { basePrice: 'desc' }
          : dto.sort === 'popular'
            ? { soldCount: 'desc' }
            : { createdAt: 'desc' };

    const [products, total, categories, brands] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          brand: true,
          images: { orderBy: { position: 'asc' } },
          variants: { where: { active: true }, orderBy: { price: 'asc' } },
        },
      }),
      this.prisma.product.count({ where }),
      this.prisma.category.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
      this.prisma.brand.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);

    return {
      items: products.map(toSummary),
      total,
      page,
      pageSize,
      categories: categories.map(({ id, name, slug }) => ({ id, name, slug })),
      brands: brands.map(({ id, name, slug }) => ({ id, name, slug })),
    };
  }

  async detail(slug: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { position: 'asc' } },
        variants: { where: { active: true }, orderBy: { price: 'asc' } },
      },
    });
    if (!product) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy sản phẩm.' });
    }
    const related = await this.prisma.product.findMany({
      where: {
        id: { not: product.id },
        categoryId: product.categoryId,
        status: ProductStatus.ACTIVE,
      },
      orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
      take: 4,
      include: {
        category: true,
        brand: true,
        images: { orderBy: { position: 'asc' } },
        variants: { where: { active: true }, orderBy: { price: 'asc' } },
      },
    });

    const summary = toSummary(product);
    return {
      ...summary,
      description: product.description,
      skuBase: product.skuBase,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        position: image.position,
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        attributes: jsonRecord(variant.attributes),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        availableStock: Math.max(0, variant.stock - variant.reservedStock),
        active: variant.active,
      })),
      policies: {
        shipping: product.shippingPolicy,
        returns: product.returnPolicy,
        warranty: product.warrantyPolicy,
      },
      related: related.map(toSummary),
    };
  }
}

function toSummary(product: CatalogProduct): ProductSummaryDto {
  const firstVariant = product.variants[0];
  const firstImage = product.images[0];
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    price: firstVariant?.price ?? product.basePrice,
    compareAtPrice: firstVariant?.compareAtPrice ?? product.compareAtPrice,
    imageUrl: firstImage?.url ?? '/products/placeholder.svg',
    imageAlt: firstImage?.alt ?? product.name,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    brand: product.brand
      ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug }
      : null,
    featured: product.featured,
    soldCount: product.soldCount,
  };
}

function jsonRecord(value: Prisma.JsonValue): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item : String(item)]),
  );
}
