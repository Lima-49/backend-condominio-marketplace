import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoryResponseDto } from './dto/category-response.dto';

// Protegido pelo JwtAuthGuard global (nao marcado com @Public()) —
// decisao registrada em DECISIONS_LOG.md #7.
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll();
  }
}
