/**
 * Figma template → layout SCHEMA (the sync bridge's SSoT).
 *
 * A `[Template]` frame is parsed ONCE into this normalized, brand-agnostic schema:
 * geometry as a transform matrix (exact position + rotation), which `Brand` variable
 * each fill binds to (not a baked color), the text/typography, and which `#slot` each
 * text is. The webapp's `<TemplateRenderer>` interprets it into live DOM; the Figma
 * plugin produces it. One source (the frame), two renderers — edit in Figma, re-parse,
 * webapp reflects. Zero hand-written React per template.
 *
 * Pure + dependency-free (no `figma` global, no async) so the plugin, server, tests and
 * webapp all share it — same discipline as `figma-slots.ts`. The plugin pre-resolves
 * variable ids → names (one async pass) and passes a sync lookup into `frameToSchema`.
 */
import { parseSlotName, aspectLabel, BRAND_TOKEN_VARS } from './figma-slots';

/** The semantic Brand variable names — a bound var with one of these keeps its varName;
 * any OTHER variable (the file's own colors) is resolved to a literal hex instead. */
const BRAND_TOKENS = new Set<string>([
  ...BRAND_TOKEN_VARS.color,
  ...BRAND_TOKEN_VARS.font,
  ...BRAND_TOKEN_VARS.number,
]);

// ── Schema ───────────────────────────────────────────────────────────────────

/** A resolved fill: a bound `Brand` variable (theme) OR a literal hex. */
export interface TemplateFill {
  varName?: string;
  hex?: string;
  opacity: number;
}

export interface TemplateText {
  chars: string;
  family: string;
  style?: string;
  size: number;
  align?: string;
  tcase?: string;
  letter?: { unit: string; value: number };
  lhPct?: number;
  /** Font bound to a Brand font variable → resolve to the brand's typography. */
  fontVar?: 'heading-font' | 'body-font';
}

/** A stroke: a bound variable OR literal hex, plus its weight (px). */
export interface TemplateStroke {
  varName?: string;
  hex?: string;
  opacity: number;
  weight: number;
}

export interface TemplateNode {
  name: string;
  type: string;
  /** relativeTransform flattened to a CSS matrix: [a, b, c, d, e, f]. */
  m: [number, number, number, number, number, number];
  w: number;
  h: number;
  opacity?: number;
  cornerRadius?: number;
  clip?: boolean;
  fill?: TemplateFill;
  stroke?: TemplateStroke;
  slot?: { id: string; variant?: string; optional: boolean; list: boolean };
  text?: TemplateText;
  children?: TemplateNode[];
}

export interface TemplateSchema {
  /** Figma node id, so a re-sync can target the same frame. */
  id?: string;
  name: string;
  width: number;
  height: number;
  aspect: string;
  root: TemplateNode;
}

// ── Minimal Figma node shape (subset of the Plugin API we read) ───────────────
// Typed structurally so the parser is pure and unit-testable with fixtures.

type Mixed = typeof globalThis extends { figma: unknown } ? symbol : symbol;

export interface PaintLike {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number };
  boundVariables?: { color?: { id: string } };
}

export interface FigmaNodeLike {
  name: string;
  type: string;
  width: number;
  height: number;
  relativeTransform: number[][];
  opacity?: number;
  cornerRadius?: number | Mixed;
  clipsContent?: boolean;
  visible?: boolean;
  fills?: readonly PaintLike[] | Mixed;
  strokes?: readonly PaintLike[];
  strokeWeight?: number | Mixed;
  characters?: string;
  fontName?: { family: string; style: string } | Mixed;
  fontSize?: number | Mixed;
  textAlignHorizontal?: string;
  textCase?: string;
  letterSpacing?: { unit: string; value: number } | Mixed;
  lineHeight?: { unit: string; value: number } | Mixed;
  boundVariables?: { fontFamily?: { id: string } | Array<{ id: string }> };
  children?: readonly FigmaNodeLike[];
}

/** Resolve a Figma variable id → its name (e.g. "accent", "heading-font"). */
export type VarNameLookup = (id: string) => string | null | undefined;
/** Resolve a NON-brand variable id → its literal hex value (so it can be auto-tokenized). */
export type VarHexLookup = (id: string) => string | null | undefined;

// ── Parser ───────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === 'number';

function rgbToHex(c: { r: number; g: number; b: number }): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** A bound var that IS a Brand token keeps its name; any other var resolves to hex. */
function bindColor(
  boundId: string,
  varName: VarNameLookup,
  varHex?: VarHexLookup
): { varName?: string; hex?: string } {
  const nm = varName(boundId);
  if (nm && BRAND_TOKENS.has(nm)) return { varName: nm };
  const hx = varHex?.(boundId);
  return hx ? { hex: hx } : {};
}

