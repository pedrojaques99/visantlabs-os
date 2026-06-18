/// <reference types="@figma/plugin-typings" />

import { postToUI } from '../utils/postMessage';
import { parseSlotName, aspectLabel } from '../../../src/lib/figma-slots';
import type { TemplateSlot, TemplateVariableInfo } from '../../../src/lib/figma-slots';

/**
 * Template info + self-describing MANIFEST. A frame named `[Template] <Name>` is a
 * preset; its fillable `#slots` and themed variables are derived from the naming
 * convention (see `figma-slots`). A human authors by naming layers; an AI reads
 * the manifest and fills slots — never touching geometry.
 */
interface TextLayerInfo {
  id: string;
  name: string;
  characters: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
}

interface TemplateInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  aspect: string;
  childCount: number;
  textLayers: TextLayerInfo[];
  hasImages: boolean;
  slots: TemplateSlot[];
  variables: TemplateVariableInfo[];
}

function isImageCapable(node: SceneNode): boolean {
  if (!('fills' in node)) return false;
  const t = node.type;
  return (
    t === 'RECTANGLE' ||
    t === 'ELLIPSE' ||
    t === 'FRAME' ||
    t === 'VECTOR' ||
    t === 'POLYGON' ||
    t === 'STAR' ||
    t === 'COMPONENT' ||
    t === 'INSTANCE'
  );
}

/** Get templates ([Template]-prefixed frames) with their slot+variable manifest. */
export async function getTemplates(requestId?: string) {
  const templates = figma.currentPage.findAll(
    (node) => node.type === 'FRAME' && node.name.startsWith('[Template]')
  ) as FrameNode[];

  const result: TemplateInfo[] = [];

  for (const t of templates) {
    const textLayers: TextLayerInfo[] = [];
    const slots: TemplateSlot[] = [];
    const variableIds = new Set<string>();
    let hasImages = false;

    const walk = (node: SceneNode) => {
      // Text-layer catalog (kept for back-compat with the existing UI).
      if (node.type === 'TEXT') {
        const tn = node as TextNode;
        const fontName = typeof tn.fontName !== 'symbol' ? tn.fontName : null;
        textLayers.push({
          id: tn.id,
          name: tn.name,
          characters: tn.characters,
          fontFamily: fontName?.family,
          fontStyle: fontName?.style,
          fontSize: typeof tn.fontSize === 'number' ? tn.fontSize : undefined,
        });
      }

      // Slot detection from the `#name` convention.
      const parsed = parseSlotName(node.name);
      if (parsed) {
        const type = node.type === 'TEXT' ? 'text' : isImageCapable(node) ? 'image' : 'text';
        slots.push({
          id: parsed.id,
          type,
          optional: parsed.optional,
          list: parsed.list,
          nodeId: node.id,
          sample: node.type === 'TEXT' ? (node as TextNode).characters : undefined,
        });
      }

      // Images present?
      if ('fills' in node && Array.isArray(node.fills)) {
        for (const fill of node.fills as Paint[]) {
          if (fill.type === 'IMAGE') hasImages = true;
        }
      }

      // Collect bound variable ids (the theme vars this template uses).
      const bound = (node as any).boundVariables as Record<string, any> | undefined;
      if (bound) {
        for (const field of Object.keys(bound)) {
          const ref = bound[field];
          const refs = Array.isArray(ref) ? ref : [ref];
          for (const r of refs) {
            const id = r?.id || r?.[0]?.id;
            if (typeof id === 'string') variableIds.add(id);
          }
        }
      }

      if ('children' in node) for (const c of (node as FrameNode).children) walk(c);
    };
    for (const child of t.children) walk(child);

    // Resolve variable ids → { name, type, collection }.
    const variables: TemplateVariableInfo[] = [];
    for (const id of variableIds) {
      try {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (!v) continue;
        let collectionName: string | undefined;
        try {
          const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
          collectionName = col?.name;
        } catch {
          /* best-effort */
        }
        variables.push({
          name: v.name,
          type: v.resolvedType as TemplateVariableInfo['type'],
          collectionId: v.variableCollectionId,
          collectionName,
        });
      } catch {
        /* skip unresolved */
      }
    }

    result.push({
      id: t.id,
      name: t.name.replace(/^\[Template\]\s*/, ''),
      width: Math.round(t.width),
      height: Math.round(t.height),
      aspect: aspectLabel(t.width, t.height),
      childCount: t.children?.length || 0,
      textLayers,
      hasImages,
      slots,
      variables,
    });
  }

  postToUI({ type: 'TEMPLATES_RESULT', requestId, templates: result });
}
