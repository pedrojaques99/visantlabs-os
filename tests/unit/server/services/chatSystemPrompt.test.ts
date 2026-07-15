import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '@server/services/chat/chatSessionHandlers';

// The chat injects only a `minimal` brand summary and expects the model to call
// get_brand_context for anything else. That trade only holds if the prompt says
// so — otherwise the model reads a partial brand as the whole brand and answers
// about voice or strategy from context that no longer carries them. The notice
// isn't decoration; it's the half of the change that prevents a correctness bug.

const memory: any = { brands: [], clients: [], decisions: [], references: [] };

describe('chat system prompt — partial brand context', () => {
  it('says the summary is partial and names the tool that completes it', () => {
    const prompt = buildSystemPrompt(memory, 'BRAND: Urban Stay\nCOLORS: #000', '');

    expect(prompt).toContain('Urban Stay');
    expect(prompt).toMatch(/parcial/i);
    expect(prompt).toContain('get_brand_context');
  });

  it('names the presets, so the model can ask for the right slice', () => {
    const prompt = buildSystemPrompt(memory, 'BRAND: Urban Stay', '');
    for (const preset of ['copy', 'visual', 'imageGen', 'full']) {
      expect(prompt).toContain(preset);
    }
  });

  it('tells the model not to answer past the summary without fetching', () => {
    const prompt = buildSystemPrompt(memory, 'BRAND: Urban Stay', '');
    expect(prompt).toMatch(/não responda sobre o que não está acima sem buscar antes/i);
  });

  it('says none of it when there is no brand linked', () => {
    // No brand → no header, no partial-context notice. Otherwise a brandless
    // session carries instructions about a brand that isn't there.
    const prompt = buildSystemPrompt(memory, '', '');
    expect(prompt).not.toContain('CONTEXTO DE MARCA (resumo');
    expect(prompt).not.toMatch(/parcial/i);
  });
});
