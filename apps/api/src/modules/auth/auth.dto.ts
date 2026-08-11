import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 80)
  @Transform(({ value }) => String(value).trim())
  name: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+?84|0)\d{9,10}$/u, { message: 'Số điện thoại không hợp lệ.' })
  phone?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/[A-Z]/u, { message: 'Mật khẩu cần ít nhất một chữ hoa.' })
  @Matches(/[a-z]/u, { message: 'Mật khẩu cần ít nhất một chữ thường.' })
  @Matches(/\d/u, { message: 'Mật khẩu cần ít nhất một chữ số.' })
  password: string;
}

export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  token: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/[A-Z]/u)
  @Matches(/[a-z]/u)
  @Matches(/\d/u)
  password: string;
}
