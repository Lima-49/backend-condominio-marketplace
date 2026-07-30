-- Seed de categorias (dado de referencia global, fixo no MVP).
-- Migration separada da migration de schema, conforme
-- docs/architecture/DATABASE_MODEL.md ("Seeds: categories deve ter uma
-- migration de seed separada, nao misturada com a migration de schema").
INSERT INTO "categories" ("id", "name", "slug") VALUES
  (gen_random_uuid(), 'Eletronicos', 'eletronicos'),
  (gen_random_uuid(), 'Moveis', 'moveis'),
  (gen_random_uuid(), 'Roupas', 'roupas'),
  (gen_random_uuid(), 'Infantil', 'infantil'),
  (gen_random_uuid(), 'Esporte', 'esporte'),
  (gen_random_uuid(), 'Outros', 'outros')
ON CONFLICT ("slug") DO NOTHING;
