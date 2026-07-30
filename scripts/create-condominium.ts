/**
 * Cadastro manual de condominio (piloto).
 * Decisao do PO (docs/product/DECISIONS_LOG.md, item 1): nao ha tela/endpoint
 * de autoatendimento no MVP. Onboarding de um novo condominio e feito pelo
 * time via este script.
 *
 * Uso: npm run condominium:create -- "Nome do Condominio"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Uso: npm run condominium:create -- "Nome do Condominio"');
    process.exit(1);
  }

  const slug = slugify(name);
  const condominium = await prisma.condominium.create({
    data: { name, slug },
  });

  console.log('Condominio criado:');
  console.log(`  id:   ${condominium.id}`);
  console.log(`  name: ${condominium.name}`);
  console.log(`  slug: ${condominium.slug}`);
}

main()
  .catch((error) => {
    console.error('Falha ao criar condominio:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
