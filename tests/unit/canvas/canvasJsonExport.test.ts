import { describe, it, expect } from 'vitest';
import {
  exportCanvasToJson,
  validateVisantJson,
  VISANT_CANVAS_SCHEMA,
} from '@/utils/canvas/canvasJsonExport';
import type { Node, Edge } from '@xyflow/react';

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeNode = (id: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type: 'image', position: { x: 0, y: 0 }, data } as Node);

const makeEdge = (id: string, source: string, target: string): Edge =>
  ({ id, source, target } as Edge);

// ── exportCanvasToJson — meta ──────────────────────────────────────────────────

describe('exportCanvasToJson — meta', () => {
  it('stamps the correct schema version', () => {
    const result = exportCanvasToJson('test', [], [], []);
    expect(result.meta.schema).toBe(VISANT_CANVAS_SCHEMA);
    expect(result.meta.schema).toBe('visant-canvas/v1');
  });

  it('sets exportedAt to a valid ISO date string', () => {
    const before = new Date().toISOString();
    const result = exportCanvasToJson('test', [], [], []);
    const after = new Date().toISOString();
    expect(result.meta.exportedAt >= before).toBe(true);
    expect(result.meta.exportedAt <= after).toBe(true);
  });

  it('counts nodes, edges and drawings correctly', () => {
    const nodes = [makeNode('n1'), makeNode('n2')];
    const edges = [makeEdge('e1', 'n1', 'n2')];
    const drawings = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
    const result = exportCanvasToJson('test', nodes, edges, drawings);
    expect(result.meta.nodeCount).toBe(2);
    expect(result.meta.edgeCount).toBe(1);
    expect(result.meta.drawingCount).toBe(3);
  });

  it('defaults name to "Untitled" when empty string given', () => {
    const result = exportCanvasToJson('', [], []);
    expect(result.name).toBe('Untitled');
  });

  it('uses provided name', () => {
    const result = exportCanvasToJson('My Project', [], []);
    expect(result.name).toBe('My Project');
  });
});

// ── exportCanvasToJson — strip sensitive/transient fields ─────────────────────

describe('exportCanvasToJson — strip fields', () => {
  const sensitiveFields = [
    'imageBase64',
    'resultImageBase64',
    'resultVideoBase64',
    'pdfBase64',
    'logoBase64',
    'uploadedVideo',
    'base64',
  ];

  sensitiveFields.forEach((field) => {
    it(`strips "${field}" from node data`, () => {
      const node = makeNode('n1', { [field]: 'data:image/png;base64,abc123', label: 'keep' });
      const result = exportCanvasToJson('test', [node], []);
      expect((result.nodes[0].data as any)[field]).toBeUndefined();
      expect((result.nodes[0].data as any).label).toBe('keep');
    });
  });

  const transientFields = [
    'isGenerating',
    'isLoading',
    'isAnalyzing',
    'connectedImages',
    'connectedImage',
    'connectedLogo',
    'oversizedWarning',
    'promptSuggestions',
    'userMockups',
  ];

  transientFields.forEach((field) => {
    it(`strips transient field "${field}"`, () => {
      const node = makeNode('n1', { [field]: true, keep: 'value' });
      const result = exportCanvasToJson('test', [node], []);
      expect((result.nodes[0].data as any)[field]).toBeUndefined();
      expect((result.nodes[0].data as any).keep).toBe('value');
    });
  });

  it('strips React callback functions from node data', () => {
    const node = makeNode('n1', { onUpdate: () => {}, label: 'keep' });
    const result = exportCanvasToJson('test', [node], []);
    expect((result.nodes[0].data as any).onUpdate).toBeUndefined();
    expect((result.nodes[0].data as any).label).toBe('keep');
  });

  it('strips nested base64 fields inside nested objects', () => {
    const node = makeNode('n1', {
      mockup: { imageBase64: 'bigdata', imageUrl: 'https://r2.example.com/img.png' },
    });
    const result = exportCanvasToJson('test', [node], []);
    const mockup = (result.nodes[0].data as any).mockup;
    expect(mockup.imageBase64).toBeUndefined();
    expect(mockup.imageUrl).toBe('https://r2.example.com/img.png');
  });

  it('preserves R2 URLs (imageUrl, videoUrl) after stripping base64', () => {
    const node = makeNode('n1', {
      imageBase64: 'bigdata',
      imageUrl: 'https://cdn.r2.example.com/file.png',
    });
    const result = exportCanvasToJson('test', [node], []);
    expect((result.nodes[0].data as any).imageUrl).toBe('https://cdn.r2.example.com/file.png');
    expect((result.nodes[0].data as any).imageBase64).toBeUndefined();
  });
});

// ── exportCanvasToJson — edge serialization ───────────────────────────────────

describe('exportCanvasToJson — edges', () => {
  it('preserves source and target', () => {
    const edge = makeEdge('e1', 'n1', 'n2');
    const result = exportCanvasToJson('test', [], [edge]);
    expect(result.edges[0]).toMatchObject({ id: 'e1', source: 'n1', target: 'n2' });
  });

  it('includes sourceHandle and targetHandle when present', () => {
    const edge = { ...makeEdge('e1', 'n1', 'n2'), sourceHandle: 'output', targetHandle: 'input' };
    const result = exportCanvasToJson('test', [], [edge]);
    expect(result.edges[0].sourceHandle).toBe('output');
    expect(result.edges[0].targetHandle).toBe('input');
  });

  it('omits sourceHandle and targetHandle when absent', () => {
    const result = exportCanvasToJson('test', [], [makeEdge('e1', 'n1', 'n2')]);
    expect(result.edges[0].sourceHandle).toBeUndefined();
    expect(result.edges[0].targetHandle).toBeUndefined();
  });
});

// ── validateVisantJson ────────────────────────────────────────────────────────

describe('validateVisantJson', () => {
  it('validates a well-formed export', () => {
    const data = exportCanvasToJson('test', [makeNode('n1')], [makeEdge('e1', 'n1', 'n2')]);
    expect(validateVisantJson(data)).toBe(true);
  });

  it('rejects null', () => expect(validateVisantJson(null)).toBe(false));
  it('rejects a string', () => expect(validateVisantJson('foo')).toBe(false));
  it('rejects empty object', () => expect(validateVisantJson({})).toBe(false));

  it('rejects wrong schema version', () => {
    const data = exportCanvasToJson('test', [], []);
    expect(validateVisantJson({ ...data, meta: { ...data.meta, schema: 'other/v2' } })).toBe(false);
  });

  it('rejects missing nodes array', () => {
    const data = exportCanvasToJson('test', [], []) as any;
    delete data.nodes;
    expect(validateVisantJson(data)).toBe(false);
  });

  it('rejects missing edges array', () => {
    const data = exportCanvasToJson('test', [], []) as any;
    delete data.edges;
    expect(validateVisantJson(data)).toBe(false);
  });

  it('round-trips: export then validate', () => {
    const nodes = [makeNode('n1', { label: 'hello', imageBase64: 'strip-me' })];
    const edges = [makeEdge('e1', 'n1', 'n2')];
    const exported = exportCanvasToJson('Round Trip', nodes, edges);
    const serialized = JSON.parse(JSON.stringify(exported));
    expect(validateVisantJson(serialized)).toBe(true);
    expect((serialized.nodes[0].data as any).imageBase64).toBeUndefined();
    expect((serialized.nodes[0].data as any).label).toBe('hello');
  });
});
