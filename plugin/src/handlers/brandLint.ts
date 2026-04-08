/// <reference types="@figma/plugin-typings" />
import { postToUI } from '../utils/postMessage';

/**
 * BRAND LINTER — deterministic quality gate.
 *
 * Scans the current selection and scores how well it adheres to the active
 * brand guideline. Produces a 0–100 score plus a list of actionable issues.
 *
 * 100% client-side, zero LLM cost. Reuses the same palette/typography data
 * the UI already has and passes into the message.
 */

type Severity = 'error' | 'warning' | 'info';

interface LintIssue {
  nodeId: string;
  nodeName: string;
  severity: Severity;
  category: 'color' | 'typography' | 'contrast' | 'spacing' | 'radius';
  message: string;
  suggestion?: string;
}

interface LintReport {
  score: number;
  totals: {
    nodesScanned: number;
    textNodes: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  issues: LintIssue[];
}

interface BrandContext {
  colors: string[];                 // hex list, from state.selectedColors
  fontFamilies: string[];           // from state.typography
  spacing?: number[];               // token values
  radius?: number[];                // token values
}

// ── Color math ──────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function rgbLuminance(rgb: RGB): number {
  const a = [rgb.r, rgb.g, rgb.b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = rgbLuminance(a);
  const lb = rgbLuminance(b);
  const brightest = Math.max(la, lb);
  const darkest = Math.min(la, lb);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Perceptual distance in sRGB — cheap and good enough for palette matching.
// ΔE CIE2000 would be more accurate but needs a lab conversion pipeline;
// sRGB-weighted distance catches all practical mismatches for this use case.
function colorDistance(a: RGB, b: RGB): number {
  const dr = (a.r - b.r) * 255;
  const dg = (a.g - b.g) * 255;
  const db = (a.b - b.b) * 255;
  // Rec. 709 luma weighting
  return Math.sqrt(0.2126 * dr * dr + 0.7152 * dg * dg + 0.0722 * db * db);
}

const PALETTE_MATCH_TOLERANCE = 6; // ~2.4% perceptual — room for float error

function inPalette(color: RGB, palette: RGB[]): boolean {
  return palette.some((p) => colorDistance(color, p) <= PALETTE_MATCH_TOLERANCE);
}

function nearestPalette(color: RGB, palette: RGB[]): RGB | null {
  let best: RGB | null = null;
  let bestD = Infinity;
  for (const p of palette) {
    const d = colorDistance(color, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function rgbToHex(c: RGB): string {
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`.toUpperCase();
}

// ── Background resolution ───────────────────────────────────────────────────

function resolveBackground(node: SceneNode): RGB {
  let current: BaseNode | null = node.parent;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if ('fills' in current && Array.isArray((current as any).fills)) {
      const fills = (current as any).fills as Paint[];
      const solid = fills.find(
        (f) => f.type === 'SOLID' && f.visible !== false
      ) as SolidPaint | undefined;
      if (solid) return solid.color;
    }
    current = (current as any).parent;
  }
  return { r: 1, g: 1, b: 1 };
}

// ── Scan ────────────────────────────────────────────────────────────────────

function scanNode(
  node: SceneNode,
  ctx: {
    palette: RGB[];
    fontFamilies: Set<string>;
    spacing: Set<number>;
    radius: Set<number>;
    issues: LintIssue[];
    totals: LintReport['totals'];
  }
) {
  ctx.totals.nodesScanned++;

  // ── Fills / strokes color check
  if ('fills' in node && Array.isArray(node.fills) && ctx.palette.length > 0) {
    for (const fill of node.fills as Paint[]) {
      if (fill.type !== 'SOLID' || fill.visible === false) continue;
      if (!inPalette(fill.color, ctx.palette)) {
        const nearest = nearestPalette(fill.color, ctx.palette);
        ctx.issues.push({
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          category: 'color',
          message: `Cor ${rgbToHex(fill.color)} fora da paleta da brand`,
          suggestion: nearest ? `Token mais próximo: ${rgbToHex(nearest)}` : undefined,
        });
        ctx.totals.warnings++;
        break; // one issue per node is enough
      }
    }
  }

  if ('strokes' in node && Array.isArray(node.strokes) && ctx.palette.length > 0) {
    for (const stroke of node.strokes as Paint[]) {
      if (stroke.type !== 'SOLID' || stroke.visible === false) continue;
      if (!inPalette(stroke.color, ctx.palette)) {
        const nearest = nearestPalette(stroke.color, ctx.palette);
        ctx.issues.push({
          nodeId: node.id,
          nodeName: node.name,
          severity: 'warning',
          category: 'color',
          message: `Stroke ${rgbToHex(stroke.color)} fora da paleta`,
          suggestion: nearest ? `Token mais próximo: ${rgbToHex(nearest)}` : undefined,
        });
        ctx.totals.warnings++;
        break;
      }
    }
  }

  // ── Corner radius check
  if (ctx.radius.size > 0 && 'cornerRadius' in node) {
    const r = (node as any).cornerRadius;
    if (typeof r === 'number' && r > 0 && !ctx.radius.has(r)) {
      ctx.issues.push({
        nodeId: node.id,
        nodeName: node.name,
        severity: 'info',
        category: 'radius',
        message: `Radius ${r}px fora dos tokens`,
      });
      ctx.totals.infos++;
    }
  }

  // ── Auto-layout spacing check
  if (
    ctx.spacing.size > 0 &&
    'layoutMode' in node &&
    (node as any).layoutMode &&
    (node as any).layoutMode !== 'NONE'
  ) {
    const spacing = (node as any).itemSpacing;
    if (typeof spacing === 'number' && spacing > 0 && !ctx.spacing.has(spacing)) {
      ctx.issues.push({
        nodeId: node.id,
        nodeName: node.name,
        severity: 'info',
        category: 'spacing',
        message: `Item spacing ${spacing}px fora dos tokens`,
      });
      ctx.totals.infos++;
    }
  }

  // ── Text checks: font family + contrast
  if (node.type === 'TEXT') {
    ctx.totals.textNodes++;

    // Font family
    if (ctx.fontFamilies.size > 0) {
      const fontName = node.fontName;
      if (fontName !== figma.mixed) {
        const family = (fontName as FontName).family;
        const normalized = family.toLowerCase().replace(/\s+/g, '');
        const matches = Array.from(ctx.fontFamilies).some(
          (f) => f.toLowerCase().replace(/\s+/g, '') === normalized
        );
        if (!matches) {
          ctx.issues.push({
            nodeId: node.id,
            nodeName: node.name,
            severity: 'warning',
            category: 'typography',
            message: `Fonte "${family}" fora das fontes da brand`,
            suggestion: `Esperado: ${Array.from(ctx.fontFamilies).join(', ')}`,
          });
          ctx.totals.warnings++;
        }
      }
    }

    // Contrast check
    const fills = node.fills;
    if (Array.isArray(fills)) {
      const textFill = fills.find(
        (f) => f.type === 'SOLID' && f.visible !== false
      ) as SolidPaint | undefined;
      if (textFill) {
        const bg = resolveBackground(node);
        const ratio = contrastRatio(textFill.color, bg);
        const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 14;
        const isLarge = fontSize >= 18;
        const minRatio = isLarge ? 3.0 : 4.5;
        if (ratio < minRatio) {
          ctx.issues.push({
            nodeId: node.id,
            nodeName: node.name,
            severity: 'error',
            category: 'contrast',
            message: `Contraste ${ratio.toFixed(2)}:1 abaixo de ${minRatio}:1 (WCAG AA)`,
            suggestion: `Texto ${rgbToHex(textFill.color)} sobre ${rgbToHex(bg)}`,
          });
          ctx.totals.errors++;
        }
      }
    }
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      scanNode(child, ctx);
    }
  }
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function computeScore(totals: LintReport['totals']): number {
  const { nodesScanned, errors, warnings, infos } = totals;
  if (nodesScanned === 0) return 100;
  // Errors hurt most, warnings medium, infos light.
  const penalty = errors * 10 + warnings * 3 + infos * 1;
  const normalized = (penalty / nodesScanned) * 10;
  return Math.max(0, Math.min(100, Math.round(100 - normalized)));
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function lintBrandAdherence(brand: BrandContext) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Selecione algo para auditar ✨');
    postToUI({ type: 'BRAND_LINT_REPORT', report: null });
    return;
  }

  const palette: RGB[] = (brand.colors || [])
    .map(hexToRgb)
    .filter((c): c is RGB => c !== null);

  const fontFamilies = new Set<string>((brand.fontFamilies || []).filter(Boolean));
  const spacing = new Set<number>((brand.spacing || []).filter((v) => typeof v === 'number'));
  const radius = new Set<number>((brand.radius || []).filter((v) => typeof v === 'number'));

  const totals: LintReport['totals'] = {
    nodesScanned: 0,
    textNodes: 0,
    errors: 0,
    warnings: 0,
    infos: 0,
  };
  const issues: LintIssue[] = [];

  for (const node of selection) {
    scanNode(node, { palette, fontFamilies, spacing, radius, issues, totals });
  }

  const report: LintReport = {
    score: computeScore(totals),
    totals,
    issues,
  };

  postToUI({ type: 'BRAND_LINT_REPORT', report });
  figma.notify(
    `Brand Score: ${report.score}/100  •  ${totals.errors} erros, ${totals.warnings} avisos`
  );
}

// ── Auto-fix ────────────────────────────────────────────────────────────────

interface FixContext {
  palette: RGB[];
  fontFamilies: string[];
  spacing: number[];
  radius: number[];
  counts: { colors: number; contrast: number; radius: number; spacing: number; typography: number };
}

function nearestNumber(value: number, options: number[]): number {
  let best = value;
  let bestD = Infinity;
  for (const o of options) {
    const d = Math.abs(o - value);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

async function fixNode(node: SceneNode, ctx: FixContext) {
  // Snap solid fills to nearest palette token
  if ('fills' in node && Array.isArray(node.fills) && ctx.palette.length > 0) {
    const fills = node.fills as Paint[];
    let changed = false;
    const newFills = fills.map((fill) => {
      if (fill.type !== 'SOLID' || fill.visible === false) return fill;
      if (inPalette(fill.color, ctx.palette)) return fill;
      const nearest = nearestPalette(fill.color, ctx.palette);
      if (nearest) {
        changed = true;
        ctx.counts.colors++;
        return { ...fill, color: nearest };
      }
      return fill;
    });
    if (changed) (node as any).fills = newFills;
  }

  // Snap strokes too
  if ('strokes' in node && Array.isArray(node.strokes) && ctx.palette.length > 0) {
    const strokes = node.strokes as Paint[];
    let changed = false;
    const newStrokes = strokes.map((stroke) => {
      if (stroke.type !== 'SOLID' || stroke.visible === false) return stroke;
      if (inPalette(stroke.color, ctx.palette)) return stroke;
      const nearest = nearestPalette(stroke.color, ctx.palette);
      if (nearest) {
        changed = true;
        ctx.counts.colors++;
        return { ...stroke, color: nearest };
      }
      return stroke;
    });
    if (changed) (node as any).strokes = newStrokes;
  }

  // Snap corner radius to nearest token
  if (ctx.radius.length > 0 && 'cornerRadius' in node) {
    const r = (node as any).cornerRadius;
    if (typeof r === 'number' && r > 0 && !ctx.radius.includes(r)) {
      try {
        (node as any).cornerRadius = nearestNumber(r, ctx.radius);
        ctx.counts.radius++;
      } catch {
        // some nodes reject direct radius assignment
      }
    }
  }

  // Snap item spacing to nearest token
  if (
    ctx.spacing.length > 0 &&
    'layoutMode' in node &&
    (node as any).layoutMode &&
    (node as any).layoutMode !== 'NONE'
  ) {
    const spacing = (node as any).itemSpacing;
    if (typeof spacing === 'number' && spacing > 0 && !ctx.spacing.includes(spacing)) {
      try {
        (node as any).itemSpacing = nearestNumber(spacing, ctx.spacing);
        ctx.counts.spacing++;
      } catch {
        // ignore
      }
    }
  }

  // Text: fix contrast + font family
  if (node.type === 'TEXT') {
    // Font family snap — pick first brand family, load its current style
    if (ctx.fontFamilies.length > 0) {
      const fontName = node.fontName;
      if (fontName !== figma.mixed) {
        const current = (fontName as FontName).family;
        const normalized = current.toLowerCase().replace(/\s+/g, '');
        const match = ctx.fontFamilies.find(
          (f) => f.toLowerCase().replace(/\s+/g, '') === normalized
        );
        if (!match) {
          const target = ctx.fontFamilies[0];
          const style = (fontName as FontName).style || 'Regular';
          try {
            await figma.loadFontAsync({ family: target, style });
            node.fontName = { family: target, style };
            ctx.counts.typography++;
          } catch {
            // Fallback to Regular if the current style doesn't exist on target
            try {
              await figma.loadFontAsync({ family: target, style: 'Regular' });
              node.fontName = { family: target, style: 'Regular' };
              ctx.counts.typography++;
            } catch {
              // give up quietly
            }
          }
        }
      }
    }

    // Contrast fix — flip text to black or white based on bg luminance
    const fills = node.fills;
    if (Array.isArray(fills)) {
      const textFill = fills.find(
        (f) => f.type === 'SOLID' && f.visible !== false
      ) as SolidPaint | undefined;
      if (textFill) {
        const bg = resolveBackground(node);
        const ratio = contrastRatio(textFill.color, bg);
        const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 14;
        const minRatio = fontSize >= 18 ? 3.0 : 4.5;
        if (ratio < minRatio) {
          const bgLum = rgbLuminance(bg);
          const flipped: RGB = bgLum < 0.5
            ? { r: 0.98, g: 0.98, b: 0.98 }
            : { r: 0.05, g: 0.05, b: 0.05 };
          // Prefer a palette color if one meets the ratio — keeps the brand feel
          let chosen = flipped;
          for (const p of ctx.palette) {
            if (contrastRatio(p, bg) >= minRatio) {
              chosen = p;
              break;
            }
          }
          (node as any).fills = [{ ...textFill, color: chosen }];
          ctx.counts.contrast++;
        }
      }
    }
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      await fixNode(child, ctx);
    }
  }
}

export async function fixBrandIssues(brand: BrandContext) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Selecione algo para aplicar fixes ✨');
    return;
  }

  const palette: RGB[] = (brand.colors || [])
    .map(hexToRgb)
    .filter((c): c is RGB => c !== null);

  const ctx: FixContext = {
    palette,
    fontFamilies: (brand.fontFamilies || []).filter(Boolean),
    spacing: (brand.spacing || []).filter((v) => typeof v === 'number'),
    radius: (brand.radius || []).filter((v) => typeof v === 'number'),
    counts: { colors: 0, contrast: 0, radius: 0, spacing: 0, typography: 0 },
  };

  for (const node of selection) {
    await fixNode(node, ctx);
  }

  const { colors, contrast, radius, spacing, typography } = ctx.counts;
  const total = colors + contrast + radius + spacing + typography;
  figma.notify(
    total === 0
      ? 'Nada para corrigir ✨'
      : `Fixes: ${colors} cores, ${contrast} contraste, ${typography} fontes, ${radius} radius, ${spacing} spacing`
  );

  // Re-run the lint so the UI refreshes with the new score
  await lintBrandAdherence(brand);
}

/**
 * Focus a specific node on canvas — invoked when the user clicks an issue.
 */
export function focusNode(nodeId: string) {
  const node = figma.getNodeById(nodeId);
  if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') return;
  figma.currentPage.selection = [node as SceneNode];
  figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
}
