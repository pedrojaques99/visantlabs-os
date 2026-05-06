/// <reference types="@figma/plugin-typings" />

import type { FontGroup, FontSwapEntry } from '@shared/protocol';
import { loadFont } from '../utils/fonts';

function collectTextNodes(nodes: readonly SceneNode[]): TextNode[] {
  const result: TextNode[] = [];
  for (const node of nodes) {
    if (node.type === 'TEXT') result.push(node);
    if ('children' in node) result.push(...collectTextNodes((node as FrameNode).children));
  }
  return result;
}

export async function scanFontsInSelection(): Promise<{ groups: FontGroup[] }> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return { groups: [] };
  }

  const textNodes = collectTextNodes(selection);
  const map = new Map<string, FontGroup>();

  for (const node of textNodes) {
    let fonts: FontName[];

    if (typeof node.fontName === 'symbol') {
      fonts = node.getRangeAllFontNames(0, node.characters.length);
    } else {
      fonts = [node.fontName as FontName];
    }

    for (const font of fonts) {
      const key = `${font.family}::${font.style}`;
      const group = map.get(key);
      if (group) {
        if (!group.nodeIds.includes(node.id)) {
          group.nodeIds.push(node.id);
          group.count++;
        }
      } else {
        map.set(key, {
          key,
          family: font.family,
          style: font.style,
          count: 1,
          nodeIds: [node.id],
        });
      }
    }
  }

  return { groups: [...map.values()].sort((a, b) => b.count - a.count) };
}

export async function swapFonts(params: { swaps: FontSwapEntry[] }): Promise<{ swapped: number; failed: string[] }> {
  let swapped = 0;
  const failed: string[] = [];

  for (const swap of params.swaps) {
    const newFont = await loadFont(swap.newFamily, swap.newStyle);

    for (const nodeId of swap.nodeIds) {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type !== 'TEXT') {
        failed.push(nodeId);
        continue;
      }

      const textNode = node as TextNode;
      try {
        if (typeof textNode.fontName === 'symbol') {
          // Mixed fonts — swap only matching segments
          const len = textNode.characters.length;
          const rangeFonts = textNode.getRangeAllFontNames(0, len);
          for (const f of rangeFonts) await figma.loadFontAsync(f);

          for (let i = 0; i < len;) {
            const segFont = textNode.getRangeFontName(i, i + 1);
            if (typeof segFont !== 'symbol' && segFont.family === swap.oldFamily && segFont.style === swap.oldStyle) {
              let end = i + 1;
              while (end < len) {
                const next = textNode.getRangeFontName(end, end + 1);
                if (typeof next === 'symbol' || next.family !== swap.oldFamily || next.style !== swap.oldStyle) break;
                end++;
              }
              textNode.setRangeFontName(i, end, newFont);
              i = end;
            } else {
              i++;
            }
          }
        } else {
          const current = textNode.fontName as FontName;
          if (current.family === swap.oldFamily && current.style === swap.oldStyle) {
            await figma.loadFontAsync(current);
            textNode.fontName = newFont;
          }
        }
        swapped++;
      } catch (err) {
        failed.push(`${textNode.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { swapped, failed };
}

export async function getStylesForFamily(params: { family: string }): Promise<{ styles: string[] }> {
  const fonts = await figma.listAvailableFontsAsync();
  const styles = fonts
    .filter(f => f.fontName.family === params.family)
    .map(f => f.fontName.style);
  return { styles: [...new Set(styles)].sort() };
}
