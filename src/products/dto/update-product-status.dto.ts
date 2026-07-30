import { IsIn } from 'class-validator';

// `inactive` nao e aceito aqui de proposito (reservado para moderacao
// futura) — API_SPEC.md secao 4, PATCH /products/:id/status.
export const SETTABLE_PRODUCT_STATUSES = ['available', 'reserved', 'sold'] as const;
export type SettableProductStatus = (typeof SETTABLE_PRODUCT_STATUSES)[number];

export class UpdateProductStatusDto {
  @IsIn(SETTABLE_PRODUCT_STATUSES, {
    message: 'status deve ser um de: available, reserved, sold',
  })
  status!: SettableProductStatus;
}
