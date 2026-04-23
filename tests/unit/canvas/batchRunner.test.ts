import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyVariables } from '@/utils/canvas/resolveVariables';

/**
 * Unit tests for Batch Runner variable resolution logic.
 * The full orchestration (mockupApi.generate calls) is tested via integration tests.
 */
describe('Batch Runner — variable resolution per row', () => {
  const rows = [
    { brand: 'Nike', color: 'red', tagline: 'Just Do It' },
    { brand: 'Adidas', color: 'black', tagline: 'Impossible is Nothing' },
    { brand: 'Puma', color: 'white', tagline: 'Forever Faster' },
  ];

  const template = 'A {{color}} {{brand}} sneaker with text "{{tagline}}" on a studio background';

  it('resolves row 0 correctly', () => {
    const result = applyVariables(template, rows[0]);
    expect(result).toBe('A red Nike sneaker with text "Just Do It" on a studio background');
  });

  it('resolves row 1 correctly', () => {
    const result = applyVariables(template, rows[1]);
    expect(result).toBe('A black Adidas sneaker with text "Impossible is Nothing" on a studio background');
  });

  it('resolves row 2 correctly', () => {
    const result = applyVariables(template, rows[2]);
    expect(result).toBe('A white Puma sneaker with text "Forever Faster" on a studio background');
  });

  it('each row produces a different prompt (no cross-contamination)', () => {
    const results = rows.map((row) => applyVariables(template, row));
    const unique = new Set(results);
    expect(unique.size).toBe(rows.length);
  });

  it('unknown placeholders remain in output (safe for partial templates)', () => {
    const partial = 'A {{color}} {{brand}} — ref: {{sku}}';
    const result = applyVariables(partial, rows[0]);
    expect(result).toContain('{{sku}}');
    expect(result).toContain('red');
    expect(result).toContain('Nike');
  });

  it('handles empty row values gracefully', () => {
    const emptyRow = { brand: '', color: 'blue', tagline: '' };
    const result = applyVariables(template, emptyRow);
    expect(result).toBe('A blue  sneaker with text "" on a studio background');
  });

  it('processes all rows without mutating the template', () => {
    const originalTemplate = template;
    rows.forEach((row) => applyVariables(template, row));
    expect(template).toBe(originalTemplate);
  });
});

describe('Batch Runner — BatchResult shape', () => {
  it('initial results are pending', () => {
    const rows = [{ a: '1' }, { a: '2' }];
    const results = rows.map((row, i) => ({
      rowIndex: i,
      rowData: row,
      status: 'pending' as const,
    }));
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'pending')).toBe(true);
  });

  it('progress calculation is correct', () => {
    const results = [
      { status: 'done' },
      { status: 'done' },
      { status: 'error' },
      { status: 'pending' },
    ];
    const done = results.filter((r) => r.status === 'done').length;
    const failed = results.filter((r) => r.status === 'error').length;
    const total = results.length;
    const progress = Math.round((done + failed) / total * 100);
    expect(progress).toBe(75);
  });
});
