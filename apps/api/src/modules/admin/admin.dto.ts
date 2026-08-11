import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;
}

export class AdminProductListDto extends AdminPageDto {
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'HIDDEN'])
  status?: 'DRAFT' | 'ACTIVE' | 'HIDDEN';
}

export class ProductImageInputDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @IsString()
  @MaxLength(200)
  alt: string;
}

export class ProductVariantInputDto {
  @IsString()
  @Length(2, 80)
  @Transform(({ value }) => String(value).trim().toUpperCase())
  sku: string;

  @IsString()
  @Length(1, 120)
  name: string;

  @IsObject()
  attributes: Record<string, string>;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold = 5;
}

export class CreateProductDto {
  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsString()
  @Length(2, 160)
  slug: string;

  @IsString()
  @Length(2, 80)
  skuBase: string;

  @IsString()
  @Length(2, 180)
  name: string;

  @IsString()
  @Length(2, 300)
  shortDescription: string;

  @IsString()
  @Length(2, 20_000)
  description: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'HIDDEN'])
  status: 'DRAFT' | 'ACTIVE' | 'HIDDEN' = 'DRAFT';

  @IsOptional()
  @IsBoolean()
  featured = false;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images: ProductImageInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInputDto)
  variants: ProductVariantInputDto[];
}

export class UpdateProductDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 180)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 300)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20_000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  compareAtPrice?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'HIDDEN'])
  status?: 'DRAFT' | 'ACTIVE' | 'HIDDEN';

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class AdjustInventoryDto {
  @IsUUID()
  variantId: string;

  @Type(() => Number)
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  delta: number;

  @IsString()
  @Length(3, 300)
  note: string;
}

export class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;
}

export class CustomerStatusDto {
  @IsUUID()
  userId: string;

  @IsIn(['ACTIVE', 'LOCKED'])
  status: 'ACTIVE' | 'LOCKED';
}

export class ContentSlugDto {
  @IsString()
  @MaxLength(160)
  slug: string;
}

export class UpdateContentDto extends ContentSlugDto {
  @IsString()
  @Length(2, 180)
  title: string;

  @IsString()
  @Length(2, 50_000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  published = true;
}
