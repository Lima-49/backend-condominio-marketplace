/**
 * Formato de `req.user` injetado pelo JwtAuthGuard/JwtStrategy a partir do
 * payload do token (docs/architecture/API_SPEC.md secao 1.1).
 * Nunca contem passwordHash, block ou apartment.
 */
export interface AuthenticatedUser {
  id: string;
  condominiumId: string;
  email: string;
}
