// GET /admin/metrics/top-categories (docs/product/ADMIN_DASHBOARD.md H3).
// Conta anuncios com deleted_at IS NULL, qualquer status; inclui categorias
// com productCount = 0 (nunca somem do ranking).
export class TopCategoryItemDto {
  categoryId!: string;
  categoryName!: string;
  productCount!: number;
}
