import { describe, it, expect } from 'vitest';
import { getLucideIcon, SUPPORTED_LUCIDE_ICONS } from '@/lib/ui/lucideIcon';

describe('getLucideIcon', () => {
  it('resolve nomes suportados para um componente', () => {
    expect(getLucideIcon('LayoutGrid')).toBeTypeOf('object');
    expect(getLucideIcon('Sparkles')).toBeDefined();
    expect(getLucideIcon('Image')).toBeDefined();
  });

  it('retorna undefined para nome vazio/desconhecido', () => {
    expect(getLucideIcon(undefined)).toBeUndefined();
    expect(getLucideIcon(null)).toBeUndefined();
    expect(getLucideIcon('')).toBeUndefined();
    expect(getLucideIcon('NopeIconThatDoesNotExist')).toBeUndefined();
  });

  it('expõe a lista de nomes suportados (para validar o input do admin)', () => {
    expect(SUPPORTED_LUCIDE_ICONS).toContain('LayoutGrid');
    expect(SUPPORTED_LUCIDE_ICONS.length).toBeGreaterThan(10);
  });
});
