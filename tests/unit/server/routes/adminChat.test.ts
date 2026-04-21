import { describe, it, expect } from 'vitest';

// Test stripAction indirectly via its signature behavior — we re-export from module
// Pure function: strips [ACTION: ... { ... }] blocks and trims. Must be null-safe
// because the LLM router can return an empty/undefined text when only tool calls are produced.

// Import the helper from the route file. stripAction is not exported — so we re-implement
// the assertion by calling the function through a thin wrapper. Since the function is
// module-private, we rely on dynamic import + vitest internals would require exposing it.
// Simplest: duplicate the contract test by loading the module and spying on its behavior.
// But duplication is worse than just exporting. We test the contract via the symbol.

import { stripAction } from '../../../../server/routes/adminChat.js';

describe('stripAction', () => {
  it('returns empty string when reply is undefined', () => {
    expect(stripAction(undefined)).toBe('');
  });

  it('returns empty string when reply is null', () => {
    expect(stripAction(null)).toBe('');
  });

  it('returns empty string when reply is empty', () => {
    expect(stripAction('')).toBe('');
  });

  it('removes [ACTION: ...] blocks and trims', () => {
    const input = 'Aqui está a proposta.\n[ACTION: generate_mockup {"prompt": "logo"}]\nFim.';
    expect(stripAction(input)).toBe('Aqui está a proposta.\n\nFim.');
  });

  it('returns plain text unchanged', () => {
    expect(stripAction('  hello world  ')).toBe('hello world');
  });
});
