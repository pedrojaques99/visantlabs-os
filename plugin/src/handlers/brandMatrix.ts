/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';
import { applyOperations } from './operations';

export interface ColorStyleToken {
  id: string;
  name: string;
  r: number;
  g: number;
  b: number;
}

export interface AssetMapping {
  nodeId: string;
  nodeName: string;
  section: string;
}

export interface GenerateAssetsPayload {
  colors: ColorStyleToken[];
  assets: AssetMapping[];
}

export interface LogoMatrixPayload {
  colors: ColorStyleToken[];
}

function hexFromRGB(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function luminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / (1000 * 255);
}

export async function scanPaintStyles(): Promise<ColorStyleToken[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  const tokens: ColorStyleToken[] = [];

  for (const style of styles) {
    const paint = style.paints[0];
    if (paint?.type === 'SOLID' && paint.visible !== false) {
      tokens.push({
        id: style.id,
        name: style.name,
        r: Math.round(paint.color.r * 255),
        g: Math.round(paint.color.g * 255),
        b: Math.round(paint.color.b * 255),
      });
    }
  }

  return tokens;
}

export async function generateBrandMatrix(payload: GenerateAssetsPayload) {
  const { colors, assets } = payload;

  if (!colors || colors.length === 0) {
    figma.notify('Nenhuma cor selecionada.', { error: true });
    return;
  }
  if (!assets || assets.length === 0) {
    figma.notify('Nenhum asset mapeado. Selecione elementos primeiro.', { error: true });
    return;
  }

  const sectionDefs = [
    { key: 'horizontal', name: 'Horizontal/' },
    { key: 'icon', name: 'Icon/' },
    { key: 'vertical', name: 'Vertical/' },
    { key: 'identity', name: 'Identidade Visual/' },
    { key: 'social', name: 'Social Media/' },
    { key: 'mockups', name: 'Mockups/' },
  ];

  const ops: any[] = [];
  const SECTION_W = 800;
  const SECTION_H = 1200;
  const SECTION_GAP = 100;
  const FRAME_W = 600;
  const FRAME_H = 400;
  const FRAME_GAP = 24;

  const startX = figma.viewport.center.x - ((sectionDefs.length * (SECTION_W + SECTION_GAP)) / 2);
  const startY = figma.viewport.center.y - SECTION_H / 2;

  for (let si = 0; si < sectionDefs.length; si++) {
    const def = sectionDefs[si];
    const sRef = `section_${def.key}`;
    const sX = startX + si * (SECTION_W + SECTION_GAP);

    ops.push({
      type: 'CREATE_SECTION',
      ref: sRef,
      props: {
        name: def.name,
        width: SECTION_W,
        height: SECTION_H,
        x: sX,
        y: startY,
      },
    });

    if (def.key === 'mockups') continue;

    const matchingAssets = assets.filter(a => a.section === def.key);
    if (matchingAssets.length === 0 && (def.key === 'social')) {
      // Social Media: create 1080x1080 frames with brand colors
      for (let ci = 0; ci < colors.length; ci++) {
        const color = colors[ci];
        const fRef = `social_frame_${ci}`;
        ops.push({
          type: 'CREATE_FRAME',
          ref: fRef,
          parentRef: sRef,
          props: {
            name: `Social_On_${color.name}`,
            width: 1080,
            height: 1080,
            fills: [{ type: 'SOLID', color: hexFromRGB(color.r, color.g, color.b) }],
          },
        });
        ops.push({
          type: 'SET_EXPORT_SETTINGS',
          ref: fRef,
          exportSettings: [
            { format: 'PNG', constraint: { type: 'SCALE', value: 1 } },
            { format: 'SVG' },
            { format: 'PDF' },
          ],
        });
      }
      continue;
    }

    if (matchingAssets.length === 0) continue;

    // Background sub-section
    const bgSectionRef = `${sRef}_bg`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: bgSectionRef,
      parentRef: sRef,
      props: {
        name: `${def.name}Background/`,
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        width: FRAME_W + 48,
        itemSpacing: FRAME_GAP,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        fills: [],
      },
    });

    for (const asset of matchingAssets) {
      for (let ci = 0; ci < colors.length; ci++) {
        const color = colors[ci];
        const hex = hexFromRGB(color.r, color.g, color.b);
        const isDark = luminance(color.r, color.g, color.b) < 0.5;
        const contrastHex = isDark ? '#FFFFFF' : '#000000';

        const frameRef = `frame_${def.key}_${asset.nodeId}_${ci}`;
        ops.push({
          type: 'CREATE_FRAME',
          ref: frameRef,
          parentRef: bgSectionRef,
          props: {
            name: `${asset.nodeName}_On_${color.name}`,
            width: FRAME_W,
            height: FRAME_H,
            fills: [{ type: 'SOLID', color: hex }],
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'FIXED',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER',
            clipsContent: true,
          },
        });

        const cloneRef = `clone_${def.key}_${asset.nodeId}_${ci}`;
        ops.push({
          type: 'CLONE_NODE',
          ref: cloneRef,
          sourceNodeId: asset.nodeId,
          parentRef: frameRef,
        });

        ops.push({
          type: 'RECOLOR_NODE',
          ref: cloneRef,
          props: { fills: [{ type: 'SOLID', color: contrastHex }] },
        });

        ops.push({
          type: 'SET_EXPORT_SETTINGS',
          ref: frameRef,
          exportSettings: [
            { format: 'PNG', constraint: { type: 'SCALE', value: 2 } },
            { format: 'SVG' },
            { format: 'PDF' },
          ],
        });
      }
    }

    // Isolated (no background) sub-section
    const isoSectionRef = `${sRef}_iso`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: isoSectionRef,
      parentRef: sRef,
      props: {
        name: `${def.name}Isolated/`,
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        width: FRAME_W + 48,
        itemSpacing: FRAME_GAP,
        paddingTop: 24,
        paddingRight: 24,
        paddingBottom: 24,
        paddingLeft: 24,
        fills: [],
        x: FRAME_W + 72,
      },
    });

    for (const asset of matchingAssets) {
      for (let ci = 0; ci < colors.length; ci++) {
        const color = colors[ci];
        const hex = hexFromRGB(color.r, color.g, color.b);

        const isoFrameRef = `iso_${def.key}_${asset.nodeId}_${ci}`;
        ops.push({
          type: 'CREATE_FRAME',
          ref: isoFrameRef,
          parentRef: isoSectionRef,
          props: {
            name: `${asset.nodeName}_${color.name}_Isolated`,
            width: FRAME_W,
            height: FRAME_H,
            fills: [],
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'FIXED',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER',
            clipsContent: true,
          },
        });

        const isoCloneRef = `iso_clone_${def.key}_${asset.nodeId}_${ci}`;
        ops.push({
          type: 'CLONE_NODE',
          ref: isoCloneRef,
          sourceNodeId: asset.nodeId,
          parentRef: isoFrameRef,
        });

        ops.push({
          type: 'RECOLOR_NODE',
          ref: isoCloneRef,
          props: { fills: [{ type: 'SOLID', color: hex }] },
        });

        ops.push({
          type: 'SET_EXPORT_SETTINGS',
          ref: isoFrameRef,
          exportSettings: [
            { format: 'PNG', constraint: { type: 'SCALE', value: 2 } },
            { format: 'SVG' },
            { format: 'PDF' },
          ],
        });
      }
    }
  }

  await applyOperations(ops);

  const createdFrames = ops.filter(o => o.type === 'CREATE_FRAME').length;
  const createdSections = ops.filter(o => o.type === 'CREATE_SECTION').length;
  figma.notify(`Brand Matrix criada: ${createdSections} seções, ${createdFrames} frames`);

  postToUI({ type: 'OPERATIONS_DONE' });
}

