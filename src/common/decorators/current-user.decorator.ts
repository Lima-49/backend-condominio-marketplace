import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Extrai `req.user` (ja validado pelo JwtAuthGuard) nos controllers.
 * Nunca usar `condominiumId` vindo de outro lugar (body/query) — sempre
 * deste decorator, que reflete o token JWT.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
