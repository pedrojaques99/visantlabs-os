import { describe, it, expect } from 'vitest';
import { getSeasonalContext, seasonalPromptLine, marketFromLanguage } from '../seasonalContext.js';

describe('seasonalContext', () => {
  it('surfaces Festa Junina in early June for the BR market', () => {
    const ctx = getSeasonalContext(new Date(Date.UTC(2026, 5, 1)), 'BR'); // Jun 1
    const keys = ctx.upcoming.map((e) => e.key);
    expect(keys).toContain('festa-junina');
    expect(keys).toContain('valentines-br'); // Dia dos Namorados (Jun 12)
  });

  it('orders upcoming moments soonest-first', () => {
    const ctx = getSeasonalContext(new Date(Date.UTC(2026, 5, 1)), 'BR');
    const days = ctx.upcoming.map((e) => e.daysAway);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(days.every((d) => d >= 0)).toBe(true);
  });

  it('wraps across year-end (late December sees January New Year)', () => {
    const ctx = getSeasonalContext(new Date(Date.UTC(2026, 11, 30)), 'BR'); // Dec 30
    const ny = ctx.upcoming.find((e) => e.key === 'new-year');
    expect(ny).toBeTruthy();
    expect(ny!.daysAway).toBeLessThanOrEqual(3);
  });

  it('respects the horizon window (nothing far in the future leaks in)', () => {
    const ctx = getSeasonalContext(new Date(Date.UTC(2026, 5, 1)), 'BR', 14); // 2-week horizon
    expect(ctx.upcoming.every((e) => e.daysAway <= 14)).toBe(true);
    // Black Friday (Nov) must NOT appear in a 2-week June window.
    expect(ctx.upcoming.map((e) => e.key)).not.toContain('black-friday');
  });

  it('filters by market (Festa Junina is BR-only, not US)', () => {
    const us = getSeasonalContext(new Date(Date.UTC(2026, 5, 1)), 'US');
    expect(us.upcoming.map((e) => e.key)).not.toContain('festa-junina');
  });

  it('builds an LLM-ready line, empty when nothing is near', () => {
    const ctx = getSeasonalContext(new Date(Date.UTC(2026, 5, 20)), 'BR');
    expect(seasonalPromptLine(ctx)).toMatch(/Upcoming commercial moments/);
    const empty = { market: 'BR' as const, upcoming: [] };
    expect(seasonalPromptLine(empty)).toBe('');
  });

  it('infers market from brand language', () => {
    expect(marketFromLanguage('pt-BR')).toBe('BR');
    expect(marketFromLanguage('en-US')).toBe('US');
    expect(marketFromLanguage('fr')).toBe('GLOBAL');
    expect(marketFromLanguage(undefined)).toBe('GLOBAL');
  });
});
