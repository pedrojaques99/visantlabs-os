import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ONBOARDING_PERSONAS,
  PRIVILEGED_USER_CATEGORIES,
  resolveOnboardingPersona,
} from '../onboardingPersona.js';

describe('resolveOnboardingPersona', () => {
  it('accepts every persona the wizard offers', () => {
    for (const p of ONBOARDING_PERSONAS) expect(resolveOnboardingPersona(p)).toBe(p);
    expect(resolveOnboardingPersona(' Designer ')).toBe('designer');
  });

  it('rejects privileged categories and anything unknown', () => {
    for (const c of ['tester', 'team', 'admin', 'TEAM', 'staff', '', 'designer;team']) {
      expect(resolveOnboardingPersona(c)).toBeNull();
    }
    expect(resolveOnboardingPersona(undefined)).toBeNull();
    expect(resolveOnboardingPersona(null)).toBeNull();
    expect(resolveOnboardingPersona({ $ne: null })).toBeNull();
    expect(resolveOnboardingPersona(['designer'])).toBeNull();
  });

  it('no persona is ever a privileged category', () => {
    for (const p of ONBOARDING_PERSONAS) expect(PRIVILEGED_USER_CATEGORIES.has(p)).toBe(false);
  });

  it('matches the ids in the onboarding UI (drift guard)', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../../src/components/onboarding/onboardingSegments.ts'),
      'utf8'
    );
    const ids = [...src.matchAll(/^\s*id:\s*'([^']+)'/gm)].map((m) => m[1]);
    expect(ids.sort()).toEqual([...ONBOARDING_PERSONAS].sort());
  });
});
