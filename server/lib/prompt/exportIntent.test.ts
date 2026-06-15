import { describe, it, expect } from 'vitest';
import {
  detectExport,
  detectExportFormat,
  extractExportFields,
  classifyIntent,
} from './classifier';

describe('detectExport', () => {
  it('detects the real-world request from the screenshot', () => {
    expect(
      detectExport(
        'consegue me voltar um json com todos os orçamentos com os dados cliente valor categoria'
      )
    ).toBe(true);
  });

  it('detects explicit export verbs', () => {
    expect(detectExport('exporta os frames em csv')).toBe(true);
    expect(detectExport('baixa uma planilha com os dados')).toBe(true);
    expect(detectExport('me dá um arquivo markdown')).toBe(true);
  });

  it('does not hijack normal create requests', () => {
    expect(detectExport('cria um banner para instagram')).toBe(false);
    expect(detectExport('faz um card de produto')).toBe(false);
  });

  it('requires data context for a bare format word', () => {
    // "json viewer card" should NOT trigger export
    expect(detectExport('cria um card com um json viewer bonito')).toBe(false);
    // but "json + dados" should
    expect(detectExport('um json com os dados dos frames')).toBe(true);
  });
});

describe('detectExportFormat', () => {
  it('maps keywords to formats', () => {
    expect(detectExportFormat('me dá um csv')).toBe('csv');
    expect(detectExportFormat('exporta uma planilha')).toBe('csv');
    expect(detectExportFormat('quero em markdown')).toBe('markdown');
    expect(detectExportFormat('gera um html')).toBe('html');
    expect(detectExportFormat('um json por favor')).toBe('json');
  });

  it('defaults to json', () => {
    expect(detectExportFormat('exporta os dados')).toBe('json');
  });
});

describe('extractExportFields', () => {
  it('extracts quoted field lists', () => {
    expect(extractExportFields('json com os dados "cliente" "valor" "categoria"')).toEqual([
      'cliente',
      'valor',
      'categoria',
    ]);
  });

  it('extracts comma/e-separated lists after a cue word', () => {
    expect(extractExportFields('exporta com os campos cliente, valor e categoria')).toEqual([
      'cliente',
      'valor',
      'categoria',
    ]);
  });

  it('returns empty when no fields are specified', () => {
    expect(extractExportFields('baixa um json de tudo')).toEqual([]);
  });

  it('dedupes case-insensitively', () => {
    expect(extractExportFields('"Cliente" "cliente" "Valor"')).toEqual(['Cliente', 'Valor']);
  });
});

describe('classifyIntent export flags', () => {
  it('sets isExport and exportFormat on the classified intent', () => {
    const intent = classifyIntent('me dá um csv com os dados dos orçamentos', true);
    expect(intent.isExport).toBe(true);
    expect(intent.exportFormat).toBe('csv');
  });

  it('leaves isExport false for ordinary commands', () => {
    const intent = classifyIntent('cria um header azul', true);
    expect(intent.isExport).toBe(false);
  });
});
