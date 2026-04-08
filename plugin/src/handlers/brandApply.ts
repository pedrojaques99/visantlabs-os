import { postToUI } from '../utils/postMessage';

// ── Font weight hierarchy ──
const WEIGHT_ORDER = ['Thin', 'Hairline', 'ExtraLight', 'UltraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'DemiBold', 'Bold', 'ExtraBold', 'UltraBold', 'Black', 'Heavy'];
const WEIGHT_RANK: Record<string, number> = {};
WEIGHT_ORDER.forEach((w, i) => { WEIGHT_RANK[w.toLowerCase()] = i; });

const HIERARCHY_TARGETS: Record<string, { idealWeights: string[]; minSize?: number }> = {
  display:  { idealWeights: ['Black', 'ExtraBold', 'Bold'], minSize: 32 },
  h1:       { idealWeights: ['Bold', 'ExtraBold', 'Black'], minSize: 28 },
  h2:       { idealWeights: ['SemiBold', 'Bold'], minSize: 22 },
  h3:       { idealWeights: ['SemiBold', 'Medium'], minSize: 18 },
  body:     { idealWeights: ['Regular', 'Medium'] },
  caption:  { idealWeights: ['Regular', 'Light'] },
  overline: { idealWeights: ['Medium', 'SemiBold', 'Bold'] },
};

function classifyTextRole(node: TextNode): string {
  const name = node.name.toLowerCase();
  const size = typeof node.fontSize === 'number' ? node.fontSize : 14;
  if (name.includes('display'))  return 'display';
  if (name.includes('h1') || name.includes('heading 1') || name.includes('title')) return 'h1';
  if (name.includes('h2') || name.includes('heading 2') || name.includes('subtitle')) return 'h2';
  if (name.includes('h3') || name.includes('heading 3') || name.includes('subhead')) return 'h3';
  if (name.includes('caption') || name.includes('label') || name.includes('footnote')) return 'caption';
  if (name.includes('overline') || name.includes('eyebrow')) return 'overline';
  if (name.includes('body') || name.includes('paragraph')) return 'body';
  if (size >= 36) return 'display';
  if (size >= 26) return 'h1';
  if (size >= 20) return 'h2';
  if (size >= 16) return 'h3';
  if (size <= 11) return 'caption';
  return 'body';
}

function pickStyleForRole(role: string, availableStyles: string[]): string {
  const target = HIERARCHY_TARGETS[role] || HIERARCHY_TARGETS.body;
  const normalized = availableStyles.map(s => s.trim());
  for (const ideal of target.idealWeights) {
    const match = normalized.find(s => s.toLowerCase() === ideal.toLowerCase());
    if (match) return match;
  }
  const idealRank = WEIGHT_RANK[target.idealWeights[0].toLowerCase()] ?? 5;
  let bestStyle = normalized[0] || 'Regular';
  let bestDist = Infinity;
  for (const style of normalized) {
    const baseWeight = style.replace(/italic/i, '').trim() || 'Regular';
    const rank = WEIGHT_RANK[baseWeight.toLowerCase()];
    if (rank !== undefined) {
      const dist = Math.abs(rank - idealRank);
      if (dist < bestDist) { bestDist = dist; bestStyle = style; }
    }
  }
  return bestStyle;
}

let availableFontsCache: Font[] | null = null;
async function getAvailableFonts(): Promise<Font[]> {
  if (!availableFontsCache) availableFontsCache = await figma.listAvailableFontsAsync();
  return availableFontsCache;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_]/g, '');
}

async function resolveFamily(requestedFamily: string): Promise<{ family: string; styles: string[]; } | null> {
  const fonts = await getAvailableFonts();
  const needle = normalizeName(requestedFamily);
  const familyMap = new Map<string, Set<string>>();
  const familyNormalized = new Map<string, string>();
  for (const f of fonts) {
    const actual = f.fontName.family;
    const norm = normalizeName(actual);
    if (!familyMap.has(actual)) { familyMap.set(actual, new Set()); familyNormalized.set(norm, actual); }
    familyMap.get(actual)!.add(f.fontName.style);
  }
  for (const [norm, actual] of familyNormalized) { if (norm === needle) return { family: actual, styles: [...familyMap.get(actual)!] }; }
  for (const [norm, actual] of familyNormalized) { if (norm.startsWith(needle) || needle.startsWith(norm)) return { family: actual, styles: [...familyMap.get(actual)!] }; }
  for (const [norm, actual] of familyNormalized) { if (norm.includes(needle) || needle.includes(norm)) return { family: actual, styles: [...familyMap.get(actual)!] }; }
  return null;
}

