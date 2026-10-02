import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateReviewDto, ReviewListDto, ReviewProductDto } from './reviews.dto.js';
import { ReviewsService } from './reviews.service.js';
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Post('list') list(@Body() dto: ReviewListDto) { return this.reviews.list(dto); }
  @Post('eligible') @UseGuards(JwtAuthGuard)
  eligible(@Body() dto: ReviewProductDto, @CurrentUser() user: AuthenticatedUser) { return this.reviews.eligible(dto.productId, user.id); }
  @Post('create') @UseGuards(JwtAuthGuard, CsrfGuard)
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedUser) { return this.reviews.create(dto, user.id); }
}
