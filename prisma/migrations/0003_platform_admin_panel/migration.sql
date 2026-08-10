-- Migration: papel platform_admin + suporte ao painel administrativo
-- Contexto: docs/product/ADMIN_DASHBOARD.md (aprovado pelo dono do produto em
-- 2026-07-30), docs/product/DECISIONS_LOG.md entradas #9 e #10.
-- Escrita manualmente (mesmo padrao de 0001_init/0002_seed_categories,
-- ver comentario no topo de prisma/schema.prisma) porque inclui CHECK
-- constraint, indices parciais e uma funcao imutavel auxiliar que o DSL do
-- Prisma nao expressa.
-- Fonte de verdade de regras de negocio: docs/architecture/ADMIN_DASHBOARD_DB.md

-- =============================================================================
-- 1) users.role
-- =============================================================================
-- ADD COLUMN ... DEFAULT ... NOT NULL preenche implicitamente todas as linhas
-- ja existentes com 'resident' no momento do ALTER TABLE (Postgres >= 11 nao
-- reescreve a tabela para um default constante, e nao exige UPDATE separado).
ALTER TABLE "users"
  ADD COLUMN "role" VARCHAR NOT NULL DEFAULT 'resident';

-- Mesmo padrao ja usado em products.status: varchar + CHECK em vez de ENUM
-- nativo, para permitir adicionar valores futuros (ex.: um eventual
-- "condo_admin"/sindico) sem ALTER TYPE.
ALTER TABLE "users"
  ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('resident', 'platform_admin'));

-- POST /auth/register nunca deve aceitar 'role' no body (ignorado pelo
-- ValidationPipe no DTO, nao apenas pelo default do banco) — reforco de
-- aplicacao, nao de banco; o default aqui e so a rede de seguranca final.

-- Indice para as 3 agregacoes do painel que depende de role:
--   (a) usuarios por condominio, filtrando role = 'resident';
--   (b) card "residents vs platform_admin".
-- Leading column = role porque toda query relevante filtra role antes de
-- agrupar/contar por condominio; index scan em role = 'resident' cobre (a),
-- e um GROUP BY role simples cobre (b) com o mesmo indice.
CREATE INDEX "idx_users_role_condominium" ON "users"("role", "condominium_id");

-- =============================================================================
-- 2) products: indices para agregacao global (cross-condominio) do painel
-- =============================================================================
-- Os indices existentes de products (idx_products_condominium_status_created,
-- idx_products_condominium_category, idx_products_seller_id) sao todos
-- compostos com condominium_id como parte da chave (idx_products_seller_id
-- nao tem condominium_id, mas tem status, o que nao ajuda a agregacao global
-- por category_id/seller_id ignorando status). Nenhum serve bem as queries
-- GROUP BY category_id / GROUP BY seller_id cruzando todos os condominios.
-- Novos indices parciais, no mesmo padrao ja usado no projeto
-- (WHERE deleted_at IS NULL, consistente com soft delete):
CREATE INDEX "idx_products_category_active" ON "products"("category_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "idx_products_seller_active" ON "products"("seller_id")
  WHERE "deleted_at" IS NULL;

-- Qualquer um dos dois indices acima tambem serve, via index-only scan, para
-- o COUNT(*) global de "produtos nao excluidos" usado no denominador da
-- media de anuncios por usuario (H4).

-- =============================================================================
-- 3) categories: reforco de unicidade case/acento/espaco-insensitive (H5)
-- =============================================================================
-- unique(slug) ja existe desde 0001_init e continua sendo a garantia
-- primaria, assumindo que o backend gera o slug de forma deterministica e
-- normalizada a partir do nome (lowercase, sem acento, trim, espacos->hifen)
-- antes do INSERT em POST /admin/categories.
--
-- Defesa em profundidade (ver risco documentado em ADMIN_DASHBOARD.md,
-- secao 9: "mitigado pela validacao de nome exigida em H5, mas depende de
-- implementacao correta no service, nao so unique constraint de slug, que
-- pode nao pegar todos os casos de nome quase igual"): um indice unico de
-- expressao sobre o NOME normalizado, independente de qualquer bug na
-- geracao do slug pelo service.
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- unaccent() do contrib e STABLE (depende de configuracao de dicionario de
-- texto), nao IMMUTABLE — isso impede seu uso direto em indice de expressao.
-- Wrapper IMMUTABLE e o padrao recomendado pela propria documentacao do
-- Postgres para esse caso (assume-se que a config de unaccent nao muda em
-- producao, premissa razoavel para este projeto).
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS $$
    SELECT unaccent('unaccent', $1);
  $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE UNIQUE INDEX "idx_categories_name_normalized_unique" ON "categories" (
  lower(immutable_unaccent(regexp_replace(btrim("name"), '\s+', ' ', 'g')))
);

-- Efeito pratico: "Eletronicos", " eletrônicos ", "ELETRÔNICOS" e
-- "Eletronicos  " colidem todos no mesmo valor normalizado e o INSERT falha
-- com violacao de unique constraint (23505), que o service de
-- POST /admin/categories deve capturar e traduzir para 400 com mensagem
-- amigavel — nao deixar o erro cru de Postgres vazar para o cliente.
