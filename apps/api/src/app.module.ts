import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { OriginGuard } from './common/guards/origin.guard.js';
import { SecureEnvelopeGuard } from './common/guards/secure-envelope.guard.js';
import { AllExceptionsFilter } from './infrastructure/crypto-envelope/all-exceptions.filter.js';
import { CryptoEnvelopeModule } from './infrastructure/crypto-envelope/crypto-envelope.module.js';
import { SecureResponseInterceptor } from './infrastructure/crypto-envelope/secure-response.interceptor.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CheckoutModule } from './modules/checkout/checkout.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { MarketingModule } from './modules/marketing/marketing.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CryptoEnvelopeModule,
    NotificationsModule,
    MarketingModule,
    AuthModule,
    AccountModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    ReviewsModule,
    OperationsModule,
    AdminModule,
    ContentModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SecureEnvelopeGuard },
    { provide: APP_INTERCEPTOR, useClass: SecureResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
