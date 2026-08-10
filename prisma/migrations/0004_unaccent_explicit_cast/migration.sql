-- Migration: cast explicito para regdictionary em immutable_unaccent
-- Contexto: ao aplicar 0003_platform_admin_panel no branch homol do Neon
-- (projeto recriado em 2026-08-10 apos o branch anterior ter sido deletado),
-- a forma `unaccent('unaccent', $1)` (cast implicito de unknown para
-- regdictionary durante a inlining da funcao SQL) falhou de forma
-- intermitente com "function unaccent(unknown, text) does not exist"
-- (SQLSTATE 42883) em varias tentativas seguidas, mesmo com a extensao ja
-- instalada e comprovadamente funcional em queries isoladas. Nao foi
-- possivel confirmar a causa raiz exata (suspeita: alguma particularidade
-- do compute serverless do Neon na resolucao do cast implicito durante
-- inlining), mas o cast explicito abaixo se mostrou estavel em testes
-- repetidos no mesmo ambiente onde a forma implicita falhava.
--
-- CREATE OR REPLACE FUNCTION e idempotente: em ambientes onde 0003 ja
-- rodou sem problema (dev local) isso so re-declara a funcao de forma
-- equivalente, sem quebrar nada.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS $$
    SELECT public.unaccent('public.unaccent'::regdictionary, $1);
  $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
