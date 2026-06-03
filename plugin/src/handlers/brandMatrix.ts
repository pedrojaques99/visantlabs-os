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
  createSections?: boolean;
}

export interface LogoMatrixPayload {
  colors: ColorStyleToken[];
  createSections?: boolean;
}

function hexFromRGB(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function luminance(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / (1000 * 255);
}

function safeName(name: string): string {
  return name
    .replace(/[^\w\s\-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

const EXPORT_PRESETS = {
  print: [
    { format: 'PNG' as const, constraint: { type: 'SCALE' as const, value: 2 } },
    { format: 'SVG' as const },
    { format: 'PDF' as const },
  ],
  screen: [
    { format: 'PNG' as const, constraint: { type: 'SCALE' as const, value: 1 } },
    { format: 'SVG' as const },
    { format: 'PDF' as const },
  ],
};

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

// ─── Full Brand Matrix ───────────────────────────────────────────────────────

export async function generateBrandMatrix(payload: GenerateAssetsPayload) {
  const { colors, assets, createSections: useSections = true } = payload;

  if (!colors || colors.length === 0) {
    figma.notify('Nenhuma cor selecionada.', { error: true });
    return;
  }
  if (!assets || assets.length === 0) {
    figma.notify('Nenhum asset mapeado. Selecione elementos primeiro.', { error: true });
    return;
  }

  figma.notify(`Gerando Brand Matrix: ${colors.length} cores × ${assets.length} assets…`);

  const sectionDefs = [
    { key: 'horizontal', name: 'Horizontal/' },
    { key: 'icon', name: 'Icon/' },
    { key: 'vertical', name: 'Vertical/' },
    { key: 'identity', name: 'Identidade Visual/' },
    { key: 'social', name: 'Social Media/' },
    { key: 'mockups', name: 'Mockups/' },
  ];

  const ops: any[] = [];
  const FRAME_W = 600;
  const FRAME_H = 400;
  const FRAME_GAP = 24;
  const PAD = 24;
  const SUB_W = FRAME_W + PAD * 2;
  const COL_GAP = 40;
  const SECTION_PAD = 40;
  const SECTION_GAP = 100;
  const SOCIAL_SIZE = 1080;
  const SOCIAL_GAP = 24;
  const BREATHE = 0.55;

  const startX = figma.viewport.center.x;
  const startY = figma.viewport.center.y;
  let cursorX = startX;

  // Pre-fetch source dimensions for rescale
  const assetDims = new Map<string, { w: number; h: number; scale: number }>();
  for (const asset of assets) {
    const node = (await figma.getNodeByIdAsync(asset.nodeId)) as SceneNode | null;
    if (node && 'width' in node) {
      const w = node.width;
      const h = node.height;
      const maxW = FRAME_W * BREATHE;
      const maxH = FRAME_H * BREATHE;
      let s = Math.min(maxW / w, maxH / h);
      if (s > 1) s = 1;
      assetDims.set(asset.nodeId, { w, h, scale: s });
    }
  }

  for (let si = 0; si < sectionDefs.length; si++) {
    const def = sectionDefs[si];
    const sRef = `section_${def.key}`;

    if (def.key === 'mockups') {
      if (useSections) {
        ops.push({
          type: 'CREATE_SECTION',
          ref: sRef,
          props: { name: def.name, width: 800, height: 800, x: cursorX, y: startY },
        });
      }
      cursorX += 800 + SECTION_GAP;
      continue;
    }

    const matchingAssets = assets.filter((a) => a.section === def.key);
    const isSocialEmpty = matchingAssets.length === 0 && def.key === 'social';

    if (matchingAssets.length === 0 && !isSocialEmpty) continue;

    if (isSocialEmpty) {
      const cols = Math.min(colors.length, 3);
      const rows = Math.ceil(colors.length / cols);
      const secW = cols * (SOCIAL_SIZE + SOCIAL_GAP) - SOCIAL_GAP + SECTION_PAD * 2;
      const secH = rows * (SOCIAL_SIZE + SOCIAL_GAP) - SOCIAL_GAP + SECTION_PAD * 2;

      if (useSections) {
        ops.push({
          type: 'CREATE_SECTION',
          ref: sRef,
          props: { name: def.name, width: secW, height: secH, x: cursorX, y: startY },
        });
      }

      for (let ci = 0; ci < colors.length; ci++) {
        const color = colors[ci];
        const col = ci % cols;
        const row = Math.floor(ci / cols);
        const fRef = `social_frame_${ci}`;
        const baseX = useSections ? SECTION_PAD : cursorX;
        const baseY = useSections ? SECTION_PAD : startY;
        ops.push({
          type: 'CREATE_FRAME',
          ref: fRef,
          ...(useSections && { parentRef: sRef }),
          props: {
            name: safeName(`Social_On_${color.name}`),
            width: SOCIAL_SIZE,
            height: SOCIAL_SIZE,
            x: baseX + col * (SOCIAL_SIZE + SOCIAL_GAP),
            y: baseY + row * (SOCIAL_SIZE + SOCIAL_GAP),
            fills: [{ type: 'SOLID', color: hexFromRGB(color.r, color.g, color.b) }],
          },
        });
        ops.push({ type: 'SET_EXPORT_SETTINGS', ref: fRef, exportSettings: EXPORT_PRESETS.screen });
      }
      cursorX += secW + SECTION_GAP;
      continue;
    }

    const totalFrames = matchingAssets.length * colors.length;
    const colContentH = totalFrames * (FRAME_H + FRAME_GAP) - FRAME_GAP + PAD * 2;
    const secW = SUB_W * 2 + COL_GAP + SECTION_PAD * 2;
    const secH = colContentH + SECTION_PAD * 2;

    if (useSections) {
      ops.push({
        type: 'CREATE_SECTION',
        ref: sRef,
        props: { name: def.name, width: secW, height: secH, x: cursorX, y: startY },
      });
    }

    const offsetX = useSections ? SECTION_PAD : cursorX;
    const offsetY = useSections ? SECTION_PAD : startY;

    // Background column
    const bgRef = `${sRef}_bg`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: bgRef,
      ...(useSections && { parentRef: sRef }),
      props: {
        name: `${def.name}Background/`,
        x: offsetX,
        y: offsetY,
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        width: SUB_W,
        itemSpacing: FRAME_GAP,
        paddingTop: PAD,
        paddingRight: PAD,
        paddingBottom: PAD,
        paddingLeft: PAD,
        fills: [],
      },
    });

    for (const asset of matchingAssets) {
      const dims = assetDims.get(asset.nodeId);
      for (let ci = 0; ci < colors.length; ci++) {
        const color = colors[ci];
        const hex = hexFromRGB(color.r, color.g, color.b);
        const isDark = luminance(color.r, color.g, color.b) < 0.5;
        const contrastHex = isDark ? '#FFFFFF' : '#000000';
        const sAsset = safeName(asset.nodeName);
        const sColor = safeName(color.name);

        const frameRef = `frame_${def.key}_${asset.nodeId}_${ci}`;
        ops.push({
          type: 'CREATE_FRAME',
          ref: frameRef,
          parentRef: bgRef,
          props: {
            name: `${sAsset}_On_${sColor}`,
            width: FRAME_W,
            height: FRAME_H,
            fills: [{ type: 'SOLID', color: hex }],
            clipsContent: true,
          },
        });

        const cloneRef = `clone_${def.key}_${asset.nodeId}_${ci}`;
        const cloneProps: any = {};
        if (dims && dims.scale < 1) {
          const cW = dims.w * dims.scale;
          const cH = dims.h * dims.scale;
          cloneProps.rescale = dims.scale;
          cloneProps.x = (FRAME_W - cW) / 2;
          cloneProps.y = (FRAME_H - cH) / 2;
        }
        ops.push({
          type: 'CLONE_NODE',
          ref: cloneRef,
          sourceNodeId: asset.nodeId,
          parentRef: frameRef,
          props: cloneProps,
        });

        ops.push({
          type: 'RECOLOR_NODE',
          ref: cloneRef,
          props: { fills: [{ type: 'SOLID', color: contrastHex }] },
        });

        ops.push({
          type: 'SET_EXPORT_SETTINGS',
          ref: frameRef,
          exportSettings: EXPORT_PRESETS.print,
        });
      }
    }

    // Isolated column
    const isoRef = `${sRef}_iso`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: isoRef,
      ...(useSections && { parentRef: sRef }),
      props: {
        name: `${def.name}Isolated/`,
        x: offsetX + SUB_W + COL_GAP,
        y: offsetY,
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        width: SUB_W,
        itemSpacing: FRAME_GAP,
        paddingTop: PAD,
        paddingRight: PAD,
        paddingBottom: PAD,
        paddingLeft: PAD,
        fills: [],
      },
    });

    for (const asset of matchingAssets) {
      const dims = assetDims.get(asset.nodeId);
      for (let ci = 0; ci < colors.length; ci++) {
        const color = colors[ci];
        const hex = hexFromRGB(color.r, color.g, color.b);
        const sAsset = safeName(asset.nodeName);
        const sColor = safeName(color.name);

        const isoFrameRef = `iso_${def.key}_${asset.nodeId}_${ci}`;
        ops.push({
          type: 'CREATE_FRAME',
          ref: isoFrameRef,
          parentRef: isoRef,
          props: {
            name: `${sAsset}_${sColor}_Isolated`,
            width: FRAME_W,
            height: FRAME_H,
            fills: [],
            clipsContent: true,
          },
        });

        const isoCloneRef = `iso_clone_${def.key}_${asset.nodeId}_${ci}`;
        const isoCloneProps: any = {};
        if (dims && dims.scale < 1) {
          const cW = dims.w * dims.scale;
          const cH = dims.h * dims.scale;
          isoCloneProps.rescale = dims.scale;
          isoCloneProps.x = (FRAME_W - cW) / 2;
          isoCloneProps.y = (FRAME_H - cH) / 2;
        }
        ops.push({
          type: 'CLONE_NODE',
          ref: isoCloneRef,
          sourceNodeId: asset.nodeId,
          parentRef: isoFrameRef,
          props: isoCloneProps,
        });

        ops.push({
          type: 'RECOLOR_NODE',
          ref: isoCloneRef,
          props: { fills: [{ type: 'SOLID', color: hex }] },
        });

        ops.push({
          type: 'SET_EXPORT_SETTINGS',
          ref: isoFrameRef,
          exportSettings: EXPORT_PRESETS.print,
        });
      }
    }

    cursorX += secW + SECTION_GAP;
  }

  await applyOperations(ops);

  const createdFrames = ops.filter((o) => o.type === 'CREATE_FRAME').length;
  const createdSections = ops.filter((o) => o.type === 'CREATE_SECTION').length;
  figma.notify(`Brand Matrix: ${createdSections} seções, ${createdFrames} frames ✓`);

  postToUI({ type: 'OPERATIONS_DONE' });
}

