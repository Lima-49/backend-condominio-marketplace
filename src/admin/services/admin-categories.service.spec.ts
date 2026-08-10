import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCategoriesService } from './admin-categories.service';

type MockedPrisma = {
  $queryRaw: jest.Mock;
  category: { create: jest.Mock };
};

function buildPrismaMock(): MockedPrisma {
  return {
    $queryRaw: jest.fn(),
    category: { create: jest.fn() },
  };
}

describe('AdminCategoriesService', () => {
  let prisma: MockedPrisma;
  let service: AdminCategoriesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AdminCategoriesService(prisma as unknown as PrismaService);
  });

  it('cria a categoria com slug normalizado gerado no backend', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.category.create.mockResolvedValue({
      id: 'cat-1',
      name: 'Moveis e Decoracao',
      slug: 'moveis-e-decoracao',
    });

    const result = await service.create('  Moveis e Decoracao  ');

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Moveis e Decoracao', slug: 'moveis-e-decoracao' },
      }),
    );
    expect(result).toEqual({ id: 'cat-1', name: 'Moveis e Decoracao', slug: 'moveis-e-decoracao' });
  });

  it('rejeita nome duplicado (case/acento/espaco-insensitive) detectado pela checagem previa', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'existing-cat' }]);

    await expect(service.create('  ELETRÔNICOS  ')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('rejeita nome duplicado detectado so no INSERT (corrida entre checagem e escrita)', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    await expect(service.create('Eletronicos')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mensagem de erro de duplicado nunca vaza detalhe cru do Postgres', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'existing-cat' }]);

    try {
      await service.create('Eletronicos');
      fail('deveria ter lancado BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        details: { field: string; message: string }[];
      };
      expect(response.message).toBe('Ja existe uma categoria com esse nome.');
      expect(response.details).toEqual([
        { field: 'name', message: 'Ja existe uma categoria com esse nome.' },
      ]);
      expect(response.message).not.toMatch(/postgres|sql|constraint/i);
    }
  });

  it('propaga erros inesperados (nao unique constraint) sem mascarar', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const unexpectedError = new Error('conexao com o banco perdida');
    prisma.category.create.mockRejectedValue(unexpectedError);

    await expect(service.create('Categoria Nova')).rejects.toBe(unexpectedError);
  });
});
