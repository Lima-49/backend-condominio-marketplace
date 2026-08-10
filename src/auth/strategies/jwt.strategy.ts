import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export interface JwtPayload {
  sub: string;
  condominiumId: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'insecure-dev-secret',
    });
  }

  // O retorno vira `req.user`. Nunca inclui passwordHash/block/apartment
  // porque esses campos nunca sao colocados no payload do token.
  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub || !payload?.condominiumId) {
      throw new UnauthorizedException('Token invalido.');
    }
    return {
      id: payload.sub,
      condominiumId: payload.condominiumId,
      email: payload.email,
      // Tokens emitidos antes da migration 0003 (role no payload) nao tem
      // esse claim; tratamos como 'resident' (nunca abre acesso admin por
      // omissao) ate o usuario logar de novo e receber um token com role.
      role: (payload.role as AuthenticatedUser['role']) ?? 'resident',
    };
  }
}
