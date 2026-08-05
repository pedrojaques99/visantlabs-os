import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractTextAsMarkdown } from '../figmaRestApi.js';

// The extractor that turns a Figma file into guideline raw material shipped only
// as a plugin button that downloaded a file on the user's machine. This is the
// headless path: same text, any file the token can read, no open tab.

const text = (name: string, characters: string, x: number, y: number) => ({
  type: 'TEXT',
  name,
  characters,
  absoluteBoundingBox: { x, y },
});

const file = {
  name: 'Arbolt Brand',
  document: {
    children: [
      {
        type: 'CANVAS',
        name: 'Estratégia',
        children: [
          {
            type: 'FRAME',
            name: 'Manifesto',
            children: [
              // Deliberately out of reading order in the child list.
              text('sub', 'Plantar é infraestrutura.', 0, 200),
              text('title', 'MANIFESTO', 0, 100),
              text('right', 'Não paisagismo.', 400, 100),
            ],
          },
          {
            type: 'FRAME',
            name: 'Frame 4836', // auto-generated: must not become a heading
            children: [text('t', 'Rastreabilidade da muda à colheita.', 0, 900)],
          },
        ],
      },
      {
        type: 'CANVAS',
        name: 'Rascunhos',
        children: [
          { type: 'FRAME', name: 'Vazio', children: [text('hidden', '   ', 0, 0)] },
          {
            type: 'FRAME',
            name: 'Oculto',
            visible: false,
            children: [text('x', 'NAO_DEVE_APARECER', 0, 0)],
          },
        ],
      },
    ],
  },
};

describe('extractTextAsMarkdown', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => file } as any));
  });

  it('fetches the FULL tree — a depth-limited read stops above every TEXT node', async () => {
    await extractTextAsMarkdown('KEY', 'tok');
    const url = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('/files/KEY');
    expect(url).not.toContain('depth=');
  });

  it('emits text in canvas reading order, not Figma child order', async () => {
    const { markdown } = await extractTextAsMarkdown('KEY', 'tok');
    const iTitle = markdown.indexOf('MANIFESTO');
    const iRight = markdown.indexOf('Não paisagismo.');
    const iSub = markdown.indexOf('Plantar é infraestrutura.');

    expect(iTitle).toBeGreaterThan(-1);
    expect(iTitle).toBeLessThan(iRight); // same row → left before right
    expect(iRight).toBeLessThan(iSub); // higher row before lower row
  });

  it('uses page and frame names as headings, skipping auto-generated ones', async () => {
    const { markdown } = await extractTextAsMarkdown('KEY', 'tok');
    expect(markdown).toContain('# Arbolt Brand');
    expect(markdown).toContain('## Estratégia');
    expect(markdown).toContain('### Manifesto');
    expect(markdown).not.toContain('### Frame 4836');
    // Its text still comes through — only the junk heading is dropped.
    expect(markdown).toContain('Rastreabilidade da muda à colheita.');
  });

  it('skips invisible nodes and pages with nothing but whitespace', async () => {
    const { markdown, pages } = await extractTextAsMarkdown('KEY', 'tok');
    expect(markdown).not.toContain('NAO_DEVE_APARECER');
    expect(pages.map((p) => p.name)).toEqual(['Estratégia']);
  });

  it('reports counts so the caller knows whether the file was worth reading', async () => {
    const out = await extractTextAsMarkdown('KEY', 'tok');
    expect(out.fileName).toBe('Arbolt Brand');
    expect(out.textNodes).toBe(4);
    expect(out.characters).toBeGreaterThan(0);
    expect(out.truncated).toBe(false);
  });

  it('surfaces a Figma API failure instead of returning empty markdown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' } as any)
    );
    await expect(extractTextAsMarkdown('KEY', 'tok')).rejects.toThrow(/403/);
  });
});
