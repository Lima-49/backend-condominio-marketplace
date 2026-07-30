import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

// `status=inactive` nao e aceito neste endpoint (API_SPEC.md secao 4,
// GET /products) — reservado para moderacao futura.
export const LISTABLE_PRODUCT_STATUSES = ['available', 'reserved', 'sold'] as const;
export type ListableProductStatus = (typeof LISTABLE_PRODUCT_STATUSES)[number];

export class ListProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'categoryId deve ser um uuid valido' })
  categoryId?: string;

  @IsOptional()
  @IsIn(LISTABLE_PRODUCT_STATUSES, {
    message: 'status deve ser um de: available, reserved, sold',
  })
  status?: ListableProductStatus;

  @IsOptional()
  @IsIn(['recent'], { message: 'sort deve ser "recent"' })
  sort?: 'recent';
}
