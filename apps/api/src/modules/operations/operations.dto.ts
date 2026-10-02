import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { AdminPageDto } from '../admin/admin.dto.js';
export class ReviewQueueDto extends AdminPageDto {
  @IsOptional() @IsIn(['PENDING','APPROVED','HIDDEN']) status?: 'PENDING' | 'APPROVED' | 'HIDDEN';
}
export class ModerateReviewDto {
  @IsUUID() reviewId: string;
  @IsIn(['APPROVED','HIDDEN']) status: 'APPROVED' | 'HIDDEN';
}
export class CreateCouponDto {
  @IsString() @Length(3,40) @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value) code: string;
  @IsString() @Length(3,120) name: string;
  @IsIn(['PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING']) type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) value: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) minOrder: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) maxDiscount?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) usageLimit?: number | null;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) usagePerUser: number;
  @IsDateString({ strict: true }) startsAt: string;
  @IsDateString({ strict: true }) expiresAt: string;
}
export class CouponStatusDto { @IsUUID() couponId: string; @IsBoolean() active: boolean; }
export class ConfirmTransferDto {
  @IsUUID() orderId: string;
  @IsString() @Length(3,120) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) providerRef: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) expectedTotal: number;
}
