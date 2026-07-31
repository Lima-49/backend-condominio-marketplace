import { PrismaService } from '../../prisma/prisma.service';
import { AdminMetricsService } from './admin-metrics.service';

type MockedPrisma = {
  condominium: { findMany: jest.Mock };
  category: { findMany: jest.Mock };
  user: { groupBy: jest.Mock; count: jest.Mock; findMany: jest.Mock };
  product: { groupBy: jest.Mock; count: jest.Mock };
};

function buildPrismaMock(): MockedPrisma {
  return {
    condominium: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
    user: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    product: { groupBy: jest.fn(), count: jest.fn() },
  };
}

const CONDO_A = { id: 'condo-a', name: 'Condominio A' };
const CONDO_B = { id: 'condo-b', name: 'Condominio B' };

const CATEGORY_ELETRONICOS = { id: 'cat-eletronicos', name: 'Eletronicos' };
const CATEGORY_LIVROS = { id: 'cat-livros', name: 'Livros' };

describe('AdminMetricsService', () => {
  let prisma: MockedPrisma;
  let service: AdminMetricsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AdminMetricsService(prisma as unknown as PrismaService);
  });

  describe('usersByCondominium (H2)', () => {
    it('inclui condominios com 0 usuarios e ignora contas platform_admin', async () => {
      prisma.condominium.findMany.mockResolvedValue([CONDO_A, CONDO_B]);
      // So o condominio A tem residents; B nao tem nenhum -> deve aparecer com 0.
      prisma.user.groupBy.mockResolvedValue([
        { condominiumId: CONDO_A.id, _count: { _all: 5 } },
      ]);

      const result = await service.usersByCondominium();

      expect(prisma.user.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'resident' } }),
      );
      expect(result).toEqual([
        { condominiumId: CONDO_A.id, condominiumName: CONDO_A.name, userCount: 5 },
        { condominiumId: CONDO_B.id, condominiumName: CONDO_B.name, userCount: 0 },
      ]);
    });

    it('ordena decrescente por contagem de usuarios, com mais de um condominio', async () => {
      prisma.condominium.findMany.mockResolvedValue([CONDO_A, CONDO_B]);
      prisma.user.groupBy.mockResolvedValue([
        { condominiumId: CONDO_A.id, _count: { _all: 2 } },
        { condominiumId: CONDO_B.id, _count: { _all: 9 } },
      ]);

      const result = await service.usersByCondominium();

      expect(result.map((r) => r.condominiumId)).toEqual([CONDO_B.id, CONDO_A.id]);
    });

    it('funciona corretamente com um unico condominio (nao e erro nem vazio)', async () => {
      prisma.condominium.findMany.mockResolvedValue([CONDO_A]);
      prisma.user.groupBy.mockResolvedValue([{ condominiumId: CONDO_A.id, _count: { _all: 3 } }]);

      const result = await service.usersByCondominium();

      expect(result).toEqual([{ condominiumId: CONDO_A.id, condominiumName: CONDO_A.name, userCount: 3 }]);
    });
  });

  describe('topCategories (H3)', () => {
    it('inclui categorias com 0 anuncios e filtra deleted_at IS NULL', async () => {
      prisma.category.findMany.mockResolvedValue([CATEGORY_ELETRONICOS, CATEGORY_LIVROS]);
      prisma.product.groupBy.mockResolvedValue([
        { categoryId: CATEGORY_ELETRONICOS.id, _count: { _all: 4 } },
      ]);

      const result = await service.topCategories();

      expect(prisma.product.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
      expect(result).toEqual([
        { categoryId: CATEGORY_ELETRONICOS.id, categoryName: CATEGORY_ELETRONICOS.name, productCount: 4 },
        { categoryId: CATEGORY_LIVROS.id, categoryName: CATEGORY_LIVROS.name, productCount: 0 },
      ]);
    });
  });

  describe('productsPerUser (H4)', () => {
    it('calcula a media global e o ranking dos top usuarios, combinando dados de mais de um condominio', async () => {
      prisma.product.count.mockResolvedValue(9);
      prisma.user.count.mockResolvedValue(3);
      prisma.product.groupBy.mockResolvedValue([
        { sellerId: 'user-1', _count: { sellerId: 6 } },
        { sellerId: 'user-2', _count: { sellerId: 3 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', fullName: 'Ana Paula', condominium: { name: CONDO_A.name } },
        { id: 'user-2', fullName: 'Bruno Souza', condominium: { name: CONDO_B.name } },
      ]);

      const result = await service.productsPerUser();

      expect(result.average).toBe(3);
      expect(result.topUsers).toEqual([
        { userId: 'user-1', fullName: 'Ana Paula', condominiumName: CONDO_A.name, productCount: 6 },
        { userId: 'user-2', fullName: 'Bruno Souza', condominiumName: CONDO_B.name, productCount: 3 },
      ]);
    });

    it('retorna media 0 (nunca NaN/Infinity) quando nao ha nenhum resident cadastrado', async () => {
      prisma.product.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(0);
      prisma.product.groupBy.mockResolvedValue([]);

      const result = await service.productsPerUser();

      expect(result.average).toBe(0);
      expect(result.topUsers).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
