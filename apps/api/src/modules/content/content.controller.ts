import { Body, Controller, Post } from '@nestjs/common';
import { ContentPageRequestDto } from './content.dto.js';
import { ContentService } from './content.service.js';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Post('page')
  page(@Body() dto: ContentPageRequestDto) {
    return this.content.page(dto.slug);
  }
}
