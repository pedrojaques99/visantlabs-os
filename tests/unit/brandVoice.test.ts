import { describe, it, expect } from 'vitest';
import {
  selectBrandVoice,
  daysSince,
  CONNECT_FLOOR,
  IDLE_DAYS,
  SEASONAL_HORIZON_DAYS,
  type BrandVoiceInput,
} from '@/lib/brandVoice';

const NOW = new Date('2026-08-18T12:00:00.000Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

/** Marca saudável: passa por todas as regras e cai no fallback. */
const base = (over: Partial<BrandVoiceInput> = {}): BrandVoiceInput => ({
  brandName: 'BOXY',
  hasLogo: true,
  isConnected: true,
  completeness: 87,
  topGapLabel: null,
  pieceCount: 12,
  lastPieceAt: daysAgo(1),
  seasonal: null,
  now: NOW,
  ...over,
});

describe('daysSince', () => {
  it('conta dias inteiros', () => {
    expect(daysSince(daysAgo(11), NOW)).toBe(11);
  });

  it('devolve null pra data ausente ou inválida', () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince('não é data', NOW)).toBeNull();
  });

  it('não devolve negativo quando o relógio do servidor está adiantado', () => {
    expect(daysSince(new Date(NOW + 60_000).toISOString(), NOW)).toBe(0);
  });
});

describe('selectBrandVoice — prioridade', () => {
  it('sem logo vence tudo', () => {
    const v = selectBrandVoice(
      base({ hasLogo: false, pieceCount: 0, isConnected: false, completeness: 10 })
    );
    expect(v.key).toBe('noLogo');
    expect(v.params.brand).toBe('BOXY');
  });

  it('sem peça vem antes de sazonal', () => {
    const v = selectBrandVoice(
      base({ pieceCount: 0, seasonal: { key: 'fathers', label: 'Dia dos Pais', daysAway: 5 } })
    );
    expect(v.key).toBe('noPieces');
  });

  it('sazonal na janela vence conectar, porque expira', () => {
    const v = selectBrandVoice(
      base({
        isConnected: false,
        completeness: 90,
        seasonal: { key: 'fathers', label: 'Dia dos Pais', daysAway: SEASONAL_HORIZON_DAYS },
      })
    );
    expect(v.key).toBe('seasonal');
    expect(v.params.days).toBe(SEASONAL_HORIZON_DAYS);
    expect(v.params.label).toBe('Dia dos Pais');
  });

  it('sazonal fora da janela não dispara', () => {
    const v = selectBrandVoice(
      base({
        isConnected: false,
        completeness: 90,
        seasonal: { key: 'xmas', label: 'Natal', daysAway: SEASONAL_HORIZON_DAYS + 1 },
      })
    );
    expect(v.key).toBe('notConnected');
  });

  it('não empurra conectar pra marca abaixo do piso', () => {
    const v = selectBrandVoice(
      base({ isConnected: false, completeness: CONNECT_FLOOR - 1, topGapLabel: 'Tokens' })
    );
    expect(v.key).toBe('gap');
    expect(v.params.gap).toBe('Tokens');
  });

  it('parada dispara a partir do piso de dias', () => {
    const v = selectBrandVoice(base({ lastPieceAt: daysAgo(IDLE_DAYS) }));
    expect(v.key).toBe('idle');
    expect(v.params.days).toBe(IDLE_DAYS);
  });

  it('parada não dispara um dia antes do piso', () => {
    const v = selectBrandVoice(base({ lastPieceAt: daysAgo(IDLE_DAYS - 1) }));
    expect(v.key).toBe('neutral');
  });

  it('sem data de peça, nunca inventa "0 dias parada"', () => {
    const v = selectBrandVoice(base({ lastPieceAt: null, topGapLabel: null }));
    expect(v.key).toBe('neutral');
    expect(v.params.count).toBe(12);
  });

  it('fallback carrega número real, nunca frase genérica', () => {
    const v = selectBrandVoice(base({ pieceCount: 3 }));
    expect(v.key).toBe('neutral');
    expect(v.params.count).toBe(3);
  });
});

describe('selectBrandVoice — portão do plano', () => {
  /**
   * Portão 1 do plano: marcas em estados diferentes não podem receber a mesma
   * frase por falta de sinal. Cinco estados reais, cinco chaves distintas.
   */
  it('cinco marcas em estados diferentes recebem cinco frases diferentes', () => {
    const keys = [
      selectBrandVoice(base({ hasLogo: false })),
      selectBrandVoice(base({ pieceCount: 0 })),
      selectBrandVoice(
        base({ seasonal: { key: 'blackfriday', label: 'Black Friday', daysAway: 9 } })
      ),
      selectBrandVoice(base({ isConnected: false, completeness: 88 })),
      selectBrandVoice(base({ lastPieceAt: daysAgo(30) })),
    ].map((v) => v.key);

    expect(new Set(keys).size).toBe(5);
  });

  /** Portão 3: marca recém-criada continua dizendo algo verdadeiro. */
  it('marca vazia não cai em branco', () => {
    const v = selectBrandVoice({
      brandName: 'Nova',
      hasLogo: false,
      isConnected: false,
      completeness: 0,
      topGapLabel: null,
      pieceCount: 0,
      lastPieceAt: null,
      seasonal: null,
      now: NOW,
    });
    expect(v.key).toBe('noLogo');
    expect(v.params.brand).toBe('Nova');
  });
});
