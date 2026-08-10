import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CategoryResponseDto } from '../categories/dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductsPerUserResponseDto } from './dto/products-per-user-response.dto';
import { TopCategoryItemDto } from './dto/top-category-response.dto';
import { UsersByCondominiumItemDto } from './dto/users-by-condominium-response.dto';
import { AdminCategoriesService } from './services/admin-categories.service';
import { AdminMetricsService } from './services/admin-metrics.service';

/**
 * Painel administrativo da plataforma (docs/product/ADMIN_DASHBOARD.md).
 * Protegido pelo JwtAuthGuard global (autenticacao) + RolesGuard aqui
 * (autorizacao: so `platform_admin`). Sem token -> 401 (JwtAuthGuard).
 * Token valido mas role != platform_admin -> 403 (RolesGuard).
 */
@UseGuards(RolesGuard)
@Roles('platform_admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminMetricsService: AdminMetricsService,
    private readonly adminCategoriesService: AdminCategoriesService,
  ) {}

  @Get('metrics/users-by-condominium')
  async usersByCondominium(): Promise<UsersByCondominiumItemDto[]> {
    return this.adminMetricsService.usersByCondominium();
  }

  @Get('metrics/top-categories')
  async topCategories(): Promise<TopCategoryItemDto[]> {
    return this.adminMetricsService.topCategories();
  }

  @Get('metrics/products-per-user')
  async productsPerUser(): Promise<ProductsPerUserResponseDto> {
    return this.adminMetricsService.productsPerUser();
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.adminCategoriesService.create(dto.name);
  }
}
