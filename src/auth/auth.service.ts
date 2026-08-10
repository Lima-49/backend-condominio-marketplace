import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto, MeResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly condominiumsService: CondominiumsService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const condominium = await this.condominiumsService.existsById(dto.condominiumId);
    if (!condominium) {
      throw new BadRequestException('Condominio invalido');
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email ja cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.usersService.create({
      fullName: dto.fullName,
      whatsapp: dto.whatsapp,
      condominiumId: dto.condominiumId,
      block: dto.block,
      apartment: dto.apartment,
      email: dto.email,
      passwordHash,
    });

    return this.buildAuthResponse(user.id, user.fullName, user.email, user.condominiumId, user.role);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Nunca revelar se o problema foi email inexistente vs senha errada.
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    return this.buildAuthResponse(user.id, user.fullName, user.email, user.condominiumId, user.role);
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.usersService.findByIdWithCondominium(userId);
    if (!user) {
      throw new UnauthorizedException('Nao autenticado.');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      condominiumId: user.condominiumId,
      condominiumName: user.condominium.name,
      role: user.role,
    };
  }

  private buildAuthResponse(
    id: string,
    fullName: string,
    email: string,
    condominiumId: string,
    role: string,
  ): AuthResponseDto {
    // `role` entra no payload do JWT para os guards do painel admin
    // decidirem acesso sem consultar o banco a cada request
    // (docs/product/ADMIN_DASHBOARD.md secao 7).
    const accessToken = this.jwtService.sign({
      sub: id,
      condominiumId,
      email,
      role,
    });

    return {
      accessToken,
      user: { id, fullName, email, condominiumId, role },
    };
  }
}