// ─── Logo Matrix (simplified) ────────────────────────────────────────────────

export async function generateLogoMatrix(payload: LogoMatrixPayload) {
  const { colors, createSections: useSections = false } = payload;
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.notify('Selecione um logo/frame/layer primeiro.', { error: true });
    return;
  }
  if (!colors || colors.length === 0) {
    figma.notify('Nenhuma cor selecionada.', { error: true });
    return;
  }

  figma.notify(`Gerando Logo Matrix: ${colors.length} variações…`);

  const source = selection[0];
  const srcW = 'width' in source ? source.width : 200;
  const srcH = 'height' in source ? source.height : 200;
  const srcName = safeName(source.name);

  const FRAME_W = 1920;
  const FRAME_H = 1080;
  const GAP = 60;
  const ROW_GAP = 60;
  const BREATHE = 0.45;
  const maxLogoW = FRAME_W * BREATHE;
  const maxLogoH = FRAME_H * BREATHE;
  let scale = Math.min(maxLogoW / srcW, maxLogoH / srcH);
  if (scale > 1) scale = 1;
  const cloneW = srcW * scale;
  const cloneH = srcH * scale;

  const ISO_PAD = 80;

  const startX = source.x + srcW + GAP * 2;
  const startY = source.y;

  const ops: any[] = [];
  const SECTION_PAD = 40;
  const totalW = colors.length * (FRAME_W + GAP) - GAP;
  const isoEstH = srcH + ISO_PAD * 2;

  if (useSections) {
    ops.push({
      type: 'CREATE_SECTION',
      ref: 'lm_sec_bg',
      props: {
        name: `${srcName}_Background/`,
        width: totalW + SECTION_PAD * 2,
        height: FRAME_H + SECTION_PAD * 2,
        x: startX,
        y: startY,
      },
    });
    ops.push({
      type: 'CREATE_SECTION',
      ref: 'lm_sec_iso',
      props: {
        name: `${srcName}_Isolated/`,
        width: totalW + SECTION_PAD * 2,
        height: isoEstH + SECTION_PAD * 2,
        x: startX,
        y: startY + FRAME_H + SECTION_PAD * 2 + ROW_GAP,
      },
    });
  }

  const bgBaseX = useSections ? SECTION_PAD : 0;
  const bgBaseY = useSections ? SECTION_PAD : 0;
  const isoBaseX = useSections ? SECTION_PAD : 0;
  const isoBaseY = useSections ? SECTION_PAD : 0;

  for (let ci = 0; ci < colors.length; ci++) {
    const color = colors[ci];
    const hexColor = hexFromRGB(color.r, color.g, color.b);
    const isDark = luminance(color.r, color.g, color.b) < 0.5;
    const sColor = safeName(color.name);

    const bgRef = `lm_bg_${ci}`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: bgRef,
      ...(useSections && { parentRef: 'lm_sec_bg' }),
      props: {
        name: `${srcName}_On_${sColor}`,
        width: FRAME_W,
        height: FRAME_H,
        x: (useSections ? bgBaseX : startX) + ci * (FRAME_W + GAP),
        y: useSections ? bgBaseY : startY,
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

    ops.push({ type: 'SET_EXPORT_SETTINGS', ref: bgRef, exportSettings: EXPORT_PRESETS.print });

    const isoRef = `lm_iso_${ci}`;
    ops.push({
      type: 'CREATE_FRAME',
      ref: isoRef,
      ...(useSections && { parentRef: 'lm_sec_iso' }),
      props: {
        name: `${srcName}_${sColor}_Isolated`,
        x: (useSections ? isoBaseX : startX) + ci * (FRAME_W + GAP),
        y: useSections ? isoBaseY : startY + FRAME_H + ROW_GAP,
        fills: [],
        layoutMode: 'HORIZONTAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'AUTO',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: ISO_PAD,
        paddingRight: ISO_PAD,
        paddingBottom: ISO_PAD,
        paddingLeft: ISO_PAD,
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

    ops.push({ type: 'SET_EXPORT_SETTINGS', ref: isoRef, exportSettings: EXPORT_PRESETS.print });
  }

  await applyOperations(ops);
  figma.notify(`Logo Matrix: ${colors.length} variações ✓`);
  postToUI({ type: 'OPERATIONS_DONE' });
}
