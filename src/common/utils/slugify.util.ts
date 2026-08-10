/**
 * Normalizacao de nome de categoria compartilhada pelo modulo `admin`
 * (POST /admin/categories). Mantida deliberadamente equivalente (mesmo
 * efeito pratico) a expressao SQL do indice unico criado na migration
 * 0003_platform_admin_panel:
 *
 *   lower(immutable_unaccent(regexp_replace(btrim(name), '\s+', ' ', 'g')))
 *
 * (docs/architecture/ADMIN_DASHBOARD_DB.md secao 4). Nao e a garantia final
 * de unicidade (essa vem do banco); e usada aqui so para gerar um `slug`
 * deterministico e para uma checagem otimista antes do INSERT (melhor
 * mensagem de erro, ver AdminCategoriesService).
 */

/** trim + colapsa espacos internos multiplos em um so, preservando acentos/caixa. */
export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Remove acentos/diacriticos (equivalente pratico ao unaccent() do Postgres). */
const COMBINING_DIACRITICS_REGEX = /[̀-ͯ]/g;

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(COMBINING_DIACRITICS_REGEX, '');
}

/** Mesma normalizacao usada para comparar duplicidade (case/acento/espaco-insensitive). */
export function normalizeCategoryName(value: string): string {
  return stripDiacritics(collapseWhitespace(value)).toLowerCase();
}

/** Gera um slug em kebab-case a partir do nome (sem acento, minusculo, hifens). */
export function slugify(value: string): string {
  return normalizeCategoryName(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
