/// <reference types="@figma/plugin-typings" />

/**
 * EXPORT_FRAMES_DATA — deterministic frame data export.
 *
 * Walks every frame in scope, collects ALL text layers (no token limit, no LLM
 * hallucination) keeping each layer's NAME, then serializes via the pure
 * formatter module to json / markdown / html / csv. Best-effort `fields` mapping
 * layers a structured schema on top of the always-complete `texts` array, so
 * nothing is ever lost.
 */

import {
  buildFields,
  formatExport,
  sanitizeFilename,
  type ExportFormat,
  type FrameRecord,
  type TextItem,
} from './exportFramesData.format';

export interface ExportResult {
  filename: string;
  content: string;
  mimeType: string;
  frameCount: number;
  format: ExportFormat;
}

function collectTexts(node: BaseNode, out: TextItem[]) {
  if ('visible' in node && !(node as SceneNode).visible) return;
  if (node.type === 'TEXT') {
    const t = (node as TextNode).characters.trim();
    if (t) out.push({ layer: node.name, text: t });
    return;
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) collectTexts(child, out);
  }
}

export async function exportFramesData(
  op: {
    format?: ExportFormat;
    scope?: 'selection' | 'page';
    nodeIds?: string[];
    fields?: string[];
    title?: string;
  },
  snapshotSelection?: readonly SceneNode[]
): Promise<ExportResult> {
  const format: ExportFormat = op.format ?? 'json';
  const fields = op.fields?.map((f) => f.trim()).filter(Boolean);

  // Resolve scope → root frames
  const selection = snapshotSelection ?? figma.currentPage.selection;
  let roots: readonly SceneNode[];
  if (op.nodeIds && op.nodeIds.length) {
    const resolved = await Promise.all(op.nodeIds.map((id) => figma.getNodeByIdAsync(id)));
    roots = resolved.filter((n): n is SceneNode => n !== null && 'children' in (n as any));
  } else if (op.scope === 'page') {
    roots = figma.currentPage.children;
  } else {
    roots = selection.length ? selection : figma.currentPage.children;
  }

  const records: FrameRecord[] = [];
  for (const root of roots) {
    const texts: TextItem[] = [];
    collectTexts(root, texts);
    const record: FrameRecord = {
      id: root.id,
      name: root.name,
      width: Math.round(root.width),
      height: Math.round(root.height),
      texts,
    };
    if (fields && fields.length) record.fields = buildFields(texts, fields);
    records.push(record);
  }

  const docName = figma.root.name || 'Figma';
  const title = op.title || docName;
  const { content, mimeType, ext } = formatExport(records, format, title, fields);

  return {
    filename: `${sanitizeFilename(title)}_frames.${ext}`,
    content,
    mimeType,
    frameCount: records.length,
    format,
  };
}
