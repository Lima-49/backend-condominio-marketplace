/**
 * Seed de conveniencia para ambiente local.
 * A fonte de verdade do seed de categorias e a migration
 * `prisma/migrations/0002_seed_categories/migration.sql` (aplicada por
 * `prisma migrate deploy`). Este script existe apenas para reexecutar o
 * seed de forma idempotente em bancos ja existentes (ex.: `npm run prisma:seed`).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Eletronicos', slug: 'eletronicos' },
  { name: 'Moveis', slug: 'moveis' },
  { name: 'Roupas', slug: 'roupas' },
  { name: 'Infantil', slug: 'infantil' },
  { name: 'Esporte', slug: 'esporte' },
  { name: 'Outros', slug: 'outros' },
];

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
  // eslint-disable-next-line no-console
  console.log('Seed de categorias concluido.');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
