import { describe, it, expect } from 'vitest';
import {
  matchField,
  buildFields,
  toJson,
  toCsv,
  toMarkdown,
  toHtml,
  sanitizeFilename,
  formatExport,
  type FrameRecord,
  type TextItem,
} from '../../plugin/src/handlers/exportFramesData.format';

const orcamento: TextItem[] = [
  { layer: 'cliente', text: 'Lucas - Estúdio VOLT' },
  { layer: 'valor', text: 'R$4.250' },
  { layer: 'categoria', text: 'Projeto de Branding Completo' },
];

const inlineLabels: TextItem[] = [
  { layer: 'Text', text: 'Cliente: Andressa Noviski' },
  { layer: 'Text', text: 'Total: R$6.350,00' },
];

const siblingLabels: TextItem[] = [
  { layer: 'Text', text: 'Cliente' },
  { layer: 'Text', text: 'João Pereira' },
  { layer: 'Text', text: 'Valor' },
  { layer: 'Text', text: 'R$ 9.800' },
];

describe('matchField', () => {
  it('matches by layer name (strongest signal)', () => {
    expect(matchField('cliente', orcamento)).toBe('Lucas - Estúdio VOLT');
    expect(matchField('valor', orcamento)).toBe('R$4.250');
  });

  it('matches inline "Label: value"', () => {
    expect(matchField('cliente', inlineLabels)).toBe('Andressa Noviski');
  });

  it('matches a sibling label → next text', () => {
    expect(matchField('cliente', siblingLabels)).toBe('João Pereira');
    expect(matchField('valor', siblingLabels)).toBe('R$ 9.800');
  });

  it('falls back to a money heuristic for value-ish fields', () => {
    const items: TextItem[] = [
      { layer: 'Text', text: 'Algum título' },
      { layer: 'Text', text: 'R$ 1.234,56' },
    ];
    expect(matchField('preço', items)).toBe('R$ 1.234,56');
  });

  it('returns undefined when nothing matches', () => {
    expect(matchField('telefone', orcamento)).toBeUndefined();
  });
});

describe('buildFields', () => {
  it('produces a full record with empty strings for misses', () => {
    expect(buildFields(orcamento, ['cliente', 'valor', 'telefone'])).toEqual({
      cliente: 'Lucas - Estúdio VOLT',
      valor: 'R$4.250',
      telefone: '',
    });
  });
});

function rec(name: string, texts: TextItem[], fields?: Record<string, string>): FrameRecord {
  return { id: name, name, width: 100, height: 100, texts, fields };
}

describe('toJson', () => {
  it('emits tabular rows when fields are present, keeping raw texts', () => {
    const r = rec('Orçamento 1', orcamento, buildFields(orcamento, ['cliente', 'valor']));
    const parsed = JSON.parse(toJson([r], ['cliente', 'valor']));
    expect(parsed[0].frame).toBe('Orçamento 1');
    expect(parsed[0].cliente).toBe('Lucas - Estúdio VOLT');
    expect(parsed[0].texts).toContain('R$4.250');
  });

  it('emits id/name/texts when no fields', () => {
    const parsed = JSON.parse(toJson([rec('F1', orcamento)]));
    expect(parsed[0].name).toBe('F1');
    expect(parsed[0].texts).toHaveLength(3);
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM so Excel renders accents', () => {
    const csv = toCsv([rec('F1', orcamento)]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('escapes cells containing commas/quotes/newlines', () => {
    const items: TextItem[] = [{ layer: 'Text', text: 'a, "b", c' }];
    const csv = toCsv([rec('F1', items)]);
    expect(csv).toContain('"a, ""b"", c"');
  });

  it('uses field columns when provided', () => {
    const r = rec('F1', orcamento, buildFields(orcamento, ['cliente', 'valor']));
    const csv = toCsv([r], ['cliente', 'valor']);
    expect(csv).toContain('frame,cliente,valor');
  });
});

describe('toMarkdown', () => {
  it('escapes pipe characters inside table cells', () => {
    const items: TextItem[] = [{ layer: 'x', text: 'a | b' }];
    const r = rec('F1', items, { x: 'a | b' });
    const md = toMarkdown([r], 'Doc', ['x']);
    expect(md).toContain('a \\| b');
  });

  it('renders a section list when no fields', () => {
    const md = toMarkdown([rec('F1', orcamento)], 'Doc');
    expect(md).toContain('## F1');
    expect(md).toContain('- R$4.250');
  });
});

describe('toHtml', () => {
  it('escapes html-sensitive characters', () => {
    const items: TextItem[] = [{ layer: 'x', text: '<script>"&' }];
    const html = toHtml([rec('F1', items)], 'Doc');
    expect(html).toContain('&lt;script&gt;&quot;&amp;');
    expect(html).not.toContain('<script>"&</td>');
  });
});

describe('sanitizeFilename', () => {
  it('strips unsafe characters and collapses underscores', () => {
    expect(sanitizeFilename('Orçamentos / 2026!!')).toBe('Or_amentos_2026');
  });

  it('falls back to "export" for empty input', () => {
    expect(sanitizeFilename('!!!')).toBe('export');
  });
});

describe('formatExport', () => {
  it('returns the right mime type and extension per format', () => {
    const records = [rec('F1', orcamento)];
    expect(formatExport(records, 'json', 'D').mimeType).toBe('application/json');
    expect(formatExport(records, 'csv', 'D').ext).toBe('csv');
    expect(formatExport(records, 'markdown', 'D').ext).toBe('md');
    expect(formatExport(records, 'html', 'D').mimeType).toBe('text/html');
  });
});
