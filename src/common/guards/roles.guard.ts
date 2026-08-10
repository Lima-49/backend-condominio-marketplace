import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Nao e registrado como guard global — so aplicado explicitamente (via
 * `@UseGuards(RolesGuard)`) nos controllers que usam `@Roles(...)`, sempre
 * depois do `JwtAuthGuard` global (que ja populou `req.user`, incluindo
 * `role`, a partir do JWT). Ver docs/product/ADMIN_DASHBOARD.md secao 7.
 *
 * Se o handler/controller nao tiver `@Roles(...)`, deixa passar (nao e um
 * guard de autenticacao, so de autorizacao por papel).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      // Mesma mensagem generica para qualquer role nao autorizado — nunca
      // revela quais roles seriam aceitos.
      throw new ForbiddenException('Acesso restrito.');
    }

    return true;
  }
}
