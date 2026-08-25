import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, MaxLength } from 'class-validator';

export class SubscribeDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsBoolean()
  @Equals(true, { message: 'Cần đồng ý nhận thông tin marketing.' })
  consent: boolean;
}