export async function applyBrandGuidelinesLocally(config: any) {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    postToUI({ type: 'ERROR', message: 'Selecione pelo menos um frame ou elemento para aplicar a brand.' });
    return;
  }

  availableFontsCache = null;
  const fontsWithValue = (config.typography || []).filter((t: any) => t.value);
  const headingEntry = fontsWithValue.find((t: any) => t.id === 'primary') || fontsWithValue[0];
  const bodyEntry = fontsWithValue.find((t: any) => t.id === 'secondary') || fontsWithValue[1] || fontsWithValue[0];

  const resolvedHeading = headingEntry?.value ? await resolveFamily(headingEntry.value.family || headingEntry.value.name || headingEntry.value) : null;
  const resolvedBody = bodyEntry?.value ? await resolveFamily(bodyEntry.value.family || bodyEntry.value.name || bodyEntry.value) : null;

  const brandColors = config.colors ? Object.values(config.colors) : [];
  const getRoleHex = (role: string) => (brandColors.find((c: any) => c.role === role) as any)?.value;

  const primaryColorHex = getRoleHex('primary') || (brandColors[0] as any)?.value;
  const backgroundHex = getRoleHex('background') || '#FFFFFF';
  const surfaceHex = getRoleHex('surface') || '#F5F5F5';
  const textHex = getRoleHex('text') || '#333333';
  const accentHex = getRoleHex('accent');

  const hexToRgb = (hex: string) => {
    if (!hex) return { r: 0, g: 0, b: 0 };
    const clean = hex.replace('#', '');
    return { r: parseInt(clean.substring(0, 2), 16) / 255, g: parseInt(clean.substring(2, 4), 16) / 255, b: parseInt(clean.substring(4, 6), 16) / 255 };
  };

  const getLuminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  const pickColor = (r: number, g: number, b: number, isText: boolean, isLargeShape: boolean, nodeName: string): string | null => {
    const lum = getLuminance(r, g, b);
    const lowerName = nodeName.toLowerCase();
    const isAccent = lowerName.includes('accent') || lowerName.includes('star') || lowerName.includes('highlight');
    if (isAccent && accentHex) return accentHex;
    if (isText) return lum < 0.45 ? textHex : backgroundHex;
    if (isLargeShape) return lum > 0.8 ? backgroundHex : surfaceHex;
    if (lum < 0.9 && lum > 0.1) return primaryColorHex;
    return lum <= 0.1 ? textHex : backgroundHex;
  };

  let fontsApplied = 0; let fontsFailed: string[] = []; let colorsApplied = 0; let gradientsApplied = 0; let nodesVisited = 0;
  let textNodesVisited = 0; let textNodesSkipped = 0;
  const roleCounts: Record<string, number> = {};

  async function traverse(node: SceneNode) {
    nodesVisited++;
    if (node.type === 'TEXT') {
      textNodesVisited++;
      const _role = classifyTextRole(node);
      roleCounts[_role] = (roleCounts[_role] || 0) + 1;
      if (!resolvedHeading && !resolvedBody) textNodesSkipped++;
      try {
        if (typeof node.fontName === 'symbol') {
          const fonts = node.getRangeAllFontNames(0, node.characters.length);
          for (const f of fonts) await figma.loadFontAsync(f);
        } else await figma.loadFontAsync(node.fontName as FontName);

        const role = classifyTextRole(node);
        const isHeading = ['display', 'h1', 'h2', 'h3', 'overline'].includes(role);
        const resolved = isHeading ? (resolvedHeading || resolvedBody) : (resolvedBody || resolvedHeading);

        if (resolved) {
          const targetStyle = pickStyleForRole(role, resolved.styles);
          const fontName = { family: resolved.family, style: targetStyle };
          try {
            await figma.loadFontAsync(fontName);
            node.fontName = fontName;
            fontsApplied++;
          } catch {
            const fallback = { family: resolved.family, style: 'Regular' };
            try { await figma.loadFontAsync(fallback); node.fontName = fallback; fontsApplied++; }
            catch { fontsFailed.push(`${resolved.family} "${targetStyle}" @ "${node.name}"`); }
          }
        }
      } catch (err) { console.warn(`[Apply Brand] Font error on "${node.name}":`, err); }
    }

    if ('fills' in node) {
      const fills = node.fills as Paint[];
      if (Array.isArray(fills) && fills.length > 0) {
        const isText = node.type === 'TEXT';
        const isLargeShape = (node.type === 'FRAME' || node.type === 'RECTANGLE') && Math.max(node.width, node.height) > 400;
        const newFills = fills.map(fill => {
          if (fill.type === 'SOLID') {
            const chosenHex = pickColor(fill.color.r, fill.color.g, fill.color.b, isText, isLargeShape, node.name);
            if (chosenHex) { colorsApplied++; return { ...fill, color: hexToRgb(chosenHex) }; }
          }
          if (fill.type.startsWith('GRADIENT')) {
            const gradientFill = fill as GradientPaint;
            if (gradientFill.gradientStops?.length) {
              const newStops = gradientFill.gradientStops.map((stop: ColorStop) => {
                const chosenHex = pickColor(stop.color.r, stop.color.g, stop.color.b, isText, isLargeShape, node.name);
                if (chosenHex) { const rgb = hexToRgb(chosenHex); return { ...stop, color: { ...stop.color, r: rgb.r, g: rgb.g, b: rgb.b } }; }
                return stop;
              });
              gradientsApplied++; return { ...gradientFill, gradientStops: newStops };
            }
          }
          return fill;
        });
        node.fills = newFills;
      }
    }
    if ('children' in node) { for (const child of node.children) await traverse(child); }
  }

  for (const node of selection) await traverse(node);

  const debugReport = {
    input: { typographySlots: (config.typography || []).map((t: any) => ({ id: t.id, label: t.label, value: t.value })), colorsCount: brandColors.length },
    resolved: { headingFont: resolvedHeading, bodyFont: resolvedBody, primaryColor: primaryColorHex, textColor: textHex },
    traversal: { nodesVisited },
    results: { fontsApplied, fontsFailed, colorsApplied, gradientsApplied },
  };

  postToUI({ type: 'BRAND_APPLY_DEBUG', report: debugReport });

  // ── Telemetry (same shape as operations audit, kind='brand') ──
  const violations: Array<{ node: string; rule: string; detail?: string }> = [];
  if (!resolvedHeading && headingEntry?.value) {
    violations.push({ node: '<config>', rule: 'heading-font-unresolved', detail: String(headingEntry.value.family || headingEntry.value.name || headingEntry.value) });
  }
  if (!resolvedBody && bodyEntry?.value) {
    violations.push({ node: '<config>', rule: 'body-font-unresolved', detail: String(bodyEntry.value.family || bodyEntry.value.name || bodyEntry.value) });
  }
  for (const f of fontsFailed) violations.push({ node: f, rule: 'font-apply-failed' });
  if (textNodesVisited > 0 && fontsApplied === 0) {
    violations.push({ node: '<batch>', rule: 'zero-font-coverage' });
  }
  if (!primaryColorHex) violations.push({ node: '<config>', rule: 'no-primary-color' });

  const telemetry = {
    rootCount: selection.length,
    nodeCount: nodesVisited,
    violations,
    stats: {
      fixed: 0, hug: 0, fill: 0, whiteFrames: 0,
      textNodes: textNodesVisited,
      // brand-specific (extra keys are preserved by the server route):
      fontsApplied, fontsFailedCount: fontsFailed.length,
      colorsApplied, gradientsApplied,
      textNodesSkipped,
      roleCounts,
    },
  };

  const summary = `Brand aplicada! ${fontsApplied} fonte(s), ${colorsApplied} cor(es), ${gradientsApplied} gradiente(s).` + (fontsFailed.length > 0 ? ` ⚠️ ${fontsFailed.length} falhas.` : '');
  postToUI({ type: 'OPERATIONS_DONE', summary, success: true, telemetry, telemetryKind: 'brand' });
}
