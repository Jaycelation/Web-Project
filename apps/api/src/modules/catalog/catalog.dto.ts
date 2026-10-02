import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsUUID,
  ArrayMaxSize,
  ArrayUnique,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CatalogSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => String(value).trim())
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @Max(2147483647)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @Max(2147483647)
  maxPrice?: number;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc', 'popular'])
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  pageSize = 12;
}

export class ProductDetailDto {
  @IsString()
  @MaxLength(160)
  slug: string;
}

export class CatalogSelectionDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds: string[];
}