export async function generateLogoMatrix(payload: LogoMatrixPayload) {
  const { colors } = payload;
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.notify('Selecione um logo/frame/layer primeiro.', { error: true });
    return;
  }
  if (!colors || colors.length === 0) {
    figma.notify('Nenhuma cor selecionada.', { error: true });
    return;
  }

  const source = selection[0];
  const srcW = 'width' in source ? source.width : 200;
  const srcH = 'height' in source ? source.height : 200;

  const FRAME_W = 1920;
  const FRAME_H = 1080;
  const GAP = 60;
  const BREATHE = 0.45; // logo occupies max 45% of frame
  const maxLogoW = FRAME_W * BREATHE;
  const maxLogoH = FRAME_H * BREATHE;
  let scale = Math.min(maxLogoW / srcW, maxLogoH / srcH);
  if (scale > 1) scale = 1;
  const cloneW = srcW * scale;
  const cloneH = srcH * scale;

  const startX = source.x + srcW + GAP * 2;
  const startY = source.y;

  const ops: any[] = [];

  for (let ci = 0; ci < colors.length; ci++) {
    const color = colors[ci];
    const hexColor = hexFromRGB(color.r, color.g, color.b);
    const isDark = luminance(color.r, color.g, color.b) < 0.5;

    // ── With background: 1920×1080 fixed, logo scaled with breathing room ──
    const bgRef = `lm_bg_${ci}`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: bgRef,
      props: {
        name: `${source.name}_On_${color.name}`,
        width: FRAME_W,
        height: FRAME_H,
        x: startX + ci * (FRAME_W + GAP),
        y: startY,
        fills: [{ type: 'SOLID', color: hexColor }],
        clipsContent: true,
      },
    });

    const cloneRef = `lm_clone_${ci}`;
    ops.push({
      type: 'CLONE_NODE',
      ref: cloneRef,
      sourceNodeId: source.id,
      parentRef: bgRef,
      props: {
        rescale: scale,
        x: (FRAME_W - cloneW) / 2,
        y: (FRAME_H - cloneH) / 2,
      },
    });

    ops.push({
      type: 'RECOLOR_NODE',
      ref: cloneRef,
      props: { fills: [{ type: 'SOLID', color: isDark ? '#FFFFFF' : '#000000' }] },
    });

    // ── Without background: hug content with padding ──
    const PAD = 80;
    const isoRef = `lm_iso_${ci}`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: isoRef,
      props: {
        name: `${source.name}_${color.name}`,
        x: startX + ci * (FRAME_W + GAP),
        y: startY + FRAME_H + GAP,
        fills: [],
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: PAD,
        paddingRight: PAD,
        paddingBottom: PAD,
        paddingLeft: PAD,
      },
    });

    const isoCloneRef = `lm_iso_clone_${ci}`;
    ops.push({
      type: 'CLONE_NODE',
      ref: isoCloneRef,
      sourceNodeId: source.id,
      parentRef: isoRef,
    });

    ops.push({
      type: 'RECOLOR_NODE',
      ref: isoCloneRef,
      props: { fills: [{ type: 'SOLID', color: hexColor }] },
    });
  }

  await applyOperations(ops);
  figma.notify(`Logo Matrix: ${colors.length} variações criadas`);
  postToUI({ type: 'OPERATIONS_DONE' });
}
