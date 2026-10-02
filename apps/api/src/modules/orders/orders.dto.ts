import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { OrderStatus } from '@secure-commerce/contracts';

export class OrderIdDto {
  @IsUUID()
  orderId: string;
}

export class OrderListDto {
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
  @Max(50)
  pageSize = 10;
}

export class TrackOrderDto {
  @IsString()
  @MaxLength(40)
  @Transform(({ value }) => String(value).trim().toUpperCase())
  orderNo: string;

  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;
}

export class CancelOrderDto extends OrderIdDto {
  @IsString()
  @MaxLength(300)
  reason: string;
}

export class ReturnOrderDto extends OrderIdDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

const ORDER_STATUSES: OrderStatus[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'SHIPPING',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'REFUNDED',
];

export class AdminOrderListDto extends OrderListDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;
}

export class UpdateOrderStatusDto extends OrderIdDto {
  @IsIn(ORDER_STATUSES)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrl?: string;
}
