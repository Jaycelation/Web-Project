import { Body, Controller, Post } from '@nestjs/common';
import { CatalogSearchDto, ProductDetailDto } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('search')
  search(@Body() dto: CatalogSearchDto) {
    return this.catalog.search(dto);
  }

  @Post('detail')
  detail(@Body() dto: ProductDetailDto) {
    return this.catalog.detail(dto.slug);
  }
}
