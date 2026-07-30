import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CondominiumsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForDropdown() {
    // Nunca inclui `slug` no payload — API_SPEC.md secao 2 (GET /condominiums).
    const condominiums = await this.prisma.condominium.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return condominiums;
  }

  existsById(id: string) {
    return this.prisma.condominium.findUnique({ where: { id }, select: { id: true } });
  }
}
