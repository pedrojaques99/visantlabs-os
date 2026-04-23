/// <reference types="@figma/plugin-typings" />

/**
 * RESPONSIVE MULTIPLIER
 *
 * Takes the currently selected frame and produces copies in multiple common
 * formats. Frames with auto-layout adapt cleanly; fixed-layout frames get
 * a proportional scale of their children as a best effort.
 *
 * 100% scriptable, no LLM. Designed for the "export kit" workflow: one hero
 * frame → full set of social/marketing deliverables in one click.
 */

export interface ResponsiveFormat {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const DEFAULT_FORMATS: ResponsiveFormat[] = [
  { id: 'story',     label: 'Story 9:16',       width: 1080, height: 1920 },
  { id: 'square',    label: 'Square 1:1',       width: 1080, height: 1080 },
  { id: 'portrait',  label: 'Portrait 4:5',     width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape 16:9',   width: 1920, height: 1080 },
  { id: 'og',        label: 'Open Graph 1.91:1',width: 1200, height: 628 },
];

/**
 * Scale a fixed-layout frame's children proportionally to the new size.
 * Auto-layout frames handle resizing on their own — this is the fallback.
 */
function scaleChildrenProportionally(
  frame: FrameNode | ComponentNode | InstanceNode,
  scaleX: number,
  scaleY: number
) {
  if (!('children' in frame)) return;
  for (const child of frame.children) {
    if ('x' in child && 'y' in child) {
      const newX = child.x * scaleX;
      const newY = child.y * scaleY;
      const newW = ('width' in child) ? child.width * scaleX : 0;
      const newH = ('height' in child) ? child.height * scaleY : 0;

      if ('resize' in child && newW > 0 && newH > 0) {
        try {
          (child as any).resize(Math.max(1, newW), Math.max(1, newH));
        } catch {
          // Some nodes refuse resize (e.g. text with auto-width) — skip quietly.
        }
      }
      child.x = newX;
      child.y = newY;
    }
  }
}

function isResizable(node: SceneNode): node is FrameNode | ComponentNode | InstanceNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
}

export async function multiplyResponsive(formats: ResponsiveFormat[] = DEFAULT_FORMATS) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Selecione um frame para multiplicar ✨');
    return;
  }

  const source = selection[0];
  if (!isResizable(source)) {
    figma.notify('Selecione um FRAME, COMPONENT ou INSTANCE');
    return;
  }

  const originalW = source.width;
  const originalH = source.height;
  const gap = 80;

  // Place the new frames to the right of the source in a row.
  let cursorX = source.x + source.width + gap;
  const cursorY = source.y;
  const createdNodes: SceneNode[] = [];

  for (const format of formats) {
    // Skip the format that matches the source exactly.
    if (Math.round(originalW) === format.width && Math.round(originalH) === format.height) {
      continue;
    }

    const clone = source.clone();
    clone.name = `${source.name} — ${format.label}`;
    clone.x = cursorX;
    clone.y = cursorY;

    const hasAutoLayout =
      'layoutMode' in clone && (clone as FrameNode).layoutMode !== 'NONE';

    if (hasAutoLayout) {
      // Temporarily switch to fixed sizing so resize() takes effect, then let
      // auto-layout reflow the children.
      const frame = clone as FrameNode;
      const prevPrimary = frame.primaryAxisSizingMode;
      const prevCounter = frame.counterAxisSizingMode;
      frame.primaryAxisSizingMode = 'FIXED';
      frame.counterAxisSizingMode = 'FIXED';
      frame.resize(format.width, format.height);
      // Restore original sizing preferences when possible (keeps intent).
      try {
        frame.primaryAxisSizingMode = prevPrimary;
        frame.counterAxisSizingMode = prevCounter;
      } catch {
        // Some combos are invalid on the new size — leave as FIXED.
      }
    } else {
      const scaleX = format.width / originalW;
      const scaleY = format.height / originalH;
      clone.resize(format.width, format.height);
      scaleChildrenProportionally(clone, scaleX, scaleY);
    }

    figma.currentPage.appendChild(clone);
    createdNodes.push(clone);
    cursorX += format.width + gap;
  }

  if (createdNodes.length === 0) {
    figma.notify('Nenhum formato novo para gerar');
    return;
  }

  figma.currentPage.selection = createdNodes;
  figma.viewport.scrollAndZoomIntoView([source, ...createdNodes]);
  figma.notify(`${createdNodes.length} formato(s) gerado(s) 📐`);
}
