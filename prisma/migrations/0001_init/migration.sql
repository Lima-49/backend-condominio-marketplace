-- Migration inicial — Vitrine do Condominio
-- Escrita manualmente (nao gerada por `prisma migrate dev`) porque o schema
-- Prisma nao expressa: extensoes, CHECK constraints, coluna gerada (STORED),
-- indices GIN de pg_trgm e indices parciais (WHERE ...).
-- Fonte de verdade de regras de negocio: docs/architecture/DATABASE_MODEL.md
-- Ordem: condominiums -> users -> categories -> products (+search_text+indices)
-- -> product_images -> whatsapp_clicks (conforme recomendado no doc acima).

-- Extensoes ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- condominiums --------------------------------------------------------------
CREATE TABLE "condominiums" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "condominiums_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "condominiums_slug_key" ON "condominiums"("slug");

-- users -----------------------------------------------------------------
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condominium_id" UUID NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "whatsapp" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "password_hash" VARCHAR NOT NULL,
    "block" VARCHAR NOT NULL,
    "apartment" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_id_condominium_id_key" ON "users"("id", "condominium_id");
CREATE INDEX "idx_users_condominium_id" ON "users"("condominium_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_condominium_id_fkey"
  FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- categories --------------------------------------------------------------
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- products ------------------------------------------------------------------
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "condominium_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_cents_check" CHECK ("price_cents" >= 0),
    CONSTRAINT "products_status_check" CHECK ("status" IN ('available', 'reserved', 'sold', 'inactive'))
);

-- Coluna gerada para suportar busca por trigram (name + description)
ALTER TABLE "products"
  ADD COLUMN "search_text" TEXT
  GENERATED ALWAYS AS (coalesce("name", '') || ' ' || coalesce("description", '')) STORED;

CREATE UNIQUE INDEX "products_id_condominium_id_key" ON "products"("id", "condominium_id");

CREATE INDEX "idx_products_condominium_status_created"
  ON "products"("condominium_id", "status", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX "idx_products_condominium_category"
  ON "products"("condominium_id", "category_id")
  WHERE "deleted_at" IS NULL;

CREATE INDEX "idx_products_seller_id" ON "products"("seller_id", "status");

CREATE INDEX "idx_products_search_trgm" ON "products" USING gin ("search_text" gin_trgm_ops);

ALTER TABLE "products"
  ADD CONSTRAINT "products_condominium_id_fkey"
  FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK composta: impede fisicamente produto com condominium_id diferente do
-- condominio real do vendedor.
ALTER TABLE "products"
  ADD CONSTRAINT "products_seller_id_condominium_id_fkey"
  FOREIGN KEY ("seller_id", "condominium_id") REFERENCES "users"("id", "condominium_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- product_images --------------------------------------------------------------
CREATE TABLE "product_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_product_images_product_id" ON "product_images"("product_id", "position");

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- whatsapp_clicks --------------------------------------------------------------
CREATE TABLE "whatsapp_clicks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "condominium_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "whatsapp_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_whatsapp_clicks_product_id" ON "whatsapp_clicks"("product_id");
CREATE INDEX "idx_whatsapp_clicks_condominium_id_created" ON "whatsapp_clicks"("condominium_id", "created_at");

ALTER TABLE "whatsapp_clicks"
  ADD CONSTRAINT "whatsapp_clicks_condominium_id_fkey"
  FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- FKs compostas: forcam que produto, comprador e vendedor pertencam todos
-- ao mesmo condominio do registro de clique (isolamento reforcado no banco).
ALTER TABLE "whatsapp_clicks"
  ADD CONSTRAINT "whatsapp_clicks_product_id_condominium_id_fkey"
  FOREIGN KEY ("product_id", "condominium_id") REFERENCES "products"("id", "condominium_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_clicks"
  ADD CONSTRAINT "whatsapp_clicks_buyer_id_condominium_id_fkey"
  FOREIGN KEY ("buyer_id", "condominium_id") REFERENCES "users"("id", "condominium_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_clicks"
  ADD CONSTRAINT "whatsapp_clicks_seller_id_condominium_id_fkey"
  FOREIGN KEY ("seller_id", "condominium_id") REFERENCES "users"("id", "condominium_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
