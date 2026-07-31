import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsPerUserResponseDto, TopUserDto } from '../dto/products-per-user-response.dto';
import { TopCategoryItemDto } from '../dto/top-category-response.dto';
import { UsersByCondominiumItemDto } from '../dto/users-by-condominium-response.dto';

const TOP_USERS_LIMIT = 10;

/**
 * Queries de agregacao cross-condominio do painel administrativo
 * (docs/product/ADMIN_DASHBOARD.md H2-H4).
 *
 * Deliberadamente ISOLADO de `ProductsService`/`UsersService` (usados pelo
 * morador comum) — nao compartilha nenhum metodo com eles. Essa e a
 * mitigacao recomendada pelo DB Admin (docs/architecture/ADMIN_DASHBOARD_DB.md
 * secao 5) e pelo PO (ADMIN_DASHBOARD.md secao 9, risco "vazamento
 * cross-condominio por reuso indevido") para reduzir o risco de uma query
 * que ignora `condominium_id` ser reaproveitada, por engano, em uma rota
 * que deveria respeitar o isolamento por condominio.
 *
 * Todas as rotas que chamam este service ja estao atras de JwtAuthGuard +
 * RolesGuard(platform_admin) no AdminController — a excecao a regra de ouro
 * de isolamento por condominio e deliberada e so acontece aqui.
 */
@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  // H2 — usuarios cadastrados por condominio. So conta role = 'resident'
  // (contas platform_admin nunca contam como "morador" — regra de negocio
  // 7 do ADMIN_DASHBOARD.md). Todo condominio aparece, mesmo com 0 usuarios.
  async usersByCondominium(): Promise<UsersByCondominiumItemDto[]> {
    const [condominiums, counts] = await Promise.all([
      this.prisma.condominium.findMany({ select: { id: true, name: true } }),
      this.prisma.user.groupBy({
        by: ['condominiumId'],
        where: { role: 'resident' },
        _count: { _all: true },
      }),
    ]);

    const countByCondominiumId = new Map(counts.map((row) => [row.condominiumId, row._count._all]));

    return condominiums
      .map((condominium) => ({
        condominiumId: condominium.id,
        condominiumName: condominium.name,
        userCount: countByCondominiumId.get(condominium.id) ?? 0,
      }))
      .sort(
        (a, b) => b.userCount - a.userCount || a.condominiumName.localeCompare(b.condominiumName),
      );
  }

  // H3 — ranking de categorias por volume de anuncios ativos
  // (deleted_at IS NULL, qualquer status). Categorias sem anuncio aparecem
  // com productCount = 0, nunca somem do ranking.
  async topCategories(): Promise<TopCategoryItemDto[]> {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true } }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    const countByCategoryId = new Map(counts.map((row) => [row.categoryId, row._count._all]));

    return categories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        productCount: countByCategoryId.get(category.id) ?? 0,
      }))
      .sort(
        (a, b) => b.productCount - a.productCount || a.categoryName.localeCompare(b.categoryName),
      );
  }

  // H4 — media global de anuncios por usuario (total de anuncios nao
  // excluidos / total de usuarios com role = resident) + ranking dos top 10
  // usuarios com mais anuncios. Usuario sem nenhum anuncio nao entra no
  // ranking, mas entra no denominador da media.
  async productsPerUser(): Promise<ProductsPerUserResponseDto> {
    const [totalActiveProducts, totalResidents, topSellers] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'resident' } }),
      this.prisma.product.groupBy({
        by: ['sellerId'],
        where: { deletedAt: null },
        _count: { sellerId: true },
        orderBy: { _count: { sellerId: 'desc' } },
        take: TOP_USERS_LIMIT,
      }),
    ]);

    // Denominador zero so pode acontecer antes do primeiro morador se
    // cadastrar; nunca deixamos vazar NaN/Infinity para o client.
    const average = totalResidents === 0 ? 0 : this.roundToTwoDecimals(totalActiveProducts / totalResidents);

    if (topSellers.length === 0) {
      return { average, topUsers: [] };
    }

    const sellers = await this.prisma.user.findMany({
      where: { id: { in: topSellers.map((row) => row.sellerId) } },
      select: { id: true, fullName: true, condominium: { select: { name: true } } },
    });
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));

    const topUsers = topSellers
      .map((row): TopUserDto | null => {
        const seller = sellerById.get(row.sellerId);
        if (!seller) {
          // Defensivo: vendedor teria que ter sido excluido entre as duas
          // queries (users nao tem soft delete hoje) — nao deve acontecer
          // na pratica, mas nunca deixamos um item quebrado no ranking.
          return null;
        }
        return {
          userId: seller.id,
          fullName: seller.fullName,
          condominiumName: seller.condominium.name,
          productCount: row._count.sellerId,
        };
      })
      .filter((item): item is TopUserDto => item !== null);

    return { average, topUsers };
  }

  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
