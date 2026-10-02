import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canReviewPurchase } from '@secure-commerce/domain';
import type { ReviewListResult } from '@secure-commerce/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { CreateReviewDto, ReviewListDto } from './reviews.dto.js';
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(dto: ReviewListDto): Promise<ReviewListResult> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: 'ACTIVE', category: { active: true } }, select: { id: true },
    });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Không tìm thấy sản phẩm.' });
    const where = { productId: product.id, status: 'APPROVED' as const };
    const [items, stats, groups] = await this.prisma.$transaction([
      this.prisma.review.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (dto.page - 1) * dto.pageSize, take: dto.pageSize,
        select: { id: true, userId: true, rating: true, comment: true, createdAt: true, user: { select: { name: true } },
          orderItem: { select: { productId: true, order: { select: { userId: true } } } } },
      }),
      this.prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const group of groups) distribution[group.rating] = group._count._all;
    return { items: items.map((review) => ({
      id: review.id, rating: review.rating, comment: review.comment,
      authorName: publicName(review.user.name), createdAt: review.createdAt.toISOString(),
      verifiedPurchase: review.orderItem.order.userId === review.userId && review.orderItem.productId === product.id,
    })), total: stats._count, page: dto.page, pageSize: dto.pageSize,
      summary: { count: stats._count, average: stats._avg.rating == null ? null : Math.round(stats._avg.rating * 10) / 10, distribution } };
  }
  async eligible(productId: string, userId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { productId, product: { status: 'ACTIVE', category: { active: true } }, order: { userId, status: 'DELIVERED' }, review: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
      select: { id: true, variantName: true, order: { select: { orderNo: true } } },
    });
    return { items: items.map((item) => ({ orderItemId: item.id, variantName: item.variantName, orderNo: item.order.orderNo })) };
  }
  async create(dto: CreateReviewDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.orderItem.findFirst({
          where: { id: dto.orderItemId, order: { userId } },
          include: { order: { select: { userId: true, status: true } }, product: { select: { status: true, category: { select: { active: true } } } } },
        });
        if (!item || !item.productId || item.product?.status !== 'ACTIVE' || !item.product.category.active ||
          !canReviewPurchase(userId, item.order.userId, item.order.status)) {
          throw new ForbiddenException({ code: 'REVIEW_PURCHASE_REQUIRED', message: 'Chỉ đơn đã giao của bạn mới được đánh giá.' });
        }
        return tx.review.create({ data: { userId, productId: item.productId, orderItemId: item.id,
          rating: dto.rating, comment: dto.comment, status: 'PENDING' }, select: { id: true, status: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'REVIEW_ALREADY_EXISTS', message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng.' });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException({ code: 'REVIEW_CONFLICT', message: 'Dữ liệu vừa thay đổi. Vui lòng thử lại.' });
      }
      throw error;
    }
  }
}
function publicName(name: string): string {
  const words = name.trim().split(/\s+/u);
  return words.length > 1 ? `${words.at(-1)} ${words[0]?.slice(0, 1)}.` : (words[0]?.slice(0, 24) || 'Khách hàng');
}
