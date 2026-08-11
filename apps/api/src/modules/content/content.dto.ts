import { IsString, MaxLength } from 'class-validator';

export class ContentPageRequestDto {
  @IsString()
  @MaxLength(160)
  slug: string;
}
