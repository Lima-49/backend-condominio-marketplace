import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca uma rota como publica, ou seja, isenta do JwtAuthGuard global.
 * Uso conforme docs/architecture/API_SPEC.md secao 1.1: apenas
 * POST /auth/register, POST /auth/login e GET /condominiums sao publicas.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
