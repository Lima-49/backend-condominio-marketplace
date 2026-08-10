import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriesService } from './services/admin-categories.service';
import { AdminMetricsService } from './services/admin-metrics.service';

// Modulo isolado (docs/architecture/ADMIN_DASHBOARD_DB.md secao 5): nao
// importa ProductsModule/UsersModule nem reaproveita seus services.
@Module({
  controllers: [AdminController],
  providers: [AdminMetricsService, AdminCategoriesService],
})
export class AdminModule {}
