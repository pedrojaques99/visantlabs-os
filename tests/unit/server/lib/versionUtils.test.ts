import { describe, it, expect } from 'vitest';
import { calculateChangedFields, createSnapshot } from '@server/lib/versionUtils';

// `strategy` was missing from TRACKABLE_FIELDS, so a strategy-only ingest told the
// user "No new brand data was found in this source" *after* writing the data, and
// snapshots silently omitted strategy so restore-version couldn't bring it back.

describe('calculateChangedFields', () => {
  it('detects a strategy-only change', () => {
    const changed = calculateChangedFields(
      { identity: { name: 'Urban Stay' } } as any,
      { identity: { name: 'Urban Stay' }, strategy: { manifesto: 'A cidade pinta.' } } as any
    );
    expect(changed).toContain('strategy');
  });

  it('reports nothing when strategy is untouched', () => {
    const same = { strategy: { manifesto: 'A cidade pinta.' } } as any;
    expect(calculateChangedFields(same, same)).toEqual([]);
  });

  it('detects a nested strategy edit', () => {
    const changed = calculateChangedFields(
      {
        strategy: { coreMessage: { product: 'Hospedagem', differential: 'a', emotionalBond: 'b' } },
      } as any,
      {
        strategy: {
          coreMessage: { product: 'Hospedagem urbana', differential: 'a', emotionalBond: 'b' },
        },
      } as any
    );
    expect(changed).toEqual(['strategy']);
  });
});

describe('createSnapshot', () => {
  it('includes strategy, so restore-version can actually restore it', () => {
    const snap = createSnapshot({
      identity: { name: 'Urban Stay' },
      strategy: { manifesto: 'A cidade pinta.' },
    } as any);
    expect(snap.strategy).toEqual({ manifesto: 'A cidade pinta.' });
  });

  it('deep clones, so later mutation of the guideline cannot rewrite history', () => {
    const guideline = { strategy: { manifesto: 'original' } } as any;
    const snap = createSnapshot(guideline);
    guideline.strategy.manifesto = 'mutated';
    expect((snap.strategy as any).manifesto).toBe('original');
  });
});
