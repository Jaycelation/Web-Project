import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutLineDto {
  @IsUUID()
  variantId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

export class ShippingAddressDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => String(value).trim())
  fullName: string;

  @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ.' })
  phone: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsString()
  @Length(3, 180)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @IsString()
  @Length(2, 100)
  district: string;

  @IsString()
  @Length(2, 100)
  province: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country = 'VN';
}

export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items: CheckoutLineDto[];

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsIn(['COD', 'BANK_TRANSFER'])
  paymentMethod: 'COD' | 'BANK_TRANSFER';

  @IsOptional()
  @IsString()
  @Length(3, 40)
  @Transform(({ value }) => String(value).trim().toUpperCase())
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;

  @IsOptional()
  @IsUUID()
  guestSessionId?: string;
}

export class CheckoutQuoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  items: CheckoutLineDto[];

  @IsOptional()
  @IsString()
  @Length(3, 40)
  @Transform(({ value }) => String(value).trim().toUpperCase())
  couponCode?: string;
}
