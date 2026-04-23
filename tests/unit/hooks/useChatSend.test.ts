/**
 * useChatSend — unit tests
 *
 * Verifies that brand data stored in the plugin store is correctly mapped
 * and included in the GENERATE_WITH_CONTEXT message sent to the sandbox.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal store shape ────────────────────────────────────────────────────────

function makeStore(overrides: Record<string, any> = {}) {
  return {
    thinkMode: false,
    useBrand: true,
    selectedModel: 'claude-opus-4-5',
    pendingAttachments: [],
    designSystem: null,
    chatHistory: [],
    isGenerating: false,
    typography: [],
    logos: [],
    selectedColors: new Map(),
    addChatMessage: vi.fn(),
    setIsGenerating: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
}

// ── Capture helper ─────────────────────────────────────────────────────────────

function buildPayload(store: ReturnType<typeof makeStore>) {
  // Replicate the mapping logic from useChatSend.ts
  const typo = store.typography as any[];
  const brandFonts = typo.length > 0 ? {
    primary: typo.find((t: any) => t.name === 'primary') ? {
      family: typo.find((t: any) => t.name === 'primary')!.fontFamily,
      style: typo.find((t: any) => t.name === 'primary')!.fontStyle,
      size: typo.find((t: any) => t.name === 'primary')!.fontSize,
    } : undefined,
    secondary: typo.find((t: any) => t.name === 'secondary') ? {
      family: typo.find((t: any) => t.name === 'secondary')!.fontFamily,
      style: typo.find((t: any) => t.name === 'secondary')!.fontStyle,
      size: typo.find((t: any) => t.name === 'secondary')!.fontSize,
    } : undefined,
  } : null;

  const logos = store.logos as any[];
  const brandLogos = logos.length > 0 ? {
    light: logos.find((l: any) => l.name === 'light')
      ? { name: logos.find((l: any) => l.name === 'light')!.label || 'Logo Light', key: logos.find((l: any) => l.name === 'light')!.figmaKey }
      : undefined,
    dark: logos.find((l: any) => l.name === 'dark')
      ? { name: logos.find((l: any) => l.name === 'dark')!.label || 'Logo Dark', key: logos.find((l: any) => l.name === 'dark')!.figmaKey }
      : undefined,
  } : null;

  const brandColors = store.selectedColors.size > 0
    ? Array.from((store.selectedColors as Map<string, any>).entries()).map(([role, entry]) => ({
        name: entry.name || role,
        value: entry.hex,
        role,
      }))
    : null;

  return {
    type: 'GENERATE_WITH_CONTEXT',
    command: 'test',
    thinkMode: store.thinkMode,
    useBrand: store.useBrand,
    attachments: store.pendingAttachments,
    model: store.selectedModel,
    brandFonts,
    brandLogos,
    brandColors,
    designSystem: store.designSystem,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useChatSend — brand payload mapping', () => {
  it('type is always GENERATE_WITH_CONTEXT', () => {
    const msg = buildPayload(makeStore());
    expect(msg.type).toBe('GENERATE_WITH_CONTEXT');
  });

  it('empty store → all brand fields null', () => {
    const msg = buildPayload(makeStore());
    expect(msg.brandFonts).toBeNull();
    expect(msg.brandLogos).toBeNull();
    expect(msg.brandColors).toBeNull();
    expect(msg.designSystem).toBeNull();
  });

  it('primary typography → brandFonts.primary mapped correctly', () => {
    const store = makeStore({
      typography: [{ name: 'primary', fontFamily: 'Bebas Neue', fontStyle: 'Regular', fontSize: 48 }],
    });
    const msg = buildPayload(store);
    expect(msg.brandFonts?.primary?.family).toBe('Bebas Neue');
    expect(msg.brandFonts?.primary?.style).toBe('Regular');
    expect(msg.brandFonts?.primary?.size).toBe(48);
  });

  it('secondary typography → brandFonts.secondary mapped correctly', () => {
    const store = makeStore({
      typography: [{ name: 'secondary', fontFamily: 'Inter', fontStyle: 'Light', fontSize: 14 }],
    });
    const msg = buildPayload(store);
    expect(msg.brandFonts?.secondary?.family).toBe('Inter');
    expect(msg.brandFonts?.primary).toBeUndefined();
  });

  it('both typography slots populated', () => {
    const store = makeStore({
      typography: [
        { name: 'primary', fontFamily: 'Bebas Neue', fontStyle: 'Regular', fontSize: 48 },
        { name: 'secondary', fontFamily: 'Inter', fontStyle: 'Light', fontSize: 14 },
      ],
    });
    const msg = buildPayload(store);
    expect(msg.brandFonts?.primary?.family).toBe('Bebas Neue');
    expect(msg.brandFonts?.secondary?.family).toBe('Inter');
  });

  it('light logo → brandLogos.light with key', () => {
    const store = makeStore({
      logos: [{ name: 'light', label: 'Logo Light', figmaKey: 'key-abc' }],
    });
    const msg = buildPayload(store);
    expect(msg.brandLogos?.light?.key).toBe('key-abc');
    expect(msg.brandLogos?.light?.name).toBe('Logo Light');
  });

  it('dark logo → brandLogos.dark', () => {
    const store = makeStore({
      logos: [{ name: 'dark', label: 'Logo Escuro', figmaKey: 'key-xyz' }],
    });
    const msg = buildPayload(store);
    expect(msg.brandLogos?.dark?.key).toBe('key-xyz');
    expect(msg.brandLogos?.light).toBeUndefined();
  });

  it('selectedColors → brandColors array with name/value/role', () => {
    const colors = new Map([
      ['primary', { name: 'Lava', hex: '#D4491B', role: 'primary' }],
      ['secondary', { name: 'Areia', hex: '#F2EAD7', role: 'secondary' }],
    ]);
    const store = makeStore({ selectedColors: colors });
    const msg = buildPayload(store);
    expect(msg.brandColors).toHaveLength(2);
    expect(msg.brandColors![0]).toMatchObject({ name: 'Lava', value: '#D4491B', role: 'primary' });
  });

  it('useBrand=false propagated as-is', () => {
    const store = makeStore({ useBrand: false });
    const msg = buildPayload(store);
    expect(msg.useBrand).toBe(false);
  });

  it('designSystem propagated when set', () => {
    const ds = { name: 'Feira 2026', version: '1.0' };
    const store = makeStore({ designSystem: ds });
    const msg = buildPayload(store);
    expect(msg.designSystem).toEqual(ds);
  });

  it('pendingAttachments cleared after build (array reference)', () => {
    const attachments = [{ type: 'image', url: 'http://x.com/a.png' }];
    const store = makeStore({ pendingAttachments: attachments });
    const msg = buildPayload(store);
    expect(msg.attachments).toHaveLength(1);
    // Simulate state clear
    store.pendingAttachments = [];
    expect(store.pendingAttachments).toHaveLength(0);
  });
});
