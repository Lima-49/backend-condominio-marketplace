import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../interfaces/authenticated-user.interface';

export const ROLES_KEY = 'roles';

/**
 * Restringe uma rota (ou controller inteiro) a usuarios cujo `req.user.role`
 * esteja entre os informados. Usado em conjunto com `RolesGuard`
 * (docs/product/ADMIN_DASHBOARD.md secao 7: "guard proprio que verifica
 * req.user.role === 'platform_admin', roda depois do JwtAuthGuard global").
 *
 * Generico o suficiente para um eventual role futuro (ex.: condo_admin/
 * sindico, ja cogitado em ADMIN_DASHBOARD.md secao 2), nao especifico de
 * platform_admin.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
