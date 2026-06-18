/**
 * Server-side template discovery — read a brand's Figma file via the REST API and
 * derive the `[Template]` manifests (the same contract the plugin scan produces).
 * Listing is read-only (any Figma plan); only the canvas FILL needs the plugin.
 *
 * Lets an agent do the full loop: `figma-templates-list` (discover what exists +
 * each template's #slots) → `figma-preset-fill` (build the deterministic op).
 */
import { parseSlotName, aspectLabel } from '../../src/lib/figma-slots.js';
import type { TemplateManifest, TemplateSlot } from '../../src/lib/figma-slots.js';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

/** Build a manifest from a Figma REST FRAME node. */
function manifestFromFrame(frame: any): TemplateManifest {
  const bb = frame.absoluteBoundingBox || {};
  const width = Math.round(bb.width || frame.size?.x || 0);
  const height = Math.round(bb.height || frame.size?.y || 0);
  const slots: TemplateSlot[] = [];

  const walk = (n: any) => {
    const p = parseSlotName(n?.name || '');
    if (p) {
      slots.push({
        id: p.id,
        type: n.type === 'TEXT' ? 'text' : 'image',
        variant: p.variant,
        optional: p.optional,
        list: p.list,
        nodeId: n.id,
        sample: n.type === 'TEXT' ? n.characters : undefined,
      });
    }
    for (const c of n?.children || []) walk(c);
  };
  for (const c of frame.children || []) walk(c);

  return {
    id: frame.id,
    name: String(frame.name).replace(/^\[Template\]\s*/, ''),
    width,
    height,
    aspect: aspectLabel(width, height),
    slots,
    // Variable NAMES require the Enterprise variables endpoint; the plugin scan
    // fills these. Listing surfaces the slots (what an agent needs to fill).
    variables: [],
  };
}

/** Walk a Figma REST `document` node → all `[Template]` manifests across pages. */
export function templatesFromDocument(document: any): TemplateManifest[] {
  const out: TemplateManifest[] = [];
  for (const page of document?.children || []) {
    for (const node of page?.children || []) {
      if (
        node?.type === 'FRAME' &&
        typeof node.name === 'string' &&
        node.name.startsWith('[Template]')
      ) {
        out.push(manifestFromFrame(node));
      }
    }
  }
  return out;
}

/** Fetch a Figma file via REST and return its `[Template]` manifests. */
export async function listFigmaTemplates(
  fileKey: string,
  token: string
): Promise<TemplateManifest[]> {
  const res = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    throw new Error(`Figma file fetch failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  const data: any = await res.json();
  return templatesFromDocument(data.document);
}
