import { describe, it, expect } from 'vitest';
import { collectVariables, applyVariables } from '@/utils/canvas/resolveVariables';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData, VariablesNodeData, DataNodeData } from '@/types/reactFlow';

const makeNode = (id: string, type: string, data: any): Node<FlowNodeData> =>
  ({ id, type, position: { x: 0, y: 0 }, data } as Node<FlowNodeData>);

const makeEdge = (source: string, target: string): Edge =>
  ({ id: `${source}->${target}`, source, target } as Edge);

describe('applyVariables', () => {
  it('replaces known placeholders', () => {
    expect(applyVariables('Hello {{name}}!', { name: 'Nike' })).toBe('Hello Nike!');
  });

  it('leaves unknown placeholders unchanged', () => {
    expect(applyVariables('{{unknown}} stays', {})).toBe('{{unknown}} stays');
  });

  it('replaces multiple different placeholders', () => {
    const result = applyVariables('{{brand}} — {{tagline}}', { brand: 'Adidas', tagline: 'Impossible is Nothing' });
    expect(result).toBe('Adidas — Impossible is Nothing');
  });

  it('replaces same placeholder multiple times', () => {
    expect(applyVariables('{{x}} and {{x}}', { x: 'A' })).toBe('A and A');
  });

  it('returns text unchanged when no vars', () => {
    expect(applyVariables('plain text', {})).toBe('plain text');
  });

  it('returns text unchanged when empty string', () => {
    expect(applyVariables('', { x: 'y' })).toBe('');
  });
});

describe('collectVariables — VariablesNode', () => {
  it('collects vars from a connected VariablesNode', () => {
    const varNode = makeNode('v1', 'variables', {
      type: 'variables',
      variables: [{ key: 'brand', value: 'Nike' }, { key: 'color', value: 'red' }],
    } as VariablesNodeData);

    const targetNode = makeNode('t1', 'edit', { type: 'edit' });
    const edge = makeEdge('v1', 't1');

    const vars = collectVariables('t1', [varNode, targetNode], [edge]);
    expect(vars).toEqual({ brand: 'Nike', color: 'red' });
  });

  it('ignores empty keys', () => {
    const varNode = makeNode('v1', 'variables', {
      type: 'variables',
      variables: [{ key: '', value: 'ignored' }, { key: 'valid', value: 'kept' }],
    } as VariablesNodeData);

    const vars = collectVariables('t1', [varNode], [makeEdge('v1', 't1')]);
    expect(Object.keys(vars)).not.toContain('');
    expect(vars.valid).toBe('kept');
  });

  it('merges vars from multiple connected VariablesNodes', () => {
    const v1 = makeNode('v1', 'variables', {
      type: 'variables', variables: [{ key: 'a', value: '1' }],
    } as VariablesNodeData);
    const v2 = makeNode('v2', 'variables', {
      type: 'variables', variables: [{ key: 'b', value: '2' }],
    } as VariablesNodeData);
    const target = makeNode('t1', 'edit', { type: 'edit' });

    const vars = collectVariables('t1', [v1, v2, target], [makeEdge('v1', 't1'), makeEdge('v2', 't1')]);
    expect(vars).toEqual({ a: '1', b: '2' });
  });

  it('returns empty when no connected variable nodes', () => {
    const image = makeNode('i1', 'image', { type: 'image' });
    const target = makeNode('t1', 'edit', { type: 'edit' });
    const edge = makeEdge('i1', 't1');

    expect(collectVariables('t1', [image, target], [edge])).toEqual({});
  });

  it('ignores edges targeting other nodes', () => {
    const varNode = makeNode('v1', 'variables', {
      type: 'variables', variables: [{ key: 'x', value: 'y' }],
    } as VariablesNodeData);

    const vars = collectVariables('t1', [varNode], [makeEdge('v1', 'other')]);
    expect(vars).toEqual({});
  });
});

describe('collectVariables — DataNode', () => {
  it('collects selected row from connected DataNode', () => {
    const dataNode = makeNode('d1', 'data', {
      type: 'data',
      rows: [{ product: 'Air Max', color: 'red' }, { product: 'UB', color: 'black' }],
      columns: ['product', 'color'],
      selectedRowIndex: 1,
    } as DataNodeData);

    const vars = collectVariables('t1', [dataNode], [makeEdge('d1', 't1')]);
    expect(vars).toEqual({ product: 'UB', color: 'black' });
  });

  it('defaults to row 0 when selectedRowIndex is undefined', () => {
    const dataNode = makeNode('d1', 'data', {
      type: 'data',
      rows: [{ name: 'First' }],
      columns: ['name'],
      selectedRowIndex: undefined,
    } as any);

    const vars = collectVariables('t1', [dataNode], [makeEdge('d1', 't1')]);
    expect(vars.name).toBe('First');
  });

  it('returns empty when DataNode has no rows', () => {
    const dataNode = makeNode('d1', 'data', {
      type: 'data', rows: [], columns: [], selectedRowIndex: 0,
    } as DataNodeData);

    expect(collectVariables('t1', [dataNode], [makeEdge('d1', 't1')])).toEqual({});
  });
});
