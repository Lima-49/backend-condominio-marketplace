import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(role: string | undefined): ExecutionContext {
  const request = { user: role ? { id: 'u1', condominiumId: 'c1', email: 'a@a.com', role } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('bloqueia com 403 um usuario resident em rota que exige platform_admin', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['platform_admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(buildContext('resident'))).toThrow(ForbiddenException);
  });

  it('permite acesso de um usuario platform_admin em rota que exige platform_admin', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['platform_admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext('platform_admin'))).toBe(true);
  });

  it('deixa passar quando a rota nao declara @Roles(...)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext('resident'))).toBe(true);
  });

  it('bloqueia quando nao ha usuario autenticado no request', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['platform_admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
