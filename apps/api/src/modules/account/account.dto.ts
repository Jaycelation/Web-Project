import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @Length(2, 80)
  @Transform(({ value }) => String(value).trim())
  name: string;

  @IsOptional()
  @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ.' })
  phone?: string;
}

export class AddressInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @Length(1, 40)
  label: string;

  @IsString()
  @Length(2, 100)
  fullName: string;

  @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ.' })
  phone: string;

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

  @IsOptional()
  @IsBoolean()
  isDefault = false;
}

export class AddressIdDto {
  @IsUUID()
  addressId: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/[A-Z]/u)
  @Matches(/[a-z]/u)
  @Matches(/\d/u)
  newPassword: string;
}
