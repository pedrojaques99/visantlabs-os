/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';

/**
 * Template info with text layers
 */
interface TemplateInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  childCount: number;
  textLayers: TextLayerInfo[];
  hasImages: boolean;
}

interface TextLayerInfo {
  id: string;
  name: string;
  characters: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
}

/**
 * Get templates (frames with [Template] prefix)
 */
export function getTemplates(requestId?: string) {
  const templates = figma.currentPage.findAll(node =>
    node.type === 'FRAME' && node.name.startsWith('[Template]')
  ) as FrameNode[];

  const result: TemplateInfo[] = templates.map(t => {
    // Find all text nodes in template
    const textLayers: TextLayerInfo[] = [];
    const findTextNodes = (node: SceneNode) => {
      if (node.type === 'TEXT') {
        const textNode = node as TextNode;
        const fontName = typeof textNode.fontName !== 'symbol' ? textNode.fontName : null;
        textLayers.push({
          id: textNode.id,
          name: textNode.name,
          characters: textNode.characters,
          fontFamily: fontName?.family,
          fontStyle: fontName?.style,
          fontSize: typeof textNode.fontSize === 'number' ? textNode.fontSize : undefined,
        });
      }
      if ('children' in node) {
        for (const child of (node as FrameNode).children) {
          findTextNodes(child);
        }
      }
    };
    for (const child of t.children) {
      findTextNodes(child);
    }

    // Check if template has images
    let hasImages = false;
    const checkForImages = (node: SceneNode) => {
      if ('fills' in node && Array.isArray(node.fills)) {
        for (const fill of node.fills as Paint[]) {
          if (fill.type === 'IMAGE') {
            hasImages = true;
            return;
          }
        }
      }
      if ('children' in node) {
        for (const child of (node as FrameNode).children) {
          if (hasImages) return;
          checkForImages(child);
        }
      }
    };
    checkForImages(t);

    return {
      id: t.id,
      name: t.name.replace(/^\[Template\]\s*/, ''),
      width: Math.round(t.width),
      height: Math.round(t.height),
      childCount: t.children?.length || 0,
      textLayers,
      hasImages,
    };
  });

  postToUI({
    type: 'TEMPLATES_RESULT',
    requestId,
    templates: result,
  });
}
