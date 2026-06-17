/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

export interface SlideFrame {
  name: string;
  png: string; // base64 data URL
}

export interface SlidePage {
  pageName: string;
  frames: SlideFrame[];
  text: string;
}

export interface SlidesAnalysisResult {
  pages: SlidePage[];
  totalFrames: number;
}

function collectText(node: BaseNode): string {
  if ('visible' in node && !(node as SceneNode).visible) return '';
  if (node.type === 'TEXT') return (node as TextNode).characters.trim();
  if ('children' in node) {
    return (node as ChildrenMixin).children.map(collectText).filter(Boolean).join('\n');
  }
  return '';
}

/**
 * Scans all pages in the document, exports each top-level frame as PNG,
 * and collects all text per page. Intended for slides analysis flow.
 */
export async function scanAllSlidesForBrand(maxWidth = 800): Promise<void> {
  const result: SlidesAnalysisResult = { pages: [], totalFrames: 0 };

  try {
    for (const page of figma.root.children) {
      await figma.setCurrentPageAsync(page);

      const slidePage: SlidePage = {
        pageName: page.name,
        frames: [],
        text: '',
      };

      const allTexts: string[] = [];

      for (const node of page.children) {
        // collect text
        const nodeText = collectText(node);
        if (nodeText) allTexts.push(nodeText);

        // export frame as PNG
        try {
          const bytes = await node.exportAsync({
            format: 'PNG',
            constraint: { type: 'WIDTH', value: maxWidth },
          });
          const b64 = figma.base64Encode(bytes);
          slidePage.frames.push({
            name: node.name,
            png: `data:image/png;base64,${b64}`,
          });
        } catch {
          // skip un-exportable nodes
        }
      }

      slidePage.text = allTexts.join('\n\n');

      if (slidePage.frames.length > 0) {
        result.pages.push(slidePage);
        result.totalFrames += slidePage.frames.length;
      }
    }
  } catch (e) {
    console.warn('[Plugin] scanAllSlidesForBrand error:', e);
  }

  postToUI({ type: 'SLIDES_ANALYSIS_RESULT', result });
}
