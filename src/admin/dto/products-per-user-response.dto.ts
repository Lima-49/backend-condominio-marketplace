// GET /admin/metrics/products-per-user (docs/product/ADMIN_DASHBOARD.md H4).
export class TopUserDto {
  userId!: string;
  fullName!: string;
  condominiumName!: string;
  productCount!: number;
}

export class ProductsPerUserResponseDto {
  // total de anuncios nao excluidos / total de usuarios com role = resident.
  // 0 quando nao ha nenhum resident cadastrado ainda (nunca NaN/Infinity).
  average!: number;
  topUsers!: TopUserDto[];
}
