import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { collapseWhitespace, slugify } from '../../common/utils/slugify.util';

const PRISMA_UNIQUE_CONSTRAINT_ERROR = 'P2002';

/**
 * POST /admin/categories (docs/product/ADMIN_DASHBOARD.md H5). Isolado do
 * `CategoriesService` (usado pelo `GET /categories` publico do morador
 * comum) por organizacao/seguranca — mesmo criterio de isolamento aplicado
 * a `AdminMetricsService` (ver docs/architecture/ADMIN_DASHBOARD_DB.md
 * secao 5), mesmo esta operacao nao envolvendo cross-condominio: categoria
 * e uma entidade global, mas a escrita fica restrita a `platform_admin`.
 */
@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string): Promise<CategoryResponseDto> {
    const normalizedName = collapseWhitespace(name);
    const slug = slugify(normalizedName);

    if (!slug) {
      throw this.invalidNameError();
    }

    // Checagem otimista antes do INSERT (melhor mensagem de erro, evita
    // depender so do erro cru do Postgres) usando a MESMA expressao de
    // normalizacao do indice unico da migration 0003_platform_admin_panel
    // (docs/architecture/ADMIN_DASHBOARD_DB.md secao 4) — evita qualquer
    // divergencia entre a normalizacao em JS (slugify.util.ts) e a normalizacao
    // em SQL (immutable_unaccent) na hora de decidir "e duplicado ou nao".
    const duplicate = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM categories
      WHERE lower(immutable_unaccent(regexp_replace(btrim(name), '\s+', ' ', 'g')))
          = lower(immutable_unaccent(regexp_replace(btrim(${normalizedName}), '\s+', ' ', 'g')))
      LIMIT 1
    `;
    if (duplicate.length > 0) {
      throw this.duplicateNameError();
    }

    try {
      return await this.prisma.category.create({
        data: { name: normalizedName, slug },
        select: { id: true, name: true, slug: true },
      });
    } catch (error) {
      // Defesa em profundidade: se, por uma corrida entre a checagem acima
      // e o INSERT, outra requisicao criar a mesma categoria primeiro, o
      // indice unico de expressao do banco (idx_categories_name_normalized_unique)
      // rejeita e o Postgres devolve 23505 -> Prisma mapeia para P2002 aqui.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === PRISMA_UNIQUE_CONSTRAINT_ERROR) {
        throw this.duplicateNameError();
      }
      throw error;
    }
  }

  private duplicateNameError(): BadRequestException {
    const message = 'Ja existe uma categoria com esse nome.';
    return new BadRequestException({
      message,
      details: [{ field: 'name', message }],
    });
  }

  private invalidNameError(): BadRequestException {
    const message = 'Informe um nome de categoria valido.';
    return new BadRequestException({
      message,
      details: [{ field: 'name', message }],
    });
  }
}
