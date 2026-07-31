// GET /admin/metrics/users-by-condominium (docs/product/ADMIN_DASHBOARD.md H2).
// Contagem considera so role = 'resident' (contas platform_admin nunca
// contam como "morador cadastrado" — regra de negocio 7 do mesmo documento).
export class UsersByCondominiumItemDto {
  condominiumId!: string;
  condominiumName!: string;
  userCount!: number;
}
