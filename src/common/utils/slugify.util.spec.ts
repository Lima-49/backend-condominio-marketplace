import { collapseWhitespace, normalizeCategoryName, slugify } from './slugify.util';

describe('slugify.util', () => {
  describe('normalizeCategoryName', () => {
    it('trata nomes com acento/caixa/espaco diferentes como equivalentes', () => {
      const variants = ['Eletronicos', ' eletrônicos ', 'ELETRÔNICOS', 'Eletronicos  '];
      const normalized = variants.map(normalizeCategoryName);

      expect(new Set(normalized).size).toBe(1);
    });

    it('colapsa espacos internos multiplos', () => {
      expect(normalizeCategoryName('Casa   e   Jardim')).toBe('casa e jardim');
    });
  });

  describe('slugify', () => {
    it('gera slug em kebab-case sem acento', () => {
      expect(slugify('Móveis e Decoração')).toBe('moveis-e-decoracao');
    });

    it('trima espacos nas pontas antes de gerar o slug', () => {
      expect(slugify('  Livros  ')).toBe('livros');
    });
  });

  describe('collapseWhitespace', () => {
    it('remove espacos nas pontas e colapsa espacos internos', () => {
      expect(collapseWhitespace('  a   b   c ')).toBe('a b c');
    });
  });
});
