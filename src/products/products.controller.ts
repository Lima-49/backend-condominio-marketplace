import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedProductsDto, ProductDetailDto } from './dto/product-response.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const PHOTOS_INTERCEPTOR_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
};

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedProductsDto> {
    return this.productsService.list(user, query);
  }

  @Get('mine')
  async mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedProductsDto> {
    return this.productsService.mine(user, query);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos', 5, PHOTOS_INTERCEPTOR_OPTIONS))
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @UploadedFiles() photos: Express.Multer.File[],
  ): Promise<ProductDetailDto> {
    return this.productsService.create(user, dto, photos);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProductDetailDto> {
    return this.productsService.detail(user, id);
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('photos', 5, PHOTOS_INTERCEPTOR_OPTIONS))
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() photos: Express.Multer.File[] | undefined,
  ): Promise<ProductDetailDto> {
    return this.productsService.update(user, id, dto, photos);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
  ): Promise<ProductDetailDto> {
    return this.productsService.updateStatus(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.productsService.remove(user, id);
  }

  @Post(':id/whatsapp-click')
  @HttpCode(HttpStatus.OK)
  async whatsappClick(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ url: string }> {
    return this.productsService.whatsappClick(user, id);
  }
}
