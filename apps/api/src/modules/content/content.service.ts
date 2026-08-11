import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async page(slug: string) {
    const page = await this.prisma.contentPage.findFirst({ where: { slug, published: true } });
    if (!page) throw new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: 'Không tìm thấy trang nội dung.' });
    return {
      slug: page.slug,
      title: page.title,
      content: page.content,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      updatedAt: page.updatedAt.toISOString(),
    };
  }
}
