import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
export class ReviewProductDto { @IsUUID() productId: string; }
export class ReviewListDto extends ReviewProductDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) pageSize = 5;
}
export class CreateReviewDto {
  @IsUUID() orderItemId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @Length(3, 3000) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value) comment: string;
}
