import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsTrue, MaxLength } from 'class-validator';

export class SubscribeDto {
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsBoolean()
  @IsTrue({ message: 'Cần đồng ý nhận thông tin marketing.' })
  consent: boolean;
}
