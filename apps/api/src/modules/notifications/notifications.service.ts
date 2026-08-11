import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueEmail(recipient: string, template: string, payload: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.notificationOutbox.create({
      data: {
        channel: 'EMAIL',
        recipient,
        template,
        payload,
      },
    });
  }

  async enqueueOrderConfirmation(input: {
    recipient: string;
    orderNo: string;
    total: number;
    paymentMethod: string;
  }): Promise<void> {
    await this.enqueueEmail(input.recipient, 'order-confirmation', input);
  }

  async enqueueOrderStatus(input: {
    recipient: string;
    orderNo: string;
    status: string;
  }): Promise<void> {
    await this.enqueueEmail(input.recipient, 'order-status', input);
  }
}
