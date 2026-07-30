import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SavedFile, UploadsService } from '../uploads/uploads.service';
import { WhatsappClicksService } from '../whatsapp-clicks/whatsapp-clicks.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import {
  PaginatedProductsDto,
  ProductDetailDto,
  ProductListItemDto,
} from './dto/product-response.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_INCLUDE = {
  category: { select: { id: true, name: true } },
  images: { orderBy: { position: 'asc' as const } },
  seller: { select: { id: true, fullName: true } },
};

type ProductWithRelations = {
  id: string;
  sellerId: string;
  condominiumId: string;
  name: string;
  description: string;
  priceCents: number;
  status: string;
  createdAt: Date;
  category: { id: string; name: string };
  images: { id: string; url: string; position: number }[];
  seller: { id: string; fullName: string };
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly whatsappClicksService: WhatsappClicksService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: ListProductsQueryDto,
  ): Promise<PaginatedProductsDto> {
    const where = {
      condominiumId: user.condominiumId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toListItem(row)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async mine(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedProductsDto> {
    const where = {
      condominiumId: user.condominiumId,
      sellerId: user.id,
      deletedAt: null,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toListItem(row)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateProductDto,
    files: Express.Multer.File[] | undefined,
  ): Promise<ProductDetailDto> {
    const validFiles = this.uploadsService.validatePhotos(files);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('categoryId invalido.');
    }

    const saved = await this.uploadsService.saveAll(validFiles);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            sellerId: user.id,
            condominiumId: user.condominiumId,
            categoryId: dto.categoryId,
            name: dto.name,
            description: dto.description,
            priceCents: dto.priceCents,
            status: 'available',
            images: {
              create: saved.map((file, index) => ({ url: file.url, position: index })),
            },
          },
          include: DETAIL_INCLUDE,
        });
        return created;
      });

      return this.toDetail(product, user.id);
    } catch (error) {
      // Regra "pelo menos 1 foto" + transacao: se o insert falhar, nenhuma
      // linha e commitada nem arquivo fica orfao em disco.
      await this.uploadsService.deleteAll(saved.map((file) => file.filename));
      throw error;
    }
  }

  async detail(user: AuthenticatedUser, id: string): Promise<ProductDetailDto> {
    const product = await this.findVisibleOrThrow(user, id);
    return this.toDetail(product, user.id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[] | undefined,
  ): Promise<ProductDetailDto> {
    const product = await this.findOwnedOrThrow(user, id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new BadRequestException('categoryId invalido.');
      }
    }

    let savedFiles: SavedFile[] | null = null;
    if (files && files.length > 0) {
      const validFiles = this.uploadsService.validatePhotos(files);
      savedFiles = await this.uploadsService.saveAll(validFiles);
    }

    const previousImageUrls = product.images.map((image) => image.url);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (savedFiles) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          await tx.productImage.createMany({
            data: savedFiles.map((file, index) => ({
              productId: id,
              url: file.url,
              position: index,
            })),
          });
        }

        return tx.product.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
            ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
          },
          include: DETAIL_INCLUDE,
        });
      });

      if (savedFiles) {
        const filenames = previousImageUrls
          .map((url) => this.uploadsService.filenameFromUrl(url))
          .filter((name): name is string => Boolean(name));
        await this.uploadsService.deleteAll(filenames);
      }

      return this.toDetail(updated, user.id);
    } catch (error) {
      if (savedFiles) {
        await this.uploadsService.deleteAll(savedFiles.map((file) => file.filename));
      }
      throw error;
    }
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProductStatusDto,
  ): Promise<ProductDetailDto> {
    await this.findOwnedOrThrow(user, id);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: dto.status },
      include: DETAIL_INCLUDE,
    });

    return this.toDetail(updated, user.id);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    await this.findOwnedOrThrow(user, id);

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async whatsappClick(user: AuthenticatedUser, id: string): Promise<{ url: string }> {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    const product = await this.prisma.product.findFirst({
      where: { id, condominiumId: user.condominiumId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        sellerId: true,
        condominiumId: true,
        seller: { select: { whatsapp: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    if (product.sellerId === user.id) {
      throw new BadRequestException('Voce nao pode iniciar contato com seu proprio anuncio');
    }

    if (product.status === 'sold') {
      throw new ConflictException('Produto ja vendido');
    }

    await this.whatsappClicksService.recordClick({
      productId: product.id,
      buyerId: user.id,
      sellerId: product.sellerId,
      condominiumId: product.condominiumId,
    });

    const url = this.whatsappClicksService.buildUrl(product.seller.whatsapp, product.name, product.id);
    return { url };
  }

  /** Produto do condominio do usuario, nao excluido. 404 caso contrario (nunca 403). */
  private async findVisibleOrThrow(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ProductWithRelations> {
    // Id com formato invalido nunca pode existir -> mesma resposta (404)
    // de "produto de outro condominio", sem diferenciar o motivo ao client.
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    const product = await this.prisma.product.findFirst({
      where: { id, condominiumId: user.condominiumId, deletedAt: null },
      include: DETAIL_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado.');
    }

    return product;
  }

  /** Alem de visivel, exige que o usuario logado seja o dono (403 caso contrario). */
  private async findOwnedOrThrow(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ProductWithRelations> {
    const product = await this.findVisibleOrThrow(user, id);

    if (product.sellerId !== user.id) {
      throw new ForbiddenException('Voce nao pode alterar um anuncio de outro morador.');
    }

    return product;
  }

  private toListItem(product: ProductWithRelations): ProductListItemDto {
    const cover = product.images[0];
    return {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      status: product.status,
      category: product.category,
      coverImageUrl: cover ? cover.url : null,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private toDetail(product: ProductWithRelations, currentUserId: string): ProductDetailDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceCents: product.priceCents,
      status: product.status,
      category: product.category,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        position: image.position,
      })),
      seller: { firstName: product.seller.fullName.split(' ')[0] },
      createdAt: product.createdAt.toISOString(),
      isOwner: product.sellerId === currentUserId,
    };
  }
}
