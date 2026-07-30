export class ProductCategoryDto {
  id!: string;
  name!: string;
}

// GET /products, GET /products/mine — nunca inclui description, sellerId,
// whatsapp, block, apartment ou condominiumId (API_SPEC.md secao 4).
export class ProductListItemDto {
  id!: string;
  name!: string;
  priceCents!: number;
  status!: string;
  category!: ProductCategoryDto;
  coverImageUrl!: string | null;
  createdAt!: string;
}

export class ProductImageDto {
  id!: string;
  url!: string;
  position!: number;
}

export class ProductSellerDto {
  firstName!: string;
}

// GET /products/:id, POST /products, PATCH /products/:id,
// PATCH /products/:id/status — nunca inclui whatsapp/email/block/apartment
// ou o id real do vendedor (sellerId).
export class ProductDetailDto {
  id!: string;
  name!: string;
  description!: string;
  priceCents!: number;
  status!: string;
  category!: ProductCategoryDto;
  images!: ProductImageDto[];
  seller!: ProductSellerDto;
  createdAt!: string;
  isOwner!: boolean;
}

export class PaginationMetaDto {
  page!: number;
  limit!: number;
  total!: number;
}

export class PaginatedProductsDto {
  data!: ProductListItemDto[];
  meta!: PaginationMetaDto;
}
