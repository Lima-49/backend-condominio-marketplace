import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateUserInput {
  fullName: string;
  whatsapp: string;
  condominiumId: string;
  block: string;
  apartment: string;
  email: string;
  passwordHash: string;
}

/**
 * Centraliza acesso a tabela `users`. Nunca deve expor `passwordHash`,
 * `block` ou `apartment` para fora da camada de servico/DTOs explicitos —
 * ver docs/architecture/DATABASE_MODEL.md secao "Protecao de dados pessoais".
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdWithCondominium(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { condominium: true },
    });
  }

  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        fullName: input.fullName,
        whatsapp: input.whatsapp,
        condominiumId: input.condominiumId,
        block: input.block,
        apartment: input.apartment,
        email: input.email,
        passwordHash: input.passwordHash,
      },
    });
  }
}
