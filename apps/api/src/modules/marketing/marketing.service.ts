import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(email: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.marketingSubscriber.upsert({
        where: { email },
        update: { active: true },
        create: { email },
      });
      await tx.notificationOutbox.create({
        data: {
          channel: 'EMAIL',
          recipient: email,
          template: 'marketing-welcome',
          payload: { email },
        },
      });
    });
    return { ok: true, message: 'Đăng ký nhận tin thành công.' };
  }
}