function readFill(
  node: FigmaNodeLike,
  varName: VarNameLookup,
  varHex?: VarHexLookup
): TemplateFill | undefined {
  const fills = node.fills;
  if (!Array.isArray(fills) || !fills.length) return undefined;
  const f = fills[0] as PaintLike;
  if (f.type !== 'SOLID' || f.visible === false) return undefined;
  const out: TemplateFill = { opacity: f.opacity == null ? 1 : f.opacity };
  const boundId = f.boundVariables?.color?.id;
  if (boundId) Object.assign(out, bindColor(boundId, varName, varHex));
  else if (f.color) out.hex = rgbToHex(f.color);
  return out.varName || out.hex ? out : undefined;
}

function readStroke(
  node: FigmaNodeLike,
  varName: VarNameLookup,
  varHex?: VarHexLookup
): TemplateStroke | undefined {
  const strokes = node.strokes;
  if (!Array.isArray(strokes) || !strokes.length) return undefined;
  const s = strokes[0] as PaintLike;
  if (s.type !== 'SOLID' || s.visible === false) return undefined;
  const weight = isNum(node.strokeWeight) ? node.strokeWeight : 1;
  const out: TemplateStroke = { opacity: s.opacity == null ? 1 : s.opacity, weight };
  const boundId = s.boundVariables?.color?.id;
  if (boundId) Object.assign(out, bindColor(boundId, varName, varHex));
  else if (s.color) out.hex = rgbToHex(s.color);
  return out.varName || out.hex ? out : undefined;
}

function readText(node: FigmaNodeLike, varName: VarNameLookup): TemplateText | undefined {
  const fn = node.fontName;
  if (!fn || typeof fn === 'symbol' || !isNum(node.fontSize)) return undefined;
  const t: TemplateText = {
    chars: node.characters ?? '',
    family: fn.family,
    style: fn.style,
    size: node.fontSize,
    align: node.textAlignHorizontal,
    tcase: node.textCase,
  };
  if (node.letterSpacing && typeof node.letterSpacing !== 'symbol') t.letter = node.letterSpacing;
  if (node.lineHeight && typeof node.lineHeight !== 'symbol' && node.lineHeight.unit === 'PERCENT')
    t.lhPct = node.lineHeight.value;

  // Font-family variable binding wins; else infer from the known brand families.
  const fv = node.boundVariables?.fontFamily;
  const fvId = Array.isArray(fv) ? fv[0]?.id : fv?.id;
  const boundName = fvId ? varName(fvId) : null;
  if (boundName === 'heading-font' || boundName === 'body-font') t.fontVar = boundName;
  else if (fn.family === 'Unbounded') t.fontVar = 'heading-font';
  else if (fn.family === 'Kumbh Sans') t.fontVar = 'body-font';
  return t;
}

/** Parse a Figma node subtree into a `TemplateNode`. Pure; skips invisible nodes. */
export function parseTemplateNode(
  node: FigmaNodeLike,
  varName: VarNameLookup,
  varHex?: VarHexLookup
): TemplateNode {
  const rt = node.relativeTransform;
  const out: TemplateNode = {
    name: node.name,
    type: node.type,
    m: [rt[0][0], rt[1][0], rt[0][1], rt[1][1], rt[0][2], rt[1][2]],
    w: node.width,
    h: node.height,
  };
  if (isNum(node.opacity) && node.opacity < 1) out.opacity = node.opacity;
  if (isNum(node.cornerRadius) && node.cornerRadius) out.cornerRadius = node.cornerRadius;
  if (node.clipsContent) out.clip = true;

  const fill = readFill(node, varName, varHex);
  if (fill) out.fill = fill;

  const stroke = readStroke(node, varName, varHex);
  if (stroke) out.stroke = stroke;

  const slot = parseSlotName(node.name);
  if (slot) out.slot = slot;

  if (node.type === 'TEXT') {
    const text = readText(node, varName);
    if (text) out.text = text;
  }

  if (node.children && node.children.length) {
    const kids = node.children
      .filter((ch) => ch.visible !== false)
      .map((ch) => parseTemplateNode(ch, varName, varHex));
    if (kids.length) out.children = kids;
  }
  return out;
}

/** Every distinct font family used by a schema's text nodes (for dynamic font loading). */
export function collectFontFamilies(schema: TemplateSchema): string[] {
  const out = new Set<string>();
  const walk = (n: TemplateNode) => {
    if (n.text?.family) out.add(n.text.family);
    n.children?.forEach(walk);
  };
  walk(schema.root);
  return [...out];
}

/** Parse a `[Template]` frame into a full schema (root transform normalized away). */
export function frameToSchema(
  node: FigmaNodeLike,
  varName: VarNameLookup,
  id?: string,
  varHex?: VarHexLookup
): TemplateSchema {
  const root = parseTemplateNode(node, varName, varHex);
  return {
    id,
    name: root.name,
    width: root.w,
    height: root.h,
    aspect: aspectLabel(root.w, root.h),
    root,
  };
}
