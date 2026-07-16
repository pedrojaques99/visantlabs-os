import { describe, it, expect } from 'vitest';
import {
  parseTemplateNode,
  frameToSchema,
  type FigmaNodeLike,
  type VarNameLookup,
} from '../../../src/lib/figma-template-schema';

// Identity relativeTransform at (0,0): [[1,0,0],[0,1,0]].
const T = (x = 0, y = 0): number[][] => [
  [1, 0, x],
  [0, 1, y],
];

const varName: VarNameLookup = (id) =>
  ({ 'v-accent': 'accent', 'v-text': 'text', 'v-head': 'heading-font' })[id] ?? null;

describe('parseTemplateNode', () => {
  it('flattens relativeTransform into a CSS matrix and keeps geometry', () => {
    const node: FigmaNodeLike = {
      name: 'box',
      type: 'RECTANGLE',
      width: 100,
      height: 50,
      relativeTransform: [
        [0.5, -0.25, 12],
        [0.75, 0.9, 34],
      ],
      cornerRadius: 8,
    };
    const out = parseTemplateNode(node, varName);
    // m = [a, b, c, d, e, f] = [rt00, rt10, rt01, rt11, rt02, rt12]
    expect(out.m).toEqual([0.5, 0.75, -0.25, 0.9, 12, 34]);
    expect(out).toMatchObject({ w: 100, h: 50, cornerRadius: 8 });
  });

  it('resolves a bound-variable fill to its variable NAME (not a baked color)', () => {
    const node: FigmaNodeLike = {
      name: 'bg',
      type: 'FRAME',
      width: 10,
      height: 10,
      relativeTransform: T(),
      fills: [
        {
          type: 'SOLID',
          opacity: 1,
          color: { r: 0, g: 0, b: 0 },
          boundVariables: { color: { id: 'v-accent' } },
        },
      ],
    };
    expect(parseTemplateNode(node, varName).fill).toEqual({ opacity: 1, varName: 'accent' });
  });

  it('keeps a literal hex fill when no variable is bound', () => {
    const node: FigmaNodeLike = {
      name: 'lit',
      type: 'RECTANGLE',
      width: 10,
      height: 10,
      relativeTransform: T(),
      fills: [{ type: 'SOLID', opacity: 0.5, color: { r: 1, g: 0, b: 0 } }],
    };
    expect(parseTemplateNode(node, varName).fill).toEqual({ opacity: 0.5, hex: '#ff0000' });
  });

  it('parses slot names and font-variable bindings on TEXT nodes', () => {
    const node: FigmaNodeLike = {
      name: '#h1',
      type: 'TEXT',
      width: 200,
      height: 60,
      relativeTransform: T(0, 5),
      characters: 'Hello',
      fontName: { family: 'Unbounded', style: 'Bold' },
      fontSize: 48,
      textAlignHorizontal: 'CENTER',
      textCase: 'UPPER',
      letterSpacing: { unit: 'PERCENT', value: -2 },
      lineHeight: { unit: 'PERCENT', value: 100 },
      boundVariables: { fontFamily: { id: 'v-head' } },
      fills: [
        {
          type: 'SOLID',
          opacity: 1,
          color: { r: 0, g: 0, b: 0 },
          boundVariables: { color: { id: 'v-text' } },
        },
      ],
    };
    const out = parseTemplateNode(node, varName);
    expect(out.slot).toEqual({ id: 'h1', variant: undefined, optional: false, list: false });
    expect(out.text).toMatchObject({
      chars: 'Hello',
      size: 48,
      align: 'CENTER',
      tcase: 'UPPER',
      lhPct: 100,
      fontVar: 'heading-font',
    });
    expect(out.text?.letter).toEqual({ unit: 'PERCENT', value: -2 });
    expect(out.fill).toEqual({ opacity: 1, varName: 'text' });
  });

  it('infers fontVar from a known family when no binding exists', () => {
    const mk = (family: string): FigmaNodeLike => ({
      name: 't',
      type: 'TEXT',
      width: 10,
      height: 10,
      relativeTransform: T(),
      characters: 'x',
      fontName: { family, style: 'Regular' },
      fontSize: 12,
    });
    expect(parseTemplateNode(mk('Unbounded'), varName).text?.fontVar).toBe('heading-font');
    expect(parseTemplateNode(mk('Kumbh Sans'), varName).text?.fontVar).toBe('body-font');
    expect(parseTemplateNode(mk('Arial'), varName).text?.fontVar).toBeUndefined();
  });

  it('recurses children and skips invisible nodes', () => {
    const node: FigmaNodeLike = {
      name: 'root',
      type: 'FRAME',
      width: 100,
      height: 100,
      relativeTransform: T(),
      children: [
        { name: 'a', type: 'RECTANGLE', width: 5, height: 5, relativeTransform: T(1, 1) },
        {
          name: 'hidden',
          type: 'RECTANGLE',
          width: 5,
          height: 5,
          relativeTransform: T(),
          visible: false,
        },
      ],
    };
    const out = parseTemplateNode(node, varName);
    expect(out.children).toHaveLength(1);
    expect(out.children?.[0].name).toBe('a');
  });
});

describe('frameToSchema', () => {
  it('produces a schema with dimensions + aspect from the frame', () => {
    const frame: FigmaNodeLike = {
      name: '[Template] Hero',
      type: 'FRAME',
      width: 1920,
      height: 1080,
      relativeTransform: T(120, 300),
      fills: [
        {
          type: 'SOLID',
          opacity: 1,
          color: { r: 1, g: 1, b: 1 },
          boundVariables: { color: { id: 'v-text' } },
        },
      ],
    };
    const schema = frameToSchema(frame, varName, '10:20');
    expect(schema).toMatchObject({
      id: '10:20',
      name: '[Template] Hero',
      width: 1920,
      height: 1080,
      aspect: '16:9',
    });
    expect(schema.root.fill).toEqual({ opacity: 1, varName: 'text' });
  });
});
