import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AdminController } from './admin.controller';
import { AdminCategoriesService } from './services/admin-categories.service';
import { AdminMetricsService } from './services/admin-metrics.service';

/**
 * Teste de integracao leve do controller (sem banco real): simula o que o
 * JwtAuthGuard global faria (popular `req.user` a partir do token) usando um
 * header de teste, para exercitar o RolesGuard real aplicado no controller
 * (docs/product/ADMIN_DASHBOARD.md H1: resident -> 403, platform_admin -> 200).
 */
class FakeJwtAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.headers['x-test-role'];
    if (!role) {
      return false;
    }
    request.user = {
      id: 'user-1',
      condominiumId: 'condo-1',
      email: 'user@example.com',
      role,
    } satisfies AuthenticatedUser;
    return true;
  }
}

describe('AdminController (guards)', () => {
  let app: INestApplication;
  let metricsService: jest.Mocked<AdminMetricsService>;
  let categoriesService: jest.Mocked<AdminCategoriesService>;

  beforeAll(async () => {
    metricsService = {
      usersByCondominium: jest.fn().mockResolvedValue([]),
      topCategories: jest.fn().mockResolvedValue([]),
      productsPerUser: jest.fn().mockResolvedValue({ average: 0, topUsers: [] }),
    } as unknown as jest.Mocked<AdminMetricsService>;
    categoriesService = {
      create: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Nova', slug: 'nova' }),
    } as unknown as jest.Mocked<AdminCategoriesService>;

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminMetricsService, useValue: metricsService },
        { provide: AdminCategoriesService, useValue: categoriesService },
        { provide: APP_GUARD, useClass: FakeJwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna 403 para usuario resident em qualquer rota do painel', async () => {
    await request(app.getHttpServer())
      .get('/admin/metrics/users-by-condominium')
      .set('x-test-role', 'resident')
      .expect(403);

    await request(app.getHttpServer())
      .post('/admin/categories')
      .set('x-test-role', 'resident')
      .send({ name: 'Categoria Nova' })
      .expect(403);
  });

  it('permite acesso para usuario platform_admin', async () => {
    await request(app.getHttpServer())
      .get('/admin/metrics/users-by-condominium')
      .set('x-test-role', 'platform_admin')
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/metrics/top-categories')
      .set('x-test-role', 'platform_admin')
      .expect(200);

    await request(app.getHttpServer())
      .get('/admin/metrics/products-per-user')
      .set('x-test-role', 'platform_admin')
      .expect(200);
  });
});
