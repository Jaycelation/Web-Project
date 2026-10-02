import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

    if (dto.minPrice !== undefined && dto.maxPrice !== undefined && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException({ code: 'PRICE_RANGE_INVALID', message: 'Giá từ phải nhỏ hơn hoặc bằng giá đến.' });
    }
    // One authoritative display price: MIN(price) over ACTIVE variants.
    // All input values are bound parameters; sorting uses only static SQL fragments.
    const predicates: Prisma.Sql[] = [Prisma.sql`p."status" = 'ACTIVE' AND c."active" = TRUE AND v."price" IS NOT NULL`];
    if (dto.category) predicates.push(Prisma.sql`c."slug" = ${dto.category}`);
    if (dto.brand) predicates.push(Prisma.sql`b."slug" = ${dto.brand} AND b."active" = TRUE`);
    if (dto.minPrice !== undefined) predicates.push(Prisma.sql`v."price" >= ${dto.minPrice}`);
    if (dto.maxPrice !== undefined) predicates.push(Prisma.sql`v."price" <= ${dto.maxPrice}`);
    if (dto.inStock) predicates.push(Prisma.sql`v."inStock" = TRUE`);
    if (dto.query) predicates.push(Prisma.sql`(
      strpos(lower(p."name"), lower(${dto.query})) > 0 OR
      strpos(lower(p."skuBase"), lower(${dto.query})) > 0 OR
      strpos(lower(p."shortDescription"), lower(${dto.query})) > 0 OR
      EXISTS (SELECT 1 FROM "ProductVariant" sv WHERE sv."productId" = p."id" AND sv."active" = TRUE
        AND strpos(lower(sv."sku"), lower(${dto.query})) > 0))`);
    const source = Prisma.sql`FROM "Product" p
      JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      JOIN LATERAL (SELECT MIN(pv."price") AS "price", BOOL_OR(pv."stock" > pv."reservedStock") AS "inStock"
        FROM "ProductVariant" pv WHERE pv."productId" = p."id" AND pv."active" = TRUE) v ON TRUE
      WHERE ${Prisma.join(predicates, ' AND ')}`;
    const order = dto.sort === 'price_asc' ? Prisma.sql`v."price" ASC, p."id" ASC`
      : dto.sort === 'price_desc' ? Prisma.sql`v."price" DESC, p."id" ASC`
      : dto.sort === 'popular' ? Prisma.sql`p."soldCount" DESC, p."id" ASC`
      : Prisma.sql`p."createdAt" DESC, p."id" ASC`;
    const { products, total, categories, brands } = await this.prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT p."id" ${source} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
      const counts = await tx.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total ${source}`);
      const found = await tx.product.findMany({ where: { id: { in: ids.map((row) => row.id) } }, include: catalogInclude });
      const byId = new Map(found.map((product) => [product.id, product]));
      const categories = await tx.category.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
      const brands = await tx.brand.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
      return { products: ids.flatMap(({ id }) => { const p = byId.get(id); return p ? [p] : []; }),
        total: Number(counts[0]?.total ?? 0), categories, brands };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    return {
      items: products.map(toSummary),
      total,
      page,
      pageSize,
      categories: categories.map(({ id, name, slug }) => ({ id, name, slug })),
      brands: brands.map(({ id, name, slug }) => ({ id, name, slug })),
    };
  }

  async selection(productIds: string[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ACTIVE', category: { active: true }, variants: { some: { active: true } } },
      include: catalogInclude,
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return { items: productIds.flatMap((id) => { const product = byId.get(id); return product ? [toSummary(product)] : []; }) };
  }

  async detail(slug: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE, category: { active: true }, variants: { some: { active: true } } },
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
        variants: { some: { active: true } },
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
    availableStock: product.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock - variant.reservedStock), 0),
  };
}

function jsonRecord(value: Prisma.JsonValue): Record<string, string> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item : String(item)]),
  );
}

const catalogInclude = {
  category: true, brand: true,
  images: { orderBy: { position: 'asc' } },
  variants: { where: { active: true }, orderBy: [{ price: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ProductInclude;
