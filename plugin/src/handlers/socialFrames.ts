/// <reference types="@figma/plugin-typings" />

import { applyOperations } from './operations';

interface BrandColor {
  hex?: string;
  value?: string;
  name?: string;
  variableId?: string;
}

function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

export async function generateSocialFrames(brandColors: BrandColor[]) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Selecione primeiro um ou mais logos', { error: true });
    return;
  }
  if (!brandColors || brandColors.length === 0) {
    figma.notify('Configure cores da brand primeiro', { error: true });
    return;
  }

  const ops: any[] = [];
  const sizes = [
    { name: '16:9', w: 1280, h: 720, id: 'wide' },
    { name: '1:1', w: 1080, h: 1080, id: 'post' }
  ];

  const pivot = selection[0];
  const startX = 'x' in pivot ? pivot.x : 0;
  const pivotY = 'y' in pivot ? pivot.y : 0;
  const pivotH = 'height' in pivot ? pivot.height : 0;
  const startY = pivotY + pivotH + 500;
  const horizontalGap = 100;
  const verticalGap = 150;

  let currentRow = 0;

  selection.forEach((sourceNode, selIdx) => {
    sizes.forEach((size) => {
      brandColors.forEach((color, colorIdx) => {
        const hex = color.value || color.hex || '#FFFFFF';
        const variableId = color.variableId;
        const frameRef = `frame_s_${selIdx}_${size.id}_${colorIdx}`;
        const x = startX + colorIdx * (size.w + horizontalGap);
        const y = startY + currentRow * (1080 + verticalGap);

        ops.push({
          type: 'CREATE_FRAME',
          ref: frameRef,
          props: {
            name: `${sourceNode.name} | ${color.name || 'Brand'}`,
            width: size.w,
            height: size.h,
            x,
            y,
            fills: [{ type: 'SOLID', color: hex, variableId }],
            cornerRadius: 12,
            clipsContent: true,
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'FIXED',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER'
          }
        });

        const srcW = 'width' in sourceNode ? sourceNode.width : 100;
        const srcH = 'height' in sourceNode ? sourceNode.height : 100;
        const maxWidth = size.w * 0.5;
        const maxHeight = size.h * 0.5;
        let scale = 1;
        if (srcW > 0 && srcH > 0) {
          scale = Math.min(maxWidth / srcW, maxHeight / srcH);
          if (scale > 1) scale = 1;
        }

        const logoRef = `logo_s_${selIdx}_${size.id}_${colorIdx}`;
        ops.push({
          type: 'CLONE_NODE',
          ref: logoRef,
          sourceNodeId: sourceNode.id,
          parentRef: frameRef,
          overrides: { name: 'Logo Clone', width: srcW * scale, height: srcH * scale }
        });

        ops.push({
          type: 'RECOLOR_NODE',
          ref: logoRef,
          props: { fills: [{ type: 'SOLID', color: getContrastColor(hex) }] }
        });
      });

      brandColors.forEach((color, vIdx) => {
        const frameRef = `frame_s_${selIdx}_${size.id}_trans_${vIdx}`;
        const x = startX + (brandColors.length + vIdx) * (size.w + horizontalGap);
        const y = startY + currentRow * (1080 + verticalGap);
        const hex = color.value || color.hex || '#FFFFFF';

        ops.push({
          type: 'CREATE_FRAME',
          ref: frameRef,
          props: {
            name: `${sourceNode.name} | Transparent - ${color.name || 'Brand'}`,
            width: size.w,
            height: size.h,
            x,
            y,
            fills: [],
            cornerRadius: 12,
            clipsContent: true,
            layoutMode: 'HORIZONTAL',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'FIXED',
            primaryAxisAlignItems: 'CENTER',
            counterAxisAlignItems: 'CENTER'
          }
        });

        const srcW = 'width' in sourceNode ? sourceNode.width : 100;
        const srcH = 'height' in sourceNode ? sourceNode.height : 100;
        const maxWidth = size.w * 0.5;
        const maxHeight = size.h * 0.5;
        let scale = 1;
        if (srcW > 0 && srcH > 0) {
          scale = Math.min(maxWidth / srcW, maxHeight / srcH);
          if (scale > 1) scale = 1;
        }

        const logoRef = `logo_s_${selIdx}_${size.id}_trans_${vIdx}`;
        ops.push({
          type: 'CLONE_NODE',
          ref: logoRef,
          sourceNodeId: sourceNode.id,
          parentRef: frameRef,
          overrides: { name: 'Logo Clone', width: srcW * scale, height: srcH * scale }
        });

        ops.push({
          type: 'RECOLOR_NODE',
          ref: logoRef,
          props: { fills: [{ type: 'SOLID', color: hex, variableId: color.variableId }] }
        });
      });

      currentRow++;
    });
    currentRow++;
  });

  await applyOperations(ops);
  figma.notify(`Social frames criados: ${ops.filter((o) => o.type === 'CREATE_FRAME').length} frames`);
}
