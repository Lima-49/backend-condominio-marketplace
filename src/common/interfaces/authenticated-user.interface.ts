/**
 * Papeis de usuario suportados (`users.role`, CHECK constraint na migration
 * 0003_platform_admin_panel). `resident` e o default de todo cadastro via
 * `/auth/register`; `platform_admin` so e atribuido manualmente pelo time
 * (docs/product/ADMIN_DASHBOARD.md H1).
 */
export type UserRole = 'resident' | 'platform_admin';

/**
 * Formato de `req.user` injetado pelo JwtAuthGuard/JwtStrategy a partir do
 * payload do token (docs/architecture/API_SPEC.md secao 1.1).
 * Nunca contem passwordHash, block ou apartment.
 */
export interface AuthenticatedUser {
  id: string;
  condominiumId: string;
  email: string;
  role: UserRole;
}
