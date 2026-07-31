import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { WhatsappClicksService } from '../whatsapp-clicks/whatsapp-clicks.service';
import { ProductsService } from './products.service';

type MockedPrisma = {
  product: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  productImage: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  category: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

function buildPrismaMock(): MockedPrisma {
  const prisma: MockedPrisma = {
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productImage: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Suporta tanto `$transaction([...])` (usado em list/mine) quanto
  // `$transaction(async (tx) => {...})` (usado em create/update), passando
  // o proprio mock como `tx` (mesmos mocks de product/productImage).
  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    if (typeof arg === 'function') {
      return (arg as (tx: MockedPrisma) => Promise<unknown>)(prisma);
    }
    return Promise.resolve(arg);
  });

  return prisma;
}

// IDs em formato uuid (o service rejeita ids com formato invalido antes de
// consultar o banco, tratando-os como 404 — ver UUID_REGEX em products.service.ts).
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CONDO_PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const NEW_PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONDO_1_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('ProductsService', () => {
  let prisma: MockedPrisma;
  let uploadsService: jest.Mocked<UploadsService>;
  let whatsappClicksService: jest.Mocked<WhatsappClicksService>;
  let service: ProductsService;

  const userA: AuthenticatedUser = {
    id: USER_A_ID,
    condominiumId: CONDO_1_ID,
    email: 'a@example.com',
    role: 'resident',
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    uploadsService = {
      validatePhotos: jest.fn(),
      saveAll: jest.fn(),
      deleteAll: jest.fn(),
      filenameFromUrl: jest.fn(),
    } as unknown as jest.Mocked<UploadsService>;
    whatsappClicksService = {
      buildUrl: jest.fn(),
      recordClick: jest.fn(),
    } as unknown as jest.Mocked<WhatsappClicksService>;

    service = new ProductsService(
      prisma as unknown as PrismaService,
      uploadsService,
      whatsappClicksService,
    );
  });

  describe('isolamento entre condominios', () => {
    it('retorna 404 ao buscar detalhe de produto de outro condominio', async () => {
      // A query real ja filtra por condominium_id = req.user.condominiumId;
      // simulamos o banco simplesmente nao encontrando a linha.
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.detail(userA, OTHER_CONDO_PRODUCT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: OTHER_CONDO_PRODUCT_ID,
            condominiumId: userA.condominiumId,
            deletedAt: null,
          }),
        }),
      );
    });

    it('retorna 404 no whatsapp-click de produto de outro condominio', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.whatsappClick(userA, OTHER_CONDO_PRODUCT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(whatsappClicksService.recordClick).not.toHaveBeenCalled();
    });
  });

  describe('bloqueio de edicao de produto de outro dono', () => {
    const productOfOtherOwner = {
      id: PRODUCT_ID,
      sellerId: USER_B_ID,
      condominiumId: CONDO_1_ID,
      categoryId: CATEGORY_ID,
      name: 'Bicicleta',
      description: 'Usada',
      priceCents: 1000,
      status: 'available',
      createdAt: new Date(),
      category: { id: CATEGORY_ID, name: 'Esporte' },
      images: [{ id: 'img-1', url: 'http://x/img1.jpg', position: 0 }],
      seller: { id: USER_B_ID, fullName: 'Bruno Souza' },
    };

    it('retorna 403 ao tentar editar anuncio de outro morador do mesmo condominio', async () => {
      prisma.product.findFirst.mockResolvedValue(productOfOtherOwner);

      await expect(
        service.update(userA, PRODUCT_ID, { name: 'Novo nome' }, undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('retorna 403 ao tentar excluir anuncio de outro morador', async () => {
      prisma.product.findFirst.mockResolvedValue(productOfOtherOwner);

      await expect(service.remove(userA, PRODUCT_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('retorna 403 ao tentar mudar status de anuncio de outro morador', async () => {
      prisma.product.findFirst.mockResolvedValue(productOfOtherOwner);

      await expect(
        service.updateStatus(userA, PRODUCT_ID, { status: 'sold' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

  describe('regra de pelo menos 1 foto ao criar produto', () => {
    it('rejeita a criacao quando nenhuma foto e enviada', async () => {
      uploadsService.validatePhotos.mockImplementation(() => {
        throw new BadRequestException('Envie pelo menos 1 foto.');
      });

      const dto = {
        name: 'Bicicleta aro 26',
        description: 'Usada, poucos riscos',
        categoryId: CATEGORY_ID,
        priceCents: 45000,
      };

      await expect(service.create(userA, dto, [])).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadsService.validatePhotos).toHaveBeenCalledWith([]);
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(uploadsService.saveAll).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cria o produto quando pelo menos 1 foto valida e enviada', async () => {
      const file = {
        originalname: 'foto.jpg',
        mimetype: 'image/jpeg',
        size: 1000,
      } as Express.Multer.File;
      uploadsService.validatePhotos.mockReturnValue([file]);
      uploadsService.saveAll.mockResolvedValue([
        { url: 'http://localhost:3000/uploads/foto.jpg', filename: 'foto.jpg' },
      ]);
      prisma.category.findUnique.mockResolvedValue({ id: CATEGORY_ID });
      prisma.product.create.mockResolvedValue({
        id: NEW_PRODUCT_ID,
        sellerId: userA.id,
        condominiumId: userA.condominiumId,
        name: 'Bicicleta aro 26',
        description: 'Usada, poucos riscos',
        priceCents: 45000,
        status: 'available',
        createdAt: new Date(),
        category: { id: CATEGORY_ID, name: 'Esporte' },
        images: [{ id: 'img-2', url: 'http://localhost:3000/uploads/foto.jpg', position: 0 }],
        seller: { id: userA.id, fullName: 'Ana Paula' },
      });

      const dto = {
        name: 'Bicicleta aro 26',
        description: 'Usada, poucos riscos',
        categoryId: CATEGORY_ID,
        priceCents: 45000,
      };

      const result = await service.create(userA, dto, [file]);

      expect(result.isOwner).toBe(true);
      expect(result.images).toHaveLength(1);
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sellerId: userA.id,
            condominiumId: userA.condominiumId,
          }),
        }),
      );
    });
  });

  describe('resposta de detalhe/listagem nunca expoe dados sensiveis', () => {
    it('detalhe nunca inclui whatsapp/sellerId/block/apartment do vendedor', async () => {
      prisma.product.findFirst.mockResolvedValue({
        id: PRODUCT_ID,
        sellerId: userA.id,
        condominiumId: userA.condominiumId,
        name: 'Bicicleta',
        description: 'Usada',
        priceCents: 1000,
        status: 'available',
        createdAt: new Date(),
        category: { id: CATEGORY_ID, name: 'Esporte' },
        images: [{ id: 'img-1', url: 'http://x/img1.jpg', position: 0 }],
        seller: { id: userA.id, fullName: 'Ana Paula' },
      });

      const result = await service.detail(userA, PRODUCT_ID);

      expect(result.seller).toEqual({ firstName: 'Ana' });
      expect(result).not.toHaveProperty('sellerId');
      expect(result).not.toHaveProperty('whatsapp');
      expect(result).not.toHaveProperty('condominiumId');
    });
  });
});
