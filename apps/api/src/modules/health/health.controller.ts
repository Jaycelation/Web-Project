import { Controller, Get } from '@nestjs/common';
import { AllowPlaintext } from '../../common/decorators/allow-plaintext.decorator.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Controller('health')
@AllowPlaintext()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      service: 'secure-commerce-api',
      timestamp: new Date().toISOString(),
    };
  }
}
